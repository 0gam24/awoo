#!/usr/bin/env node
/**
 * ingest-analytics — 네이버 애널리틱스 "유입검색어" 7일치를 글 단위로 배분하고
 * 클래스×순위버킷 계수(1 데이터랩 포인트당 주간 유입)를 만든다.
 *
 * 왜 필요한가(계획 §0·§1-17·§4-0): 데이터랩 헤드값과 실유입의 상관은 Spearman 0.14다.
 * 헤드 1점당 주간 유입이 창원 8 ~ 고흥 528로 66배 갈리고, 같은 김해 안에서도 9~73으로
 * 8배 갈린다. 그래서 "시 15~60/pt" 같은 단일 계수는 버리고, 쿼리 클래스(군/시/전국/롤업/헤드)
 * × 순위 버킷(r1~2 / r3~5 / r6+ / null)로 쪼갠 계수를 실유입에서 역산한다.
 * 이 계수는 keyword-pipeline이 후보 점수(recent7 × min(openSlots,4) × 계수)를 낼 때 쓴다.
 *
 * 입력
 *   src/data/analytics/naver-analytics-search-*.json   최신 1건(파일명 정렬 마지막). --input=으로 지정 가능
 *   src/data/naver-ranks.json                           byQuery.latest.{rank,url} — 측정 쿼리의 순위·랜딩
 *   docs/ops/rank-targets.json                          query→url (운영자가 손으로 확정한 매핑, 최우선)
 *   src/data/regions.json                               지역 토큰(name·aliases·full). 인구 필드는 없음(→ 이름 접미사로 군/시 판정)
 *   src/data/issues/** /*.json                          제목·slug·태그·date (읽기만)
 *   --volumes=<파일>                                    `keyword-volume.mjs --json` 출력. rows[].recentRelative(=recent7)를
 *                                                       계수 분모로 쓴다. 이 스크립트는 API를 직접 부르지 않는다.
 *
 * 출력
 *   docs/ops/volume-scale.json  {meta, shares, coefficients, zeroCases, regions, queryMap}
 *     queryMap[] = {query, visits, url|null, class, rank|null, ...}  ← 묶음 간 계약.
 *       rank          = 네이버 SERP 순위(naver-ranks.json latest.rank, 미측정이면 null). 순위 버킷의 기준.
 *       analyticsRank = 애널리틱스 유입검색어 행 순번(1~). SERP 순위와 무관하다.
 *       naverRank     = rank와 같은 값(이전 소비자 호환용으로 남긴다).
 *   stdout                      한국어 요약
 *
 * 사용
 *   node scripts/ingest-analytics.mjs                       # 매핑·점유율만(계수 null)
 *   node scripts/ingest-analytics.mjs --emit-terms=40       # 상위 40 검색어를 한 줄에 하나씩 → keyword-volume --file= 입력용
 *   node scripts/keyword-volume.mjs --json --file=terms.txt > vol.json
 *   node scripts/ingest-analytics.mjs --volumes=vol.json    # 계수까지
 *   node scripts/ingest-analytics.mjs --dry-run             # 파일에 쓰지 않고 요약만
 *   --input= · --out= · --volumes= 는 절대경로면 그대로, 상대경로면 레포 루트 기준으로 푼다.
 *
 * 쿼리→글 매핑 우선순위(신뢰도)
 *   high  rank-targets.json url  →  naver-ranks.json latest.url
 *   med   지역 쿼리: 지역 후보 글 중 토큰 점수 단독 1위(후보 1건 포함)
 *         전국 쿼리: 토큰 점수 ≥0.5 단독 1위 + 제목 직접 히트 토큰 2개 이상(태그·prefix 히트는 안 친다)
 *   low   지역 쿼리 동점(앵커·패밀리A·최고령으로 고른 url + candidates)
 *         지역 쿼리에서 롤업 글(cluster-intents rollup:true)이 1위일 때 — 같은 지역의 high 앵커(region-rollup-vs-anchor)
 *         또는 비롤업 최고점 글(region-rollup-vs-post)로 바꾸고 candidates에 롤업을 병기한다. 롤업 제목의 '민생지원금'
 *         1.0이 정규본 제목의 '민생회복지원금' 0.75를 이겨 통영 346이 08-21 롤업에 붙던 것을 막는다(계획 §0: 08-21 롤업 귀속 0)
 *         전국 쿼리 제목 직접 히트가 4글자 이상 토큰 1개뿐(url + candidates)
 *   null  못 찾음. 전국 쿼리의 동점(title-tie)·약한 겹침(title-weak)은 url을 넣지 않고 candidates만 남긴다
 *         — 예전엔 '추석 정부지원금'→청년내일저축계좌처럼 아무 글이나 붙어 글 단위 귀속을 오염시켰다
 *   meta.mapping.urlRate는 url이 있는 행 비율(low 포함), urlRateHighMed는 high+med만. 성공률 보고는 후자를 쓴다.
 *
 * 점유율의 분모: 애널리틱스는 상위 170행(81~90위 스크린샷 누락 → 160행)만 있다. 검색유입 34,314 중
 * 상위 행 합계는 "(검색어 없음)"을 빼면 약 34%다. 아래 모든 %는 그 상위 행 기준이며 전체가 아니다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { issueUrlPath } from '../src/lib/issue-url.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIOME_BIN = join(ROOT, 'node_modules', '@biomejs', 'biome', 'bin', 'biome');
const ANALYTICS_DIR = join(ROOT, 'src', 'data', 'analytics');
const ISSUES_DIR = join(ROOT, 'src', 'data', 'issues');
const RANKS_FILE = join(ROOT, 'src', 'data', 'naver-ranks.json');
const TARGETS_FILE = join(ROOT, 'docs', 'ops', 'rank-targets.json');
const REGIONS_FILE = join(ROOT, 'src', 'data', 'regions.json');
const OUT_FILE = join(ROOT, 'docs', 'ops', 'volume-scale.json');
/** 있으면 읽는다(다른 묶음 소유) — 지역 글 목록·패밀리(A/B/V) 동점 해소에만 쓴다. 없어도 동작 */
const INTENTS_FILE = join(ROOT, 'docs', 'ops', 'cluster-intents.json');

/** 애널리틱스가 "(검색어 없음)"으로 표기하는 행 */
const NONE_QUERY = '(검색어 없음)';

/**
 * regions.json에 없는데 유입검색어·계획 §5에 등장하는 지역. full의 접미사로 군/시/도를 판정한다.
 * 인구는 regions.json에 없어 확인 불가 — 군/시 분류는 이름 기준이다(문경시 등 10만 미만 시는 '시'로 남는다).
 */
const EXTRA_REGIONS = [
  { id: 'jangheung', name: '장흥', full: '전남 장흥군', aliases: ['장흥군'] },
  { id: 'gangneung', name: '강릉', full: '강원 강릉시', aliases: ['강릉시'] },
  { id: 'changwon', name: '창원', full: '경남 창원시', aliases: ['창원시'] },
  { id: 'cheongju', name: '청주', full: '충북 청주시', aliases: ['청주시'] },
  { id: 'gwangyang', name: '광양', full: '전남 광양시', aliases: ['광양시'] },
  { id: 'uljin', name: '울진', full: '경북 울진군', aliases: ['울진군'] },
  { id: 'yeongam', name: '영암', full: '전남 영암군', aliases: ['영암군'] },
  { id: 'yangsan', name: '양산', full: '경남 양산시', aliases: ['양산시'] },
  { id: 'ganghwa', name: '강화', full: '인천 강화군', aliases: ['강화군'] },
  { id: 'jangseong', name: '장성', full: '전남 장성군', aliases: ['장성군'] },
  { id: 'daegu', name: '대구', full: '대구광역시', aliases: ['대구광역시', '대구시'] },
  { id: 'jeonnam', name: '전남', full: '전라남도', aliases: ['전라남도'] },
  { id: 'jeonbuk', name: '전북', full: '전북특별자치도', aliases: ['전라북도'] },
  { id: 'gyeongbuk', name: '경북', full: '경상북도', aliases: ['경상북도'] },
  { id: 'chungbuk', name: '충북', full: '충청북도', aliases: ['충청북도'] },
  { id: 'chungnam', name: '충남', full: '충청남도', aliases: ['충청남도'] },
  { id: 'gangwon', name: '강원', full: '강원특별자치도', aliases: ['강원도'] },
];

/** 민생 클러스터 어휘 — 지역 쿼리를 "민생×지역"으로 세는 조건, 지역 없는 쿼리를 "헤드"로 세는 조건 */
const MINSAENG_RE = /민생|재난지원금|쿠폰|추석|상품권|고시공고/;
/** 지역 쿼리에 붙었을 때 민생 클러스터로 인정하는 완화 어휘(지원금·10만원 등). 지역 토큰이 있을 때만 쓴다 */
const REGIONAL_LOOSE_RE = /지원금|만원|지급|신청/;
/** 롤업 어휘 — 지역별·지자체·전국 */
const ROLLUP_RE = /지역별|지자체|전국|우리지역/;
/** 제목 매칭에서 무시하는 범용 토큰 */
const STOP_TOKENS = new Set([
  '지원금',
  '신청',
  '방법',
  '대상',
  '기준',
  '조건',
  '금액',
  '지급',
  '2026',
  '2027',
]);

const CLASSES = {
  gun: '군 — 지역 토큰이 군(인구 확인 불가 → 이름 접미사 기준)',
  si: '시 — 지역 토큰이 시',
  do: '도·광역 — 지역 토큰이 도/광역시(민생×지역 점유에는 넣지 않는다)',
  rollup: '롤업 — 지역 없이 지역별·지자체·전국 어휘',
  head: "헤드 — 지역 없이 '민생지원금'·'4차'·'추석' 단독 류",
  national: '전국 — 근로장려금·실업급여·주휴수당·기초연금 등 제도 쿼리',
  none: '(검색어 없음)',
};
const RANK_BUCKETS = ['r1-2', 'r3-5', 'r6+', 'null'];

const round = (v, d = 2) =>
  v == null || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d;
const pct = (a, b) => (b ? round((a / b) * 100, 1) : null);
const stripSpace = (s) => String(s).replace(/\s+/g, '');
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function latestAnalyticsFile() {
  const names = (await readdir(ANALYTICS_DIR))
    .filter((n) => /^naver-analytics-search-.*\.json$/.test(n))
    .sort();
  if (!names.length) throw new Error(`유입검색어 파일 없음: ${ANALYTICS_DIR}`);
  return join(ANALYTICS_DIR, names[names.length - 1]);
}

/** 절대/상대 URL을 사이트 상대 경로로. 자사 URL이 아니면 null */
function toPath(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('/')) return url;
  try {
    const u = new URL(url);
    return u.hostname.endsWith('awoo.or.kr') ? u.pathname : null;
  } catch {
    return null;
  }
}

function regionLevel(full) {
  if (/(광역시|특별시|특별자치시|특별자치도|도)$/.test(full)) return 'do';
  if (/군$/.test(full)) return 'gun';
  if (/시$/.test(full)) return 'si';
  return 'si';
}

/** 지역 토큰 표: [{id,name,level,tokens[]}] — 긴 토큰 먼저, 시·군을 도보다 먼저 */
function buildRegionTable(regions) {
  const seen = new Set();
  const list = [];
  for (const r of [...regions, ...EXTRA_REGIONS]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const tokens = [...new Set([r.name, ...(r.aliases ?? [])])].sort((a, b) => b.length - a.length);
    list.push({ id: r.id, name: r.name, full: r.full, level: regionLevel(r.full), tokens });
  }
  return list;
}

/** 쿼리에서 가장 구체적인 지역 1개를 찾는다(시·군 우선, 그다음 도). "경남고성추석민생지원금"처럼 붙어 있어도 잡는다 */
function matchRegion(query, table) {
  const q = stripSpace(query);
  let best = null;
  for (const r of table) {
    for (const t of r.tokens) {
      const idx = q.indexOf(t);
      if (idx < 0) continue;
      const prio = r.level === 'do' ? 1 : 0;
      if (!best || prio < best.prio || (prio === best.prio && idx < best.idx)) {
        best = { region: r, token: t, idx, prio };
      }
      break;
    }
  }
  return best ? { region: best.region, token: best.token } : null;
}

function classify(query, table) {
  if (query === NONE_QUERY) return { cls: 'none', region: null, minsaeng: false };
  const hit = matchRegion(query, table);
  const q = stripSpace(query);
  if (hit && hit.region.level !== 'do') {
    const minsaeng = MINSAENG_RE.test(q) || REGIONAL_LOOSE_RE.test(q);
    return { cls: hit.region.level, region: hit.region, minsaeng };
  }
  if (hit) return { cls: 'do', region: hit.region, minsaeng: MINSAENG_RE.test(q) };
  if (ROLLUP_RE.test(q) && MINSAENG_RE.test(q))
    return { cls: 'rollup', region: null, minsaeng: true };
  if (MINSAENG_RE.test(q)) return { cls: 'head', region: null, minsaeng: true };
  return { cls: 'national', region: null, minsaeng: false };
}

/** 점유율 버킷: 민생×지역 / 롤업 / 헤드 / 전국 / 검색어 없음 / 기타 */
function shareBucket(c) {
  if (c.cls === 'none') return 'none';
  if ((c.cls === 'gun' || c.cls === 'si') && c.minsaeng) return 'minsaengRegional';
  if (c.cls === 'rollup') return 'rollup';
  if (c.cls === 'head') return 'head';
  if (c.cls === 'national') return 'national';
  return 'other';
}

function rankBucket(rank) {
  if (rank == null) return 'null';
  if (rank <= 2) return 'r1-2';
  if (rank <= 5) return 'r3-5';
  return 'r6+';
}

async function loadIssues() {
  const out = [];
  const days = (await readdir(ISSUES_DIR, { withFileTypes: true })).filter((d) => d.isDirectory());
  for (const d of days) {
    const dir = join(ISSUES_DIR, d.name);
    for (const f of await readdir(dir)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      let j;
      try {
        j = await readJson(join(dir, f));
      } catch {
        continue;
      }
      if (!j.slug || !j.title) continue;
      const date = j.date ?? d.name;
      out.push({
        slug: j.slug,
        title: j.title,
        date,
        url: issueUrlPath(date, j.slug),
        tags: Array.isArray(j.tags) ? j.tags : [],
        titleHay: stripSpace(j.title),
        tagHay: stripSpace((Array.isArray(j.tags) ? j.tags : []).join(' ')),
      });
    }
  }
  out.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : a.date < b.date ? -1 : 1));
  return out;
}

/** 쿼리 토큰(공백·가운뎃점 분리, 범용어·1글자 제외). 지역 토큰은 호출자가 뺀다 */
function queryTokens(query, dropTokens = []) {
  const drop = new Set([...STOP_TOKENS, ...dropTokens]);
  return query
    .split(/[\s·,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !drop.has(t) && !/^\d{2,4}년?$/.test(t));
}

/**
 * 토큰이 제목·태그에 얼마나 겹치나(0~1). 제목 1.0 > 태그 0.6 > 민생 변형(민생지원금≈민생안정·민생회복지원금) 0.75
 * > 앞 2글자 prefix(계산기→계산) 0.4. 제목을 태그보다 무겁게 두어 태그 남발로 생기는 동점을 줄인다.
 */
function scorePost(post, tokens) {
  if (!tokens.length) return 0;
  // 긴 토큰(중위소득)이 짧은 토큰(계산)보다 무겁다 — 2글자 0.5, 3글자 0.75, 4글자 이상 1.0
  let s = 0;
  let wsum = 0;
  for (const t of tokens) {
    const w = Math.min(t.length, 4) / 4;
    wsum += w;
    if (post.titleHay.includes(t)) s += w;
    else if (t.startsWith('민생') && /민생[가-힣]*지원금/.test(post.titleHay)) s += 0.75 * w;
    else if (post.tagHay.includes(t)) s += 0.6 * w;
    else if (t.length >= 3 && post.titleHay.includes(t.slice(0, 2))) s += 0.4 * w;
  }
  return wsum ? s / wsum : 0;
}

/** 제목에 그대로 들어 있는 토큰(태그·민생 변형·prefix 히트는 제외). 지역 없는 쿼리의 url 확정 조건에 쓴다 */
function titleDirectHits(post, tokens) {
  return tokens.filter((t) => post.titleHay.includes(t));
}

/** oldestFirst: 지역 쿼리는 정규본(A, 보통 첫 글)이 랜딩일 확률이 높아 오래된 글 우선. 전국 쿼리는 최신 글 우선 */
function pickBest(cands, tokens, oldestFirst = false) {
  const scored = cands
    .map((p) => ({ post: p, score: scorePost(p, tokens) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.post.date === b.post.date ? 0 : a.post.date < b.post.date === oldestFirst ? -1 : 1),
    );
  const top = scored[0];
  if (!top) return null;
  const ties = scored.filter((x) => x.score === top.score);
  return { top, ties, scored };
}

/** 제목에 지역 토큰이 있는가 */
function regionTitleHit(region, post) {
  return region.tokens.some((t) => post.titleHay.includes(t));
}

/**
 * 지역의 후보 글: 제목에 지역 토큰이 있는 글(태그는 안 본다 — 태그 남발로 타 지역 글이 섞인다)
 * + cluster-intents가 그 지역으로 등록한 글. 주간 묶음 글(new-subsidies-weekly-*)은 뺀다.
 * 레지스트리로만 들어온 글(제목에 지역명 없음 — 예: 영동 제목 글이 region[]에 고성·의성을 나열)은
 * regionsOut·0 사례에서 viaRegistry:true로 구분한다. 그 지역의 "이번 물결 글"로 치지 않기 위해서다.
 */
function regionPosts(region, ctx) {
  const { issues, intentRegionSlugs } = ctx;
  // 롤업(rollup:true) 글은 제목에 지역명이 있을 때만 후보 — 레지스트리의 region[] 나열만으로는 안 넣는다
  const fromIntents = intentRegionSlugs.get(region.name) ?? new Set();
  return issues.filter(
    (p) =>
      !p.slug.startsWith('new-subsidies-weekly') &&
      (regionTitleHit(region, p) || fromIntents.has(p.slug)),
  );
}

/**
 * 쿼리→글. 반환 {url, slug, confidence, source, candidates?}
 * regionAnchor: 같은 지역에서 high로 확정된 url(동점 해소용)
 */
function mapQuery(row, c, ctx) {
  const {
    targetsByQuery,
    ranksByQuery,
    issues,
    issuesByUrl,
    regionAnchor,
    intentFamily,
    intentRollup,
  } = ctx;
  const t = targetsByQuery.get(row.query);
  if (t?.url) {
    const p = issuesByUrl.get(t.url);
    return { url: t.url, slug: p?.slug ?? null, confidence: 'high', source: 'rank-targets' };
  }
  const r = ranksByQuery.get(row.query);
  const rUrl = toPath(r?.url);
  if (rUrl) {
    const p = issuesByUrl.get(rUrl);
    return { url: rUrl, slug: p?.slug ?? null, confidence: 'high', source: 'naver-ranks' };
  }
  if (c.cls === 'none') return { url: null, slug: null, confidence: null, source: null };

  if (c.region) {
    const cands = regionPosts(c.region, ctx);
    if (!cands.length)
      return { url: null, slug: null, confidence: null, source: 'no-post-for-region' };
    const tokens = queryTokens(row.query, c.region.tokens);
    const best = pickBest(cands, tokens, true);
    const isRollup = (p) => intentRollup.has(p.slug);
    // 롤업 글(cluster-intents rollup:true)이 어휘만으로 지역 정규본을 이기면 안 된다.
    // 08-21 롤업 제목 '추석 지자체 민생지원금 …'은 '민생지원금' 직접 히트 1.0, 통영 A글 제목 '통영 민생회복지원금 …'은
    // 변형 가중 0.75라 동점이 아니어서 통영 앵커가 쓰이지 않았다(통영 4쿼리 346이 롤업에 귀속). 계획 §0은 08-21 롤업
    // 귀속 0으로 봤으므로, 롤업이 1위면 같은 지역 high 앵커 → 없으면 점수>0 비롤업 최고점 글로 바꾸고 low로 내린다.
    if (isRollup(best.top.post)) {
      const anchor = regionAnchor.get(c.region.id);
      const nonRollup = best.scored.filter((x) => !isRollup(x.post));
      const anchored = anchor ? nonRollup.find((x) => x.post.url === anchor) : null;
      const fallback = nonRollup.find((x) => x.score > 0);
      const chosen = anchored ?? fallback;
      if (chosen) {
        const candidates = [
          ...new Set([best.top.post.url, ...nonRollup.slice(0, 3).map((x) => x.post.url)]),
        ];
        return {
          url: chosen.post.url,
          slug: chosen.post.slug,
          confidence: 'low',
          source: anchored ? 'region-rollup-vs-anchor' : 'region-rollup-vs-post',
          candidates,
        };
      }
    }
    if (cands.length === 1 || (best.ties.length === 1 && best.top.score > 0)) {
      return {
        url: best.top.post.url,
        slug: best.top.post.slug,
        confidence: 'med',
        source: cands.length === 1 ? 'region-single-post' : 'region-title-tokens',
      };
    }
    // 동점: high 앵커 → cluster-intents 패밀리 A → 가장 오래된 글(정규본일 확률)
    const tieUrls = best.ties.map((x) => x.post.url);
    const anchor = regionAnchor.get(c.region.id);
    // 롤업 항목도 family A라서 비롤업 A만 정규본으로 친다
    const familyA = best.ties.find(
      (x) => intentFamily.get(x.post.slug) === 'A' && !isRollup(x.post),
    )?.post;
    let pick = best.top.post;
    let source = 'region-tie-oldest';
    if (anchor && tieUrls.includes(anchor)) {
      pick = issuesByUrl.get(anchor);
      source = 'region-anchor-tie';
    } else if (familyA) {
      pick = familyA;
      source = 'region-familyA-tie';
    }
    return { url: pick.url, slug: pick.slug, confidence: 'low', source, candidates: tieUrls };
  }

  // 지역 없는 쿼리(전국 제도·헤드): 제목이 직접 말해 줄 때만 url을 확정한다.
  // 태그·prefix 겹침만으로 붙이면 '2026 재난지원금'→고수온 재난지원금, '직장인 지원금'→국민연금 상한처럼
  // 엉뚱한 글에 귀속되므로, 못 고르면 url null + candidates로 남긴다(사양 "못 하면 null").
  const tokens = queryTokens(row.query);
  const best = pickBest(issues, tokens);
  if (!best || best.top.score === 0)
    return { url: null, slug: null, confidence: null, source: 'no-token-match' };
  const candidates = best.ties.slice(0, 5).map((x) => x.post.url);
  if (best.ties.length > 1)
    return { url: null, slug: null, confidence: null, source: 'title-tie', candidates };
  const hits = titleDirectHits(best.top.post, tokens);
  if (best.top.score >= 0.5 && hits.length >= 2) {
    return {
      url: best.top.post.url,
      slug: best.top.post.slug,
      confidence: 'med',
      source: 'title-tokens',
    };
  }
  // 직접 히트가 1개뿐이면 4글자 이상 복합명사(아이맞이지원금·혼인지원금)만 인정. '직장인'·'계산' 같은
  // 2~3글자 일반명사 1개는 글을 특정하지 못한다
  if (best.top.score >= 0.5 && hits.length === 1 && hits[0].length >= 4) {
    return {
      url: best.top.post.url,
      slug: best.top.post.slug,
      confidence: 'low',
      source: 'title-single-token',
      candidates,
    };
  }
  return { url: null, slug: null, confidence: null, source: 'title-weak', candidates };
}

/** keyword-volume --json 출력을 term→row로. recent7는 row.recent7 ?? row.recentRelative */
async function loadVolumes(file) {
  if (!file) return null;
  const j = await readJson(file);
  const rows = Array.isArray(j) ? j : (j.rows ?? []);
  const map = new Map();
  for (const r of rows) {
    if (!r?.term) continue;
    const recent7 = r.recent7 ?? r.recentRelative ?? null;
    const measured = r.measured ?? !(r.relative === 0 && recent7 == null);
    map.set(stripSpace(r.term), { ...r, recent7, measured });
  }
  return { file, benchmark: j.benchmark ?? null, mode: j.mode ?? null, rows: map, raw: rows };
}

/** 레포 안 파일이면 레포 기준 상대경로, 밖이면 파일명만(행은 volumesUsed에 내장). 상대경로로 받아도 절대경로로 판정한다 */
function describeVolumesFile(file) {
  const abs = resolve(ROOT, file);
  const rel = relative(ROOT, abs);
  const outside = rel.startsWith('..') || isAbsolute(rel);
  return outside ? `${basename(abs)} (레포 밖 — 행은 volumesUsed에 내장)` : rel.replace(/\\/g, '/');
}

function buildRegionAnchors(rows, issuesByUrl) {
  // high 매핑(rank-targets·naver-ranks)이 가리키는 지역별 url — 동점 해소에만 쓴다
  const anchor = new Map();
  for (const r of rows) {
    if (
      r.confidence === 'high' &&
      r.regionId &&
      r.url &&
      issuesByUrl.has(r.url) &&
      !anchor.has(r.regionId)
    ) {
      anchor.set(r.regionId, r.url);
    }
  }
  return anchor;
}

/**
 * biome가 있으면 산출 JSON을 저장소 규칙대로 정돈한다. JSON.stringify는 짧은 배열도 여러 줄로 쓰는데
 * biome 포맷터는 한 줄로 접어서, 재생성할 때마다 CI `biome check .`가 실패했다(2026-09-10).
 * 없거나 실패하면 그대로 둔다 — 커밋 전 `npx biome format --write`로 잡는다.
 */
function formatWithBiome(file) {
  if (!existsSync(BIOME_BIN)) return;
  try {
    execFileSync(process.execPath, [BIOME_BIN, 'format', '--write', file], {
      stdio: 'ignore',
      timeout: 60_000,
    });
  } catch {
    /* 포맷 실패는 치명적이지 않다 */
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const dryRun = argv.includes('--dry-run');
  const jsonOnly = argv.includes('--json');
  const emitTerms = arg('emit-terms');
  // 경로 옵션 3종은 같은 규칙: 절대경로면 그대로, 상대경로면 레포 루트 기준
  const inputFile = arg('input') ? resolve(ROOT, arg('input')) : await latestAnalyticsFile();
  const outFile = arg('out') ? resolve(ROOT, arg('out')) : OUT_FILE;
  const volumesFile = arg('volumes') ? resolve(ROOT, arg('volumes')) : null;

  const analytics = await readJson(inputFile);
  const keywords = (analytics.keywords ?? []).map((k) => ({
    rank: k.rank ?? null,
    query: String(k.keyword ?? k.query ?? '').trim(),
    visits: Number(k.visits ?? 0),
  }));
  if (!keywords.length) throw new Error(`keywords[] 비어 있음: ${inputFile}`);

  if (emitTerms) {
    const n = Number(emitTerms) || 40;
    for (const k of keywords.filter((x) => x.query !== NONE_QUERY).slice(0, n))
      console.log(k.query);
    return;
  }

  const [ranks, targets, regions, issues, volumes, intents] = await Promise.all([
    readJson(RANKS_FILE).catch(() => ({ byQuery: {} })),
    readJson(TARGETS_FILE).catch(() => ({ targets: [] })),
    readJson(REGIONS_FILE).catch(() => []),
    loadIssues(),
    loadVolumes(volumesFile),
    readJson(INTENTS_FILE).catch(() => null),
  ]);
  // cluster-intents(있을 때만): slug→family, 지역명→slug 집합
  const intentFamily = new Map();
  const intentRegionSlugs = new Map();
  /** rollup:true 글의 slug — 지역 쿼리 매핑에서 정규본보다 뒤로 민다 */
  const intentRollup = new Set();
  for (const e of intents?.entries ?? []) {
    if (!e?.slug) continue;
    intentFamily.set(e.slug, e.family ?? null);
    if (e.rollup) {
      intentRollup.add(e.slug);
      continue;
    }
    for (const name of e.region ?? []) {
      const set = intentRegionSlugs.get(name) ?? new Set();
      set.add(e.slug);
      intentRegionSlugs.set(name, set);
    }
  }

  const table = buildRegionTable(Array.isArray(regions) ? regions : []);
  const targetsByQuery = new Map((targets.targets ?? []).map((t) => [t.query, t]));
  const ranksByQuery = new Map(
    Object.entries(ranks.byQuery ?? {}).map(([q, v]) => {
      const hist = Array.isArray(v.history) ? v.history : [];
      const last = hist[hist.length - 1] ?? {};
      const latest = v.latest ?? {};
      return [
        q,
        {
          rank: latest.rank ?? last.rank ?? null,
          url: latest.url ?? null,
          date: last.date ?? null,
          measured: hist.length > 0 || Boolean(v.latest),
        },
      ];
    }),
  );
  const issuesByUrl = new Map(issues.map((p) => [p.url, p]));

  // 1차: 분류 + high 매핑 → 지역 앵커 → 2차: 나머지 매핑
  const rows = keywords.map((k) => {
    const c = classify(k.query, table);
    const rk = ranksByQuery.get(k.query);
    return {
      ...k,
      cls: c.cls,
      regionId: c.region?.id ?? null,
      region: c.region?.name ?? null,
      share: shareBucket(c),
      naverRank: rk?.rank ?? null,
      rankMeasured: Boolean(rk?.measured),
      rankDate: rk?.date ?? null,
      _c: c,
    };
  });
  const ctxHigh = {
    targetsByQuery,
    ranksByQuery,
    issues,
    issuesByUrl,
    regionAnchor: new Map(),
    intentFamily,
    intentRollup,
    intentRegionSlugs,
  };
  for (const r of rows) {
    const m = mapQuery(r, { cls: 'none' }, ctxHigh); // high만(지역 매칭은 cls none으로 막는다)
    if (m.confidence === 'high') Object.assign(r, m);
  }
  const regionAnchor = buildRegionAnchors(rows, issuesByUrl);
  const ctx = { ...ctxHigh, regionAnchor };
  for (const r of rows) {
    if (r.confidence === 'high') continue;
    Object.assign(r, mapQuery(r, r._c, ctx));
  }

  // 계수 재료: recent7(데이터랩, 실업급여=100) → perPoint = visits ÷ recent7
  for (const r of rows) {
    const v = volumes?.rows.get(stripSpace(r.query)) ?? null;
    r.recent7 = v?.recent7 ?? null;
    r.volumeMeasured = v ? v.measured : null;
    r.born = v?.born ?? null;
    r.perPoint = r.recent7 ? round(r.visits / r.recent7, 1) : null;
    r.rankBucket = rankBucket(r.naverRank);
  }

  // 점유율
  const totalTop = rows.reduce((s, r) => s + r.visits, 0);
  const noneVisits = rows.filter((r) => r.share === 'none').reduce((s, r) => s + r.visits, 0);
  const totalExNone = totalTop - noneVisits;
  const shares = {};
  for (const b of ['minsaengRegional', 'rollup', 'head', 'national', 'none', 'other']) {
    const rs = rows.filter((r) => r.share === b);
    const visits = rs.reduce((s, r) => s + r.visits, 0);
    shares[b] = {
      visits,
      queries: rs.length,
      pct: b === 'none' ? null : pct(visits, totalExNone),
      pctIncludingNone: pct(visits, totalTop),
      pctOfSearchInbound: pct(visits, analytics.summary?.searchInbound),
    };
  }
  const regPlusRoll = shares.minsaengRegional.visits + shares.rollup.visits;
  const regPlusRollHead = regPlusRoll + shares.head.visits;
  shares.combined = {
    minsaengRegionalPlusRollup: { visits: regPlusRoll, pct: pct(regPlusRoll, totalExNone) },
    minsaengAll: {
      visits: regPlusRollHead,
      pct: pct(regPlusRollHead, totalExNone),
      note: '민생×지역 + 롤업 + 헤드. 계획 §0의 "61%+20%=81%"는 이 합에 해당한다(헤드가 롤업 쪽에 섞여 있었다)',
    },
  };

  // 클래스 × 순위버킷 계수
  const coefficients = [];
  for (const cls of Object.keys(CLASSES)) {
    if (cls === 'none') continue;
    for (const bucket of RANK_BUCKETS) {
      const cell = rows.filter((r) => r.cls === cls && r.rankBucket === bucket);
      if (!cell.length) continue;
      const withVol = cell.filter((r) => r.perPoint != null);
      const pts = withVol.map((r) => r.perPoint);
      const visits = cell.reduce((s, r) => s + r.visits, 0);
      const note = withVol.length
        ? `${withVol.map((r) => `${r.query} ${r.perPoint}`).join(' · ')}`
        : volumes
          ? '셀 안 쿼리에 recent7 없음(--volumes에 미포함 또는 무응답)'
          : 'recent7 없음 — --volumes 미지정';
      coefficients.push({
        class: cls,
        rankBucket: bucket,
        perPoint: pts.length ? round(median(pts), 1) : null,
        perPointMean: pts.length ? round(pts.reduce((s, v) => s + v, 0) / pts.length, 1) : null,
        perPointRange: pts.length ? [round(Math.min(...pts), 1), round(Math.max(...pts), 1)] : null,
        n: pts.length,
        queries: cell.length,
        visits,
        note,
      });
    }
  }

  // 지역 요약: 지역별 유입·쿼리 수·헤드형(X군 민생지원금 + X 민생지원금) 비중·최고 순위·글 목록
  const regionRows = new Map();
  for (const r of rows) {
    if (!r.regionId) continue;
    const g = regionRows.get(r.regionId) ?? { visits: 0, queries: [], best: null };
    g.visits += r.visits;
    g.queries.push(r);
    if (r.naverRank != null && (g.best == null || r.naverRank < g.best)) g.best = r.naverRank;
    regionRows.set(r.regionId, g);
  }
  const regionsOut = [];
  for (const reg of table) {
    // 지역 글 목록: 제목에 (민생|지원금). 도 단위·주간 묶음은 0 사례에서 뺀다.
    // minsaengTitle = 제목이 민생 클러스터 어휘(MINSAENG_RE)에 걸리는가 — postNoTraffic 0 사례는 이 글만 센다
    // (버팀이음 근속유지지원금·피해지원금처럼 '지원금'만 걸리는 글은 민생 클러스터가 아니다).
    // viaRegistry = 제목에 지역명 없이 cluster-intents region[] 나열로만 들어온 글.
    const posts = regionPosts(reg, ctx).filter(
      (p) => reg.level !== 'do' && (MINSAENG_RE.test(p.titleHay) || /지원금/.test(p.titleHay)),
    );
    const g = regionRows.get(reg.id);
    if (!g && !posts.length) continue;
    const headForms =
      reg.level === 'do'
        ? []
        : [`${reg.name}${reg.level === 'gun' ? '군' : '시'}민생지원금`, `${reg.name}민생지원금`];
    const headRows = (g?.queries ?? []).filter((q) => headForms.includes(stripSpace(q.query)));
    const headVisits = headRows.reduce((sum, q) => sum + q.visits, 0);
    regionsOut.push({
      region: reg.name,
      id: reg.id,
      level: reg.level,
      visits: g?.visits ?? 0,
      queries: g?.queries.length ?? 0,
      headForms,
      headVisits,
      headShare: headForms.length && g?.visits ? pct(headVisits, g.visits) : null,
      bestRank: g?.best ?? null,
      mappedUrls: [...new Set((g?.queries ?? []).map((q) => q.url).filter(Boolean))],
      posts: posts.map((p) => ({
        slug: p.slug,
        date: p.date,
        url: p.url,
        family: intentFamily.get(p.slug) ?? null,
        minsaengTitle: MINSAENG_RE.test(p.titleHay),
        ...(regionTitleHit(reg, p) ? {} : { viaRegistry: true }),
      })),
    });
  }
  regionsOut.sort((a, b) => b.visits - a.visits || a.region.localeCompare(b.region, 'ko'));

  // 0 사례: 글은 있는데 상위 행에 유입 0 / 글 없이 유입 / 순위 있는데 유입 0
  const zeroCases = [];
  // 애널리틱스 기간 시작 60일 전보다 오래된 글은 "이번 물결의 글"로 치지 않는다(고성 5월 글 vs 9월 유입)
  const freshCut = analytics.period?.from
    ? new Date(new Date(analytics.period.from).getTime() - 60 * 86400000).toISOString().slice(0, 10)
    : '0000-00-00';
  for (const rg of regionsOut) {
    if (rg.level === 'do') continue;
    // 제목에 지역명이 있는 글만 그 지역의 글로 센다. 레지스트리로만 들어온 글은 note에 병기
    const own = rg.posts.filter((p) => !p.viaRegistry);
    const viaRegistry = rg.posts.filter((p) => p.viaRegistry);
    const fresh = own.filter((p) => p.date >= freshCut);
    const registryFresh = viaRegistry.filter((p) => p.date >= freshCut);
    const registryNote = registryFresh.length
      ? ` 레지스트리 등록 글만 있음(제목에 ${rg.region} 없음): ${registryFresh.map((p) => `${p.slug} (${p.date})`).join(', ')}`
      : '';
    // postNoTraffic은 민생 클러스터 글(제목 MINSAENG_RE 히트)만 — 근속유지지원금·피해지원금 글은 대상이 아니다
    const ownMinsaeng = own.filter((p) => p.minsaengTitle);
    if (ownMinsaeng.length && rg.visits === 0) {
      const rq = [...ranksByQuery.entries()].find(([q]) => stripSpace(q).includes(rg.region));
      zeroCases.push({
        type: 'postNoTraffic',
        region: rg.region,
        posts: ownMinsaeng.map((p) => p.slug),
        rank: rq ? rq[1].rank : null,
        rankNote: rq
          ? `naver-ranks "${rq[0]}"`
          : '순위 확인 불가 — naver-ranks·rank-targets에 이 지역 쿼리 없음',
        note: '상위 행(약 34%)에 이 지역 쿼리가 한 건도 없다. 순위가 있어도 유입 0일 수 있다는 사례',
      });
    } else if (!own.length && rg.visits > 0) {
      zeroCases.push({
        type: 'trafficNoPost',
        region: rg.region,
        visits: rg.visits,
        queries: rg.queries,
        ...(viaRegistry.length
          ? { registryOnlyPosts: viaRegistry.map((p) => `${p.slug} (${p.date})`) }
          : {}),
        note: `대응 글 없이 들어온 유입 — 허브·롤업이 대신 받는다. 발행 후보 신호.${registryNote}`,
      });
    } else if (!fresh.length && rg.visits > 0) {
      zeroCases.push({
        type: 'trafficNoFreshPost',
        region: rg.region,
        visits: rg.visits,
        queries: rg.queries,
        stalePosts: own.map((p) => `${p.slug} (${p.date})`),
        ...(registryFresh.length
          ? { registryOnlyPosts: registryFresh.map((p) => `${p.slug} (${p.date})`) }
          : {}),
        note: `이번 물결 글 없음(${freshCut} 이전 글만). 유입은 옛 글·허브가 받는다. 발행 후보 신호.${registryNote}`,
      });
    }
  }
  for (const r of rows) {
    if (r.recent7 != null && r.recent7 > 0 && r.visits === 0) {
      zeroCases.push({
        type: 'volumeNoTraffic',
        query: r.query,
        recent7: r.recent7,
        rank: r.naverRank,
      });
    }
  }
  if (volumes) {
    for (const [, v] of volumes.rows) {
      const q = stripSpace(v.term);
      if (!v.measured || !(v.recent7 > 0)) continue; // 무응답은 0 사례가 아니라 미측정
      if (rows.some((r) => stripSpace(r.query) === q)) continue;
      const hit = matchRegion(v.term, table);
      const regionVisits = hit ? (regionRows.get(hit.region.id)?.visits ?? 0) : null;
      zeroCases.push({
        type: 'volumeNoTraffic',
        query: v.term,
        recent7: v.recent7,
        rank: ranksByQuery.get(v.term)?.rank ?? null,
        region: hit?.region.name ?? null,
        regionVisits,
        note:
          regionVisits > 0
            ? '이 쿼리 문자열은 상위 행에 없지만 같은 지역의 다른 변형이 유입을 받는다(변형 분산)'
            : '데이터랩 값은 있는데 상위 행에 유입 0 — 순위가 있어도 실유입이 안 붙는 사례(의령형)',
      });
    }
  }

  // 매핑 성적
  const conf = { high: 0, med: 0, low: 0, null: 0 };
  for (const r of rows) conf[r.confidence ?? 'null'] += 1;
  const mappable = rows.filter((r) => r.share !== 'none');
  const visitsMapped = mappable.filter((r) => r.url).reduce((s, r) => s + r.visits, 0);
  const visitsMappable = mappable.reduce((s, r) => s + r.visits, 0);
  const isHighMed = (r) => r.confidence === 'high' || r.confidence === 'med';
  const visitsMappedHighMed = mappable.filter(isHighMed).reduce((s, r) => s + r.visits, 0);

  const searchInbound = analytics.summary?.searchInbound ?? null;
  const pv = analytics.summary?.pageviews ?? null;
  const visits = analytics.summary?.visits ?? null;
  const coveragePctExNone = pct(totalExNone, searchInbound);
  const coveragePct = pct(totalTop, searchInbound);

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: relative(ROOT, inputFile).replace(/\\/g, '/'),
      sourceNote: analytics._source ?? null,
      period: analytics.period ?? null,
      summary: analytics.summary ?? null,
      topRows: rows.length,
      topRowsVisits: totalTop,
      topRowsVisitsExNone: totalExNone,
      coverageNote: `상위170 기준, 전체의 34% (실측: 검색어 없음 제외 ${totalExNone.toLocaleString('ko-KR')}/${(searchInbound ?? 0).toLocaleString('ko-KR')} = ${coveragePctExNone}%, 포함 ${coveragePct}%)`,
      coverage: {
        searchInbound,
        topRowsVisitsExNone: totalExNone,
        pctExNone: coveragePctExNone,
        pctIncludingNone: coveragePct,
        unmeasured: searchInbound != null ? searchInbound - totalTop : null,
        note: '상위 행 밖은 미측정. 아래 %는 상위 행 기준이며 전체 점유가 아니다. 랜딩 URL 보고서가 들어오기 전까지 추정',
      },
      internalMove: {
        pvPerVisit: pv && visits ? round(pv / visits, 3) : null,
        visitsPerVisitor:
          visits && analytics.summary?.visitors
            ? round(visits / analytics.summary.visitors, 3)
            : null,
        note: 'pageviews/visits ≈ 1.05 — 내부 이동이 거의 없다. 허브·내부링크 효과는 발행 순서 논리에서 뺀다(계획 §1-18)',
      },
      classes: CLASSES,
      rankBuckets: RANK_BUCKETS,
      rankSource:
        'queryMap[].rank = src/data/naver-ranks.json byQuery.latest.rank(같은 쿼리 문자열만, SERP 순위). 미측정 쿼리는 null(null 버킷). 애널리틱스 행 순번은 analyticsRank',
      populationNote:
        'regions.json에 인구 없음 — 군/시는 full 접미사로 판정(확인 불가). 10만 미만 시(문경·속초 등)는 si로 남는다',
      volumesFile: volumes ? describeVolumesFile(volumes.file) : null,
      volumesBenchmark: volumes?.benchmark ?? null,
      coefficientsNote: volumes
        ? `perPoint = 주간 유입 ÷ recent7(데이터랩 최근 7일 평균, ${volumes.benchmark ?? '실업급여'}=100). 셀 값은 중앙값, n은 recent7가 있는 쿼리 수. 데이터랩 창(오늘 기준 7일)과 애널리틱스 기간(${analytics.period?.from ?? '?'}~${analytics.period?.to ?? '?'})은 며칠 어긋난다`
        : '계수 없음 — --volumes=<keyword-volume --json 출력> 미지정. API를 직접 부르지 않는다. 매핑·점유율만 산출',
      mapping: {
        ...conf,
        urlRate: pct(rows.filter((r) => r.url).length, mappable.length),
        urlRateHighMed: pct(mappable.filter(isHighMed).length, mappable.length),
        visitsMapped,
        visitsMappable,
        visitsRate: pct(visitsMapped, visitsMappable),
        visitsRateHighMed: pct(visitsMappedHighMed, visitsMappable),
        note: 'high=rank-targets·naver-ranks url, med=지역 토큰 단독 1위 또는 제목 직접 히트 2개+, low=지역 동점(앵커·패밀리A로 고름)·롤업 글이 1위일 때 같은 지역 앵커/비롤업 글로 교체(region-rollup-vs-anchor/-post)·제목 직접 히트 4글자+ 1개(candidates 병기), null=못 찾음(전국 쿼리 동점·약한 겹침은 url 없이 candidates만). urlRate는 low 포함, urlRateHighMed는 high+med만 — 성공률은 후자로 읽는다. (검색어 없음)은 분모에서 뺀다',
      },
    },
    shares,
    coefficients,
    zeroCases,
    regions: regionsOut,
    // 계약: {query, visits, url|null, class, rank|null}. rank는 SERP 순위(순위 버킷의 기준), 행 순번은 analyticsRank
    queryMap: rows.map((r) => ({
      query: r.query,
      visits: r.visits,
      url: r.url ?? null,
      class: r.cls,
      rank: r.naverRank,
      analyticsRank: r.rank,
      naverRank: r.naverRank,
      slug: r.slug ?? null,
      confidence: r.confidence ?? null,
      source: r.source ?? null,
      ...(r.candidates ? { candidates: r.candidates } : {}),
      region: r.region,
      share: r.share,
      rankBucket: r.rankBucket,
      rankMeasured: r.rankMeasured,
      recent7: r.recent7,
      born: r.born,
      perPoint: r.perPoint,
    })),
  };
  if (volumes) {
    out.volumesUsed = volumes.raw.map((v) => ({
      term: v.term,
      relative: v.relative ?? null,
      recent7: v.recent7 ?? v.recentRelative ?? null,
      born: v.born ?? null,
      days: v.days ?? null,
      measured: v.measured ?? !(v.relative === 0 && (v.recent7 ?? v.recentRelative) == null),
    }));
  }

  if (!dryRun) {
    await writeFile(outFile, `${JSON.stringify(out, null, 2)}\n`);
    formatWithBiome(outFile);
  }

  if (jsonOnly) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const p = (b) =>
    `${String(shares[b].visits).padStart(6)} (${shares[b].pct ?? '-'}%) ${shares[b].queries}건`;
  console.log(
    `[ingest] 입력 ${out.meta.source} · ${analytics.period?.from}~${analytics.period?.to} · 상위 ${rows.length}행`,
  );
  console.log(`[ingest] ${out.meta.coverageNote}`);
  console.log(`[ingest] PV/방문 ${out.meta.internalMove.pvPerVisit} — 내부 이동 ≈ 0`);
  console.log('[ingest] 점유율(검색어 없음 제외 기준)');
  console.log(`  민생×지역   ${p('minsaengRegional')}`);
  console.log(`  민생 롤업   ${p('rollup')}`);
  console.log(`  민생 헤드   ${p('head')}`);
  console.log(`  전국 제도   ${p('national')}`);
  console.log(`  기타        ${p('other')}`);
  console.log(
    `  검색어 없음 ${String(shares.none.visits).padStart(6)} (상위 행 포함 기준 ${shares.none.pctIncludingNone}%)`,
  );
  console.log(
    `  → 민생×지역+롤업 ${shares.combined.minsaengRegionalPlusRollup.pct}% · +헤드 ${shares.combined.minsaengAll.pct}%`,
  );
  console.log(
    `[ingest] 매핑 high ${conf.high} · med ${conf.med} · low ${conf.low} · null ${conf.null} — url 확정률 high+med ${out.meta.mapping.urlRateHighMed}% (유입 기준 ${out.meta.mapping.visitsRateHighMed}%) · low 포함 ${out.meta.mapping.urlRate}% (유입 기준 ${out.meta.mapping.visitsRate}%)`,
  );
  const withCoef = coefficients.filter((c) => c.perPoint != null);
  if (withCoef.length) {
    console.log('[ingest] 계수 perPoint(유입/pt, 중앙값)');
    for (const c of withCoef) {
      console.log(
        `  ${c.class.padEnd(8)} ${c.rankBucket.padEnd(5)} ${String(c.perPoint).padStart(7)}  n=${c.n}/${c.queries}  범위 ${c.perPointRange[0]}~${c.perPointRange[1]}`,
      );
    }
  } else {
    console.log(`[ingest] 계수: ${out.meta.coefficientsNote}`);
  }
  if (zeroCases.length) {
    console.log('[ingest] 0 사례');
    for (const z of zeroCases) {
      const head =
        z.type === 'postNoTraffic'
          ? `${z.region} 글 ${z.posts.length}건·유입 0 (순위 ${z.rank ?? '확인 불가'})`
          : z.type === 'trafficNoPost' || z.type === 'trafficNoFreshPost'
            ? `${z.region} ${z.type === 'trafficNoPost' ? '글 없이' : '이번 물결 글 없이'} 유입 ${z.visits} (${z.queries}쿼리)${z.registryOnlyPosts ? ` · 레지스트리 등록 글만: ${z.registryOnlyPosts.join(', ')}` : ''}`
            : `${z.query} recent7 ${z.recent7}·유입 0 (순위 ${z.rank ?? '미측정'}${z.regionVisits > 0 ? `, 지역 합 ${z.regionVisits}` : ''})`;
      console.log(`  ${z.type.padEnd(16)} ${head}`);
    }
  }
  console.log(
    dryRun
      ? '[ingest] --dry-run — 파일에 쓰지 않음'
      : `[ingest] 적재 → ${relative(ROOT, outFile).replace(/\\/g, '/')}`,
  );
}

main().catch((e) => {
  console.error(`[ingest] 실패: ${e.message}`);
  process.exit(1);
});
