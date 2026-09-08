// ─────────────────────────────────────────────────────────────
// keyword-radar — 지원금 키워드 수요 레이더
//
// 합법 소스만 사용 (KEYWORD-INTELLIGENCE-PLAN §3):
//   [kin]     지식iN 검색 API (openapi.naver.com/v1/search/kin.json) — 신규 질문 수집
//   [news]    기존 today-issue.json / _history.json 트렌딩 baseline (재수집 X)
//   [datalab] 데이터랩 검색어트렌드 (openapi.naver.com/v1/datalab/search) — 상대수요 + 모멘텀
//   [market]  블로그·카페·뉴스 검색 API — 공급 규모·경쟁 신선도·최근 보도량 → 수요/공급 갭
//   [demo]    같은 API의 연령 필터(ages) — 연령대 쏠림 → 페르소나 힌트
//
// 산출: src/data/keyword-radar.json (30일 롤링, 스냅샷당 top 30)
//   signals.datalab   최근 7일 상대수요 0~5
//   signals.momentum  최근 7일 ÷ 직전 23일 (1.5↑ = 급상승, 점수 가산)
//   demo              { young, middle, senior } % + peak + personaHint
//   signals.gap       수요(질문·보도) ÷ 공급(블로그 문서량·최근글비율) — 3↑면 네이버 진입 우위
//   market            { blogTotal, blogFresh, cafeTotal, newsRecent }
// 소비: keyword-scout 에이전트 / /today / /traffic / 0400 루틴
//
// 사용:
//   node scripts/keyword-radar.mjs                  # 수집 + 적재
//   node scripts/keyword-radar.mjs --dry-run        # 적재 없이 stdout 표만
//   node scripts/keyword-radar.mjs --sources=kin    # 소스 한정 (kin,news,datalab,demo,market)
// ─────────────────────────────────────────────────────────────
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'src', 'data', 'keyword-radar.json');
const HISTORY_FILE = join(ROOT, 'src', 'data', 'issues', '_history.json');
const TODAY_ISSUE_FILE = join(ROOT, 'src', 'data', 'today-issue.json');
const CURATED_DIR = join(ROOT, 'src', 'data', 'subsidies', '_curated');
const GOV24_DIR = join(ROOT, 'src', 'data', 'subsidies', '_gov24');

const KIN_API = 'https://openapi.naver.com/v1/search/kin.json';
const DATALAB_API = 'https://openapi.naver.com/v1/datalab/search';
const BLOG_API = 'https://openapi.naver.com/v1/search/blog.json';
const CAFE_API = 'https://openapi.naver.com/v1/search/cafearticle.json';
const NEWS_API = 'https://openapi.naver.com/v1/search/news.json';

const ROLLING_DAYS = 30;
const SNAPSHOT_TERM_CAP = 30;
const FILE_SIZE_GUARD = 500 * 1024; // 500KB
const FETCH_DELAY_MS = 150;

// 데이터랩 호출 예산 (일 1,000회 한도, 하루 4회 실행 기준 여유 충분)
const DATALAB_TOP = 20; // 상대수요·모멘텀 대상 (5개씩 4요청)
const DEMO_TOP = 10; // 연령 프로파일 대상 (5개씩 2요청 × 3버킷 = 6요청)
const MOMENTUM_SURGE = 1.5; // 최근 7일이 직전 23일의 1.5배 이상이면 급상승
const MOMENTUM_BONUS = 2;
// 네이버 공급·보도량 (검색 API 일 25,000회 — 키워드당 3콜)
const MARKET_TOP = 15;
const GAP_STRONG = 3; // 이 이상이면 "수요 대비 공급이 빈 자리"

// 지식iN 질문 수집 시드 (광역 도메인 질의)
const SEED_QUERIES = [
  '지원금 신청',
  '보조금',
  '수당 받을 수 있나요',
  '바우처',
  '장려금',
  '급여 신청 자격',
  '기초연금',
  '실업급여',
  '환급 언제',
  '청년 적금',
];

// 키워드(term) 추출 — 이 접미사로 끝나는 n-gram만 도메인 후보로 인정
const TERM_SUFFIX_RE =
  /([가-힣A-Za-z0-9·]{1,14}(?:지원금|보조금|수당|바우처|장려금|급여|연금|적금|환급금|장학금|대출금리는?|계좌))/g;

// 스팸/저품질 필터 — 제목에 포함 시 해당 질문 폐기
const SPAM_RE =
  /보험\s?추천|보험\s?상담|대출\s?상담|작업대출|폰테크|개인회생|회생\s?파산|카지노|토토|리딩방|코인\s?추천|주식\s?리딩|상조|렌탈|광고|홍보/;

// term 자체 블랙리스트 (도메인 무관 일반어)
const TERM_BLACKLIST = new Set(['월급여', '본급여', '주휴수당은', '퇴직급여']);

// 갱신 후보 감지 — 기발행 글의 미확정 마커 ("예정" 단독은 오탐 多 → 제외)
const ISSUES_DIR = join(ROOT, 'src', 'data', 'issues');
const STALE_MARKER_RE =
  /발표 대기|발표대기|미확정|추후 확정|공시 예정|확정 전|검토 중|검토중|보도 기준/g;

// ── env ──────────────────────────────────────────────────────
async function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    try {
      const text = await readFile(join(ROOT, file), 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
      }
    } catch {}
  }
  return env;
}

// ── 정제 (sync-issues clean()과 동일 정책 — prompt injection 표면 축소) ──
function clean(text, maxLen = 0) {
  if (!text) return '';
  let s = String(text);
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  s = s.replace(/<[^>]*>/g, '');
  s = s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control-char strip
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  s = s.replace(/javascript:/gi, 'javascript_').replace(/data:/gi, 'data_');
  s = s.replace(/\s+/g, ' ').trim();
  if (maxLen > 0 && s.length > maxLen) s = `${s.slice(0, maxLen)}…`;
  return s;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 소스 1: 지식iN 검색 API ──────────────────────────────────
async function collectKin(env) {
  const headers = {
    'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
  };
  const questions = [];
  for (const seed of SEED_QUERIES) {
    const url = `${KIN_API}?query=${encodeURIComponent(seed)}&display=30&sort=date`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`kin.json ${res.status} (seed: ${seed})`);
    const data = await res.json();
    for (const item of data.items ?? []) {
      const title = clean(item.title, 200);
      if (!title || SPAM_RE.test(title)) continue;
      questions.push({ title, seed });
    }
    await sleep(FETCH_DELAY_MS);
  }
  return questions;
}

// ── 소스 2: 뉴스 트렌딩 baseline (기존 산출물 읽기만) ─────────
async function collectNewsBaseline() {
  const signal = new Map(); // term → newsScore
  try {
    const today = JSON.parse(await readFile(TODAY_ISSUE_FILE, 'utf8'));
    if (today.trendingTopic) {
      signal.set(today.trendingTopic, (today.trendingTopicCount ?? 1) * 1.0);
    }
  } catch {}
  try {
    const history = JSON.parse(await readFile(HISTORY_FILE, 'utf8'));
    const cutoff = Date.now() - 7 * 86400_000;
    for (const [term, rec] of Object.entries(history.byTerm ?? {})) {
      const lastSeen = Date.parse(rec.lastSeen ?? 0);
      if (lastSeen >= cutoff) {
        signal.set(term, Math.max(signal.get(term) ?? 0, 2));
      }
    }
  } catch {}
  return signal;
}

// ── 소스 5: 네이버 공급·보도량 (블로그·카페·뉴스 검색 API) ──────
// 네이버 상위노출은 "수요 대비 공급이 빈 자리"에서 가장 쉽게 난다.
// 지식iN 질문(수요)만 보던 것에 실제 문서 수(공급)를 붙여 갭을 계산한다.
//   blogTotal   블로그 총 문서 수 (공급 규모)
//   blogFresh   최신 30건 중 30일 이내 비율 0~1 (경쟁 활발도 — 높으면 레드오션)
//   newsRecent  최근 7일 뉴스 건수 (시기성 실측 — 기존 news는 자체 파일 baseline이었다)
async function searchCount(env, api, query, { sort = 'sim', display = 1 } = {}) {
  const headers = {
    'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
  };
  const url = `${api}?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${api.split('/').pop()} ${res.status}`);
  return res.json();
}

const DAY = 86400_000;

async function collectNaverMarket(env, terms) {
  const market = new Map(); // term → { blogTotal, blogFresh, cafeTotal, newsRecent }
  for (const term of terms) {
    const rec = {};
    try {
      const blog = await searchCount(env, BLOG_API, term, { sort: 'date', display: 30 });
      rec.blogTotal = blog.total ?? 0;
      const items = blog.items ?? [];
      const cutoff = Date.now() - 30 * DAY;
      // postdate = YYYYMMDD
      const fresh = items.filter((it) => {
        const d = String(it.postdate ?? '');
        if (d.length !== 8) return false;
        return Date.parse(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`) >= cutoff;
      }).length;
      rec.blogFresh = items.length ? Math.round((fresh / items.length) * 100) / 100 : null;
      await sleep(FETCH_DELAY_MS);
    } catch {}
    try {
      const cafe = await searchCount(env, CAFE_API, term);
      rec.cafeTotal = cafe.total ?? 0;
      await sleep(FETCH_DELAY_MS);
    } catch {}
    try {
      const news = await searchCount(env, NEWS_API, term, { sort: 'date', display: 30 });
      const cutoff = Date.now() - 7 * DAY;
      rec.newsRecent = (news.items ?? []).filter(
        (it) => Date.parse(it.pubDate ?? 0) >= cutoff,
      ).length;
      await sleep(FETCH_DELAY_MS);
    } catch {}
    if (Object.keys(rec).length) market.set(term, rec);
  }
  return market;
}

// 수요/공급 갭 — 네이버 상위노출 진입 난이도의 대리 지표.
// 질문은 쏟아지는데 블로그 공급이 얇고 최근 글도 적으면 갭이 크다(=기회).
function gapScore({ kinQuestions = 0, newsRecent = 0, blogTotal = 0, blogFresh = null }) {
  const demand = kinQuestions * 1.5 + newsRecent;
  if (demand <= 0) return 0;
  // 공급은 자릿수로 압축 (1만건과 10만건의 차이는 선형이 아니다)
  const supply = Math.max(Math.log10(Math.max(blogTotal, 10)), 1);
  const freshPenalty = blogFresh == null ? 1 : 1 + blogFresh; // 최근 글 많으면 최대 2배 불리
  return Math.round((demand / (supply * freshPenalty)) * 10) / 10;
}

// ── 데이터랩 공통 호출 (5키워드 1묶음, filter = {ages/gender/device}) ──
// 주의: ratio는 "그 요청 안에서의" 최대값 100 기준 상대지수다. 서로 다른 요청
// (연령 버킷이 다른 호출 등)의 ratio를 절대 비교하면 안 된다. 대신 같은 요청 안에서
// 각 키워드가 차지하는 몫(share)을 구해 요청 간에 비교한다.
async function datalabQuery(env, terms, { days = 29, timeUnit = 'date', filter = {} } = {}) {
  const headers = {
    'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
    'Content-Type': 'application/json',
  };
  const fmt = (d) => d.toISOString().slice(0, 10);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const out = new Map(); // term → { points: [ratio...] }
  for (let i = 0; i < terms.length; i += 5) {
    const groups = terms.slice(i, i + 5).map((t) => ({ groupName: t, keywords: [t] }));
    const res = await fetch(DATALAB_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        startDate: fmt(start),
        endDate: fmt(end),
        timeUnit,
        keywordGroups: groups,
        ...filter,
      }),
    });
    if (!res.ok) throw new Error(`datalab ${res.status}`);
    const data = await res.json();
    for (const r of data.results ?? []) {
      out.set(
        r.title,
        (r.data ?? []).map((p) => p.ratio),
      );
    }
    await sleep(FETCH_DELAY_MS);
  }
  return out;
}

const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

// ── 소스 3: 데이터랩 상대수요 + 모멘텀(급상승) ────────────────
// 30일 일별 시계열을 한 번만 받아 두 신호를 뽑는다 (추가 호출 없음).
//   demand   최근 7일 평균을 0~5로 압축 (기존 점수 체계 유지)
//   momentum 최근 7일 평균 ÷ 직전 23일 평균 → 1.0이면 보합, 1.5↑면 급상승
async function collectDatalab(env, terms) {
  const series = await datalabQuery(env, terms);
  const demand = new Map();
  const momentum = new Map();
  for (const [term, points] of series) {
    const last7 = points.slice(-7);
    const prev = points.slice(0, -7);
    const a7 = avg(last7);
    const aPrev = avg(prev);
    demand.set(term, Math.round((a7 / 100) * 5 * 10) / 10);
    if (aPrev > 0 && prev.length >= 7) {
      momentum.set(term, Math.round((a7 / aPrev) * 100) / 100);
    }
  }
  return { demand, momentum };
}

// ── 소스 4: 연령대 쏠림 → 페르소나 힌트 ──────────────────────
// 네이버 연령 코드: 3~5=19~34, 6~10=35~59, 11=60+
// 버킷별로 따로 호출한 뒤 "그 요청 안에서 이 키워드가 차지하는 몫"을 비교한다.
const AGE_BUCKETS = [
  { key: 'young', label: '19~34', ages: ['3', '4', '5'] },
  { key: 'middle', label: '35~59', ages: ['6', '7', '8', '9', '10'] },
  { key: 'senior', label: '60+', ages: ['11'] },
];
const AGE_PERSONA = { young: 'office-rookie', middle: 'newlywed-family', senior: 'senior' };

async function collectAgeProfile(env, terms) {
  const shareByBucket = new Map(); // bucketKey → Map(term → share)
  for (const b of AGE_BUCKETS) {
    const series = await datalabQuery(env, terms, { filter: { ages: b.ages } });
    const means = new Map();
    for (const [term, points] of series) means.set(term, avg(points.slice(-14)));
    const total = [...means.values()].reduce((s, v) => s + v, 0);
    const shares = new Map();
    for (const [term, m] of means) shares.set(term, total > 0 ? m / total : 0);
    shareByBucket.set(b.key, shares);
  }
  const profile = new Map(); // term → { young, middle, senior, peak, personaHint }
  for (const term of terms) {
    const raw = {};
    for (const b of AGE_BUCKETS) raw[b.key] = shareByBucket.get(b.key)?.get(term) ?? 0;
    const sum = Object.values(raw).reduce((s, v) => s + v, 0);
    if (sum <= 0) continue;
    const norm = {};
    for (const k of Object.keys(raw)) norm[k] = Math.round((raw[k] / sum) * 100);
    const peak = Object.entries(norm).sort((a, b) => b[1] - a[1])[0][0];
    profile.set(term, { ...norm, peak, personaHint: AGE_PERSONA[peak] });
  }
  return profile;
}

// ── 지원금 DB 매칭 ───────────────────────────────────────────
async function loadSubsidyIndex() {
  const idx = []; // {id, text}
  for (const dir of [CURATED_DIR, GOV24_DIR]) {
    try {
      for (const f of await readdir(dir)) {
        if (!f.endsWith('.json') || f.startsWith('_')) continue;
        try {
          const d = JSON.parse(await readFile(join(dir, f), 'utf8'));
          const text = [d.title, ...(d.tags ?? [])].join(' ');
          idx.push({ id: d.id ?? f.replace(/\.json$/, ''), text });
        } catch {}
      }
    } catch {}
  }
  return idx;
}

function matchSubsidies(term, idx) {
  const core = term.replace(/(지원금|보조금|수당|바우처|장려금|급여|연금|적금|환급금|장학금)$/, '');
  return idx
    .filter((s) => s.text.includes(term) || (core.length >= 2 && s.text.includes(core)))
    .map((s) => s.id)
    .slice(0, 5);
}

// ── term 추출·집계 ───────────────────────────────────────────
function extractTerms(questions) {
  const byTerm = new Map(); // term → {count, questions:[]}
  for (const q of questions) {
    const seen = new Set();
    for (const m of q.title.matchAll(TERM_SUFFIX_RE)) {
      const term = m[1].replace(/^[0-9·]+/, '').trim();
      if (term.length < 3 || term.length > 18) continue;
      if (TERM_BLACKLIST.has(term) || seen.has(term)) continue;
      seen.add(term);
      const rec = byTerm.get(term) ?? { count: 0, questions: [] };
      rec.count += 1;
      if (rec.questions.length < 3) rec.questions.push(q.title);
      byTerm.set(term, rec);
    }
  }
  return byTerm;
}

// ── 갱신 후보 감지: 미확정 마커 보유 글 × 오늘 수요 신호 교차 ──
// 마커가 남은 글의 키워드가 지식iN/뉴스에서 다시 움직이면 "확정 발표 났을 가능성" 플래그.
// 실제 확정 여부 검증은 /today의 fact-checker 몫 — 여기선 감지만 한다.
async function scanUpdateCandidates(questions, newsSignal, rows) {
  const posts = [];
  try {
    for (const dateDir of await readdir(ISSUES_DIR)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir)) continue;
      for (const f of await readdir(join(ISSUES_DIR, dateDir))) {
        if (!f.endsWith('.json') || f.startsWith('_')) continue;
        try {
          const d = JSON.parse(await readFile(join(ISSUES_DIR, dateDir, f), 'utf8'));
          const body = JSON.stringify([d.tldr, d.coreFacts, d.sections, d.faq, d.table]);
          const markers = (body.match(STALE_MARKER_RE) ?? []).length;
          if (markers === 0) continue;
          const term = d.freshness?.trendingTerm ?? d.tags?.[0] ?? '';
          if (!term) continue;
          posts.push({ slug: f.replace(/\.json$/, ''), date: dateDir, term, markers });
        } catch {}
      }
    }
  } catch {}

  const core = (t) =>
    t.replace(/(지원금|보조금|수당|바우처|장려금|급여|연금|적금|환급금|장학금)$/, '') || t;
  const candidates = [];
  for (const p of posts) {
    const kinCount = questions.filter((q) => q.title.includes(core(p.term))).length;
    const news = newsSignal.get(p.term) ?? 0;
    const datalab = rows.find((r) => r.term === p.term)?.signals.datalab ?? 0;
    const signalScore = Math.round((kinCount * 1.5 + news + datalab) * 10) / 10;
    if (signalScore >= 2) {
      candidates.push({ ...p, signal: { kinQuestions: kinCount, news, datalab }, signalScore });
    }
  }
  candidates.sort((a, b) => b.signalScore - a.signalScore);
  return candidates;
}

// ── 적재 (30일 롤링 + 사이즈 가드) ───────────────────────────
async function loadStore() {
  try {
    return JSON.parse(await readFile(OUT_FILE, 'utf8'));
  } catch {
    return { updatedAt: null, snapshots: [], byTerm: {} };
  }
}

function pruneStore(store) {
  const cutoff = Date.now() - ROLLING_DAYS * 86400_000;
  store.snapshots = store.snapshots.filter((s) => Date.parse(s.ts) >= cutoff);
  // 사이즈 가드: 넘으면 오래된 스냅샷부터 제거
  while (JSON.stringify(store).length > FILE_SIZE_GUARD && store.snapshots.length > 4) {
    store.snapshots.shift();
  }
}

// ── main ─────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const srcArg = args.find((a) => a.startsWith('--sources='));
  const sources = srcArg
    ? srcArg.split('=')[1].split(',')
    : ['kin', 'news', 'datalab', 'demo', 'market'];

  const env = await loadEnv();
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) {
    console.error('[radar] NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 필요 (.env 또는 secrets)');
    process.exit(1);
  }

  const sourceStatus = {};
  let questions = [];
  let newsSignal = new Map();

  if (sources.includes('kin')) {
    try {
      questions = await collectKin(env);
      sourceStatus.kin = `ok (${questions.length} questions)`;
    } catch (e) {
      sourceStatus.kin = `fail: ${e.message}`;
    }
  }
  if (sources.includes('news')) {
    try {
      newsSignal = await collectNewsBaseline();
      sourceStatus.news = `ok (${newsSignal.size} terms)`;
    } catch (e) {
      sourceStatus.news = `fail: ${e.message}`;
    }
  }

  const okCount = Object.values(sourceStatus).filter((v) => v.startsWith('ok')).length;
  if (okCount === 0) {
    console.error('[radar] 모든 소스 실패:', JSON.stringify(sourceStatus));
    process.exit(1);
  }

  // 집계 + 1차 스코어 (kin 빈도 ×1.5 + news ×1.0)
  const termMap = extractTerms(questions);
  for (const [term] of newsSignal) {
    if (!termMap.has(term)) termMap.set(term, { count: 0, questions: [] });
  }
  const subsidyIdx = await loadSubsidyIndex();
  let rows = [...termMap.entries()].map(([term, rec]) => ({
    term,
    signals: { kinQuestions: rec.count, news: newsSignal.get(term) ?? 0, datalab: null },
    questions: rec.questions,
    matchedSubsidies: matchSubsidies(term, subsidyIdx),
    score: rec.count * 1.5 + (newsSignal.get(term) ?? 0),
  }));

  // 도메인 2차 게이트: kin 단독 1회 등장 + 지원금 매칭 0건이면 노이즈로 제거
  rows = rows.filter(
    (r) => r.signals.kinQuestions >= 2 || r.signals.news > 0 || r.matchedSubsidies.length > 0,
  );
  rows.sort((a, b) => b.score - a.score);

  // 데이터랩: 상위 후보 상대수요 + 모멘텀 검증
  if (sources.includes('datalab') && rows.length > 0) {
    try {
      const top = rows.slice(0, DATALAB_TOP).map((r) => r.term);
      const { demand, momentum } = await collectDatalab(env, top);
      for (const r of rows) {
        if (demand.has(r.term)) {
          r.signals.datalab = demand.get(r.term);
          r.score = Math.round((r.score + r.signals.datalab) * 10) / 10;
        }
        if (momentum.has(r.term)) {
          r.signals.momentum = momentum.get(r.term);
          // 급상승 가산: 시기성 오버라이드(마감 D-14·발표 24h)와 같은 방향의 신호
          if (r.signals.momentum >= MOMENTUM_SURGE) {
            r.score = Math.round((r.score + MOMENTUM_BONUS) * 10) / 10;
          }
        }
      }
      rows.sort((a, b) => b.score - a.score);
      sourceStatus.datalab = `ok (${demand.size} terms, 모멘텀 ${momentum.size})`;
    } catch (e) {
      sourceStatus.datalab = `fail: ${e.message}`;
    }
  }

  // 연령대 쏠림 → 페르소나 힌트 (상위 소수만, 실패해도 본 신호는 유지)
  if (sources.includes('demo') && rows.length > 0) {
    try {
      const top = rows.slice(0, DEMO_TOP).map((r) => r.term);
      const profile = await collectAgeProfile(env, top);
      for (const r of rows) {
        if (profile.has(r.term)) r.demo = profile.get(r.term);
      }
      sourceStatus.demo = `ok (${profile.size} terms)`;
    } catch (e) {
      sourceStatus.demo = `fail: ${e.message}`;
    }
  }

  // 네이버 공급·보도량 + 수요/공급 갭 (상위노출 진입 난이도)
  if (sources.includes('market') && rows.length > 0) {
    try {
      const top = rows.slice(0, MARKET_TOP).map((r) => r.term);
      const market = await collectNaverMarket(env, top);
      for (const r of rows) {
        const m = market.get(r.term);
        if (!m) continue;
        r.market = m;
        r.signals.gap = gapScore({ kinQuestions: r.signals.kinQuestions, ...m });
      }
      rows.sort((a, b) => b.score - a.score);
      sourceStatus.market = `ok (${market.size} terms)`;
    } catch (e) {
      sourceStatus.market = `fail: ${e.message}`;
    }
  }

  rows = rows.slice(0, SNAPSHOT_TERM_CAP);
  const ts = new Date().toISOString();

  // 갱신 후보 감지 (미확정 글 × 수요 신호)
  const updateCandidates = await scanUpdateCandidates(questions, newsSignal, rows);

  console.log(`[radar] ${ts} — 소스: ${JSON.stringify(sourceStatus)}`);
  console.log('[radar] top 15:');
  for (const r of rows.slice(0, 15)) {
    const mo = r.signals.momentum
      ? ` mo:${r.signals.momentum}${r.signals.momentum >= MOMENTUM_SURGE ? '🔥' : ''}`
      : '';
    const demo = r.demo ? ` ${r.demo.peak}(${r.demo[r.demo.peak]}%)` : '';
    const gap =
      r.signals.gap != null ? ` gap:${r.signals.gap}${r.signals.gap >= GAP_STRONG ? '★' : ''}` : '';
    console.log(
      `  ${String(r.score).padStart(6)}  ${r.term}  (kin:${r.signals.kinQuestions} news:${r.signals.news} dl:${r.signals.datalab ?? '-'}${mo}${gap}${demo} 매칭:${r.matchedSubsidies.length})`,
    );
  }
  const gaps = rows.filter((r) => (r.signals.gap ?? 0) >= GAP_STRONG);
  if (gaps.length) {
    console.log('[radar] ★ 수요/공급 갭 (네이버 진입 우위):');
    for (const r of gaps.slice(0, 8)) {
      console.log(
        `  gap ${r.signals.gap}  ${r.term}  (질문 ${r.signals.kinQuestions} / 블로그 ${r.market?.blogTotal?.toLocaleString() ?? '-'}건, 최근글비율 ${r.market?.blogFresh ?? '-'})`,
      );
    }
  }
  const surging = rows.filter((r) => (r.signals.momentum ?? 0) >= MOMENTUM_SURGE);
  if (surging.length) {
    console.log('[radar] 📈 급상승 (최근 7일 / 직전 23일):');
    for (const r of surging.slice(0, 8)) {
      console.log(`  ×${r.signals.momentum}  ${r.term}`);
    }
  }
  if (updateCandidates.length) {
    console.log('[radar] 🔔 갱신 후보 (미확정 글 키워드 수요 감지):');
    for (const c of updateCandidates.slice(0, 8)) {
      console.log(`  ${c.signalScore}  ${c.date}/${c.slug} — ${c.term} (마커 ${c.markers}곳)`);
    }
  }

  if (dryRun) {
    console.log('[radar] --dry-run — 적재 생략');
    return;
  }

  const store = await loadStore();
  store.updatedAt = ts;
  store.updateCandidates = updateCandidates.map((c) => ({ ...c, flaggedAt: ts }));
  store.snapshots.push({ ts, sourceStatus, keywords: rows });
  for (const r of rows) {
    const rec = store.byTerm[r.term] ?? { firstSeen: ts, bestScore: 0, appearances: 0 };
    rec.lastSeen = ts;
    rec.bestScore = Math.max(rec.bestScore, r.score);
    rec.appearances += 1;
    store.byTerm[r.term] = rec;
  }
  // byTerm도 30일 미등장 시 정리
  const cutoff = Date.now() - ROLLING_DAYS * 86400_000;
  for (const [term, rec] of Object.entries(store.byTerm)) {
    if (Date.parse(rec.lastSeen) < cutoff) delete store.byTerm[term];
  }
  pruneStore(store);
  await writeFile(OUT_FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  console.log(
    `[radar] 적재 완료 → src/data/keyword-radar.json (스냅샷 ${store.snapshots.length}개)`,
  );
}

main().catch((e) => {
  console.error('[radar] 실패:', e);
  process.exit(1);
});
