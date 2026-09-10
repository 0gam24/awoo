// ─────────────────────────────────────────────────────────────
// keyword-radar — 지원금 키워드 수요 레이더
//
// 합법 소스만 사용 (KEYWORD-INTELLIGENCE-PLAN §3). 엔드포인트는 레거시 오픈API와
// NAVER API HUB(Ncloud)를 이중 지원 — NCP_API_KEY_ID/NCP_API_KEY가 있으면 HUB로 자동 전환:
//   [kin]     지식iN 검색 API — 신규 질문 수집
//   [news]    기존 today-issue.json / _history.json 트렌딩 baseline (재수집 X)
//   [datalab] 검색어트렌드(데이터랩) — 상대수요 + 모멘텀
//   [market]  블로그·카페·뉴스 검색 API — 공급 규모·경쟁 신선도·최근 보도량 → 수요/공급 갭
//   [demo]    같은 API의 연령 필터(ages) — 연령대 쏠림 → 페르소나 힌트
//
//   [analytics] src/data/analytics/naver-analytics-search-*.json — 실유입 검색어(주 1회 적재본)
//
// 산출: src/data/keyword-radar.json (30일 롤링, 스냅샷당 top 30)
//   signals.datalab   최근 7일 상대수요 0~5
//   signals.momentum  최근 7일 ÷ 직전 23일 (1.5↑ = 급상승, 점수 가산)
//   signals.volume    기준 키워드(실업급여) 대비 검색량 — keyword-volume.mjs와 같은 자
//                     { relative, recent7, window, zeroDays, firstNonZero, days, trend, born, measured }
//   demo              { young, middle, senior } % + peak + personaHint
//   signals.gap       수요(질문·보도) ÷ 공급(블로그 문서량·최근글비율) — 3↑면 네이버 진입 우위
//   market            { blogTotal, blogFresh, cafeTotal, newsRecent }
//   candidates        후보 목록(신생 born · 실유입 fromAnalytics · 틈새 niche) — 파이프라인 입력
//   niche             (구) 틈새 후보 — 기존 소비자 호환용으로 유지
// 소비: keyword-scout 에이전트 / /today / /traffic / 0400 루틴 / keyword-pipeline.mjs
//
// 물결 감지(docs/ops/KEYWORD-PLAN-2026-09-10.md §3 신호 (2)·(4)):
//   born          데이터랩 일별 시계열에서 "창 안에서 방금 생긴" 키워드. 판정식은 keyword-volume.mjs와
//                 동일 — (zeroDays ≥8 OR firstNonZero ≥7 OR days ≤21) AND recent7 ≥ 기준의 3%.
//                 born이면 모멘텀·기회도·대형 포함 여부와 무관하게 candidates에 직행한다.
//   fromAnalytics 실유입 검색어 중 자사 순위가 null·4위 이하·미측정인 것(상위 40). 검색량 문턱 없음 —
//                 지역 클러스터는 데이터랩이 게이트가 아니라 정렬 지표다(§1 표 3·11).
//
// 사용:
//   node scripts/keyword-radar.mjs                  # 수집 + 적재
//   node scripts/keyword-radar.mjs --dry-run        # API는 호출하되 적재 없이 후보 요약만 stdout
//   node scripts/keyword-radar.mjs --sources=kin    # 소스 한정 (kin,news,datalab,demo,market)
// ─────────────────────────────────────────────────────────────
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countCall, formatUsage, usageReport } from './lib/api-quota.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'src', 'data', 'keyword-radar.json');
const HISTORY_FILE = join(ROOT, 'src', 'data', 'issues', '_history.json');
const TODAY_ISSUE_FILE = join(ROOT, 'src', 'data', 'today-issue.json');
const CURATED_DIR = join(ROOT, 'src', 'data', 'subsidies', '_curated');
const GOV24_DIR = join(ROOT, 'src', 'data', 'subsidies', '_gov24');
const ANALYTICS_DIR = join(ROOT, 'src', 'data', 'analytics');
const RANKS_FILE = join(ROOT, 'src', 'data', 'naver-ranks.json');

// ── API 경로·인증: 레거시 오픈API ↔ NAVER API HUB(Ncloud) 이중 지원 ──
// 네이버가 오픈API를 Ncloud의 NAVER API HUB로 옮기는 중이다. 응답 스키마는 동일하고
// 주소와 인증 헤더만 다르므로, NCP 키가 있으면 HUB를, 없으면 기존 키로 레거시를 쓴다.
// 종료 일정은 공식 문서에 아직 없다(2026-09-08 확인) — 전환은 키만 넣으면 끝나게 해 둔다.
const LEGACY = {
  kin: 'https://openapi.naver.com/v1/search/kin.json',
  blog: 'https://openapi.naver.com/v1/search/blog.json',
  cafe: 'https://openapi.naver.com/v1/search/cafearticle.json',
  news: 'https://openapi.naver.com/v1/search/news.json',
  trend: 'https://openapi.naver.com/v1/datalab/search',
};
const HUB = {
  kin: 'https://naverapihub.apigw.ntruss.com/search/v1/kin',
  blog: 'https://naverapihub.apigw.ntruss.com/search/v1/blog',
  cafe: 'https://naverapihub.apigw.ntruss.com/search/v1/cafearticle',
  news: 'https://naverapihub.apigw.ntruss.com/search/v1/news',
  trend: 'https://naverapihub.apigw.ntruss.com/search-trend/v1/search',
};

/** NCP 키가 있으면 NAVER API HUB 모드 */
const isHubMode = (env) => Boolean(env.NCP_API_KEY_ID && env.NCP_API_KEY);
const apiUrl = (env, name) => (isHubMode(env) ? HUB[name] : LEGACY[name]);
const authHeaders = (env) =>
  isHubMode(env)
    ? { 'X-NCP-APIGW-API-KEY-ID': env.NCP_API_KEY_ID, 'X-NCP-APIGW-API-KEY': env.NCP_API_KEY }
    : {
        'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
      };

// 하루 몇 번 도는지 — .github/workflows/keyword-radar.yml 의 cron '17 21,2,7,12 * * *'
// 여기와 cron이 어긋나면 사용량 추정이 틀어진다. cron을 바꾸면 이 값도 바꿔라.
const RUNS_PER_DAY = 4;

const ROLLING_DAYS = 30;
const SNAPSHOT_TERM_CAP = 60;
const FILE_SIZE_GUARD = 700 * 1024; // 700KB — 넘으면 오래된 스냅샷부터 버린다
const FETCH_DELAY_MS = 150;

// 데이터랩 호출 예산 (일 1,000회 한도, 하루 4회 실행 기준 여유 충분)
// 조사 폭. 한도의 1%도 안 쓰던 것을 2026-09-09에 넓혔다 —
// 좁게 보면 상위권 밖의 "아직 아무도 안 쓴 자리"를 통째로 놓친다.
// 확대 후에도 검색 일 3%, 데이터랩 월 6%대다(docs/ops/NAVER-API-QUOTA.md).
const DATALAB_TOP = 40; // 상대수요·모멘텀·검색량 대상 (기준 1 + 후보 4 = 10요청)
const DEMO_TOP = 30; // 연령 프로파일 대상 (5개씩 6요청 × 3버킷 = 18요청)
const MOMENTUM_SURGE = 1.5; // 최근 7일이 직전 23일의 1.5배 이상이면 급상승
const MOMENTUM_BONUS = 2;

// ── 검색량 자(keyword-volume.mjs와 동일) + 신생(born) 판정 ──────
// 데이터랩 ratio는 요청 안에서의 상대지수라, 매 요청에 기준 키워드를 같이 넣고 그 대비 %로 환산한다.
// 기준은 '실업급여' — 코퍼스에서 가장 크고 안정적인 축. 바꾸면 과거 측정치와 비교가 안 된다.
const VOLUME_BENCHMARK = '실업급여';
const VOLUME_GROUP = 4; // 요청당 후보 수 (기준 1 + 후보 4 = 데이터랩 상한 5)
// born = (zeroDays ≥8 OR firstNonZero ≥7 OR days ≤21) AND recent7 ≥ 기준의 3%.
// '추석지원금 지역별 지급 대상'(5일)·'김해 지원금 10만원 신청'(19일)이 잡히고
// '4차 민생지원금'·'김해 민생지원금' 같은 상시 헤드는 탈락하는 정의(2026-09-10 실측 15건).
const BORN_ZERO_DAYS = 8;
const BORN_FIRST_NONZERO = 7;
const BORN_MAX_DAYS = 21;
const BORN_RECENT_FLOOR = 3; // 기준(실업급여) 대비 %

// ── 측정 진입 조건(완화, 2026-09-10) ────────────────────────────
// 종전엔 점수 상위 40만 데이터랩에 넣었다. 점수는 지식iN 질문 수가 지배하므로 방금 생긴 지역
// 키워드는 시야에 안 들어왔다. 이제 (처음 본 지 ≤7일 OR 질문 ≥3 OR 지역 패턴)이면 점수와 무관하게
// 측정 풀에 먼저 넣고, 남는 자리를 점수순으로 채운다.
const MEASURE_NEW_DAYS = 7;
const MEASURE_KIN_MIN = 3;
const REGION_PATTERN_RE = /([가-힣]{1,4}(?:시|군|구|도))\s*(민생|지원금|쿠폰|상품권)/;
// "효도지원금"의 '도'처럼 지역이 아닌 글자를 걸러낸다(isRegionName은 아래 term 추출부에서 정의)
const hasRegionPattern = (term) => {
  const m = term.match(REGION_PATTERN_RE);
  return Boolean(m) && isRegionName(m[1]);
};

// ── 실유입 검색어(애널리틱스) 입력 ──────────────────────────────
// 자사 순위가 null·4위 이하·미측정인 유입 쿼리는 "이미 트래픽이 오는데 자리가 비어 있는" 곳이다.
// 검색량 문턱 없이 상위 40을 후보에 넣는다. 4위 이하 = 패밀리B 트리거(계획 §2).
const ANALYTICS_TOP = 40;
const ANALYTICS_RANK_FLOOR = 4; // 이 순위 이상(숫자가 크면)이면 후보
const ANALYTICS_FILE_RE = /^naver-analytics-search-.*\.json$/;
const ANALYTICS_SKIP = new Set(['(검색어 없음)']);
// 네이버 공급·보도량 (검색 API 일 25,000회 — 키워드당 3콜)
const MARKET_TOP = 60; // 블로그·카페·뉴스 공급량 조사 (× 3 = 180요청)
const GAP_STRONG = 3; // 이 이상이면 "수요 대비 공급이 빈 자리"

// ── 기회도(opportunity) ────────────────────────────────────
// gap은 수요가 지배한다. 공급을 log10으로 눌러버려서 블로그 106건과 161,699건의
// 차이가 2.6배밖에 안 되는데 질문 수 차이는 20배라, 결국 질문 많은 순으로 다시
// 줄 세우는 지표가 된다. 실측(2026-09-09): gap 상위 10개 중 6개가 블로그
// 3만건 이상인 포화 키워드였다. 게다가 gap은 수집량에 비례해 부풀어서
// 회차 간 비교도 안 된다(같은 실업급여가 수집 확대 후 5.9 → 18.3).
//
// 기회도는 그 회차 안에서의 백분위 곱이라 수집량과 무관하다.
//   수요 백분위 × 공급 희소 백분위 × 100
// 둘 다 높아야 점수가 나온다 — 질문만 많거나 공급만 얇으면 안 된다.
const OPPORTUNITY_STRONG = 30; // 이 이상이면 "들어갈 만한 빈 자리"
const NICHE_MIN_QUESTIONS = 3; // 질문이 이보다 적으면 표본 부족 (뉴스 신호가 있으면 면제)

// ── 신생·성장 키워드 판정 ──────────────────────────────────
// 이미 큰 키워드는 이미 남들이 다 썼다. 트래픽이 "앞으로" 커질 자리를 잡으려면
// 방금 생겼고(신생) 우상향 중인(성장) 키워드를 봐야 한다.
const NEW_TERM_DAYS = 7; // 이 안에 처음 등장했으면 신생
const TERM_HIST_CAP = 30; // byTerm에 남기는 관측치 수 (4회/일 × 약 7일)
const GROWTH_MIN_OBS = 4; // 추세 판정 최소 관측치
const GROWTH_STRONG = 1.4; // 후반 평균 ÷ 전반 평균이 이 이상이면 성장

// 지식iN 질문 수집 시드 (광역 도메인 질의)
// 시드가 곧 탐색 범위다. 좁으면 신생 키워드가 아예 시야에 안 들어온다.
// 2026-09-09 확대: 10 → 28. 호출은 시드당 1회라 28회, 검색 한도의 0.1%다.
// 2026-09-10 확대: 28 → 35. 민생 물결 어휘 3축(차수·명절·지역명, 계획 §3)과 가결·조례 트리거를 시드에 넣는다.
const SEED_QUERIES = [
  // 총칭
  '지원금 신청',
  '보조금',
  '수당 받을 수 있나요',
  '바우처',
  '장려금',
  '급여 신청 자격',
  '환급 언제',
  '지원 대상 되나요',
  '신청 자격 조건',
  '얼마 받나요',
  // 생애·가구
  '청년 지원',
  '신혼부부 지원',
  '출산 지원',
  '육아 지원',
  '노인 지원',
  '장애인 지원',
  '한부모 지원',
  '저소득층 지원',
  // 분야
  '기초연금',
  '실업급여',
  '청년 적금',
  '주거 지원',
  '월세 지원',
  '학자금',
  '의료비 지원',
  '난방비 지원',
  '소상공인 지원',
  '농업 지원',
  // 민생 물결 (차수·명절·가결 트리거) — 실유입 81%가 민생×지역 클러스터다
  '4차 민생지원금',
  '추석 민생지원금',
  '설 민생지원금',
  '민생지원금 조례',
  '1인당 지원금 가결',
  '민생안정지원금 신청',
  '민생회복지원금 지급일',
];

// 키워드(term) 추출 — 이 접미사로 끝나는 n-gram만 도메인 후보로 인정
const TERM_SUFFIX_RE =
  /([가-힣A-Za-z0-9·]{1,14}(?:지원금|보조금|수당|바우처|장려금|급여|연금|적금|환급금|장학금|대출금리는?|계좌|공제|감면|지원사업|융자|보험료|등록금|보육료|급식비|난방비|위로금|격려금|생활비|상품권|통장))/g;

// 지역 접미형 term 추출 — "완주군 민생안정지원금"처럼 띄어쓴 지자체×지원금은 위 정규식이 잘라먹는다.
// 군 단위 유입의 85~100%가 이 접미형(계획 §0)이라 별도로 잡아 한 칸 띄운 형태로 정규화한다.
const REGION_TERM_RE =
  /([가-힣]{2,4}(?:특별시|광역시|시|군|구|도))\s*((?:민생회복|민생안정|민생|추석|설|명절|군민|시민|활력)?\s*(?:지원금|쿠폰|상품권))/g;
// 붙여 쓴 "완주군민생지원금"도 같은 term으로 접는다 — 실유입 쿼리·순위 측정은 띄운 형태다
const REGION_FULL_RE =
  /^([가-힣]{2,4}(?:특별시|광역시|시|군|구|도))((?:민생회복|민생안정|민생|추석|설|명절|군민|시민|활력)?(?:지원금|쿠폰|상품권))$/;
// "동시 지원금"·"제도 지원금"·"지역도 추석지원금" 같은 일반어 오탐 차단.
// '도'로 끝나는 지역명은 광역 9곳뿐이라 그 목록만 통과시킨다.
const REGION_STOP = new Set([
  '동시',
  '당시',
  '임시',
  '역시',
  '혹시',
  '잠시',
  '다시',
  '친구',
  '입구',
  '지구',
  '가구',
  '도구',
  '요구',
  '연구',
]);
const DO_NAMES = new Set([
  '경기도',
  '강원도',
  '충청도',
  '충북도',
  '충남도',
  '전라도',
  '전북도',
  '전남도',
  '경상도',
  '경북도',
  '경남도',
  '제주도',
]);
const isRegionName = (name) =>
  !REGION_STOP.has(name) && (!name.endsWith('도') || DO_NAMES.has(name));

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
  const headers = authHeaders(env);
  const kinApi = apiUrl(env, 'kin');
  const questions = [];
  for (const seed of SEED_QUERIES) {
    // display는 네이버 검색 API 상한인 100까지 공짜다 — 호출 1회로 3배를 받는다
    const url = `${kinApi}?query=${encodeURIComponent(seed)}&display=100&sort=date`;
    countCall('search', 'kin');
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
  const headers = authHeaders(env);
  const url = `${api}?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
  countCall('search', (api.split('/').pop() ?? 'search').replace('.json', ''));
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
      const blog = await searchCount(env, apiUrl(env, 'blog'), term, { sort: 'date', display: 30 });
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
      const cafe = await searchCount(env, apiUrl(env, 'cafe'), term);
      rec.cafeTotal = cafe.total ?? 0;
      await sleep(FETCH_DELAY_MS);
    } catch {}
    try {
      // display 30이면 화제 키워드가 전부 30으로 포화돼 변별력이 사라진다. 호출 수는 같다.
      const news = await searchCount(env, apiUrl(env, 'news'), term, {
        sort: 'date',
        display: 100,
      });
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
// benchmark를 주면 매 요청에 기준 키워드를 함께 넣고(후보 4 + 기준 1), 반환값 base에
// "그 요청의 기준 시계열"을 term별로 매핑한다 — keyword-volume.mjs와 같은 자로 잰 %를 낼 수 있다.
async function datalabQuery(
  env,
  terms,
  { days = 29, timeUnit = 'date', filter = {}, benchmark = null } = {},
) {
  const headers = { ...authHeaders(env), 'Content-Type': 'application/json' };
  const fmt = (d) => d.toISOString().slice(0, 10);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const out = new Map(); // term → [ratio...]
  const base = new Map(); // term → 같은 요청의 기준 키워드 [ratio...] (benchmark 모드만)
  const answered = new Set(); // 요청이 성공한 묶음의 term — 응답에 없으면 "노출 하한 미만"
  let failedGroups = 0;
  const step = benchmark ? VOLUME_GROUP : 5;

  for (let i = 0; i < terms.length; i += step) {
    const chunk = terms.slice(i, i + step);
    const names = benchmark ? [benchmark, ...chunk] : chunk;
    const groups = names.map((t) => ({ groupName: t, keywords: [t] }));
    const body = JSON.stringify({
      startDate: fmt(start),
      endDate: fmt(end),
      timeUnit,
      keywordGroups: groups,
      ...filter,
    });

    // 데이터랩은 간헐적으로 400(내부 500을 감싼 것)을 뱉는다. 2026-09-09 실측:
    // 실패한 묶음을 낱개로 다시 부르면 전부 성공했다 — 특정 키워드 문제가 아니라 일시적이다.
    // 한 묶음 실패로 예외를 던지면 그 회차의 수요·모멘텀·연령 신호가 통째로 날아간다.
    let data = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      countCall('datalab', 'trend');
      try {
        const res = await fetch(apiUrl(env, 'trend'), { method: 'POST', headers, body });
        if (res.ok) {
          data = await res.json();
          break;
        }
        if (attempt === 2) console.warn(`[radar] datalab ${res.status} — 묶음 건너뜀`);
      } catch (e) {
        if (attempt === 2) console.warn(`[radar] datalab ${e.message} — 묶음 건너뜀`);
      }
      await sleep(FETCH_DELAY_MS * 4 * (attempt + 1)); // 0.6s → 1.2s → 포기
    }

    if (data) {
      const raw = new Map(); // title → [{period, ratio}]
      for (const r of data.results ?? []) raw.set(r.title, r.data ?? []);
      // 측정 편향 렌즈: 데이터랩은 검색이 없던 날을 점으로 안 준다(실측 2026-09-10 — 어떤 키워드는 30일 창에
      // 2점만 옴). 그대로 평균 내면 "이틀 검색된 키워드"가 상시 키워드보다 커 보인다. 날짜 축을 묶음 안에서
      // 통일하고 빠진 날은 0으로 채워야 zeroDays·firstNonZero·recent7이 같은 자가 된다.
      const axis = [
        ...new Set([...raw.values()].flatMap((pts) => pts.map((p) => p.period))),
      ].sort();
      const aligned = (pts) => {
        const byDate = new Map(pts.map((p) => [p.period, p.ratio]));
        return axis.map((d) => byDate.get(d) ?? 0);
      };
      const got = new Map();
      for (const [title, pts] of raw) got.set(title, aligned(pts));
      const basePts = benchmark ? (got.get(benchmark) ?? []) : null;
      for (const t of chunk) {
        answered.add(t);
        if (got.has(t)) out.set(t, got.get(t));
        if (basePts) base.set(t, basePts);
      }
    } else {
      failedGroups += 1;
    }
    await sleep(FETCH_DELAY_MS);
  }

  // 전부 실패했을 때만 던진다 — 부분 성공은 살려서 쓴다
  const groupCount = Math.ceil(terms.length / step);
  if (groupCount > 0 && failedGroups >= groupCount) {
    throw new Error(`전체 실패 (${failedGroups}/${groupCount} 묶음)`);
  }
  if (failedGroups > 0) {
    console.warn(`[radar] datalab 부분 실패 — ${failedGroups}/${groupCount} 묶음 누락`);
  }
  return { series: out, base, answered };
}

const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * 일별 시계열 → 검색량·신생 판정. keyword-volume.mjs의 정의를 그대로 옮겼다(두 스크립트가 같은 자).
 *   relative      30일 평균 ÷ 기준 평균 × 100
 *   recent7       최근 7일 평균 ÷ 기준 평균 × 100
 *   zeroDays      창 안에서 0인 날 수
 *   firstNonZero  첫 0 초과 점의 인덱스 (-1 = 전부 0)
 *   days          최초 관측 이후 지난 일수 (창 길이가 아니다 — 2026-09-10 정정)
 *   born          위 셋 중 하나라도 "방금 생김"이고 recent7 ≥ 기준 3%
 */
function volumeFromSeries(vals, basePts) {
  const baseAvg = avg(basePts ?? []);
  if (!(baseAvg > 0)) {
    return { measured: false, note: '기준 키워드 응답 없음 — 환산 불가' };
  }
  const recent = avg(vals.slice(-7));
  const prior = avg(vals.slice(0, -7));
  const firstNonZero = vals.findIndex((v) => v > 0);
  const zeroDays = vals.filter((v) => v === 0).length;
  const days = firstNonZero < 0 ? 0 : vals.length - firstNonZero;
  const recent7 = round2((recent / baseAvg) * 100);
  return {
    measured: true,
    relative: round2((avg(vals) / baseAvg) * 100),
    recent7,
    window: vals.length,
    zeroDays,
    firstNonZero,
    days,
    trend: prior > 0 ? round2(recent / prior) : null,
    born:
      (zeroDays >= BORN_ZERO_DAYS || firstNonZero >= BORN_FIRST_NONZERO || days <= BORN_MAX_DAYS) &&
      recent7 >= BORN_RECENT_FLOOR,
  };
}

/** 데이터랩이 시계열을 아예 안 준 키워드 — 검색량이 노출 하한 미만. 이것도 정보다. */
const UNMEASURED_VOLUME = Object.freeze({
  measured: false,
  relative: 0,
  recent7: 0,
  window: 0,
  zeroDays: null,
  firstNonZero: -1,
  days: 0,
  trend: null,
  born: false,
  note: '데이터랩 무응답 — 검색량이 노출 하한 미만',
});

// ── 소스 3: 데이터랩 상대수요 + 모멘텀(급상승) + 검색량·신생(born) ──
// 30일 일별 시계열을 한 번만 받아 세 신호를 뽑는다 (추가 호출 없음).
//   demand   최근 7일 평균을 0~5로 압축 (기존 점수 체계 유지)
//   momentum 최근 7일 평균 ÷ 직전 23일 평균 → 1.0이면 보합, 1.5↑면 급상승
//   volume   기준 키워드(실업급여) 대비 % + born — 요청마다 기준을 같이 넣어 자를 통일
async function collectDatalab(env, terms) {
  const { series, base, answered } = await datalabQuery(env, terms, {
    benchmark: VOLUME_BENCHMARK,
  });
  const demand = new Map();
  const momentum = new Map();
  const volume = new Map();
  for (const [term, points] of series) {
    const last7 = points.slice(-7);
    const prev = points.slice(0, -7);
    const a7 = avg(last7);
    const aPrev = avg(prev);
    demand.set(term, Math.round((a7 / 100) * 5 * 10) / 10);
    if (aPrev > 0 && prev.length >= 7) {
      momentum.set(term, Math.round((a7 / aPrev) * 100) / 100);
    }
    volume.set(term, volumeFromSeries(points, base.get(term)));
  }
  // 요청은 성공했는데 시계열이 안 온 키워드 = 노출 하한 미만. 실패한 묶음은 아예 안 넣는다(재측정 대상).
  for (const term of answered) {
    if (!series.has(term)) volume.set(term, { ...UNMEASURED_VOLUME });
  }
  return { demand, momentum, volume };
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
    const { series } = await datalabQuery(env, terms, { filter: { ages: b.ages } });
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
  const add = (term, q, seen) => {
    if (term.length < 3 || term.length > 18) return;
    if (TERM_BLACKLIST.has(term) || seen.has(term)) return;
    seen.add(term);
    const rec = byTerm.get(term) ?? { count: 0, questions: [] };
    rec.count += 1;
    if (rec.questions.length < 3) rec.questions.push(q.title);
    byTerm.set(term, rec);
  };
  for (const q of questions) {
    const seen = new Set();
    for (const m of q.title.matchAll(TERM_SUFFIX_RE)) {
      // 앞머리 숫자는 떼되 차수("4차민생지원금")는 물결 어휘라 남긴다
      let term = m[1].replace(/^[0-9·]+(?!차)/, '').trim();
      const rm = term.match(REGION_FULL_RE);
      if (rm) {
        if (!isRegionName(rm[1])) continue;
        term = `${rm[1]} ${rm[2]}`;
      }
      add(term, q, seen);
    }
    // 지역 접미형 — "완주군 민생안정지원금" 한 칸 띄운 형태로 정규화
    for (const m of q.title.matchAll(REGION_TERM_RE)) {
      if (!isRegionName(m[1])) continue;
      add(`${m[1]} ${m[2].replace(/\s+/g, '')}`, q, seen);
    }
  }
  return byTerm;
}

/** 측정 진입 조건(완화): 처음 본 지 ≤7일 OR 질문 ≥3 OR 지역 패턴 */
function measureEligible(row, store, now) {
  const firstSeen = store.byTerm?.[row.term]?.firstSeen;
  const age = firstSeen ? (now - Date.parse(firstSeen)) / 86400_000 : 0;
  return (
    age <= MEASURE_NEW_DAYS ||
    row.signals.kinQuestions >= MEASURE_KIN_MIN ||
    hasRegionPattern(row.term)
  );
}

// ── 소스 6: 실유입 검색어(애널리틱스) × 자사 순위 ─────────────────
// 최신 naver-analytics-search-*.json 하나만 읽는다. 순위는 naver-ranks.json의 latest.rank.
//   ourRank: null = 측정했으나 미노출, undefined = 측정 없음
async function loadAnalyticsGaps() {
  let files = [];
  try {
    files = (await readdir(ANALYTICS_DIR)).filter((f) => ANALYTICS_FILE_RE.test(f)).sort();
  } catch {
    return { file: null, gaps: [] };
  }
  const file = files.at(-1);
  if (!file) return { file: null, gaps: [] };
  const data = JSON.parse(await readFile(join(ANALYTICS_DIR, file), 'utf8'));
  let ranks = {};
  try {
    ranks = JSON.parse(await readFile(RANKS_FILE, 'utf8')).byQuery ?? {};
  } catch {}

  const gaps = [];
  for (const k of data.keywords ?? []) {
    const query = clean(k.query, 80);
    if (!query || ANALYTICS_SKIP.has(query)) continue;
    const rec = ranks[query];
    const ourRank = rec ? (rec.latest?.rank ?? null) : undefined;
    const open = ourRank === undefined || ourRank === null || ourRank >= ANALYTICS_RANK_FLOOR;
    if (!open) continue;
    gaps.push({
      term: query,
      inbound7d: Number(k.visits) || 0,
      ourRank: ourRank === undefined ? null : ourRank,
      rankMeasured: rec != null,
      regionPattern: hasRegionPattern(query),
    });
  }
  gaps.sort((a, b) => b.inbound7d - a.inbound7d);
  return {
    file,
    period: data.period ?? null,
    gaps: gaps.slice(0, ANALYTICS_TOP),
  };
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

// ── 기회도 산출 ──────────────────────────────────────────────
/** 값이 배열 안에서 차지하는 백분위(0~1). higherBetter=false면 작을수록 1에 가깝다. */
function percentile(sorted, v, higherBetter) {
  const below = higherBetter
    ? sorted.filter((x) => x < v).length
    : sorted.filter((x) => x > v).length;
  return sorted.length ? below / sorted.length : 0;
}

/**
 * 시장 데이터가 있는 행에 기회도를 매긴다.
 * 백분위는 "그 회차 안에서"만 의미가 있다 — 회차 간 절대 비교는 하지 마라.
 */
function scoreOpportunity(rows) {
  const withMarket = rows.filter((r) => r.market?.blogTotal != null);
  if (withMarket.length < 5) return; // 표본이 너무 적으면 백분위가 무의미하다

  const demands = withMarket.map((r) => r.signals.kinQuestions).sort((a, b) => a - b);
  const supplies = withMarket.map((r) => r.market.blogTotal).sort((a, b) => a - b);

  for (const r of withMarket) {
    const dP = percentile(demands, r.signals.kinQuestions, true);
    const sP = percentile(supplies, r.market.blogTotal, false);
    r.signals.demandPct = Math.round(dP * 100);
    r.signals.supplyScarcity = Math.round(sP * 100);
    r.signals.opportunity = Math.round(dP * sP * 100);
  }
}

// ── 신생·성장 판정 ───────────────────────────────────────────
// 이미 큰 키워드는 이미 남들이 다 썼다. "앞으로" 커질 자리를 잡으려면
// 방금 생겼거나(new) 우상향 중인(rising) 키워드를 봐야 한다.
//   age    처음 관측된 뒤 지난 일수 (이번이 첫 관측이면 0)
//   growth byTerm.hist 후반 평균 ÷ 전반 평균 (관측 4회 미만이면 판정 불가 → null)
function classifyLifecycle(rows, store, ts) {
  const now = Date.parse(ts);
  for (const r of rows) {
    const rec = store.byTerm?.[r.term];
    const age = rec?.firstSeen
      ? Math.max(0, Math.floor((now - Date.parse(rec.firstSeen)) / 86400_000))
      : 0;
    const hist = rec?.hist ?? [];
    let growth = null;
    if (hist.length >= GROWTH_MIN_OBS) {
      const half = Math.floor(hist.length / 2);
      const early = avg(hist.slice(0, half).map((h) => h[1]));
      const late = avg(hist.slice(half).map((h) => h[1]));
      if (early > 0) growth = Math.round((late / early) * 100) / 100;
    }
    let stage;
    if (age <= NEW_TERM_DAYS) stage = 'new';
    else if (growth != null && growth >= GROWTH_STRONG) stage = 'rising';
    else if (growth != null && growth < 0.7) stage = 'fading';
    else stage = 'mature';
    r.lifecycle = { age, growth, stage, observations: hist.length };
  }
}

/**
 * 틈새 후보 — "들어갈 자리가 있다" × "지금 막 커지는 중".
 * 판정은 gap이 아니라 기회도로 한다(위 주석 참조 — gap은 포화 키워드를 상위로 올린다).
 * 급상승(momentum)은 나이와 무관하게 편입한다 — 정책 발표로 갑자기 열린 자리가 있다.
 */
function nicheCandidates(rows) {
  return rows
    .filter((r) => {
      const stage = r.lifecycle?.stage;
      const fresh = stage === 'new' || stage === 'rising';
      const surging = (r.signals.momentum ?? 0) >= MOMENTUM_SURGE;
      const room = (r.signals.opportunity ?? 0) >= OPPORTUNITY_STRONG;
      // 질문 2건짜리는 공급이 아무리 얇아도 수요를 확인할 표본이 못 된다
      const enough = r.signals.kinQuestions >= NICHE_MIN_QUESTIONS || (r.signals.news ?? 0) > 0;
      return room && enough && (fresh || surging);
    })
    .sort((a, b) => (b.signals.opportunity ?? 0) - (a.signals.opportunity ?? 0));
}

/**
 * 파이프라인용 후보(candidates) — 세 갈래를 한 목록으로 합친다.
 *   born          데이터랩 신생. 기회도·모멘텀·표본 수와 무관하게 직행(계획 §3 신호 (2)).
 *   fromAnalytics 실유입 쿼리 중 자사 미노출·4위 이하·미측정(계획 §3 신호 (4)).
 *   niche         (구) 틈새 — 기회도 30↑ × 신생/성장/급상승.
 * 한 term이 여러 갈래에 걸리면 reasons에 전부 남긴다. 정렬: born → 실유입 많은 순 → 기회도.
 */
function buildCandidates(rows, niche, analyticsGaps, volumeByTerm) {
  const byTerm = new Map();
  const upsert = (term, reason, patch) => {
    const c = byTerm.get(term) ?? {
      term,
      reasons: [],
      born: false,
      fromAnalytics: false,
      inbound7d: null,
      ourRank: null,
      rankMeasured: false,
      regionPattern: hasRegionPattern(term),
      signals: {},
    };
    if (!c.reasons.includes(reason)) c.reasons.push(reason);
    Object.assign(c, patch);
    byTerm.set(term, c);
  };
  const rowSignals = (r) => ({
    kinQuestions: r.signals.kinQuestions,
    news: r.signals.news,
    datalab: r.signals.datalab ?? null,
    momentum: r.signals.momentum ?? null,
    opportunity: r.signals.opportunity ?? null,
    gap: r.signals.gap ?? null,
    volume: r.signals.volume ?? null,
    stage: r.lifecycle?.stage ?? null,
    age: r.lifecycle?.age ?? null,
  });

  for (const r of rows) {
    if (r.signals.volume?.born) {
      upsert(r.term, 'born', { born: true, signals: rowSignals(r) });
    }
  }
  for (const g of analyticsGaps) {
    const vol = volumeByTerm.get(g.term) ?? null;
    const prev = byTerm.get(g.term);
    upsert(g.term, 'analytics', {
      fromAnalytics: true,
      inbound7d: g.inbound7d,
      ourRank: g.ourRank,
      rankMeasured: g.rankMeasured,
      born: Boolean(prev?.born || vol?.born),
      signals: { ...(prev?.signals ?? {}), volume: prev?.signals?.volume ?? vol },
    });
  }
  for (const r of niche) {
    const prev = byTerm.get(r.term);
    upsert(r.term, 'niche', { signals: { ...rowSignals(r), ...(prev?.signals ?? {}) } });
  }

  const key = (c) => [
    c.born ? 0 : 1,
    c.fromAnalytics ? 0 : 1,
    -(c.inbound7d ?? 0),
    -(c.signals.volume?.recent7 ?? 0),
    -(c.signals.opportunity ?? 0),
  ];
  return [...byTerm.values()].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return a.term.localeCompare(b.term, 'ko');
  });
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
  if (!isHubMode(env) && !(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET)) {
    console.error(
      '[radar] 인증 키 필요 — NAVER API HUB는 NCP_API_KEY_ID/NCP_API_KEY, 레거시 오픈API는 NAVER_CLIENT_ID/NAVER_CLIENT_SECRET (.env 또는 secrets)',
    );
    process.exit(1);
  }
  console.log(`[radar] API 모드: ${isHubMode(env) ? 'NAVER API HUB (Ncloud)' : '레거시 오픈API'}`);

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
  console.log(`[radar] 추출 term ${termMap.size}개 (질문 ${questions.length}건)`);
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

  // 판정(신생·측정 진입)은 "이전 관측"을 봐야 하므로 적재 전에 store를 먼저 읽는다
  const store = await loadStore();
  const nowMs = Date.now();

  // 실유입 검색어 — API 호출 없음. 자사 미노출·4위 이하·미측정 쿼리를 후보에 넣고 검색량만 같이 잰다.
  let analytics = { file: null, gaps: [] };
  try {
    analytics = await loadAnalyticsGaps();
    sourceStatus.analytics = analytics.file
      ? `ok (${analytics.gaps.length} gaps, ${analytics.file})`
      : 'skip (파일 없음)';
  } catch (e) {
    sourceStatus.analytics = `fail: ${e.message}`;
  }

  // 데이터랩: 상대수요 + 모멘텀 + 검색량·신생(born)
  // 측정 풀 = (처음 본 지 ≤7일 OR 질문 ≥3 OR 지역 패턴) 점수순 → 남는 자리 점수순.
  // 실유입 쿼리는 풀 상한과 별도로 붙인다(검색량 문턱이 아니라 정렬용 — 계획 §1 표 3).
  const volumeByTerm = new Map();
  if (sources.includes('datalab') && rows.length > 0) {
    try {
      const eligible = rows.filter((r) => measureEligible(r, store, nowMs));
      const eligibleSet = new Set(eligible);
      const rest = rows.filter((r) => !eligibleSet.has(r));
      const pool = [...eligible, ...rest].slice(0, DATALAB_TOP).map((r) => r.term);
      const poolSet = new Set(pool);
      const extra = analytics.gaps.map((g) => g.term).filter((t) => !poolSet.has(t));
      const { demand, momentum, volume } = await collectDatalab(env, [...pool, ...extra]);
      for (const [term, v] of volume) volumeByTerm.set(term, v);
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
        if (volume.has(r.term)) r.signals.volume = volume.get(r.term);
      }
      rows.sort((a, b) => b.score - a.score);
      const bornN = [...volume.values()].filter((v) => v.born).length;
      sourceStatus.datalab = `ok (${demand.size} terms, 모멘텀 ${momentum.size}, 측정 ${volume.size}, born ${bornN}, 진입조건 ${eligible.length})`;
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
      scoreOpportunity(rows);
      rows.sort((a, b) => b.score - a.score);
      sourceStatus.market = `ok (${market.size} terms)`;
    } catch (e) {
      sourceStatus.market = `fail: ${e.message}`;
    }
  }

  // born은 점수와 무관하게 살아남아야 한다 — 상한(SNAPSHOT_TERM_CAP)은 지키되 born 자리를 먼저 확보한다
  const bornRows = rows.filter((r) => r.signals.volume?.born);
  const others = rows.filter((r) => !r.signals.volume?.born);
  rows = [...bornRows, ...others.slice(0, Math.max(0, SNAPSHOT_TERM_CAP - bornRows.length))].sort(
    (a, b) => b.score - a.score,
  );
  const ts = new Date().toISOString();

  classifyLifecycle(rows, store, ts);
  const niche = nicheCandidates(rows);
  const candidates = buildCandidates(rows, niche, analytics.gaps, volumeByTerm);

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

  if (niche.length) {
    console.log('[radar] 🌱 틈새 후보 (기회도 = 수요상위 × 공급희소, 30↑ × 신생/성장/급상승):');
    for (const r of niche.slice(0, 12)) {
      const lc = r.lifecycle;
      const tag =
        lc.stage === 'new'
          ? `신생 ${lc.age}일`
          : lc.stage === 'rising'
            ? `성장 ×${lc.growth}`
            : `급상승 ×${r.signals.momentum}`;
      console.log(
        `  기회 ${String(r.signals.opportunity).padStart(3)}  ${r.term.padEnd(14)} ${tag}` +
          `  수요상위 ${r.signals.demandPct}% · 공급희소 ${r.signals.supplyScarcity}%` +
          `${r.market ? ` (질문 ${r.signals.kinQuestions} / 블로그 ${r.market.blogTotal.toLocaleString()})` : ''}`,
      );
    }
  } else {
    console.log('[radar] 🌱 틈새 후보 없음 — 기회도 미달이거나 전부 성숙 키워드');
  }

  // 파이프라인 후보 요약 — born / 실유입 / 틈새
  const bornC = candidates.filter((c) => c.born);
  const fromA = candidates.filter((c) => c.fromAnalytics);
  console.log(
    `[radar] 🎯 후보 ${candidates.length}건 — born ${bornC.length} · 실유입 ${fromA.length}${
      analytics.file ? ` (${analytics.file})` : ''
    } · 틈새 ${niche.length}`,
  );
  if (bornC.length) {
    console.log('[radar]   ★ born (창 안에서 방금 생긴 검색량 — 기회도·모멘텀 무관 직행):');
    for (const c of bornC.slice(0, 12)) {
      const v = c.signals.volume;
      console.log(
        `    ${c.term.padEnd(18)} 최근7 ${String(v.recent7).padStart(6)}  0인날 ${String(v.zeroDays).padStart(2)}  첫관측 +${v.firstNonZero}  경과 ${v.days}일  추세 ${v.trend ?? '-'}` +
          `${c.fromAnalytics ? `  실유입 ${c.inbound7d}` : ''}`,
      );
    }
  }
  if (fromA.length) {
    console.log('[radar]   ⚑ 실유입 쿼리 중 자사 미노출·4위 이하·미측정 (상위 40):');
    for (const c of fromA.slice(0, 12)) {
      const v = c.signals.volume;
      const vol = v ? (v.measured ? `최근7 ${v.recent7}` : '데이터랩 무응답') : '미측정';
      const rank = c.rankMeasured
        ? c.ourRank == null
          ? '미노출'
          : `${c.ourRank}위`
        : '순위 측정 없음';
      console.log(
        `    ${c.term.padEnd(18)} 유입 ${String(c.inbound7d).padStart(5)}  ${rank.padEnd(9)} ${vol}${c.born ? '  ★born' : ''}`,
      );
    }
  }

  const usage = usageReport(RUNS_PER_DAY);
  console.log(formatUsage(usage));

  if (dryRun) {
    // 기계가 읽을 한 줄 — 파이프라인이 stdout에서 그대로 파싱한다
    console.log(
      `[radar] candidates-json ${JSON.stringify({ ts, analyticsFile: analytics.file, candidates })}`,
    );
    console.log('[radar] --dry-run — 적재 생략');
    return;
  }

  store.updatedAt = ts;
  store.apiUsage = { ts, mode: isHubMode(env) ? 'hub' : 'legacy', ...usage };
  store.updateCandidates = updateCandidates.map((c) => ({ ...c, flaggedAt: ts }));
  store.candidates = candidates.map((c) => ({ ...c, flaggedAt: ts }));
  store.analytics = analytics.file
    ? { file: analytics.file, period: analytics.period ?? null, gaps: analytics.gaps.length }
    : null;
  store.snapshots.push({ ts, sourceStatus, keywords: rows });
  store.niche = niche.slice(0, 20).map((r) => ({
    term: r.term,
    opportunity: r.signals.opportunity,
    demandPct: r.signals.demandPct,
    supplyScarcity: r.signals.supplyScarcity,
    kinQuestions: r.signals.kinQuestions,
    gap: r.signals.gap,
    momentum: r.signals.momentum ?? null,
    stage: r.lifecycle.stage,
    age: r.lifecycle.age,
    growth: r.lifecycle.growth,
    blogTotal: r.market?.blogTotal ?? null,
    demo: r.demo?.peak ?? null,
    born: r.signals.volume?.born ?? false,
    recent7: r.signals.volume?.recent7 ?? null,
    flaggedAt: ts,
  }));
  for (const r of rows) {
    const rec = store.byTerm[r.term] ?? { firstSeen: ts, bestScore: 0, appearances: 0 };
    rec.lastSeen = ts;
    rec.bestScore = Math.max(rec.bestScore, r.score);
    rec.appearances += 1;
    // 압축 시계열 — 스냅샷은 용량 가드에 밀려 짧아지지만 추세 판정은 길게 봐야 한다
    rec.hist = [...(rec.hist ?? []), [ts.slice(0, 10), r.score, r.signals.gap ?? null]].slice(
      -TERM_HIST_CAP,
    );
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
