#!/usr/bin/env node
/**
 * ops-dashboard — 운영자 로컬 전용 대시보드 생성기.
 *
 * 목적은 하나다. 포스팅이 네이버 최상단에 올라 트래픽을 모으고 애드센스 수익을 최대화한다.
 * 이 스크립트는 리포 안의 운영 데이터를 읽어 `docs/ops/dashboard.html` 한 파일로 요약한다.
 * 공개 사이트와 무관하며(생성물은 .gitignore), 외부 리소스 0 · 인라인 CSS/JS만 · file:// 로 열린다.
 *
 * 화면 원칙(2026-09-11 개편): 한 열 · 필요한 것만 · 사람 말로. 원시 필드명·slug는 화면에 쓰지 않는다.
 *   ① 오늘 할 일(명령형 5줄) → ② 어떤 키워드·어떻게(A 새 글 / B 기존 글 손보기, 한 줄 4칸)
 *   → ③ 오늘 쓸 글감(같은 한 줄 4칸, 근거는 접힘) → ④ 순위 → ⑤ 트래픽
 *   → ⑥ 갱신 필요 글 → ⑦ 다가오는 일정 → (접힘) 자동화·API·잠금 장부·읽는 법
 *   색은 상태 배지에만 쓴다. 킥포인트: 할 일 · 어떤 키워드 · 어떻게 쓸지.
 *
 * 사용:
 *   node scripts/ops-dashboard.mjs                # docs/ops/dashboard.html 생성
 *   node scripts/ops-dashboard.mjs --today=2026-09-10   # 날짜 고정(재현용)
 *   npm run ops:dashboard
 *
 * 입력(전부 읽기만 · 비밀 파일은 절대 읽지 않는다):
 *   docs/ops/pipeline-queue.json · src/data/naver-ranks.json · docs/ops/rank-targets.json
 *   docs/ops/volume-scale.json · src/data/analytics/naver-analytics-search-*.json
 *   docs/ops/cluster-intents.json · src/data/keyword-radar.json(niche·candidates·apiUsage만)
 *   docs/ops/0400-queue.json · docs/ops/landgrab-calendar.json · src/data/issues/**（제목·메타만）
 *   src/data/today-issue.json(동기화 시각만) · .github/workflows/*.yml(cron 줄만)
 *
 * 원칙: 없는 파일·빈 필드에 죽지 않는다(섹션마다 '데이터 없음'). 파일에 없는 숫자는 만들지 않는다.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'ops', 'dashboard.html');
const SITE = 'https://awoo.or.kr';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// ───────────────────────── 시간 유틸(KST) ─────────────────────────
function kstParts(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}`,
    time: `${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`,
    ms: d.getTime(),
  };
}
function kst(input) {
  const p = kstParts(input);
  return p ? `${p.date} ${p.time}` : '없음';
}
function kstShort(input) {
  const p = kstParts(input);
  return p ? `${p.date.slice(5)} ${p.time}` : '없음';
}
function kstDate(input) {
  const p = kstParts(input);
  return p ? p.date : null;
}
function dayDiff(fromYmd, toYmd) {
  if (!fromYmd || !toYmd) return null;
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}
function addDays(ymd, n) {
  const t = Date.parse(`${ymd}T00:00:00Z`) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
function dday(today, ymd) {
  const n = dayDiff(today, ymd);
  if (n === null) return '';
  if (n === 0) return 'D-day';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

const argToday = process.argv.find((a) => a.startsWith('--today='))?.slice(8);
const NOW = new Date();
const TODAY = argToday && /^\d{4}-\d{2}-\d{2}$/.test(argToday) ? argToday : kstDate(NOW);
const YESTERDAY = addDays(TODAY, -1);

function agoText(ms) {
  if (!ms) return '없음';
  const h = (NOW.getTime() - ms) / 3600000;
  if (h < 0) return '방금';
  if (h < 1) return `${Math.round(h * 60)}분 전`;
  if (h < 48) return `${Math.round(h)}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

// ───────────────────────── 파일 유틸(읽기 전용) ─────────────────────────
function rel(p) {
  return p.replaceAll('\\', '/').replace(`${ROOT.replaceAll('\\', '/')}/`, '');
}
function mtimeOf(abs) {
  try {
    return statSync(abs).mtime;
  } catch {
    return null;
  }
}
function readJson(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs))
    return { ok: false, path: relPath, data: null, mtime: null, error: '파일 없음' };
  try {
    const data = JSON.parse(readFileSync(abs, 'utf8'));
    return { ok: true, path: relPath, data, mtime: mtimeOf(abs), error: null };
  } catch (e) {
    return {
      ok: false,
      path: relPath,
      data: null,
      mtime: mtimeOf(abs),
      error: `JSON 파싱 실패: ${e.message}`,
    };
  }
}
function fileHref(relPath) {
  return pathToFileURL(join(ROOT, relPath)).href;
}
function postUrl(slug) {
  if (!slug) return null;
  return `${SITE}/issues/${slug.replace(/-\d{4}-\d{2}-\d{2}$/, '')}/`;
}
function shortSlug(slug) {
  return String(slug ?? '').replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

// ───────────────────────── HTML 유틸 ─────────────────────────
function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function num(v, digits = 0) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '없음';
  return Number(v).toLocaleString('ko-KR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}
function pct(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '없음';
  return `${Number(v).toFixed(digits)}%`;
}
function cut(s, n) {
  const t = String(s ?? '').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}
function extLink(href, label) {
  return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}
function localLink(relPath, label) {
  return `<a href="${esc(fileHref(relPath))}" class="local">${esc(label ?? relPath)}</a>`;
}
/** 키워드 자체가 네이버 검색 링크다. 별도 '검색' 칩은 두지 않는다. */
function qLink(query) {
  return `<a class="q" href="https://search.naver.com/search.naver?query=${encodeURIComponent(query)}" target="_blank" rel="noopener" title="네이버에서 검색">${esc(query)}</a>`;
}
function badge(kind, text, title) {
  return `<span class="b b-${kind}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
}
function rankBadge(rank, wholeBlock) {
  if (rank === null || rank === undefined) {
    return badge(
      'none',
      `미노출 · ${wholeBlock ? '블록 만석' : '블록 밖'}`,
      '자사 글이 웹문서 블록에 없음',
    );
  }
  if (rank <= 3) return badge('good', `${rank}위`);
  if (rank <= 10) return badge('warn', `${rank}위`);
  return badge('none', `${rank}위`);
}
function rankText(rank, wholeBlock) {
  if (rank === null || rank === undefined) return `미노출(${wholeBlock ? '블록 만석' : '블록 밖'})`;
  return `${rank}위`;
}
/** 데이터 파일의 기계 문구를 사람 말로. 규칙 치환만 하고 뜻은 바꾸지 않는다. */
const HUMAN = [
  [/verdictT1 (open|closed)/g, (_m, s) => `지역 자리 ${s === 'open' ? '열림' : '닫힘'}`],
  [/verdictT2 (open|closed)/g, (_m, s) => `롱테일 자리 ${s === 'open' ? '열림' : '닫힘'}`],
  [/verdictT1/g, '지역 자리'],
  [/verdictT2/g, '롱테일 자리'],
  [/openSlots (\d+)<(\d+)/g, '빈자리 $1개(기준 $2)'],
  [/openSlots ≥(\d+)/g, '빈자리 $1개 이상'],
  [/openSlots (\d+)/g, '빈자리 $1개'],
  [/openSlots/g, '빈자리'],
  [/rank null/g, '미노출'],
  [/already r(\d+)/g, '이미 $1위'],
  [/(^|[\s"(])r(\d+)(?=[\s,.·)"]|$)/g, '$1$2위'],
  [/offset-warn ([\d.]+%)/g, '웹문서 비중 $1 주의'],
  [/offset ([\d.]+%)/g, '웹문서 비중 $1'],
  [/webDocOffset/g, '웹문서 비중'],
  [/mainGovAbove/g, '위 본청'],
  [/pressAbove/g, '위 언론'],
  [/inbound7d?/g, '실유입/주'],
  [/fromAnalytics/g, '실유입 발견'],
  [/\bborn\b/g, '신생'],
  [/knownPair/g, '알려진 쌍'],
  [/coreFacts\.deadline/g, '기한 사실'],
  [/coreFactsKeys?/g, '핵심 사실'],
  [/coreFacts/g, '핵심 사실'],
  [/cluster-intents VETO/g, '잠금 장부 거부'],
  [/\bVETO\b/g, '거부'],
  [/--check (\S+) PASS/g, '잠금 장부 $1 통과'],
  [/--serp로/g, '실측으로'],
  [/fact-checker/g, '사실 확인'],
  [/recent7/g, '최근 7일 검색지수'],
  [/rel30/g, '30일 상대검색량'],
  [/datalab/g, '데이터랩'],
  [/mode update-only/g, '갱신 전용'],
  [/\bhold\b/g, '보류'],
  [/\btrend\b/g, '추세'],
  [/\bpeak\b/g, '피크'],
  [/\bproposed\b/g, '지시 대기'],
  [/\bstatus\b/g, '상태'],
  [/writeBy/g, '작성 기한'],
  [/watchFrom/g, '감시 시작'],
  [/targetQuery/g, '타깃 쿼리'],
  [/updates\[\]/g, '갱신 기록'],
  [/big-keywords/g, '대형 키워드 목록'],
  [/naver-ranks/g, '순위 기록'],
  [/keyword-volume/g, '검색량 측정'],
  [/\bnull\b/g, '없음'],
];
function humanize(text) {
  let t = String(text ?? '');
  for (const [re, rep] of HUMAN) t = t.replace(re, rep);
  return t;
}
/** 계획서·결정 번호 같은 내부 참조를 지운다. 뜻은 바꾸지 않는다. */
function scrubRefs(text) {
  return String(text ?? '')
    .replace(/\s*\((?:계획|결정)[^)]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
/** 글 slug를 화면에 내지 않는다. 아는 글이면 제목 앞 20자, 모르면 '기존 글(월/일)'. */
const SLUG_RE = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+?)-(\d{4}-\d{2}-\d{2})\b/g;
function deslug(text) {
  return String(text ?? '').replace(SLUG_RE, (_m, short, date) => {
    const p = postBySlug.get(short);
    return p?.title ? `'${cut(p.title, 20)}'` : `기존 글(${date.slice(5, 7)}/${date.slice(8)})`;
  });
}
function srcItem(relPath, when) {
  return `<li>${localLink(relPath)} <span>${esc(when ?? '없음')}</span></li>`;
}
function card(id, title, sources, body, opts = {}) {
  const src = sources.length
    ? `<details class="src"><summary>출처</summary><ul>${sources.join('')}</ul></details>`
    : '';
  const sub = opts.sub ? `<p class="sub">${opts.sub}</p>` : '';
  return `<section class="card" id="${id}"><div class="card-h"><h2>${esc(title)}</h2>${src}</div>${sub}${body}</section>`;
}
function empty(text = '데이터 없음') {
  return `<p class="empty">${esc(text)}</p>`;
}

// ───────────────────────── 데이터 적재 ─────────────────────────
const pq = readJson('docs/ops/pipeline-queue.json');
const ranks = readJson('src/data/naver-ranks.json');
const targets = readJson('docs/ops/rank-targets.json');
const vs = readJson('docs/ops/volume-scale.json');
const ci = readJson('docs/ops/cluster-intents.json');
const radar = readJson('src/data/keyword-radar.json');
const q0400 = readJson('docs/ops/0400-queue.json');
const landgrab = readJson('docs/ops/landgrab-calendar.json');
const todayIssue = readJson('src/data/today-issue.json');

function latestAnalytics() {
  const dir = join(ROOT, 'src', 'data', 'analytics');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => /^naver-analytics-search-.*\.json$/.test(f))
    .sort();
  if (!files.length) return null;
  return readJson(`src/data/analytics/${files.at(-1)}`);
}
const analytics = latestAnalytics();

function loadPosts() {
  const base = join(ROOT, 'src', 'data', 'issues');
  const posts = [];
  if (!existsSync(base)) return posts;
  for (const d of readdirSync(base)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const dir = join(base, d);
    let st;
    try {
      st = statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      try {
        const o = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        posts.push({
          title: o.title ?? f,
          slug: o.slug ?? f.replace(/\.json$/, ''),
          date: o.date ?? d,
          publishedAt: o.publishedAt ?? null,
          targetQuery: o.targetQuery ?? null,
          parseOk: true,
        });
      } catch {
        posts.push({
          title: `${f} (파싱 실패)`,
          slug: f.replace(/.json$/, ''),
          date: d,
          publishedAt: null,
          targetQuery: null,
          parseOk: false,
        });
      }
    }
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
  return posts;
}
const posts = loadPosts();
const postBySlug = new Map();
for (const p of posts) {
  postBySlug.set(p.slug, p);
  postBySlug.set(shortSlug(p.slug), p);
}

function loadCrons() {
  const dir = join(ROOT, '.github', 'workflows');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.yml') || x.endsWith('.yaml'))) {
    const text = readFileSync(join(dir, f), 'utf8');
    const crons = [...text.matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    const nameMatch = text.match(/^name:\s*(.+)$/m);
    out.push({ file: f, name: nameMatch ? nameMatch[1].trim() : f, crons });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}
const crons = loadCrons();

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function cronToKst(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { text: expr, times: [], daily: false, weekly: false };
  const [minS, hourS, dom, mon, dowS] = parts;
  const minute = Number(minS);
  if (Number.isNaN(minute) || hourS === '*' || /[/-]/.test(hourS) || dom !== '*' || mon !== '*') {
    return { text: `${expr} (UTC, 변환 생략)`, times: [], daily: false, weekly: false };
  }
  const hours = hourS.split(',').map(Number);
  const times = [];
  for (const hh of hours) {
    const kh = (hh + 9) % 24;
    const shift = hh + 9 >= 24 ? 1 : 0;
    times.push({ h: kh, m: minute, shift });
  }
  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = times.map((t) => `${pad(t.h)}:${pad(t.m)}`).join('·');
  if (dowS === '*') return { text: `매일 ${timeStr}`, times, daily: true, weekly: false };
  const days = dowS.split(',').map((d) => {
    const base = Number(d);
    if (Number.isNaN(base)) return d;
    const shifted = (base + (times[0]?.shift ?? 0)) % 7;
    return DOW[shifted];
  });
  return { text: `매주 ${days.join('·')} ${timeStr}`, times, daily: false, weekly: true };
}
function nextRunKst(expr) {
  const c = cronToKst(expr);
  if (!c.times.length || !c.daily) return null;
  const nowK = new Date(NOW.getTime() + KST_OFFSET_MS);
  const nowMin = nowK.getUTCHours() * 60 + nowK.getUTCMinutes();
  const upcoming = c.times.map((t) => t.h * 60 + t.m).sort((a, b) => a - b);
  const next = upcoming.find((m) => m > nowMin);
  const pad = (n) => String(n).padStart(2, '0');
  if (next !== undefined) return `오늘 ${pad(Math.floor(next / 60))}:${pad(next % 60)}`;
  const first = upcoming[0];
  return `내일 ${pad(Math.floor(first / 60))}:${pad(first % 60)}`;
}
const rankCron = crons.find((c) => c.file === 'naver-rank.yml')?.crons[0];
const rankNextKst = rankCron ? nextRunKst(rankCron) : null;

// ───────────────────────── 파생 데이터 ─────────────────────────
const byQuery = ranks.ok && ranks.data?.byQuery ? ranks.data.byQuery : {};
const rankQueries = Object.keys(byQuery);
const targetList = targets.ok && Array.isArray(targets.data?.targets) ? targets.data.targets : [];
const targetByQuery = new Map(targetList.map((t) => [t.query, t]));

function sortedHistory(entry) {
  const hist = Array.isArray(entry?.history) ? [...entry.history] : [];
  const key = (x) => Date.parse(x.ts ?? `${x.date}T00:00:00Z`) || 0;
  return hist.sort((a, b) => key(a) - key(b));
}
const rankRows = rankQueries.map((q) => {
  const e = byQuery[q];
  const latest = e?.latest ?? {};
  const hist = sortedHistory(e);
  const last = hist.at(-1);
  const prev = hist.at(-2);
  const kinds = {};
  for (const a of latest.above ?? []) kinds[a.kind ?? '?'] = (kinds[a.kind ?? '?'] ?? 0) + 1;
  const t = targetByQuery.get(q);
  return {
    query: q,
    rank: latest.rank ?? null,
    prevRank: prev ? (prev.rank ?? null) : undefined,
    curHist: last ? (last.rank ?? null) : undefined,
    url: latest.url ?? null,
    wholeBlock: latest.aboveIsWholeBlock === true,
    parseOk: latest.parseOk,
    date: latest.date ?? e?.first ?? null,
    kinds,
    openSlots: last?.openSlots,
    verdictT1: last?.verdictT1,
    verdictT2: last?.verdictT2,
    gov: latest.mainGovAbove,
    press: latest.pressAbove,
    inbound7d: t?.inbound7d ?? null,
    targetUrl: t?.url ?? null,
  };
});
rankRows.sort((a, b) => {
  const ra = a.rank ?? 999;
  const rb = b.rank ?? 999;
  if (ra !== rb) return ra - rb;
  return (b.inbound7d ?? 0) - (a.inbound7d ?? 0);
});
const rankBuckets = {
  top: rankRows.filter((r) => r.rank !== null && r.rank <= 3).length,
  mid: rankRows.filter((r) => r.rank !== null && r.rank > 3 && r.rank <= 10).length,
  low: rankRows.filter((r) => r.rank !== null && r.rank > 10).length,
  none: rankRows.filter((r) => r.rank === null).length,
};
const parseFails = rankRows.filter((r) => r.parseOk === false);
const unregisteredTargets = targetList.filter((t) => !byQuery[t.query]);

const pqItems = pq.ok && Array.isArray(pq.data?.items) ? pq.data.items : [];
const pqNew = pqItems.filter((i) => i.track === 'T1' || i.track === 'T2' || i.track === 'T3');
const pqUpd = pqItems.filter((i) => i.track === '갱신');
const pqWatch = pq.ok && Array.isArray(pq.data?.watch) ? pq.data.watch : [];
const pqExcluded = pq.ok && Array.isArray(pq.data?.excluded) ? pq.data.excluded : [];
const pqMeta = pq.ok ? (pq.data?.meta ?? {}) : {};
const serpResults = Array.isArray(pqMeta.serp?.results) ? pqMeta.serp.results : [];

const ciEntries = ci.ok && Array.isArray(ci.data?.entries) ? ci.data.entries : [];
const ciRegionOf = (e) => (Array.isArray(e.region) ? e.region : [e.region]).filter(Boolean);
const ciToday = ciEntries.filter((e) => e.date === TODAY);
const ciRecent = ciEntries.filter((e) => (e.date ?? '') >= YESTERDAY);
const ciByRegion = new Map();
for (const e of ciEntries) {
  if (e.rollup) continue;
  for (const g of ciRegionOf(e)) {
    if (!ciByRegion.has(g)) ciByRegion.set(g, []);
    ciByRegion.get(g).push(e);
  }
}
for (const list of ciByRegion.values())
  list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
const ciBySlug = new Map(ciEntries.map((e) => [shortSlug(e.slug), e]));
const REGIONS = [
  ...new Set([...(ci.ok ? (ci.data?.meta?.regions ?? []) : []), ...ciByRegion.keys()]),
].sort((a, b) => b.length - a.length);
function regionOf(text) {
  const s = String(text ?? '');
  for (const r of REGIONS) if (s.includes(r)) return r;
  return null;
}
function famsOf(entries) {
  return [...new Set(entries.map((e) => e.family).filter(Boolean))].join('·');
}
const norm = (s) => String(s ?? '').replace(/\s+/g, '');

// 발행된 글의 타깃 쿼리(날짜 무관). 어제 낸 글이 오늘도 "지시 대기"로 보이면 안 된다(2026-09-11 운영자 혼동).
const normQ = norm; // 공백 제거 정규화(위 norm과 동일)
const publishedByQuery = new Map();
for (const p of posts) if (p.targetQuery) publishedByQuery.set(normQ(p.targetQuery), p);
for (const e of ciEntries)
  if (e.targetQuery && !publishedByQuery.has(normQ(e.targetQuery)))
    publishedByQuery.set(normQ(e.targetQuery), { slug: e.slug, date: e.date, title: e.slug });
const publishedPostFor = (i) => {
  // serp.query는 근사 측정에서 빌려온 쿼리일 수 있어(다른 글의 타깃) 매칭에 쓰지 않는다
  const keys = [i.query, ...String(i.variant ?? '').split(' / ')].filter(Boolean);
  for (const k of keys) {
    const hit = publishedByQuery.get(normQ(k));
    if (hit) return hit;
  }
  return null;
};
const isPublishedToday = (i) => Boolean(publishedPostFor(i));
const STATUS_KO = {
  proposed: '지시 대기',
  approved: '승인됨',
  published: '발행됨',
  rejected: '반려',
  hold: '보류',
  watch: '감시',
  scheduled: '예정',
  migrated: '이관됨',
};
const statusKo = (s) => STATUS_KO[s] ?? (s ? humanize(s) : '없음');

// ── 자동화 상태(워크플로별 마지막 산출) ──
const OUTPUT_OF = {
  'naver-rank.yml': ['순위 기록', ranks.ok ? Date.parse(ranks.data.updatedAt) : null],
  'keyword-pipeline.yml': ['파이프라인', pq.ok ? Date.parse(pqMeta.generatedAt) : null],
  'keyword-radar.yml': ['레이더', radar.ok ? Date.parse(radar.data.updatedAt) : null],
  'sync-issues.yml': ['오늘의 이슈', todayIssue.ok ? Date.parse(todayIssue.data?.syncedAt) : null],
};
const automation = crons
  .filter((c) => c.crons.length)
  .map((c) => {
    const k = cronToKst(c.crons[0]);
    const runsPerDay = k.daily ? Math.max(1, k.times.length) : 0;
    const expectH = k.daily ? 24 / runsPerDay : k.weekly ? 168 : null;
    const out = OUTPUT_OF[c.file];
    const lastMs = out?.[1] && !Number.isNaN(out[1]) ? out[1] : null;
    const ageH = lastMs ? (NOW.getTime() - lastMs) / 3600000 : null;
    let state = 'none';
    let stateText = '산출 파일 추적 안 함';
    if (out) {
      if (!lastMs) {
        state = 'crit';
        stateText = '산출 없음';
      } else if (expectH !== null && ageH > expectH + 3) {
        state = 'crit';
        stateText = '지연 또는 미pull';
      } else {
        state = 'good';
        stateText = '정상';
      }
    }
    return {
      file: c.file,
      name: c.name,
      schedule: c.crons.map((x) => cronToKst(x).text).join(' / '),
      next: k.daily ? nextRunKst(c.crons[0]) : null,
      outputName: out?.[0] ?? null,
      lastMs,
      state,
      stateText,
    };
  });
const delayed = automation.filter((a) => a.state === 'crit');

// ── 데이터 최신도(핵심 3파일 중 가장 오래된 것) ──
const coreFiles = [
  ['순위 기록', ranks.ok ? Date.parse(ranks.data.updatedAt) : null],
  ['파이프라인', pq.ok ? Date.parse(pqMeta.generatedAt) : null],
  ['레이더', radar.ok ? Date.parse(radar.data.updatedAt) : null],
].filter(([, t]) => t && !Number.isNaN(t));
const oldestCore = coreFiles.length ? coreFiles.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
const oldestAgeH = oldestCore ? (NOW.getTime() - oldestCore[1]) / 3600000 : null;

// ───────────────────────── ② 새 키워드 목록 ─────────────────────────
const nicheList = radar.ok && Array.isArray(radar.data?.niche) ? radar.data.niche : [];
const candList = radar.ok && Array.isArray(radar.data?.candidates) ? radar.data.candidates : [];
function ourPostsFor(term) {
  const region = regionOf(term);
  if (region && ciByRegion.has(region)) {
    const list = ciByRegion.get(region);
    return { has: true, region, slug: list[0].slug, fams: famsOf(list), count: list.length };
  }
  const n = norm(term);
  const hits = n
    ? posts.filter((p) => norm(p.title).includes(n) || (p.targetQuery && norm(p.targetQuery) === n))
    : [];
  if (hits.length) {
    const fam = ciBySlug.get(shortSlug(hits[0].slug))?.family;
    return { has: true, region, slug: hits[0].slug, fams: fam ?? '', count: hits.length };
  }
  return { has: false, region };
}
function variantsOf(item) {
  return String(item.variant ?? '')
    .split(' / ')
    .map((s) => s.trim())
    .filter(Boolean);
}
function itemMatches(item, term) {
  return item.query === term || item.serp?.query === term || variantsOf(item).includes(term);
}
function slotOf(term) {
  const it = pqItems.find((i) => i.serp && itemMatches(i, term));
  const s = it?.serp ?? serpResults.find((r) => r.query === term);
  if (s) {
    return {
      measured: true,
      verdict: true,
      open: s.verdictT1 === 'open' || s.verdictT2 === 'open',
      rank: s.rank ?? null,
      wholeBlock: s.aboveIsWholeBlock === true,
      gov: s.mainGovAbove,
      press: s.pressAbove,
      openSlots: s.openSlots,
      approx: s.approx === true,
      query: s.query,
    };
  }
  const e = byQuery[term];
  if (e?.latest && 'rank' in e.latest) {
    const l = e.latest;
    const hasVerdict = l.verdictT1 !== undefined || l.verdictT2 !== undefined;
    return {
      measured: true,
      verdict: hasVerdict,
      open: l.verdictT1 === 'open' || l.verdictT2 === 'open',
      rank: l.rank ?? null,
      wholeBlock: l.aboveIsWholeBlock === true,
      gov: l.mainGovAbove,
      press: l.pressAbove,
      openSlots: l.openSlots,
      approx: false,
      query: term,
    };
  }
  return { measured: false };
}
function slotHtml(s) {
  if (!s.measured) return badge('none', '미측정');
  const parts = [];
  if (s.verdict) {
    parts.push(badge(s.open ? 'good' : 'warn', s.open ? '열림' : '닫힘'));
    if (s.gov !== undefined || s.press !== undefined)
      parts.push(`위에 본청 ${num(s.gov)}·언론 ${num(s.press)}`);
  }
  parts.push(`우리 ${esc(rankText(s.rank, s.wholeBlock))}`);
  if (s.approx) parts.push('<span class="muted">(근사)</span>');
  return parts.join(' · ');
}
function verdictOf(term) {
  const it = pqItems.find((i) => itemMatches(i, term));
  if (it)
    return { kind: '후보', order: 0, published: isPublishedToday(it), item: it, reason: null };
  const ex =
    pqExcluded.find((x) => x.query === term) ??
    pqExcluded.find((x) => String(x.reason ?? '').includes(`"${term}"`));
  if (ex) return { kind: '제외', order: 2, published: false, item: null, reason: ex.reason ?? '' };
  return { kind: '미판정', order: 1, published: false, item: null, reason: null };
}
const kwMap = new Map();
for (const n of nicheList) {
  if (!n?.term) continue;
  const r = byQuery[n.term]?.latest?.rank;
  if (typeof r === 'number' && r <= 3) continue; // 이미 1~3위면 틈새가 아니다
  kwMap.set(n.term, {
    term: n.term,
    opportunity: n.opportunity ?? null,
    stage: n.stage ?? null,
    age: n.age ?? null,
    kin: n.kinQuestions ?? null,
    blogTotal: n.blogTotal ?? null,
    recent7: n.recent7 ?? null,
    born: n.born === true,
    fromAnalytics: false,
    inbound7d: null,
    days: null,
    regionPattern: false,
    flaggedAt: n.flaggedAt ?? null,
    sources: ['niche'],
  });
}
for (const c of candList) {
  if (!c?.term) continue;
  const eligible =
    (c.born === true || c.fromAnalytics === true) &&
    (c.ourRank === null || c.ourRank === undefined || c.ourRank >= 4);
  if (!eligible) continue;
  const v = c.signals?.volume ?? {};
  const prev = kwMap.get(c.term) ?? { term: c.term, sources: [] };
  kwMap.set(c.term, {
    ...prev,
    opportunity: prev.opportunity ?? c.signals?.opportunity ?? null,
    stage: prev.stage ?? c.signals?.stage ?? null,
    age: prev.age ?? c.signals?.age ?? null,
    kin: prev.kin ?? c.signals?.kinQuestions ?? null,
    blogTotal: prev.blogTotal ?? null,
    recent7: prev.recent7 ?? v.recent7 ?? null,
    born: prev.born === true || c.born === true,
    fromAnalytics: prev.fromAnalytics === true || c.fromAnalytics === true,
    inbound7d: c.inbound7d ?? prev.inbound7d ?? null,
    days: v.days ?? prev.days ?? null,
    regionPattern: prev.regionPattern === true || c.regionPattern === true,
    flaggedAt: prev.flaggedAt ?? c.flaggedAt ?? null,
    sources: [...prev.sources, 'candidates'],
  });
}
const kwList = [...kwMap.values()].map((k) => ({
  ...k,
  ours: ourPostsFor(k.term),
  slot: slotOf(k.term),
  verdict: verdictOf(k.term),
}));
kwList.sort((a, b) => {
  if (a.verdict.order !== b.verdict.order) return a.verdict.order - b.verdict.order;
  const ia = a.inbound7d ?? -1;
  const ib = b.inbound7d ?? -1;
  if (ia !== ib) return ib - ia;
  return (b.opportunity ?? -1) - (a.opportunity ?? -1);
});
// A = 우리 글이 없는 새 자리(새 주제). B = 글은 있는데 이 검색 표현에서 4위 아래·미노출(새 표현).
// 이미 1~3위인 표현은 손볼 게 없으니 B에서도 뺀다.
const kwA = kwList.filter((k) => !k.ours.has);
const kwB = kwList.filter(
  (k) => k.ours.has && !(k.slot.measured && typeof k.slot.rank === 'number' && k.slot.rank <= 3),
);
const countKind = (list, kind) => list.filter((k) => k.verdict.kind === kind).length;
const kwStats = {
  aToday: kwA.filter((k) => kstDate(k.flaggedAt) === TODAY).length,
  aReady: countKind(kwA, '후보'),
  aWait: countKind(kwA, '미판정'),
  bReady: countKind(kwB, '후보'),
};
const pipelineCron = crons.find((c) => c.file === 'keyword-pipeline.yml')?.crons[0];
const pipelineNextKst = pipelineCron ? nextRunKst(pipelineCron) : null;
/** 신호는 있는 것만 최대 2개. B는 이 표현에서의 우리 순위가 첫 신호. */
function signalsOf(k, box) {
  const s = [];
  if (box === 'B') {
    if (!k.slot.measured) s.push('순위 미측정');
    else if (k.slot.rank === null) s.push('미노출');
    else s.push(`우리 ${k.slot.rank}위`);
  }
  if (k.inbound7d !== null) s.push(`유입 ${num(k.inbound7d)}/주`);
  if (k.born) s.push(k.days !== null ? `신생 ${num(k.days)}일` : '신생');
  else if (k.stage === 'new') s.push('새로 뜸');
  else if (k.stage === 'rising') s.push('상승 중');
  if (k.kin !== null) s.push(`질문 ${num(k.kin)}`);
  return s.slice(0, 2);
}
/** '어떻게'는 규칙 문장 하나(≤28자). 판정·상자 조합으로만 정한다. */
function howOf(k, box) {
  const v = k.verdict;
  if (v.published) return '발행됨 · 순위 확인';
  if (v.kind === '후보' && v.item?.track === '갱신') return '갱신 큐에 있음 · 사실만 정정';
  if (box === 'A') {
    if (v.kind === '후보') return '새 글. 제목 맨 앞에 이 표현';
    if (v.kind === '미판정')
      return pipelineNextKst ? `실측 후 결정(${pipelineNextKst} 자동)` : '실측 후 결정';
    return `보류: ${cut(deslug(humanize(scrubRefs(v.reason))), 18)}`;
  }
  if (v.kind === '후보') return `새 글(패밀리 ${v.item?.family ?? 'B'}) 제목 맨 앞에 이 표현`;
  if (v.kind === '미판정') return '새 글 쓸 때 제목 표현으로 참고';
  return '참고만(같은 의도 글 있음)';
}
function kwBadge(k) {
  const v = k.verdict;
  if (v.published) return badge('good', '오늘 발행됨');
  if (v.kind === '후보') return badge('good', '지시 대기');
  if (v.kind === '미판정') return badge('warn', '실측 필요');
  return badge('none', '보류/잠김', v.reason ? deslug(humanize(v.reason)) : undefined);
}
function oursLink(o) {
  const p = postBySlug.get(shortSlug(o.slug));
  const label = p?.title ? cut(p.title, 20) : '우리 글';
  return `<div class="ours">글: ${extLink(postUrl(o.slug), label)}${o.count > 1 ? ` <span class="muted">외 ${o.count - 1}</span>` : ''}</div>`;
}
function kwLine(k, box) {
  return `<div class="ln"><div class="c1">${qLink(k.term)}${box === 'B' ? oursLink(k.ours) : ''}</div><div class="c2">${esc(signalsOf(k, box).join(' · ') || '신호 없음')}</div><div class="c3">${esc(howOf(k, box))}</div><div class="c4">${kwBadge(k)}</div></div>`;
}

// ───────────────────────── ① 오늘 할 일 ─────────────────────────
// 순서 고정, 최대 5줄, 한 줄은 명령형 40자 이내. 해당 없으면 그 줄은 없다.
// ① 발행 지시 → ② 새 글 키워드 → ③ 기존 글 손보기 → ④ 갱신 → ⑤ 결과 확인
const todos = [];
{
  const proposed = pqNew.filter((i) => i.status === 'proposed' && !isPublishedToday(i));
  if (proposed.length)
    todos.push({
      text: `글감 ${proposed.length}건 중 골라 발행 지시`,
      href: '#ideas',
      label: '글감',
    });
  if (kwStats.aReady)
    todos.push({
      text: `바로 쓸 수 있는 키워드 ${kwStats.aReady}건`,
      href: '#kw-a',
      label: '키워드',
    });
  else if (kwStats.aWait)
    todos.push({
      text: `새 글 키워드 ${kwStats.aWait}건 실측 대기`,
      href: '#kw-a',
      label: '키워드',
    });
  // 운영자(2026-09-11): 기존 글 손보기는 할 일에서 뺀다 — 만들 때 잘 만든다. 표현은 새 글 제목 참고로만 쓴다.
  const due = pqUpd
    .map((i) => ({ i, d: i.dueDate ? dayDiff(TODAY, i.dueDate) : (i.daysLeft ?? null) }))
    .filter((x) => x.d !== null && x.d <= 0);
  if (due.length)
    todos.push({
      text: `마감 지난 글 ${due.length}건 사실·날짜 정정`,
      href: '#updates',
      label: '갱신',
    });
  if (ciRecent.length) {
    const when = ciRecent.some((e) => e.date === TODAY) ? '어제·오늘' : '어제';
    const next = rankNextKst ? rankNextKst.replace(/^오늘 /, '') : '없음';
    todos.push({
      text: `${when} 낸 글 ${ciRecent.length}건 순위 확인, 다음 측정 ${next}`,
      href: '#ranks',
      label: '순위',
    });
  }
}
// 할 일은 아니지만 화면의 숫자를 못 믿게 만드는 것 — 한 줄 주석으로만.
const todoNotes = [];
if (delayed.length) todoNotes.push(`자동화 지연 ${delayed.length}건`);
if (parseFails.length) todoNotes.push(`순위 파싱 실패 ${parseFails.length}건`);

// ───────────────────────── 섹션 렌더 ─────────────────────────
function todoSection() {
  const body = todos.length
    ? `<ol class="todo">${todos
        .slice(0, 5)
        .map(
          (t) =>
            `<li><span class="t">${esc(t.text)}</span><a class="jump" href="${t.href}">${esc(t.label)} →</a></li>`,
        )
        .join('')}</ol>`
    : empty('오늘 할 일 없음 — 글감·키워드·갱신·최근 발행에 신호가 없다');
  const note = todoNotes.length
    ? `<p class="foot">주의: ${esc(todoNotes.join(' · '))} → <a href="#more-auto">자세히</a></p>`
    : '';
  return card(
    'todo',
    '오늘 할 일',
    [
      srcItem('docs/ops/pipeline-queue.json', pq.ok ? kst(pqMeta.generatedAt) : pq.error),
      srcItem('src/data/naver-ranks.json', ranks.ok ? kst(ranks.data?.updatedAt) : ranks.error),
      srcItem('docs/ops/cluster-intents.json', ci.ok ? `수정 ${kst(ci.mtime)}` : ci.error),
      '<li>규칙으로만 파생, 순서 고정: 발행 지시 → 새 글 키워드 → 기존 글 손보기 → 갱신 → 결과 확인</li>',
    ],
    body + note,
  );
}

function keywordSection() {
  const TITLE = '어떤 키워드 · 어떻게';
  if (!radar.ok)
    return card('keywords', TITLE, [srcItem('src/data/keyword-radar.json', radar.error)], empty());
  // 두 상자로 완전히 분리(2026-09-11 운영자: "창원·문경은 글이 있는데 왜 새 키워드냐").
  const box = (id, title, desc, sum, items, kind) => {
    const shown = items.slice(0, 6);
    const rest = items.slice(6);
    const lines = shown.length
      ? `<div class="lns">${shown.map((k) => kwLine(k, kind)).join('')}</div>`
      : empty('없음');
    const more = rest.length
      ? `<details class="more"><summary>나머지 ${rest.length}건</summary><div class="lns">${rest.map((k) => kwLine(k, kind)).join('')}</div></details>`
      : '';
    return `<div class="box" id="${id}"><h3>${esc(title)}</h3><p class="desc">${esc(desc)}</p><p class="sum">${sum}</p>${lines}${more}</div>`;
  };
  const a = box(
    'kw-a',
    '새 글을 쓸 키워드',
    '우리 글이 없는 검색어. 새 주제.',
    `새로 관측 <b>${num(kwStats.aToday)}</b> · 바로 쓸 수 있음 <b>${num(kwStats.aReady)}</b> · 실측 대기 <b>${num(kwStats.aWait)}</b>`,
    kwA,
    'A',
  );
  const b = box(
    'kw-b',
    '사람들이 쓰는 표현 (새 글 제목 참고)',
    '글은 있는데 사람들은 이 표현으로 검색한다. 기존 글은 손대지 않고, 새 글을 만들 때 제목에 이 표현을 쓴다.',
    `참고 표현 <b>${num(kwB.length)}</b> · 새 글 후보 <b>${num(kwStats.bReady)}</b>`,
    kwB,
    'B',
  );
  const foot = `<p class="foot">왼쪽은 새 주제, 오른쪽은 새 표현이다. 예: '창원 민생지원금' 글은 있는데 사람들은 '창원 지원금'으로 검색한다. 기존 글을 손보지 않고 만들 때 잘 만든다(운영자 2026-09-11).</p>`;
  return card(
    'keywords',
    TITLE,
    [
      srcItem(
        'src/data/keyword-radar.json',
        `${kst(radar.data?.updatedAt)} · 틈새 ${nicheList.length} · 후보 ${candList.length}`,
      ),
      srcItem(
        'docs/ops/pipeline-queue.json',
        pq.ok ? `판정·실측 ${kst(pqMeta.generatedAt)}` : pq.error,
      ),
      srcItem(
        'src/data/naver-ranks.json',
        ranks.ok ? `자사 순위 ${kst(ranks.data?.updatedAt)}` : ranks.error,
      ),
      '<li>조건: 신생이거나 실유입에서 발견됐고 우리 순위가 없거나 4위 아래. 1~3위는 뺐다.</li>',
      '<li>배지: 지시 대기 = 글감 큐에 있음 · 실측 필요 = 아직 검색 결과를 안 봄 · 보류/잠김 = 큐에서 제외됨</li>',
    ],
    `<div class="two">${a}${b}</div>${foot}`,
  );
}

function ideasSection() {
  if (!pq.ok)
    return card(
      'ideas',
      '오늘 쓸 글감',
      [srcItem('docs/ops/pipeline-queue.json', pq.error)],
      empty(),
    );
  const published = pqNew.filter((i) => i.status === 'proposed' && publishedPostFor(i));
  const proposed = pqNew.filter((i) => i.status === 'proposed' && !publishedPostFor(i));
  // 큐가 이미 노출 가능성 순으로 정렬돼 있다(keyword-pipeline exposureOf). 실측 전은 뒤로.
  const ready = proposed.filter((i) => i.exposure?.score != null);
  const pendingMeasure = proposed
    .filter((i) => i.exposure?.score == null)
    .sort((a, b) => (b.inbound7d ?? 0) - (a.inbound7d ?? 0) || (b.recent7 ?? 0) - (a.recent7 ?? 0));
  const shown = ready.slice(0, 8);
  const rows = shown.map((i) => {
    const s = i.serp ? slotOf(i.serp.query ?? i.query) : { measured: false };
    const cond = condOf(i);
    const evLines = (Array.isArray(i.evidence) ? i.evidence : []).map(
      (e) => `<li>${esc(deslug(humanize(e)))}</li>`,
    );
    const facts = [
      i.serp?.query && i.serp.query !== i.query ? `<li>실측 쿼리: ${esc(i.serp.query)}</li>` : '',
      `<li>빈자리: ${slotHtml(s)}</li>`,
      i.score !== undefined
        ? `<li>점수: ${num(i.score, 1)}${i.scoreNote ? ` <span class="muted">(${esc(humanize(i.scoreNote))})</span>` : ''}</li>`
        : '',
      (i.region ?? i.cluster) ? `<li>묶음: ${esc(i.region ?? i.cluster)}</li>` : '',
      i.start ? `<li>개시: ${esc(i.start)} ${esc(dday(TODAY, i.start))}</li>` : '',
      i.condition ? `<li>조건 전체: ${esc(deslug(humanize(i.condition)))}</li>` : '',
    ].join('');
    const ev = `<details class="ev"><summary>근거 보기</summary><ul class="plain small">${facts}${evLines.join('')}</ul></details>`;
    const ex = i.exposure ?? {};
    const exTone = ex.label === '높음' ? 'good' : ex.label === '중간' ? 'warn' : 'none';
    const exHtml = ex.score == null ? '' : `${badge(exTone, `${ex.label} ${ex.score}`)} `;
    const why = (ex.reasons ?? []).join(' · ') || whyOf(i);
    return `<div class="ln"><div class="c1">${exHtml}${qLink(i.query)}</div><div class="c2">${esc(why)}</div><div class="c3">${esc(howOfIdea(i))}</div><div class="c4">${ideaBadge(i)}</div>${cond ? `<div class="cond">조건: ${esc(cond)}</div>` : ''}${ev}</div>`;
  });
  const exBody = pqExcluded.length
    ? `<ul class="plain">${pqExcluded
        .map(
          (x) =>
            `<li><b>${esc(x.query)}</b>${x.track ? ` <span class="muted">${esc(x.track)}</span>` : ''} · ${esc(cut(deslug(humanize(x.reason)), 80))}</li>`,
        )
        .join('')}</ul>`
    : empty('제외 항목 없음');
  const serp = pqMeta.serp ?? {};
  return card(
    'ideas',
    '오늘 쓸 글감',
    [
      srcItem(
        'docs/ops/pipeline-queue.json',
        `${kst(pqMeta.generatedAt)} · 기준일 ${pqMeta.today ?? '없음'}`,
      ),
      `<li>실측 예산 ${num(serp.used)}/${num(serp.budget?.total)}${serp.error ? ` · 오류 ${esc(serp.error)}` : ''}${pqMeta.dryRun ? ' · 시험 실행' : ''}</li>`,
      '<li>지역 글은 개시일 임박순, 롱테일은 점수순. 발행은 운영자 지시 후 수동.</li>',
      '<li>"왜"는 근거 줄에서 규칙으로 뽑은 한 문장. 수치·실측값은 "근거 보기" 안에.</li>',
    ],
    `${rows.length ? `<div class="rows3"><div class="lns">${rows.join('')}</div></div>` : empty('지시 대기 후보 없음')}${ready.length > shown.length ? `<p class="muted">실측된 후보 ${ready.length}건 중 ${shown.length}건 표시</p>` : ''}${
      pendingMeasure.length
        ? `<p class="muted">실측 대기 ${pendingMeasure.length}건 — ${pendingMeasure
            .slice(0, 4)
            .map((i) => esc(i.query))
            .join(' · ')}${pendingMeasure.length > 4 ? ' …' : ''}</p>`
        : ''
    }${
      published.length
        ? `<p class="muted">이미 발행됨 ${published.length}건: ${published
            .map((i) => {
              const h = publishedPostFor(i);
              return `${esc(i.query)} → ${extLink(postUrl(h.slug), esc(h.date ?? ''))}`;
            })
            .join(' · ')}</p>`
        : ''
    }<details class="more"><summary>제외·보류 ${pqExcluded.length}건</summary>${exBody}</details>`,
  );
}
/** '왜' — 근거 줄에서 규칙으로 뽑은 사람 말 한 문장(≤40자). 없는 근거는 만들지 않는다. */
function whyOf(i) {
  const ev = Array.isArray(i.evidence) ? i.evidence.map((e) => String(e ?? '')) : [];
  const find = (re) => {
    for (const e of ev) {
      const m = e.match(re);
      if (m) return m;
    }
    return null;
  };
  // 규칙표: 먼저 맞는 것 하나만. 순서가 우선순위다(직접 유입 > 새 키 > 언론 > 다른 표현 > 묶음 유입 > 롤업).
  const cluster = find(/^클러스터 실유입 (\d+)\/주/);
  const RULES = [
    [
      /^실유입 "([^"]+)" (\d+)\/주(?: (순위 미측정))?/,
      (m) => `'${m[1]}' 주 ${m[2]}명 유입${m[3] ? ', 순위 미측정' : ''}`,
    ],
    [/([^.·]*새 키)/, (m) => scrubRefs(m[1]).replace(/A글/g, '기본 글')],
    [/언론 (\d+)곳 ([\d/~]+)/, (m) => `언론 ${m[1]}곳 보도(${m[2]})`],
    [/^([^,]*보도)/, (m) => m[1]],
    [
      /^big-keywords "([^"]+)" alias "[^"]+"/,
      (m) => `'${m[1]}'의 다른 표현${cluster ? ` · 묶음 유입 주 ${cluster[1]}명` : ''}`,
    ],
    [/^클러스터 실유입 (\d+)\/주/, (m) => `같은 묶음 글에 주 ${m[1]}명 유입`],
    [
      /^롤업 축 "([^"]+)" × \w(?: — 기존 롤업 [^(]*\(([^)]+)\))?/,
      (m) => `'${m[1]}' 축 지역별 묶음 글 없음${m[2] ? `(기존은 ${m[2]})` : ''}`,
    ],
  ];
  let why = '';
  for (const [re, build] of RULES) {
    const m = find(re);
    if (m) {
      why = build(m);
      break;
    }
  }
  if (i.start) {
    const tail = `개시 ${dday(TODAY, i.start)}`;
    if (!why) why = `지급 ${tail}(${i.start.slice(5).replace('-', '/')})`;
    else if (`${why} · ${tail}`.length <= 40) why = `${why} · ${tail}`;
  }
  if (!why && ev[0]) why = deslug(humanize(scrubRefs(ev[0])));
  return cut(why, 40) || '근거 없음';
}
/** '어떻게' — 트랙·패밀리·예상 유입만. */
function howOfIdea(i) {
  const fam = i.family ?? (i.track === 'T2' ? '롱테일' : i.track === 'T3' ? '선점' : '');
  let inb = String(i.expectedInbound ?? '')
    .replace(/\(.*$/, '')
    .trim();
  if (inb && !inb.includes('/주')) inb = `${inb}/주`;
  return `새 글${fam ? ` ${fam}` : ''}${inb ? ` · ${inb}` : ''}`;
}
const STATUS_TONE = {
  proposed: 'good',
  approved: 'good',
  published: 'good',
  scheduled: 'warn',
  watch: 'warn',
};
function ideaBadge(i) {
  if (isPublishedToday(i)) return badge('good', '오늘 발행됨');
  return badge(STATUS_TONE[i.status] ?? 'none', statusKo(i.status));
}
/** 조건 — 있을 때만 한 줄(≤50자). 제목 선두를 변형으로 바꾸라는 조건은 앞으로 뺀다. */
function condOf(i) {
  if (!i.condition) return '';
  const raw = String(i.condition);
  const lead = raw.match(/타깃\(제목 선두\)을 변형으로: "([^"]+)"/);
  const parts = raw
    .split(' · ')
    .map((s) => s.trim())
    .filter((s) => s && !/타깃\(제목 선두\)/.test(s))
    .map((s) => deslug(humanize(scrubRefs(s))));
  const out = lead ? [`제목 앞에 '${lead[1]}'`] : [];
  for (const p of parts) {
    if ([...out, p].join(' · ').length > 50) break;
    out.push(p);
  }
  if (!out.length && parts[0]) out.push(parts[0]);
  return cut(out.join(' · '), 50);
}

function ranksSection() {
  if (!ranks.ok)
    return card('ranks', '순위', [srcItem('src/data/naver-ranks.json', ranks.error)], empty());
  const tiles = `<div class="tiles"><div class="tile"><span class="tile-v good">${num(rankBuckets.top)}</span><span class="tile-l">1~3위</span></div><div class="tile"><span class="tile-v warn">${num(rankBuckets.mid)}</span><span class="tile-l">4~10위</span></div><div class="tile"><span class="tile-v none">${num(rankBuckets.none)}</span><span class="tile-l">미노출</span></div></div>${rankBuckets.low ? `<p class="muted">11위 아래 ${num(rankBuckets.low)}건은 미노출에 넣지 않았다.</p>` : ''}`;
  const changed = rankRows
    .filter((r) => r.prevRank !== undefined && r.curHist !== undefined && r.prevRank !== r.curHist)
    .sort((a, b) => (b.inbound7d ?? 0) - (a.inbound7d ?? 0))
    .slice(0, 6);
  const arrow = (r) => {
    const up = r.curHist !== null && (r.prevRank === null || r.curHist < r.prevRank);
    return `<span class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'}</span>`;
  };
  const changes = changed.length
    ? `<h3>변동 <span class="muted">전회 대비 · 마지막 측정 ${esc(kstShort(ranks.data?.updatedAt))}</span></h3><ul class="plain">${changed
        .map(
          (r) =>
            `<li>${arrow(r)} <b>${esc(r.query)}</b> · ${esc(rankText(r.prevRank))} → ${esc(rankText(r.curHist, r.wholeBlock))}${r.inbound7d !== null ? ` · 실유입 ${num(r.inbound7d)}/주` : ''}</li>`,
        )
        .join('')}</ul>`
    : '<h3>변동</h3><p class="muted">전회 대비 바뀐 순위 없음</p>';
  const core = targetList
    .filter((t) => t.inbound7d !== null && t.inbound7d !== undefined)
    .sort((a, b) => b.inbound7d - a.inbound7d)
    .slice(0, 8);
  const coreHtml = core.length
    ? `<h3>수익 클러스터 핵심 <span class="muted">실유입 있는 타깃</span></h3><div class="tw"><table class="mini"><thead><tr><th>쿼리</th><th>순위</th><th>실유입/주</th></tr></thead><tbody>${core
        .map((t) => {
          const e = byQuery[t.query];
          const rk = e?.latest
            ? rankBadge(e.latest.rank ?? null, e.latest.aboveIsWholeBlock === true)
            : badge('none', '미측정');
          return `<tr><td>${esc(t.query)}${t.url ? ` ${extLink(`${SITE}${t.url}`, '글')}` : ''}</td><td>${rk}</td><td class="num">${num(t.inbound7d)}</td></tr>`;
        })
        .join('')}</tbody></table></div>`
    : '';
  const fullRows = rankRows.map((r) => {
    const above =
      r.gov !== undefined || r.press !== undefined
        ? `본청 ${num(r.gov)}·언론 ${num(r.press)}`
        : `기관 ${num(r.kinds.institutional ?? 0)}·언론 ${num(r.kinds.press ?? 0)}`;
    const verdict =
      r.verdictT1 !== undefined
        ? badge(r.verdictT1 === 'open' ? 'good' : 'warn', r.verdictT1 === 'open' ? '열림' : '닫힘')
        : '<span class="muted">—</span>';
    const delta =
      r.prevRank === undefined || r.curHist === undefined
        ? '<span class="muted">신규</span>'
        : r.prevRank === r.curHist
          ? '<span class="muted">＝</span>'
          : `${arrow(r)} 이전 ${esc(rankText(r.prevRank))}`;
    return `<tr><td class="qcol">${esc(r.query)}${r.url ? ` ${extLink(r.url, '글')}` : ''}${r.parseOk === false ? ` ${badge('crit', '파싱 실패')}` : ''}</td><td class="nw">${rankBadge(r.rank, r.wholeBlock)}</td><td class="nw">${delta}</td><td class="num">${r.openSlots !== undefined ? num(r.openSlots) : '<span class="muted">—</span>'}</td><td class="nw">${verdict}</td><td class="nw">${above}</td><td class="num">${r.inbound7d !== null ? num(r.inbound7d) : '<span class="muted">—</span>'}</td><td class="nw">${esc(r.date ?? '없음')}</td></tr>`;
  });
  const full = `<details class="more"><summary>전체 ${rankRows.length}건 보기</summary><p><input id="rank-filter" type="search" placeholder="쿼리 필터" class="filter"></p><div class="tw"><table id="rank-table"><thead><tr><th>쿼리</th><th>순위</th><th>변동</th><th>빈자리</th><th>지역 자리</th><th>위에</th><th>실유입/주</th><th>측정일</th></tr></thead><tbody>${fullRows.join('')}</tbody></table></div></details>`;
  return card(
    'ranks',
    '순위',
    [
      srcItem(
        'src/data/naver-ranks.json',
        `${kst(ranks.data?.updatedAt)} · ${rankQueries.length}쿼리`,
      ),
      srcItem(
        'docs/ops/rank-targets.json',
        targets.ok ? `수정 ${kst(targets.mtime)}` : targets.error,
      ),
      `<li>자동 측정 ${esc(rankCron ? cronToKst(rankCron).text : '없음')} · 다음 ${esc(rankNextKst ?? '없음')}</li>`,
      '<li>변동은 마지막 두 회차 비교. 실유입/주는 쿼리 문자열이 완전히 같을 때만 붙는다.</li>',
    ],
    tiles + changes + coreHtml + full,
  );
}

function trafficSection() {
  if (!analytics?.ok) return card('traffic', '트래픽', [], empty('애널리틱스 전사본 없음'));
  const a = analytics.data;
  const sum = a.summary ?? {};
  const per = a.period ?? {};
  const big = `<div class="bignum"><span class="bn">${num(sum.searchInbound)}</span><span class="bn-l">7일 검색 유입 <span class="muted">${esc(per.from ?? '?')} ~ ${esc(per.to ?? '?')}</span></span></div>`;
  let share = '';
  if (vs.ok && vs.data?.shares) {
    const sh = vs.data.shares;
    const other = (sh.head?.pct ?? 0) + (sh.other?.pct ?? 0);
    const segs = [
      ['민생×지역', sh.minsaengRegional?.pct, 's1'],
      ['롤업', sh.rollup?.pct, 's2'],
      ['전국 제도', sh.national?.pct, 's3'],
      ['기타', sh.head || sh.other ? other : null, 's4'],
    ].filter(([, v]) => typeof v === 'number');
    share = segs.length
      ? `<div class="stack">${segs.map(([l, v, c]) => `<div class="seg ${c}" style="width:${v.toFixed(1)}%" title="${esc(l)} ${pct(v)}"></div>`).join('')}</div><div class="legend">${segs.map(([l, v, c]) => `<span><i class="sw ${c}"></i>${esc(l)} <b>${pct(v)}</b></span>`).join('')}</div>`
      : '';
  }
  const kws = Array.isArray(a.keywords)
    ? a.keywords.filter((k) => k.query !== '(검색어 없음)')
    : [];
  const top = kws.slice(0, 5);
  const topHtml = top.length
    ? `<h3>상위 유입 검색어</h3><div class="tw"><table class="mini"><thead><tr><th>검색어</th><th>유입</th><th>우리 순위</th></tr></thead><tbody>${top
        .map((k) => {
          const e = byQuery[k.query];
          const rk = e?.latest
            ? rankBadge(e.latest.rank ?? null, e.latest.aboveIsWholeBlock === true)
            : badge('none', '미측정');
          return `<tr><td>${esc(k.query)}</td><td class="num">${num(k.visits)}</td><td>${rk}</td></tr>`;
        })
        .join('')}</tbody></table></div>`
    : '';
  return card(
    'traffic',
    '트래픽',
    [
      srcItem(analytics.path, `${per.from ?? '?'}~${per.to ?? '?'} · 수정 ${kst(analytics.mtime)}`),
      srcItem('docs/ops/volume-scale.json', vs.ok ? kst(vs.data?.meta?.generatedAt) : vs.error),
      '<li>점유 바의 기타 = 헤드 + 기타. 분모는 상위 행 유입(검색어 없음 제외).</li>',
    ],
    `${big}${share}${topHtml}<p class="foot">상위 160 검색어 기준(전체의 약 34%), 주 1회 전사본. 미측정 = 순위 추적 대상이 아니라는 뜻이지 순위가 없다는 뜻이 아니다.</p>`,
  );
}

function updatesSection() {
  if (!pq.ok)
    return card(
      'updates',
      '갱신 필요 글',
      [srcItem('docs/ops/pipeline-queue.json', pq.error)],
      empty(),
    );
  const list = pqUpd
    .map((i) => ({ i, d: i.dueDate ? dayDiff(TODAY, i.dueDate) : (i.daysLeft ?? null) }))
    .sort((a, b) => (a.d ?? 9999) - (b.d ?? 9999));
  const row = (x) => {
    const { i, d } = x;
    const when =
      d === null
        ? badge('none', '기한 없음')
        : d <= 0
          ? badge('warn', d === 0 ? '오늘' : `D+${-d}`)
          : badge('good', `D-${d}`);
    const what = Array.isArray(i.evidence) && i.evidence[0] ? cut(humanize(i.evidence[0]), 90) : '';
    const title = i.slug
      ? extLink(postUrl(i.slug), i.query ?? shortSlug(i.slug))
      : esc(i.query ?? '');
    return `<li>${when} <b>${title}</b>${i.region ? ` <span class="muted">${esc(i.region)}</span>` : ''}${what ? `<div class="row-why">${esc(what)}</div>` : ''}</li>`;
  };
  const shown = list.slice(0, 5);
  const rest = list.slice(5);
  return card(
    'updates',
    '갱신 필요 글',
    [
      srcItem(
        'docs/ops/pipeline-queue.json',
        `갱신 트랙 ${pqUpd.length}건 · ${kst(pqMeta.generatedAt)}`,
      ),
      '<li>D-day는 이 화면 생성 시각 기준으로 다시 계산했다.</li>',
    ],
    `${shown.length ? `<ul class="plain upd">${shown.map(row).join('')}</ul>` : empty('갱신 후보 없음')}${rest.length ? `<details class="more"><summary>나머지 ${rest.length}건</summary><ul class="plain upd">${rest.map(row).join('')}</ul></details>` : ''}<p class="foot">사실·날짜·갱신 기록만, 제목·구조는 그대로.</p>`,
  );
}

function scheduleSection() {
  const events = [];
  const year = TODAY.slice(0, 4);
  for (const w of pqWatch) {
    if (w.kind === 'wave') {
      const m = String(w.text ?? '').match(/개시 (\d{2})\/(\d{2})/);
      const date = m ? `${year}-${m[1]}-${m[2]}` : null;
      const what = String(w.text ?? '')
        .replace(/^.*? — /, '')
        .replace(/개시 \d{2}\/\d{2} D[-+]?\d* · /, '')
        .replace(/개시일 미정 · /, '');
      events.push({
        region: w.region ?? regionOf(w.text),
        what: `물결 · ${what}`,
        date,
        undated: !date,
      });
    } else if (w.kind === 'milestone') {
      const m = String(w.text ?? '').match(/(\d{4}-\d{2}-\d{2})/);
      const what = String(w.text ?? '').split(' — ')[0];
      events.push({
        region: w.region ?? regionOf(w.text),
        what: `갱신 · ${what}`,
        date: m ? m[1] : null,
        undated: !m,
      });
    }
  }
  for (const i of pqNew) {
    if (!i.start || i.start < TODAY) continue;
    if (events.some((e) => e.region === i.region && e.date === i.start)) continue;
    events.push({ region: i.region, what: `개시 · ${i.query}`, date: i.start, undated: false });
  }
  events.sort((a, b) => {
    if (a.undated !== b.undated) return a.undated ? 1 : -1;
    return (a.date ?? '').localeCompare(b.date ?? '');
  });
  const evRow = (e) => {
    const ours =
      e.region && ciByRegion.has(e.region)
        ? `있음 (${esc(famsOf(ciByRegion.get(e.region)))})`
        : '<span class="none">없음</span>';
    const dd = e.date ? dday(TODAY, e.date) : '미정';
    const tone = !e.date ? 'none' : dayDiff(TODAY, e.date) <= 3 ? 'warn' : 'good';
    return `<li>${badge(tone, dd)} <b>${esc(e.region ?? '—')}</b> · ${esc(humanize(e.what))} <span class="muted">· 우리 글 ${ours}</span></li>`;
  };
  const shown = events.slice(0, 6);
  const rest = events.slice(6);
  const evHtml = shown.length
    ? `<ul class="plain">${shown.map(evRow).join('')}</ul>${rest.length ? `<details class="more"><summary>나머지 ${rest.length}건</summary><ul class="plain">${rest.map(evRow).join('')}</ul></details>` : ''}`
    : empty('물결 감시 항목 없음');
  // 0400 다음 지정
  let q0400Html = '';
  if (q0400.ok) {
    const keys = Object.keys(q0400.data ?? {})
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k > TODAY)
      .sort();
    const k = keys[0];
    if (k) {
      const v = q0400.data[k] && typeof q0400.data[k] === 'object' ? q0400.data[k] : {};
      const what =
        v.mode === 'update'
          ? `갱신 · ${v.target ? localLink(v.target, shortSlug(basename(v.target, '.json'))) : '대상 없음'}`
          : `신규 · ${esc(v.keyword ?? '없음')}`;
      q0400Html = `<li>${badge('good', dday(TODAY, k))} <b>04시 자동 발행</b> · ${esc(k)} ${what}${keys.length > 1 ? ` <span class="muted">(이후 ${keys.length - 1}건 더)</span>` : ''}</li>`;
    } else {
      q0400Html = '<li><b>04시 자동 발행</b> · 다음 지정 없음 → 평소 선정</li>';
    }
  }
  // 선점 캘린더
  let lgHtml = '';
  if (landgrab.ok && Array.isArray(landgrab.data?.items)) {
    const up = landgrab.data.items
      .filter((i) => typeof i.writeBy === 'string' && i.writeBy >= TODAY)
      .sort((a, b) => a.writeBy.localeCompare(b.writeBy))
      .slice(0, 2);
    lgHtml = up
      .map(
        (i) =>
          `<li>${badge('good', dday(TODAY, i.writeBy))} <b>선점</b> · ${esc(i.topic)} <span class="muted">작성 기한 ${esc(i.writeBy)} · ${esc(statusKo(i.status))}</span></li>`,
      )
      .join('');
  }
  const other =
    q0400Html || lgHtml
      ? `<h3>자동 발행 · 선점</h3><ul class="plain">${q0400Html}${lgHtml}</ul>`
      : '';
  return card(
    'schedule',
    '다가오는 일정',
    [
      srcItem(
        'docs/ops/pipeline-queue.json',
        `감시 ${pqWatch.length}줄 · ${kst(pqMeta.generatedAt)}`,
      ),
      srcItem('docs/ops/0400-queue.json', q0400.ok ? `수정 ${kst(q0400.mtime)}` : q0400.error),
      srcItem(
        'docs/ops/landgrab-calendar.json',
        landgrab.ok ? `갱신 ${landgrab.data?.updated ?? '없음'}` : landgrab.error,
      ),
      '<li>물결 날짜는 감시 문장의 "개시 MM/DD"·"YYYY-MM-DD"에서 읽고 D-day는 오늘 기준으로 다시 계산.</li>',
    ],
    `<h3>물결 · 갱신 시점</h3>${evHtml}${other}`,
  );
}

function moreSection() {
  // 자동화
  const autoRows = automation.length
    ? `<div class="tw"><table class="mini"><thead><tr><th>워크플로</th><th>예정(KST)</th><th>마지막 산출</th><th>상태</th></tr></thead><tbody>${automation
        .map(
          (a) =>
            `<tr><td>${esc(a.file.replace(/\.ya?ml$/, ''))}</td><td>${esc(a.schedule)}${a.next ? ` <span class="muted">다음 ${esc(a.next)}</span>` : ''}</td><td>${a.outputName ? `${esc(a.outputName)} ${a.lastMs ? esc(kstShort(a.lastMs)) : '없음'}` : '<span class="muted">—</span>'}</td><td>${badge(a.state === 'good' ? 'good' : a.state === 'crit' ? 'crit' : 'none', a.stateText)}</td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : empty('워크플로 cron 없음');
  const noCron = crons.filter((c) => !c.crons.length).map((c) => c.file.replace(/\.ya?ml$/, ''));
  const noCronHtml = noCron.length
    ? `<p class="muted">시간표 없이 이벤트·수동으로 도는 것: ${noCron.map((f) => esc(f)).join(' · ')} (04시 자동 발행 포함 — 스케줄이 다른 곳에 있거나 수동)</p>`
    : '';
  const unregHtml = unregisteredTargets.length
    ? `<p class="muted">순위 추적 대상인데 아직 측정 기록이 없는 쿼리 ${unregisteredTargets.length}건: ${unregisteredTargets.map((t) => esc(t.query)).join(' · ')}</p>`
    : '';
  // API
  const au = radar.ok ? (radar.data?.apiUsage ?? {}) : {};
  const g = au.groups ?? {};
  const apiHtml =
    g.search || g.datalab
      ? `<ul class="plain">${g.search ? `<li>검색 API · 일 ${num(g.search.perDay)} / ${num(g.search.dailyQuota)} (${pct(g.search.dailyPct)}) · 월 ${num(g.search.perMonth)} / ${num(g.search.monthlyQuota)} (${pct(g.search.monthlyPct)})</li>` : ''}${g.datalab ? `<li>데이터랩 · 월 ${num(g.datalab.perMonth)} / ${num(g.datalab.monthlyQuota)} (${pct(g.datalab.monthlyPct)})</li>` : ''}</ul><p class="muted">스케줄대로 돌 때의 산출값(하루 ${num(au.runsPerDay)}회 · 회차당 ${num(au.thisRun)}회). 실누적은 Ncloud 콘솔.</p>`
      : empty('사용량 기록 없음');
  // 잠금 장부
  const m = ci.ok ? (ci.data?.meta ?? {}) : {};
  const lockHtml = ci.ok
    ? `<ul class="plain"><li>지역 ${num(m.regionCount)} · 글 ${num(m.entryCount)} · A ${num(m.families?.A)} / B ${num(m.families?.B)} / V ${num(m.families?.V)} · 민생 잠금 ${num(m.clusters?.minsaeng)} · 롤업 ${num(m.rollups)}</li><li>오늘 편입 ${ciToday.length}건${ciToday.length ? `: ${ciToday.map((e) => `${esc(ciRegionOf(e).join('/'))} ${esc(e.family)} ${extLink(postUrl(e.slug), shortSlug(e.slug))}`).join(' · ')}` : ''}</li></ul><p class="muted">거부 규칙: 같은 지자체×같은 패밀리, 또는 A 있는 지역에 V 추가. 판정은 build-cluster-intents.mjs --check가 한다.</p>`
    : empty(ci.error ?? '데이터 없음');
  const howto = `<ul class="plain"><li>데이터랩 값은 상대값(기준 키워드=100)이지 검색량이 아니다. 발행 근거는 SERP 실측이 우선.</li><li>미노출 ≠ 유입 0. 블록 만석은 자사 글이 웹문서 블록 밖으로 밀린 상태이고, 순위가 있어도 유입이 0일 수 있다.</li><li>트래픽의 상위 160 검색어는 전체 검색 유입의 약 34%다. 점유율은 전체가 아니라 상위 행 기준.</li><li>D-day와 "오늘"은 이 화면을 생성한 시각에 고정된다. 하루 지났으면 다시 뽑는다.</li><li>모든 값은 로컬 파일 기준. 봇이 커밋한 최신 파일은 git pull 뒤에 보인다.</li></ul>`;
  const details = (id, title, body) =>
    `<details class="more" id="${id}"><summary>${esc(title)}</summary>${body}</details>`;
  return `<section class="card thin" id="more"><h2>자세히</h2>${details('more-auto', `자동화 상태${delayed.length ? ` — 지연 ${delayed.length}` : ''}`, autoRows + noCronHtml + unregHtml)}${details('more-api', 'API 사용량', apiHtml)}${details('more-lock', '잠금 장부 요약', lockHtml)}${details('more-howto', '읽는 법', howto)}</section>`;
}

// ───────────────────────── 조립 ─────────────────────────
const sections = [
  todoSection(),
  keywordSection(),
  ideasSection(),
  ranksSection(),
  trafficSection(),
  updatesSection(),
  scheduleSection(),
  moreSection(),
];

const CSS = `
:root{color-scheme:light;--bg:#f6f6f3;--card:#ffffff;--line:#e5e4df;--text:#16160f;--text2:#5a5955;--muted:#8b8a85;--link:#1d5db3;
--good:#1f7a3a;--good-bg:#e4f3e8;--warn:#9a6b12;--warn-bg:#fbf0d5;--none:#6a6965;--none-bg:#ededea;--crit:#b3261e;--crit-bg:#fae5e3;
--s1:#2f6fd0;--s2:#e07a3f;--s3:#2aa876;--s4:#a3a29d}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#121211;--card:#1b1b1a;--line:#2f2e2b;--text:#f1f0ea;--text2:#bcbbb2;--muted:#8a8982;--link:#8fb8ee;
--good:#6fcf8a;--good-bg:#173a22;--warn:#e6b85e;--warn-bg:#3b2f13;--none:#a6a59e;--none-bg:#2a2a28;--crit:#f08f84;--crit-bg:#41211d;--s4:#6d6c67}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#121211;--card:#1b1b1a;--line:#2f2e2b;--text:#f1f0ea;--text2:#bcbbb2;--muted:#8a8982;--link:#8fb8ee;
--good:#6fcf8a;--good-bg:#173a22;--warn:#e6b85e;--warn-bg:#3b2f13;--none:#a6a59e;--none-bg:#2a2a28;--crit:#f08f84;--crit-bg:#41211d;--s4:#6d6c67}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;word-break:keep-all;overflow-wrap:anywhere}
a{color:var(--link)}a.local{color:var(--text2);text-decoration-style:dotted}
a.q{color:inherit;text-decoration:none;border-bottom:1px dotted var(--muted)}a.q:hover{color:var(--link);border-bottom-color:var(--link)}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line)}
.bar{max-width:1080px;margin:0 auto;padding:10px 20px;display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;font-size:12.5px;color:var(--text2)}
.bar b{font-size:15px;color:var(--text)}
main{max-width:1080px;margin:0 auto;padding:12px 20px 40px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 22px;margin:16px 0}
.card.thin{padding:14px 22px}
.card-h{display:flex;align-items:baseline;gap:12px;margin-bottom:10px}
h2{font-size:18px;margin:0;font-weight:700}h3{font-size:14px;margin:18px 0 8px;color:var(--text2);font-weight:600}h3 .muted{font-weight:400}
.src{font-size:12px;color:var(--muted);margin-left:auto}.src summary{cursor:pointer;list-style:none;padding:0 6px;border:1px solid var(--line);border-radius:4px}.src summary::-webkit-details-marker{display:none}
.src ul{margin:6px 0 0;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);box-shadow:0 4px 16px rgba(0,0,0,.12);list-style:none;font-size:12px;position:absolute;right:0;width:max-content;min-width:240px;max-width:min(440px,80vw);z-index:3;overflow-wrap:normal;word-break:keep-all;text-align:left}.src{position:relative}.src li{margin:2px 0}.src li span{color:var(--muted);margin-left:6px}
.sub,.lead{margin:0 0 10px;color:var(--text2);font-size:13.5px}.lead b{color:var(--text)}
.muted{color:var(--muted)}.none{color:var(--none)}.empty{color:var(--muted);font-style:italic;margin:6px 0}
.foot{font-size:12.5px;color:var(--muted);margin:12px 0 0}
.b{display:inline-block;padding:0 9px;border-radius:999px;font-size:12px;font-weight:600;line-height:1.7;white-space:nowrap;vertical-align:middle}
.b-good{color:var(--good);background:var(--good-bg)}.b-warn{color:var(--warn);background:var(--warn-bg)}.b-none{color:var(--none);background:var(--none-bg)}.b-crit{color:var(--crit);background:var(--crit-bg)}
.todo{margin:0;padding:0;list-style:none;counter-reset:n}
.todo li{display:flex;align-items:baseline;gap:12px;padding:8px 0;border-top:1px solid var(--line)}.todo li:first-child{border-top:none;padding-top:2px}
.todo .t{flex:1;font-size:15.5px;font-weight:600}.todo .t::before{counter-increment:n;content:counter(n) ".";color:var(--muted);font-weight:400;margin-right:8px}
.todo .jump{font-size:12.5px;white-space:nowrap;text-decoration:none}.todo .jump:hover{text-decoration:underline}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:700px){.two{grid-template-columns:1fr}}
.box{border:1px solid var(--line);border-radius:10px;padding:12px 14px;min-width:0;container-type:inline-size}
.box h3{font-size:16px;margin:0;color:var(--text);font-weight:700}.box .desc{font-size:12.5px;color:var(--muted);margin:2px 0 6px}
.box .sum{font-size:12.5px;color:var(--text2);margin:0;padding-bottom:6px;border-bottom:1px solid var(--line)}.box .sum b{color:var(--text)}
.rows3{container-type:inline-size}
.lns{display:flex;flex-direction:column}
.ln{display:grid;grid-template-columns:minmax(0,1fr) max-content;gap:2px 10px;align-items:start;padding:9px 0;border-top:1px solid var(--line)}.lns .ln:first-child{border-top:none}
.ln .c1{grid-area:1/1;font-weight:700;font-size:14.5px;line-height:1.4}.ln .c4{grid-area:1/2;justify-self:end}
.ln .c2,.ln .c3,.ln .cond,.ln .ev{grid-column:1/-1}
.ln .c2{font-size:12.5px;color:var(--text2)}.ln .c3{font-size:13px}.ln .c3::before{content:"→ ";color:var(--muted)}
.ln .ours{font-weight:400;font-size:12px;color:var(--muted);line-height:1.5}
.ln .cond{font-size:12.5px;color:var(--text2);margin-top:2px}
.ln .ev{margin-top:2px}.ln .ev>summary{cursor:pointer;font-size:12px;color:var(--muted);padding:2px 0}.ln .ev .small{font-size:12.5px;color:var(--text2)}.ln .ev .small li{margin:3px 0}
@container (min-width:560px){.ln{grid-template-columns:minmax(0,1.25fr) minmax(0,1.1fr) minmax(0,1.25fr) max-content;gap:2px 14px;align-items:center}.ln .c1,.ln .c4{grid-area:auto}.ln .c2,.ln .c3{grid-column:auto}.ln .c3::before{content:none}}
.row-why{font-size:13px;color:var(--text2);margin-top:3px}
.tiles{display:flex;gap:12px;flex-wrap:wrap}.tile{flex:1;min-width:120px;border:1px solid var(--line);border-radius:10px;padding:10px 14px;display:flex;flex-direction:column}.tile-v{font-size:26px;font-weight:700;line-height:1.2}.tile-l{font-size:12.5px;color:var(--text2)}
.tile-v.good{color:var(--good)}.tile-v.warn{color:var(--warn)}.tile-v.none{color:var(--none)}
.up{color:var(--good);font-weight:700}.down{color:var(--crit);font-weight:700}
.plain{margin:4px 0;padding-left:0;list-style:none}.plain li{margin:6px 0}.plain.upd li{padding:6px 0;border-bottom:1px solid var(--line)}.plain.upd li:last-child{border-bottom:none}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--text2);white-space:nowrap;font-size:12px}td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}td.qcol{min-width:16em}td.nw{white-space:nowrap}
table.mini td,table.mini th{padding:5px 8px}
.bignum{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:4px 0 12px}.bn{font-size:34px;font-weight:700;line-height:1.1}.bn-l{font-size:13.5px;color:var(--text2)}
.stack{display:flex;height:16px;gap:2px;border-radius:6px;overflow:hidden}.seg{height:100%;min-width:2px}.s1{background:var(--s1)}.s2{background:var(--s2)}.s3{background:var(--s3)}.s4{background:var(--s4)}
.legend{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12.5px;margin-top:6px;color:var(--text2)}.legend b{color:var(--text)}.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
details.more{margin-top:12px}details.more>summary{cursor:pointer;font-size:13px;color:var(--text2);padding:6px 0}details.more[open]>summary{margin-bottom:6px}
.filter{width:100%;max-width:320px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--text);font:inherit;font-size:13px}
footer{font-size:12px;color:var(--muted);margin:16px 0;text-align:center}
@media (max-width:600px){main{padding:8px 12px 30px}.card{padding:14px 14px}.bar{padding:8px 12px}.tile-v{font-size:22px}.bn{font-size:28px}.src ul{max-width:80vw}}
@media print{header{position:static}.card{break-inside:avoid;border:none;padding:0 0 12px}.tw{overflow:visible}a{color:inherit;text-decoration:none}.src{display:none}}
`;

const JS = `
document.addEventListener('DOMContentLoaded',function(){
  var f=document.getElementById('rank-filter');var t=document.getElementById('rank-table');
  if(f&&t){f.addEventListener('input',function(){var v=f.value.trim().toLowerCase();t.querySelectorAll('tbody tr').forEach(function(tr){tr.hidden=!!v&&tr.textContent.toLowerCase().indexOf(v)<0;});});}
  document.addEventListener('click',function(e){document.querySelectorAll('details.src[open]').forEach(function(d){if(!d.contains(e.target))d.removeAttribute('open');});});
});
`;

const genKst = kst(NOW);
const freshness = oldestCore
  ? `데이터 최신: ${esc(oldestCore[0])} ${esc(agoText(oldestCore[1]))}${oldestAgeH > 24 ? ` ${badge('warn', 'git pull 후 다시 뽑기')}` : ''}`
  : '데이터 최신: 핵심 파일 없음';
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>awoo 운영 ${esc(TODAY)}</title>
<style>${CSS}</style>
</head>
<body>
<header><div class="bar"><b>awoo 운영</b><span>기준일 ${esc(TODAY)} (KST)</span><span>생성 ${esc(genKst)}</span><span>${freshness}</span><span>${extLink(SITE, 'awoo.or.kr')}</span></div></header>
<main>
${sections.join('\n')}
</main>
<footer>scripts/ops-dashboard.mjs · 생성 ${esc(genKst)} KST · 로컬 전용 생성물(커밋하지 않음) · 비밀 파일은 읽지 않았다</footer>
<script>${JS}</script>
</body>
</html>
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html, 'utf8');
const bytes = Buffer.byteLength(html, 'utf8');
console.log(
  `${rel(OUT)} 생성 — ${(bytes / 1024).toFixed(1)} KB · 섹션 ${sections.length} · 할 일 ${todos.length}줄 · 새 키워드 ${kwList.length}건 · 기준일 ${TODAY} · 생성 ${genKst} KST`,
);
if (bytes > 1.5 * 1024 * 1024) {
  console.error('경고: 1.5MB 초과');
  process.exitCode = 1;
}
