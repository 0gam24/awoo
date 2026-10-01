#!/usr/bin/env node
/**
 * next-wave — 다음에 크게 뜰 주제(물결)를 묶음 단위로 찾는다.
 *
 * 왜 필요한가(2026-10-02 수익 하락 진단): 9월까지 수익의 81%가 민생지원금×지역 글에서 나왔는데
 * 추석이 지나자 그 검색이 80~95% 사라졌다. 반값여행은 8월 말에 이미 민생 수준 검색량이었지만
 * 9/29에야 손으로 발견했다. 빈틈 목록(keyword-pipeline)은 "검색어 하나"를 재서 "주제 묶음이
 * 커지는 것"을 못 본다. 이 스크립트가 묶음(정책·혜택 이름 + 지역 변형)을 통째로 잰다.
 *
 * 방법(합법 소스만 — 공식 API):
 *   1) 뉴스 검색 API: 최근 기사 제목에서 정책·혜택 이름(○○지원금·○○여행·○○페스타…)을 뽑고,
 *      같은 제목에 나온 지역 수를 센다. 지역이 많으면 "지역별로 쪼개 쓸 수 있는" 묶음이다
 *      — 수익 패턴(신생 대형 이슈 × 지역 분해 × 조기 선점)의 원형.
 *   2) 고정 감시 목록 docs/ops/next-wave-seeds.json: 해마다 돌아오는 큰 묶음. ignore는 운영자 보류분.
 *   3) 레이더 신생 키워드(src/data/keyword-radar.json candidates의 born).
 *   4) 데이터랩: 묶음(이름 · 이름+신청 · 지역 변형 상위 5)을 56일 일별로 잰다. 요청마다 기준 '실업급여'를
 *      넣어 같은 자로 환산한다(실업급여 28일 평균 = 100). 요청 간 ratio 비교는 무효라서다(keyword-volume과 같은 원칙).
 *
 * 판정(stage):
 *   rising   지금 뜨는 중 — 최근 7일이 직전 3주 평균의 1.4배 이상, 그리고 기준의 8 이상
 *   growing  커지는 중 — 1.2배 이상이고 2 이상, 또는 뉴스에 처음 보인 지 3일 이내(새로 등장)
 *   fading   꺾이는 중 — 0.6배 이하이고 직전 3주가 10 이상(새 글 대신 갱신만)
 *   steady   그 밖
 *
 * 산출: docs/ops/next-wave.json — 위젯(scripts/ops-widget.mjs)의 "다음에 크게 뜰 주제" 칸이 읽는다.
 *       seen에 뉴스 첫 관측일·일별 기사 수를 30일 남겨 "새로 등장"을 가린다.
 *
 * 사용:
 *   node scripts/next-wave.mjs             # 수집 + 적재
 *   node scripts/next-wave.mjs --dry-run   # 적재 없이 요약만
 *   node scripts/next-wave.mjs --if-stale  # 오늘(KST) 결과가 이미 있으면 아무것도 안 한다(/목록용)
 *
 * 호출량: 뉴스 24회(12검색어 × 2쪽) + 데이터랩 최대 11회. 인증: NCP_API_KEY_ID·NCP_API_KEY(HUB) 또는
 * NAVER_CLIENT_ID·NAVER_CLIENT_SECRET(레거시). 값은 출력하지 않는다.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countCall, formatUsage, usageReport } from './lib/api-quota.mjs';
import { NATIONWIDE } from './lib/regions-kr.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_REL = 'docs/ops/next-wave.json';
const SEEDS_REL = 'docs/ops/next-wave-seeds.json';
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const IF_STALE = argv.includes('--if-stale');
const DEBUG_TERMS = argv.includes('--terms'); // 뉴스에서 뽑은 낱말만 보고 끝(데이터랩 호출 없음)

const DAY = 86_400_000;
const kstDate = (offsetDays = 0) =>
  new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * DAY).toISOString().slice(0, 10);
const TODAY = kstDate(0);

const BENCHMARK = '실업급여';
const WINDOW_DAYS = 56;
// 혜택 유형별로 넓게 던진다. sort=date는 한 검색어에 몇 시간치만 주므로 2쪽(200건)씩 본다.
const NEWS_QUERIES = [
  '지원금 신청',
  '신청 접수 시작',
  '환급',
  '할인 지원',
  '반값',
  '바우처',
  '쿠폰',
  '상품권',
  '캐시백',
  '페스타',
  '선착순',
  '지급 개시',
];
const NEWS_PAGES = 2;
const MAX_DYNAMIC = 24; // 뉴스에서 뽑은 묶음 중 잴 개수
const MAX_FAMILIES = 44; // 데이터랩 11회(요청당 4묶음 + 기준)
const MIN_MENTIONS = 3; // 기사 제목 3건 미만은 우연으로 본다

// 정책·혜택 이름의 꼬리. 이 꼬리로 끝나는 낱말만 묶음 후보로 본다.
const POLICY_TAIL =
  /(지원금|수당|바우처|쿠폰|상품권|장려금|여행|페스타|캐시백|환급금|지원사업|급여|연금|기부제|할인권|할인|보조금|지역화폐|패스|카드|적금|계좌|감면|지원비|이용권|교통비|세일)$/;
// 정책이 아닌 흔한 말 — 일반 여행·의료 용어는 이 사이트(지원금) 독자의 물결이 아니다
const NOISE = new Set([
  '해외여행',
  '국내여행',
  '가족여행',
  '연휴 여행',
  '수학여행',
  '신혼여행',
  '요양급여',
  '비급여',
]);
// 카드사·은행 상품명은 정책이 아니다(현대카드·ONE체크카드 같은 잡음)
const BRAND =
  /^(현대|삼성|신한|국민|롯데|우리|하나|비씨|농협|케이뱅크|카카오|토스|씨티|기업|새마을|우체국)/;
// 꼬리만 있는 일반명사 — 혼자선 묶음이 아니다. 앞 낱말과 붙여 "추석 지원금"처럼 만든다.
const GENERIC = new Set([
  '지원금',
  '수당',
  '바우처',
  '쿠폰',
  '상품권',
  '장려금',
  '여행',
  '페스타',
  '캐시백',
  '환급금',
  '지원사업',
  '급여',
  '연금',
  '할인권',
  '할인',
  '보조금',
  '지역화폐',
  '패스',
  '카드',
  '적금',
  '계좌',
  '감면',
  '지원비',
  '이용권',
  '교통비',
  '세일',
  '신용카드',
  '체크카드',
  '국민연금',
  '퇴직연금',
  '개인연금',
]);
// 앞 낱말로 붙이면 안 되는 말(지역·숫자는 따로 거른다)
const WEAK_PREFIX = new Set([
  '및',
  '등',
  '첫',
  '새',
  '더',
  '또',
  '총',
  '각',
  '전',
  '본',
  '이번',
  '올해',
  '내년',
  '지난해',
  '최대',
  '최소',
  '추가',
  '신청',
  '지급',
  '관련',
  '위한',
  '대상',
  '모든',
  '전국',
  '정부',
  '시민',
  '군민',
  '도민',
  '구민',
]);
const JOSA = /(으로|에서|까지|부터|이나|이란|에게|와|과|은|는|이|가|을|를|에|의|도|로|만)$/;

const PROVINCES = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
];

// ── 공통 ─────────────────────────────────────────────────────
async function loadEnv() {
  const env = { ...process.env };
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of (await readFile(join(ROOT, f), 'utf8')).split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) env[m[1]] = m[2].trim();
      }
    } catch {
      /* 파일 없으면 환경변수만 쓴다 */
    }
  }
  return env;
}
const isHub = (env) => Boolean(env.NCP_API_KEY_ID && env.NCP_API_KEY);
const URLS = {
  hub: {
    news: 'https://naverapihub.apigw.ntruss.com/search/v1/news',
    trend: 'https://naverapihub.apigw.ntruss.com/search-trend/v1/search',
  },
  legacy: {
    news: 'https://openapi.naver.com/v1/search/news.json',
    trend: 'https://openapi.naver.com/v1/datalab/search',
  },
};
const api = (env, name) => URLS[isHub(env) ? 'hub' : 'legacy'][name];
const authHeaders = (env) =>
  isHub(env)
    ? { 'X-NCP-APIGW-API-KEY-ID': env.NCP_API_KEY_ID, 'X-NCP-APIGW-API-KEY': env.NCP_API_KEY }
    : {
        'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
      };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readJsonSync(rel, fallback) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  } catch {
    return fallback;
  }
}
const norm = (s) => String(s ?? '').replace(/\s+/g, '');
const round1 = (n) => Math.round(n * 10) / 10;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

// ── 지역 사전 ────────────────────────────────────────────────
function regionIndex() {
  const names = new Map(); // 표기 → 정규 이름
  const add = (name, alias) => {
    if (name && alias && alias.length >= 2) names.set(alias, name);
  };
  for (const p of PROVINCES) add(p, p);
  for (const [, name, suffix] of NATIONWIDE) {
    add(name, `${name}${suffix}`);
    // 두 글자 이름(고성·광주…)은 그대로도 쓰지만, 한 글자로 줄지 않게 add가 막는다
    add(name, name);
  }
  for (const r of readJsonSync('src/data/regions.json', [])) {
    add(r.name, r.name);
    for (const a of r.aliases ?? []) add(r.name, a);
  }
  // 긴 표기부터 맞춰야 "김해시"가 "김해"보다 먼저 잡힌다
  const sorted = [...names.keys()].sort((a, b) => b.length - a.length);
  return { names, sorted };
}

// ── 1) 뉴스 제목에서 묶음 후보 뽑기 ──────────────────────────
const decode = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

function tokensOf(title) {
  return title
    .split(/[\s,.·…'"‘’“”[\]()<>!?:;~/|=+→▲▶■◆※-]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** 제목 하나 → { terms:Set, regions:Set } */
function extract(title, rx) {
  const toks = tokensOf(title);
  const regions = new Set();
  const terms = new Set();
  const regionOf = (tok) => {
    if (rx.names.has(tok)) return rx.names.get(tok);
    return null;
  };
  for (let i = 0; i < toks.length; i++) {
    let tok = toks[i];
    const reg = regionOf(tok) ?? regionOf(tok.replace(JOSA, ''));
    if (reg) {
      regions.add(reg);
      continue;
    }
    if (/[\dA-Za-z]/.test(tok)) continue; // 숫자·영문 섞인 낱말은 상품명·금액이 대부분
    if (BRAND.test(tok) && /(카드|계좌|적금|캐시백)$/.test(tok)) continue;
    if (!POLICY_TAIL.test(tok)) {
      const stripped = tok.replace(JOSA, '');
      if (stripped.length >= 2 && POLICY_TAIL.test(stripped)) tok = stripped;
      else continue;
    }
    // "김해시민생지원금"처럼 지역이 붙은 낱말은 지역을 떼어 낸다
    for (const alias of rx.sorted) {
      if (tok.startsWith(alias) && tok.length - alias.length >= 3) {
        const rest = tok.slice(alias.length);
        if (POLICY_TAIL.test(rest) && !GENERIC.has(rest)) {
          regions.add(rx.names.get(alias));
          tok = rest;
        }
        break;
      }
    }
    if (GENERIC.has(tok)) {
      const prev = toks[i - 1]?.replace(JOSA, '');
      if (
        !prev ||
        prev.length < 2 ||
        prev.length > 6 ||
        /\d/.test(prev) ||
        !/^[가-힣]+$/.test(prev) ||
        WEAK_PREFIX.has(prev) ||
        regionOf(prev) ||
        POLICY_TAIL.test(prev)
      )
        continue;
      tok = `${prev} ${tok}`;
    }
    if (tok.replace(/\s/g, '').length < 3 || tok.length > 14 || NOISE.has(tok)) continue;
    terms.add(tok);
  }
  return { terms, regions };
}

async function collectNews(env) {
  const rx = regionIndex();
  const seenTitles = new Set();
  const byKey = new Map(); // norm(term) → { forms: Map, mentions, regions: Map, days: Map, sample: [] }
  const pages = NEWS_QUERIES.flatMap((q) =>
    Array.from({ length: NEWS_PAGES }, (_, i) => [q, 1 + i * 100]),
  );
  for (const [q, startAt] of pages) {
    const url = `${api(env, 'news')}?query=${encodeURIComponent(q)}&display=100&start=${startAt}&sort=date`;
    countCall('search', 'news');
    let items = [];
    try {
      const res = await fetch(url, { headers: authHeaders(env) });
      if (res.ok) items = (await res.json()).items ?? [];
      else console.error(`[next-wave] 뉴스 "${q}" ${res.status}`);
    } catch (e) {
      console.error(`[next-wave] 뉴스 "${q}" 실패: ${e.message}`);
    }
    for (const it of items) {
      const title = decode(it.title);
      const key = norm(title);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      const day = it.pubDate
        ? new Date(new Date(it.pubDate).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
        : TODAY;
      const { terms, regions } = extract(title, rx);
      for (const t of terms) {
        const k = norm(t);
        const e = byKey.get(k) ?? {
          forms: new Map(),
          mentions: 0,
          regions: new Map(),
          days: new Map(),
          sample: [],
        };
        e.forms.set(t, (e.forms.get(t) ?? 0) + 1);
        e.mentions++;
        e.days.set(day, (e.days.get(day) ?? 0) + 1);
        for (const r of regions) e.regions.set(r, (e.regions.get(r) ?? 0) + 1);
        if (e.sample.length < 2) e.sample.push(title);
        byKey.set(k, e);
      }
    }
    await sleep(120);
  }
  const out = [];
  for (const [k, e] of byKey) {
    const term = [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
    out.push({
      key: k,
      term,
      mentions: e.mentions,
      regions: [...e.regions.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      days: Object.fromEntries(e.days),
      sample: e.sample,
    });
  }
  return { terms: out, titles: seenTitles.size };
}

// ── 2) 데이터랩 ──────────────────────────────────────────────
function axis(start, end) {
  const out = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += DAY)
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** 묶음 4개 + 기준 1개를 한 요청으로. 반환: { [groupName]: number[] (축에 맞춘 일별) } */
async function trendBatch(env, families, start, end, days) {
  const groups = [
    { groupName: '__benchmark__', keywords: [BENCHMARK] },
    ...families.map((f) => ({ groupName: f.key, keywords: f.keywords.slice(0, 20) })),
  ];
  const body = JSON.stringify({
    startDate: start,
    endDate: end,
    timeUnit: 'date',
    keywordGroups: groups,
  });
  for (let i = 0; i < 3; i++) {
    countCall('datalab', 'search-trend');
    try {
      const res = await fetch(api(env, 'trend'), {
        method: 'POST',
        headers: { ...authHeaders(env), 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) {
        const j = await res.json();
        const out = {};
        for (const r of j.results ?? []) {
          const m = new Map(r.data.map((d) => [d.period, d.ratio]));
          out[r.title] = days.map((d) => m.get(d) ?? 0); // 빈 날 = 0(데이터랩은 0인 날을 빼고 준다)
        }
        return out;
      }
      if (i === 2) console.error(`[next-wave] 데이터랩 ${res.status}`);
    } catch (e) {
      if (i === 2) console.error(`[next-wave] 데이터랩 실패: ${e.message}`);
    }
    await sleep(800 * (i + 1));
  }
  return null;
}

function measure(series, benchSeries) {
  const scale = mean(benchSeries.slice(-28)) || 1; // 실업급여 28일 평균 = 100
  const v = series.map((x) => (x / scale) * 100);
  const now7 = mean(v.slice(-7));
  const base21 = mean(v.slice(-28, -7));
  const weekly = [];
  for (let w = 0; w < 8; w++) weekly.push(round1(mean(v.slice(w * 7, w * 7 + 7))));
  let peak = 0;
  for (let i = 6; i < v.length; i++) peak = Math.max(peak, mean(v.slice(i - 6, i + 1)));
  return {
    level: round1(now7),
    base: round1(base21),
    growth: base21 > 0.05 ? round1(now7 / base21) : now7 > 0.5 ? 9.9 : 1,
    fromPeak: peak > 0 ? Math.round((now7 / peak) * 100) : null,
    weekly,
  };
}

/**
 * 작년 같은 달 → 다음 두 달. "곧 뜸"의 근거다(연말정산·고향사랑기부처럼 해마다 같은 때 뜨는 묶음).
 * 그 묶음이 작년에 없던 새 정책이면 0이 나와 판정에 안 쓴다.
 */
function lastYearWindow() {
  const [y, m] = TODAY.split('-').map(Number);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return {
    start: fmt(new Date(Date.UTC(y - 1, m - 1, 1))),
    end: fmt(new Date(Date.UTC(y - 1, m + 2, 0))), // 작년 (이번 달+2)의 말일
    months: [0, 1, 2].map((k) => fmt(new Date(Date.UTC(y - 1, m - 1 + k, 1)))),
  };
}

async function seasonBatch(env, families, win) {
  const body = JSON.stringify({
    startDate: win.start,
    endDate: win.end,
    timeUnit: 'month',
    // 기준을 같이 넣어야 작년 값을 지금 level과 같은 자로 맞댈 수 있다
    keywordGroups: [
      { groupName: '__benchmark__', keywords: [BENCHMARK] },
      ...families.map((f) => ({ groupName: f.key, keywords: f.keywords.slice(0, 20) })),
    ],
  });
  countCall('datalab', 'search-trend');
  try {
    const res = await fetch(api(env, 'trend'), {
      method: 'POST',
      headers: { ...authHeaders(env), 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) return null;
    const out = {};
    for (const r of (await res.json()).results ?? []) {
      const m = new Map(r.data.map((d) => [d.period, d.ratio]));
      out[r.title] = win.months.map((p) => m.get(p) ?? 0);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * [작년 이번 달, +1, +2] → { up: 최고 배수, month: 그 달(1~12), lastYear: 작년 이번 달 level }
 * lastYear는 작년 실업급여 3개월 평균 = 100 눈금. 지금 level의 절반도 안 되면 작년엔 없던(또는 뜻이 다른)
 * 이름이라 계절 판정에 쓰지 않는다 — 모두의카드처럼 올해 생긴 정책이 "작년 패턴"으로 오판되는 것을 막는다.
 */
function seasonOf(v, bench, win) {
  if (!v || !(v[0] > 0)) return null;
  const k = v[1] >= v[2] ? 1 : 2;
  const scale = mean(bench ?? []) || 1;
  return {
    up: round1(v[k] / v[0]),
    month: Number(win.months[k].slice(5, 7)),
    lastYear: round1((v[0] / scale) * 100),
  };
}

function stageOf(m, isNew, season, curated, fewPosts) {
  if (m.growth >= 1.4 && m.level >= 8) return 'rising';
  // 작년엔 한두 달 뒤 1.5배 이상 컸고, 그대로 커지면 기준의 8 이상이 되는 묶음.
  // 감시 목록·지역 묶음만(뉴스 잡음의 작년 패턴은 우리 독자와 무관). 작년에 없던 이름은 main에서 season을 지운다.
  if (
    curated &&
    season &&
    season.up >= 1.5 &&
    m.level * season.up >= 8 &&
    m.growth >= 0.6 // 피크가 한두 달 뒤라 지금 조금 내려가는 중이어도 된다(고향사랑기부제 10월)
  )
    return 'soon';
  if ((m.growth >= 1.2 && m.level >= 2) || (isNew && m.growth >= 1 && m.level >= 1))
    return 'growing';
  if (m.growth <= 0.6 && m.base >= 10) return 'fading';
  // 이미 큰데 우리 글이 거의 없는 묶음 — 뜨는 중은 아니어도 채울 자리
  if (curated && fewPosts && m.level >= 30) return 'gap';
  return 'steady';
}

// ── 3) 우리 글·큐 대조 ───────────────────────────────────────
function ourPosts() {
  const dir = join(ROOT, 'src/data/issues');
  let tracked = null;
  try {
    tracked = new Set(
      execFileSync('git', ['ls-files', 'src/data/issues'], { cwd: ROOT, encoding: 'utf8' })
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    );
  } catch {
    /* git이 없으면 파일 전부 */
  }
  const posts = [];
  for (const d of readdirSync(dir).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))) {
    if (!statSync(join(dir, d)).isDirectory()) continue;
    for (const f of readdirSync(join(dir, d))) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      if (tracked && !tracked.has(`src/data/issues/${d}/${f}`)) continue;
      try {
        const j = JSON.parse(readFileSync(join(dir, d, f), 'utf8'));
        posts.push({ date: d, title: norm(j.title), q: norm(j.targetQuery) });
      } catch {
        /* 깨진 파일은 무시 */
      }
    }
  }
  return posts;
}

// ── main ─────────────────────────────────────────────────────
async function main() {
  const prev = readJsonSync(OUT_REL, null);
  if (IF_STALE && prev?.meta?.today === TODAY) {
    console.log(`[next-wave] 오늘(${TODAY}) 결과가 이미 있다 — 건너뜀`);
    return;
  }
  const env = await loadEnv();
  if (!isHub(env) && !(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET)) {
    console.error('[next-wave] 네이버 API 키가 없다 — .env 또는 환경변수 확인');
    process.exit(1);
  }
  const seedsFile = readJsonSync(SEEDS_REL, { seeds: [], ignore: [] });
  const ignore = new Set((seedsFile.ignore ?? []).map(norm));

  // 1) 뉴스
  const news = await collectNews(env);
  if (DEBUG_TERMS) {
    for (const t of news.terms.sort((a, b) => b.mentions - a.mentions).slice(0, 60))
      console.log(
        `${t.mentions}	${t.regions.length}	${t.term}	${t.regions
          .slice(0, 5)
          .map((r) => r.name)
          .join(',')}`,
      );
    return;
  }
  const bootstrap = !prev?.seen; // 첫 실행이면 전부 처음 보는 것이라 "새로 등장"을 매기지 않는다
  const seen = prev?.seen ?? {};
  for (const t of news.terms) {
    // 첫 실행에서 본 것은 "원래 있던 것"으로 둔다(첫 관측일을 30일 전으로) — 다음 실행에 전부 새로 등장으로 뜨지 않게
    const s = seen[t.key] ?? { term: t.term, first: bootstrap ? kstDate(-30) : TODAY, days: {} };
    for (const [d, n] of Object.entries(t.days)) s.days[d] = Math.max(s.days[d] ?? 0, n);
    if (!s.first || s.first > TODAY) s.first = TODAY;
    seen[t.key] = s;
  }
  // 30일 지난 기록은 버린다
  const cutoff = kstDate(-30);
  for (const [k, s] of Object.entries(seen)) {
    for (const d of Object.keys(s.days)) if (d < cutoff) delete s.days[d];
    if (!Object.keys(s.days).length && s.first < cutoff) delete seen[k];
  }

  // 2) 잴 묶음 고르기 — 뉴스(지역 많고 기사 많은 순) + 고정 목록 + 레이더 신생
  const dynamic = news.terms
    .filter((t) => t.mentions >= MIN_MENTIONS && !ignore.has(t.key))
    .sort((a, b) => b.regions.length * 2 + b.mentions - (a.regions.length * 2 + a.mentions))
    .slice(0, MAX_DYNAMIC);
  const fam = new Map();
  const addFam = (term, source, extra = {}) => {
    const key = norm(term);
    if (!key || ignore.has(key)) return;
    const cur = fam.get(key);
    if (cur) {
      cur.sources.add(source);
      return;
    }
    fam.set(key, { key, term, sources: new Set([source]), ...extra });
  };
  for (const t of dynamic) addFam(t.term, '뉴스', { news: t });
  for (const s of seedsFile.seeds ?? []) addFam(s, '감시 목록');
  const radar = readJsonSync('src/data/keyword-radar.json', null);
  const radarBorn = (radar?.candidates ?? [])
    .filter((c) => c?.born || c?.signals?.volume?.born)
    .map((c) => c.term)
    .filter(Boolean)
    .slice(0, 6);
  for (const k of radarBorn) addFam(k, '레이더 신생');
  const newsByKey = new Map(news.terms.map((t) => [t.key, t]));
  const families = [...fam.values()].slice(0, MAX_FAMILIES).map((f) => {
    const n = f.news ?? newsByKey.get(f.key) ?? null;
    const regions = (n?.regions ?? []).slice(0, 5).map((r) => r.name);
    const keywords = [
      ...new Set([f.term, norm(f.term), `${f.term} 신청`, ...regions.map((r) => `${r} ${f.term}`)]),
    ];
    return { ...f, news: n, keywords };
  });

  // 3) 데이터랩 — 어제까지(오늘은 집계 중이라 낮게 나온다)
  const end = kstDate(-1);
  const start = kstDate(-WINDOW_DAYS);
  const days = axis(start, end);
  const results = [];
  for (let i = 0; i < families.length; i += 4) {
    const batch = families.slice(i, i + 4);
    const r = await trendBatch(env, batch, start, end, days);
    if (!r?.__benchmark__) continue;
    for (const f of batch) {
      if (!r[f.key]) continue;
      results.push({ f, m: measure(r[f.key], r.__benchmark__) });
    }
    await sleep(200);
  }

  // 3-2) 작년 같은 때 — 지금 기준의 2 이상인 묶음만(작은 건 작년 값도 잡음이다)
  const win = lastYearWindow();
  const seasonal = new Map();
  const forSeason = results.filter((r) => r.m.level >= 2).map((r) => r.f);
  for (let i = 0; i < forSeason.length; i += 4) {
    const r = await seasonBatch(env, forSeason.slice(i, i + 4), win); // 기준 + 4묶음 = 데이터랩 상한 5그룹
    if (r?.__benchmark__)
      for (const [k, v] of Object.entries(r))
        if (k !== '__benchmark__') seasonal.set(k, seasonOf(v, r.__benchmark__, win));
    await sleep(200);
  }

  // 4) 판정·대조
  const posts = ourPosts();
  const queue = readJsonSync('docs/ops/pipeline-queue.json', { items: [] });
  const items = results.map(({ f, m }) => {
    const s = seen[f.key];
    const isNew =
      !bootstrap && Boolean(s && s.first >= kstDate(-3) && (f.news?.mentions ?? 0) >= MIN_MENTIONS);
    const mine = posts.filter((p) => p.title.includes(f.key) || p.q.includes(f.key));
    const queued = (queue.items ?? []).filter(
      (q) => q.status === 'proposed' && norm(q.query).includes(f.key),
    ).length;
    const regionCount = f.news?.regions?.length ?? 0;
    let season = seasonal.get(f.key) ?? null;
    // 작년 이맘때 지금의 절반도 안 됐으면 작년엔 없던 이름이다(모두의카드) — 작년 패턴을 믿지 않는다
    if (season && season.lastYear < m.level * 0.5) season = null;
    // "곧 뜸"·"큰데 글 적음"은 감시 목록이거나 지역이 3곳 이상 나온 것만 — 뉴스 잡음(관세청 유니패스 등)을 거른다
    const curated = f.sources.has('감시 목록') || regionCount >= 3;
    const stage = stageOf(m, isNew, season, curated, mine.length <= 2);
    const lift = stage === 'soon' ? season.up : Math.min(Math.max(m.growth, 0.1), 4);
    const score =
      Math.round(m.level * lift * (regionCount >= 3 ? 1.5 : 1) * (mine.length ? 1 : 1.3) * 10) / 10;
    return {
      term: f.term,
      stage,
      isNew,
      score,
      season,
      ...m,
      regions: (f.news?.regions ?? []).slice(0, 8),
      mentions: f.news?.mentions ?? 0,
      firstSeen: s?.first ?? null,
      posts: mine.length,
      lastPost:
        mine
          .map((p) => p.date)
          .sort()
          .pop() ?? null,
      queued,
      sources: [...f.sources],
      keywords: f.keywords,
      sample: f.news?.sample ?? [],
    };
  });
  const order = { rising: 0, soon: 1, growing: 2, gap: 3, steady: 4, fading: 5 };
  items.sort((a, b) => order[a.stage] - order[b.stage] || b.score - a.score);

  const out = {
    _readme:
      '다음에 크게 뜰 주제(묶음 단위). scripts/next-wave.mjs가 만들고 scripts/ops-widget.mjs가 읽는다. stage = rising(지금 뜨는 중)·soon(작년 이맘때 한두 달 뒤 1.5배↑)·growing(커지는 중)·gap(큰데 우리 글 2개 이하)·steady·fading(꺾이는 중). level·base = 실업급여 28일 평균을 100으로 둔 검색량(최근 7일·직전 3주), growth = level÷base, fromPeak = 56일 최고 7일 평균 대비 %, season = 작년 같은 달 대비 다음 두 달 최고 배수와 그 달. seen = 뉴스 첫 관측일·일별 기사 수(30일).',
    meta: {
      generatedAt: new Date().toISOString(),
      today: TODAY,
      window: { start, end },
      benchmark: BENCHMARK,
      newsTitles: news.titles,
      measured: items.length,
      apiCalls: usageReport(1).thisRun,
    },
    items,
    seen,
  };

  const label = {
    rising: '지금 뜨는 중',
    soon: '곧 뜸',
    growing: '커지는 중',
    gap: '큰데 글 적음',
    steady: '평이',
    fading: '꺾이는 중',
  };
  for (const it of items.filter((x) => x.stage !== 'steady').slice(0, 20)) {
    console.log(
      `${label[it.stage]}${it.isNew ? '(새로 등장)' : ''}\t${it.term}\t검색 ${it.level} (3주 전 ${it.base}, ${it.growth}배)${it.season ? `\t작년 ${it.season.month}월 ${it.season.up}배` : ''}\t지역 ${it.regions.length}곳 · 기사 ${it.mentions} · 우리 글 ${it.posts}`,
    );
  }
  console.log(
    `[next-wave] 기사 제목 ${news.titles}건 · 묶음 ${items.length}개 측정 · ${formatUsage(usageReport(1))}`,
  );
  if (DRY) return;
  await writeFile(join(ROOT, OUT_REL), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`→ ${OUT_REL}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
