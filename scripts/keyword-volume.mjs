#!/usr/bin/env node
/**
 * keyword-volume — 후보 키워드의 실제 검색량을 기준 키워드 대비로 잰다.
 *
 * 왜 필요한가: 레이더는 수요를 "지식iN 질문 수"로 잡는다. 그건 검색량이 아니다.
 * 애드센스 수익은 순위가 아니라 **트래픽**에서 나오므로, 검색량 없는 1위는 값이 0이다.
 *
 * 데이터랩 ratio는 "그 요청 안에서의" 상대지수라 요청 간 비교가 무효다. 그래서
 * 모든 요청에 **기준 키워드를 함께 넣고** 그 대비 비율로 환산한다. 이러면 요청이
 * 달라도 같은 자로 잰 값이 된다.
 *
 * 사용:
 *   node scripts/keyword-volume.mjs "월세환급금" "냉방지원금" "상병수당"
 *   node scripts/keyword-volume.mjs --file=후보.txt      # 한 줄에 하나
 *   node scripts/keyword-volume.mjs --benchmark=기초연금 "..."
 *   node scripts/keyword-volume.mjs --json "..."          # JSON만 출력
 *   node scripts/keyword-volume.mjs --season "..."        # 13개월 월별 — 계절성·선점 판정
 *   node scripts/keyword-volume.mjs --region 완주 [--kind=군] [--json]
 *                                                          # 지역 접미형·변형 묶음을 자동 생성해 잰다
 *   node scripts/keyword-volume.mjs --help
 *
 * 기준 키워드 기본값은 '실업급여'다. 코퍼스에서 가장 크고 안정적인 축이라
 * 눈금 역할을 한다. 바꾸면 과거 측정치와 비교가 안 되니 웬만하면 두어라.
 *
 * ── --region 모드: 지역 클러스터는 헤드 하나로 재면 틀린다 ──
 * 실유입(2026-09-02~08 애널리틱스)에서 군 단위는 "X군 민생지원금" 접미형이 지역 유입의
 * 85~100%였고, 김해는 변형 27개(1,891)가 헤드 "김해 민생지원금"(166)의 11배였다.
 * 그래서 --region은 헤드가 아니라 **접미형 + 변형 묶음**을 한꺼번에 던지고
 *   regionSum7        응답 있는 변형의 recentRelative 합 — 지역 수요의 크기
 *   measured:false    데이터랩 무응답(노출 하한 미만). 0이 아니라 "못 쟀다"다
 *   proxyRecent7      무응답 행에 같은 지역 형제 변형의 최고값을 병기 — 완주군 민생안정지원금은
 *                     데이터랩 0.51인데 주 512 유입이었다. 무응답 = 수요 없음이 아니다
 * 를 낸다. kind(군·시·구·도)는 --kind로 주거나 src/data/regions.json의 full 이름에서 읽고,
 * 둘 다 없으면 군·시 두 벌을 모두 만든다. 지역 클러스터에서 이 값은 게이트가 아니라
 * 정렬용이다(docs/ops/KEYWORD-PLAN-2026-09-10.md §0·§2).
 *
 * 정렬은 30일 평균(relative)이 아니라 최근 7일(recentRelative)이 먼저다. 물결은 7일 안에
 * 뜨고 지므로 30일 평균은 한 달 전 물결을 지금 것으로 착각하게 만든다.
 *
 * ── --season 모드: "지금은 없지만 커질 것"을 가려내는 자 ──
 * 신생 키워드의 값어치는 지금 검색량이 아니라 **곧 올 검색량을 미리 먹는 것**이다.
 * 그런데 "지금 검색량 0"에는 두 종류가 섞여 있다.
 *   (가) 아직 안 왔다 — 매년 특정 달에 터지는데 지금이 비수기. 선점 대상.
 *   (나) 애초에 없다 — 작년에도 없었다. 아무도 안 찾는 주제. 버릴 것.
 * 30일 창으로는 둘을 구분할 수 없다. 13개월 월별 시계열로 본다.
 *   peakMonth      연중 검색량이 가장 큰 달
 *   monthsToPeak   지금부터 그 달까지 몇 달 (0~2면 지금이 선점 적기)
 *   lastYearPeak   작년 같은 시기 대비 지금 (1보다 크게 낮으면 비수기)
 *   flat=true      13개월 내내 평평 — 계절성이 없다. (나)일 확률이 높다
 *   inProgressWave 최근 7일 일별값이 30일 평균의 1.5배 이상 — 지금 물결이 진행 중이다.
 *                  이 행의 monthsToPeak는 쓰지 마라. 민생 물결은 가결→개시 1~5주짜리 트리거라
 *                  "피크 11개월 뒤"로 읽으면 진행 중 물결을 놓친다(계획 §1 표 6).
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const LEGACY_TREND = 'https://openapi.naver.com/v1/datalab/search';
const HUB_TREND = 'https://naverapihub.apigw.ntruss.com/search-trend/v1/search';

const DEFAULT_BENCHMARK = '실업급여';
const GROUP_SIZE = 5; // 데이터랩 1요청당 키워드 그룹 상한
const DAYS = 29;
const DELAY_MS = 200;
const RETRIES = 3;

// 판정 문턱 — 기준 키워드(실업급여) 대비 %
const EVERGREEN_FLOOR = 10; // 평평하면서 이 이상이면 연중 고른 상시 수요 (애드센스에 최적)
const PEAK_FLOOR = 3; // 계절 피크가 이 미만이면 선점해도 트래픽이 안 온다
const NOISE_FLOOR = 1.5; // 이 미만은 사실상 수요 없음
const WAVE_RATIO = 1.5; // 최근 7일 / 30일 평균이 이 이상이면 진행 중 물결

/** 희소 시계열을 날짜 축(axis: 'YYYY-MM-DD'[])에 맞춰 빈 날을 0으로 채운다. 축이 없으면 그대로 */
function alignToAxis(pts, axis) {
  if (!axis || axis.length === 0) return pts.map((p) => p.ratio);
  const byPeriod = new Map(pts.map((p) => [p.period, p.ratio]));
  return axis.map((d) => byPeriod.get(d) ?? 0);
}

// --region 묶음 템플릿. {R}=지역명, {RK}=지역명+kind(완주군). 순서가 곧 표 순서다.
const REGION_TEMPLATES = [
  '{RK} 민생지원금',
  '{R} 민생지원금',
  '{R} 지원금',
  '{RK} 민생안정지원금',
  '{RK} 민생회복지원금',
  '{R} 지원금 신청',
  '{R} 민생지원금 신청',
  '{R} 추석 지원금',
];
const KINDS = ['군', '시', '구', '도'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

function printHelp() {
  console.log(`사용:
  node scripts/keyword-volume.mjs "키워드1" "키워드2" ...      기준 대비 30일 검색량
  node scripts/keyword-volume.mjs --file=후보.txt              한 줄에 하나
  node scripts/keyword-volume.mjs --season "..."               13개월 월별 — 계절성·선점 판정
  node scripts/keyword-volume.mjs --region 완주 [--kind=군]     지역 접미형·변형 묶음 측정
  옵션:
    --benchmark=키워드   기준 키워드(기본 실업급여). 바꾸면 과거 측정과 비교 불가
    --json               JSON만 출력
    --kind=군|시|구|도   --region의 행정구역. 생략 시 regions.json 또는 이름에서 추정, 못 하면 군·시 둘 다
  --region 묶음: ${REGION_TEMPLATES.join(' · ')}
  출력(recent): recentRelative(최근7일, 정렬 기준) · relative(30일) · trend · zeroDays · days · born · window
                measured:false = 데이터랩 무응답, --region에서는 proxyRecent7(형제 최고값) 병기
                regionSum7 = 응답 있는 변형의 recentRelative 합
  출력(season): peakMonth · monthsToPeak · flat · inProgressWave(진행 중 물결 — monthsToPeak 무효)`);
}

/** 지역 인자에서 (이름, kind 후보) 추출. regions.json → 이름 접미 → 군·시 둘 다. */
async function resolveRegion(input, kindArg) {
  let regions = [];
  try {
    regions = JSON.parse(await readFile(join(ROOT, 'src/data/regions.json'), 'utf8'));
  } catch {
    /* 없으면 이름만으로 추정 */
  }
  const hit = regions.find(
    (r) => r.name === input || (r.aliases ?? []).includes(input) || r.full === input,
  );
  // "완주군"처럼 접미가 붙어 들어오면 이름과 kind를 분리한다
  const tail = input.slice(-1);
  const suffixed = input.length >= 3 && KINDS.includes(tail);
  const name = hit?.name ?? (suffixed ? input.slice(0, -1) : input);
  const full = hit?.full ?? null;

  let kinds;
  let kindSource;
  if (kindArg) {
    kinds = [kindArg];
    kindSource = '--kind';
  } else if (full && KINDS.includes(full.slice(-1))) {
    kinds = [full.slice(-1)];
    kindSource = 'regions.json';
  } else if (suffixed) {
    kinds = [tail];
    kindSource = '이름 접미';
  } else {
    kinds = ['군', '시'];
    kindSource = '추정 불가 — 군·시 둘 다';
  }
  return { name, full, kinds, kindSource };
}

/** 지역 묶음 생성. 도 단위는 "경남도"가 아니라 정식명(경상남도)을 접미형으로 쓴다. */
function buildRegionTerms({ name, full, kinds }) {
  const out = [];
  for (const kind of kinds) {
    const rk = kind === '도' && full ? full : `${name}${kind}`;
    for (const tpl of REGION_TEMPLATES) {
      out.push(tpl.replace('{RK}', rk).replace('{R}', name));
    }
  }
  return [...new Set(out)];
}

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

const isHubMode = (env) => Boolean(env.NCP_API_KEY_ID && env.NCP_API_KEY);
const trendUrl = (env) => (isHubMode(env) ? HUB_TREND : LEGACY_TREND);
const authHeaders = (env) =>
  isHubMode(env)
    ? { 'X-NCP-APIGW-API-KEY-ID': env.NCP_API_KEY_ID, 'X-NCP-APIGW-API-KEY': env.NCP_API_KEY }
    : {
        'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
      };

/** 한 묶음(기준 + 후보 4개) 조회. 데이터랩이 간헐적 400을 뱉으므로 재시도한다. */
async function queryGroup(env, terms, { season = false } = {}) {
  const fmt = (d) => d.toISOString().slice(0, 10);
  const end = new Date();
  // 계절성 판정은 13개월을 봐야 작년 같은 달과 맞댈 수 있다
  const start = season
    ? new Date(end.getTime() - 396 * 86400_000)
    : new Date(end.getTime() - DAYS * 86400_000);
  const body = JSON.stringify({
    startDate: fmt(start),
    endDate: fmt(end),
    timeUnit: season ? 'month' : 'date',
    keywordGroups: terms.map((t) => ({ groupName: t, keywords: [t] })),
  });
  const headers = { ...authHeaders(env), 'Content-Type': 'application/json' };

  for (let i = 0; i < RETRIES; i++) {
    try {
      const res = await fetch(trendUrl(env), { method: 'POST', headers, body });
      if (res.ok) return await res.json();
      if (i === RETRIES - 1) throw new Error(`datalab ${res.status}`);
    } catch (e) {
      if (i === RETRIES - 1) throw e;
    }
    await sleep(DELAY_MS * 4 * (i + 1));
  }
  return null;
}

/** 13개월 월별 시계열 → 계절성·선점 판정 */
function analyseSeason(points, baseAvg, nowMonth) {
  // points: [{period:'2025-09-01', ratio}] 오름차순
  const vals = points.map((p) => p.ratio);
  const peakIdx = vals.reduce((mi, v, i, a) => (v > a[mi] ? i : mi), 0);
  const peak = points[peakIdx];
  const peakMonth = Number(peak.period.slice(5, 7));
  const maxV = vals[peakIdx];
  const minV = Math.min(...vals);
  const meanV = avg(vals);

  // 지금(마지막 완결 월)과 작년 같은 달
  const last = points[points.length - 1];
  const lastYearSame = points.find(
    (p) => Number(p.period.slice(5, 7)) === Number(last.period.slice(5, 7)) && p !== last,
  );

  // 피크가 몇 달 뒤인가 (연중 순환)
  const monthsToPeak = (peakMonth - nowMonth + 12) % 12;

  // 계절성이 없으면(최대/평균이 1.6 미만) 비수기가 아니라 그냥 수요가 없는 것이다
  const flat = meanV > 0 ? maxV / meanV < 1.6 : true;

  return {
    peakMonth,
    peakRelative: baseAvg > 0 ? Math.round((maxV / baseAvg) * 10000) / 100 : 0,
    monthsToPeak,
    troughRelative: baseAvg > 0 ? Math.round((minV / baseAvg) * 10000) / 100 : 0,
    lastYearSameMonth:
      lastYearSame && lastYearSame.ratio > 0
        ? Math.round((last.ratio / lastYearSame.ratio) * 100) / 100
        : null,
    peakOverNow: last.ratio > 0 ? Math.round((maxV / last.ratio) * 100) / 100 : null,
    flat,
    months: points.length,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }
  const jsonOnly = argv.includes('--json');
  const season = argv.includes('--season');
  const benchmark = argv.find((a) => a.startsWith('--benchmark='))?.slice(12) ?? DEFAULT_BENCHMARK;
  const fileArg = argv.find((a) => a.startsWith('--file='))?.slice(7);

  // --region 완주 / --region=완주, --kind=군 / --kind 군 — 값이 붙는 옵션은 다음 토큰을 먹는다
  const takeValue = (flag) => {
    const eq = argv.find((a) => a.startsWith(`${flag}=`));
    if (eq) return eq.slice(flag.length + 1);
    const i = argv.indexOf(flag);
    if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
    return undefined;
  };
  const regionArg = takeValue('--region');
  const kindArg = takeValue('--kind');
  const consumed = new Set([regionArg, kindArg].filter(Boolean));
  if (kindArg && !KINDS.includes(kindArg)) {
    console.error(`[volume] --kind는 ${KINDS.join('|')} 중 하나여야 한다: "${kindArg}"`);
    process.exit(2);
  }

  let terms = argv.filter((a) => !a.startsWith('--') && !consumed.has(a));
  if (fileArg) {
    const text = await readFile(fileArg, 'utf8');
    terms = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  }
  let region = null;
  if (regionArg) {
    region = await resolveRegion(regionArg, kindArg);
    // 지역 묶음 뒤에 직접 준 키워드가 있으면 같이 잰다(형제 변형 추가용)
    terms = [...buildRegionTerms(region), ...terms];
  }
  terms = [...new Set(terms)].filter((t) => t !== benchmark);

  if (terms.length === 0) {
    console.error('사용: node scripts/keyword-volume.mjs "키워드1" "키워드2" ...');
    console.error('      node scripts/keyword-volume.mjs --file=후보.txt');
    console.error('      node scripts/keyword-volume.mjs --region 완주 [--kind=군]');
    console.error('      node scripts/keyword-volume.mjs --help');
    process.exit(2);
  }

  const env = await loadEnv();
  if (!isHubMode(env) && !(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET)) {
    console.error('[volume] 인증 키 필요 — NCP_API_KEY_ID/NCP_API_KEY 또는 NAVER_CLIENT_ID/SECRET');
    process.exit(1);
  }

  /** 응답 → {title: [{period, ratio}]} */
  const indexByTitle = (data) =>
    new Map(
      (data?.results ?? []).map((r) => [
        r.title,
        (r.data ?? []).map((p) => ({ period: p.period, ratio: p.ratio })),
      ]),
    );

  const rows = [];
  let failed = 0;
  // 후보 4개 + 기준 1개씩 묶어 던진다. 기준이 매 요청에 들어가야 눈금이 같아진다.
  for (let i = 0; i < terms.length; i += GROUP_SIZE - 1) {
    const chunk = terms.slice(i, i + GROUP_SIZE - 1);
    let data;
    try {
      data = await queryGroup(env, [benchmark, ...chunk], { season });
    } catch (e) {
      console.error(`[volume] 묶음 실패(${chunk.join(', ')}): ${e.message}`);
      failed += chunk.length;
      // 무응답(노출 하한 미만)과 API 실패는 다르다. 실패는 failed:true로 구분해 행을 남긴다.
      for (const t of chunk)
        rows.push({
          term: t,
          measured: false,
          failed: true,
          relative: 0,
          note: `묶음 실패 — ${e.message}`,
        });
      continue;
    }
    const byTitle = indexByTitle(data);
    const base = avg((byTitle.get(benchmark) ?? []).map((p) => p.ratio));
    // 기준 키워드는 매일 값이 있으므로 그 날짜 목록이 이 묶음의 달력이 된다.
    const axis = (byTitle.get(benchmark) ?? []).map((p) => p.period);
    if (!base) {
      console.error(`[volume] 기준 키워드 "${benchmark}" 응답 없음 — 묶음 건너뜀`);
      failed += chunk.length;
      for (const t of chunk)
        rows.push({
          term: t,
          measured: false,
          failed: true,
          relative: 0,
          note: '기준 키워드 응답 없음',
        });
      continue;
    }
    // --season은 월별이라 "지금 물결이 진행 중인가"를 못 본다. 같은 묶음을 30일 일별로 한 번 더 던져
    // 최근 7일 / 30일 평균을 잰다(기준 없이 자기 자신 대비라 눈금 문제 없음). 요청 1건 추가.
    let dailyByTitle = null;
    if (season) {
      await sleep(DELAY_MS);
      try {
        dailyByTitle = indexByTitle(await queryGroup(env, [benchmark, ...chunk]));
      } catch (e) {
        console.error(`[volume] 물결 판정용 일별 조회 실패(${chunk.join(', ')}): ${e.message}`);
      }
    }
    for (const t of chunk) {
      const pts = byTitle.get(t);
      if (!pts || pts.length === 0) {
        // 검색량이 데이터랩 노출 하한 미만이면 아예 시계열이 안 온다. 이것도 정보다.
        // 단 "0"이 아니라 "못 쟀다"다 — 완주군 민생안정지원금은 0.51로 주 512 유입이었다.
        rows.push({
          term: t,
          measured: false,
          relative: 0,
          ...(season ? {} : { recentRelative: 0 }),
          note: '데이터랩 무응답 — 검색량이 노출 하한 미만',
        });
        continue;
      }
      // 데이터랩은 검색이 0인 날을 점으로 주지 않는다(2026-09-10 실측: 완주 변형 window 1·9·10·13·15).
      // 그대로 쓰면 5점짜리 시계열이 "5일"로 읽히고 recent7이 '마지막 7개 점' 평균이 돼 과대된다.
      // 일별 모드는 기준 키워드의 날짜 축에 맞춰 빈 날을 0으로 채운다(레이더와 같은 처리).
      const vals = season ? pts.map((p) => p.ratio) : alignToAxis(pts, axis);
      const row = { term: t, measured: true };
      if (season) {
        row.relative = Math.round((avg(vals) / base) * 10000) / 100; // 기준 대비 %
        // 데이터 마지막 점이 아니라 오늘(KST) 달 기준 — 월 초에 지난달 점만 오면 D-개월이 하나 어긋난다
        const nowMonth = new Date(Date.now() + 9 * 3600 * 1000).getUTCMonth() + 1;
        Object.assign(row, analyseSeason(pts, base, nowMonth));
        // 진행 중 물결: 최근 7일 일별값이 30일 평균의 1.5배 이상. 이 행의 monthsToPeak는 무효다.
        const daily = (dailyByTitle?.get(t) ?? []).map((p) => p.ratio);
        if (daily.length >= 7) {
          const mean30 = avg(daily);
          row.waveRatio =
            mean30 > 0 ? Math.round((avg(daily.slice(-7)) / mean30) * 100) / 100 : null;
          row.inProgressWave = row.waveRatio != null && row.waveRatio >= WAVE_RATIO;
        } else {
          row.waveRatio = null;
          row.inProgressWave = null; // 일별 응답 없음 — 판정 불가
        }
      } else {
        const recent7 = avg(vals.slice(-7));
        const prior = avg(vals.slice(0, -7));
        // recent7이 relative보다 앞이다 — 물결은 7일 안에 뜨고 지므로 정렬도 이걸로 한다
        row.recentRelative = Math.round((recent7 / base) * 10000) / 100;
        row.relative = Math.round((avg(vals) / base) * 10000) / 100; // 기준 대비 %
        row.trend = prior > 0 ? Math.round((recent7 / prior) * 100) / 100 : null;
        row.zeroDays = vals.filter((v) => v === 0).length;
        // 2026-09-10 정정: 예전 `days = vals.length`는 30일 창 길이(항상 29)라 "days<30 = 신생"
        // 판정이 전부 참이 됐다. days는 최초 관측(첫 0 초과 점) 이후 지난 일수로 바꾼다.
        const firstNonZero = vals.findIndex((v) => v > 0);
        row.window = vals.length;
        row.firstNonZeroIndex = firstNonZero;
        row.days = firstNonZero < 0 ? 0 : vals.length - firstNonZero;
        // 신생(born): 창 안에서 방금 생긴 키워드. '추석지원금 지역별 지급 대상'(5일)·'김해 지원금 10만원 신청'(19일)이
        // 잡히고 '4차 민생지원금'·'김해 민생지원금' 같은 상시 헤드는 탈락하는 정의(2026-09-10 실측 15건).
        row.born =
          (row.zeroDays >= 8 || firstNonZero >= 7 || row.days <= 21) && row.recentRelative >= 3;
      }
      rows.push(row);
    }
    await sleep(DELAY_MS);
  }

  // 정렬: recent 모드는 최근 7일이 먼저, 같으면 30일 평균. season은 월별이라 30일 평균 그대로.
  rows.sort((a, b) =>
    season
      ? b.relative - a.relative
      : (b.recentRelative ?? 0) - (a.recentRelative ?? 0) || b.relative - a.relative,
  );

  // --region: 응답 있는 변형의 합 + 무응답 행에 형제 최고값 병기(측정 편향 규칙 5)
  let regionSum7 = null;
  if (region && !season) {
    const measured = rows.filter((r) => r.measured);
    regionSum7 = Math.round(measured.reduce((s, r) => s + (r.recentRelative ?? 0), 0) * 100) / 100;
    const proxy = measured.length ? Math.max(...measured.map((r) => r.recentRelative ?? 0)) : null;
    for (const r of rows) if (!r.measured) r.proxyRecent7 = proxy;
  }

  if (jsonOnly) {
    console.log(
      JSON.stringify(
        {
          benchmark,
          mode: season ? 'season' : 'recent',
          ...(region
            ? {
                region: region.name,
                regionFull: region.full,
                kinds: region.kinds,
                kindSource: region.kindSource,
                regionSum7,
                unmeasured: rows.filter((r) => !r.measured).length,
              }
            : {}),
          rows,
          failed,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (season) {
    console.log(`[volume] 계절성 — 기준 "${benchmark}" = 100 · 최근 13개월 월별`);
    console.log('');
    console.log('  평균   피크량  피크월  D-개월  저점   작년동월비  판정');
    for (const r of rows) {
      if (r.note) {
        console.log(
          `  ${String(r.relative).padStart(5)}     -      -      -      -       -      ${r.term}  ← ${r.note}`,
        );
        continue;
      }
      // 평평하다고 다 나쁜 게 아니다. 검색량이 크면서 평평한 것은 연중 고른 상시 수요라
      // 애드센스에는 오히려 가장 좋다. 반대로 계절성이 있어도 피크 자체가 미미하면 선점 가치가 없다.
      const verdict = r.inProgressWave
        ? `⚠ 진행 중 물결 (최근7일 = 30일 평균 ×${r.waveRatio}) — monthsToPeak 무효, 가결 트리거로 판단`
        : r.flat
          ? r.relative >= EVERGREEN_FLOOR
            ? `◎ 상시 수요 (연중 고른 트래픽, 평균 ${r.relative})`
            : r.relative >= NOISE_FLOOR
              ? '얇은 상시 수요'
              : '수요 없음 — 선점해도 트래픽이 안 온다'
          : r.peakRelative < PEAK_FLOOR
            ? `피크도 미미(${r.peakRelative}) — 계절성은 있으나 값이 없다`
            : r.monthsToPeak <= 2
              ? `★ 선점 적기 (${r.peakMonth}월 피크 ${r.peakRelative}, D-${r.monthsToPeak}개월)`
              : `대기 (${r.peakMonth}월 피크 ${r.peakRelative}, D-${r.monthsToPeak}개월)`;
      console.log(
        `  ${String(r.relative).padStart(5)}  ${String(r.peakRelative).padStart(6)}  ${String(r.peakMonth).padStart(4)}월  ${String(r.monthsToPeak).padStart(4)}   ${String(r.troughRelative).padStart(5)}  ${String(r.lastYearSameMonth ?? '-').padStart(8)}   ${r.term}  ${verdict}`,
      );
    }
    console.log('');
    console.log(
      `  ★ 선점 = 피크가 ${'0~2'}개월 앞 + 피크 검색량 ${PEAK_FLOOR} 이상. 지금 쓰면 피크에 상위를 잡는다.`,
    );
    console.log(
      `  ◎ 상시 = 계절성 없이 평균 ${EVERGREEN_FLOOR} 이상. 연중 트래픽이 쌓여 애드센스에 가장 좋다.`,
    );
    console.log('  "수요 없음"은 비수기가 아니라 작년에도 아무도 안 찾았다는 뜻이다.');
    console.log(
      `  ⚠ 진행 중 물결(최근 7일 값이 30일 평균의 ${WAVE_RATIO}배 이상)에는 monthsToPeak를 쓰지 마라 — 민생 물결은 가결→개시 1~5주짜리 트리거다.`,
    );
    if (failed)
      console.log(`
[volume] ${failed}건 측정 실패`);
    return;
  }

  if (region) {
    console.log(
      `[volume] 지역 묶음 "${region.name}"(${region.kinds.join('·')}, ${region.kindSource}) · 기준 "${benchmark}" = 100 · 최근 ${DAYS + 1}일`,
    );
    console.log(
      `  regionSum7 = ${regionSum7} (응답 ${rows.filter((r) => r.measured).length}/${rows.length}, 무응답 ${rows.filter((r) => !r.measured).length})`,
    );
  } else {
    console.log(`[volume] 기준 "${benchmark}" = 100 · 최근 ${DAYS + 1}일 일별 평균 대비`);
  }
  console.log('');
  console.log('  최근7일  상대량  추세   0인날  키워드');
  for (const r of rows) {
    if (!r.measured) {
      const proxy = r.proxyRecent7 != null ? ` (형제 최고 ${r.proxyRecent7} 대용)` : '';
      console.log(`       -       -      -      -    ${r.term}  ← ${r.note}${proxy}`);
      continue;
    }
    const trend = r.trend == null ? '  -  ' : `×${String(r.trend).padEnd(4)}`;
    console.log(
      `  ${String(r.recentRelative).padStart(6)}  ${String(r.relative).padStart(6)}  ${trend}  ${String(r.zeroDays).padStart(3)}/${String(r.days).padStart(2)}${r.born ? ' ★신생' : '      '}  ${r.term}`,
    );
  }
  if (failed) console.log(`\n[volume] ${failed}건 측정 실패`);
  console.log('');
  if (region) {
    console.log(
      '  해석: 무응답은 0이 아니라 "못 쟀다"다. 군 단위 접미형은 데이터랩 하한 아래서도 주 수백 유입이 난다.',
    );
    console.log(
      '        regionSum7로 지역 간 크기를 견주고, 발행 여부는 SERP 실측(--mode=scout)으로 정한다.',
    );
  }
  console.log('  해석: 0인 날이 많으면 검색이 산발적이라 트래픽이 안 쌓인다.');
  console.log(
    '        상대량이 1 미만이면 기준 키워드의 1% 미만 — 전국 키워드는 1위를 해도 방문자가 거의 없다.',
  );
  console.log(
    '        단, 지역×지원금 쿼리는 예외다: 완주군 민생안정지원금 0.51이 주 512 유입(2026-09-10 실측).',
  );
  console.log(
    '        지역 클러스터에서 이 값은 게이트가 아니라 정렬용이다(docs/ops/KEYWORD-PLAN-2026-09-10.md §2).',
  );
}

main().catch((e) => {
  console.error('[volume] 실패:', e.message);
  process.exit(1);
});
