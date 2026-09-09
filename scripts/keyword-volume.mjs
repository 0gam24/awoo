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
 *
 * 기준 키워드 기본값은 '실업급여'다. 코퍼스에서 가장 크고 안정적인 축이라
 * 눈금 역할을 한다. 바꾸면 과거 측정치와 비교가 안 되니 웬만하면 두어라.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

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
  const jsonOnly = argv.includes('--json');
  const season = argv.includes('--season');
  const benchmark = argv.find((a) => a.startsWith('--benchmark='))?.slice(12) ?? DEFAULT_BENCHMARK;
  const fileArg = argv.find((a) => a.startsWith('--file='))?.slice(7);

  let terms = argv.filter((a) => !a.startsWith('--'));
  if (fileArg) {
    const text = await readFile(fileArg, 'utf8');
    terms = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  }
  terms = [...new Set(terms)].filter((t) => t !== benchmark);

  if (terms.length === 0) {
    console.error('사용: node scripts/keyword-volume.mjs "키워드1" "키워드2" ...');
    console.error('      node scripts/keyword-volume.mjs --file=후보.txt');
    process.exit(2);
  }

  const env = await loadEnv();
  if (!isHubMode(env) && !(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET)) {
    console.error('[volume] 인증 키 필요 — NCP_API_KEY_ID/NCP_API_KEY 또는 NAVER_CLIENT_ID/SECRET');
    process.exit(1);
  }

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
      continue;
    }
    const byTitle = new Map(
      (data?.results ?? []).map((r) => [
        r.title,
        (r.data ?? []).map((p) => ({ period: p.period, ratio: p.ratio })),
      ]),
    );
    const base = avg((byTitle.get(benchmark) ?? []).map((p) => p.ratio));
    if (!base) {
      console.error(`[volume] 기준 키워드 "${benchmark}" 응답 없음 — 묶음 건너뜀`);
      failed += chunk.length;
      continue;
    }
    for (const t of chunk) {
      const pts = byTitle.get(t);
      if (!pts || pts.length === 0) {
        // 검색량이 데이터랩 노출 하한 미만이면 아예 시계열이 안 온다. 이것도 정보다.
        rows.push({ term: t, relative: 0, note: '데이터랩 무응답 — 검색량이 노출 하한 미만' });
        continue;
      }
      const vals = pts.map((p) => p.ratio);
      const row = {
        term: t,
        relative: Math.round((avg(vals) / base) * 10000) / 100, // 기준 대비 %
      };
      if (season) {
        const nowMonth = Number(pts[pts.length - 1].period.slice(5, 7));
        Object.assign(row, analyseSeason(pts, base, nowMonth));
      } else {
        const recent7 = avg(vals.slice(-7));
        const prior = avg(vals.slice(0, -7));
        row.recentRelative = Math.round((recent7 / base) * 10000) / 100;
        row.trend = prior > 0 ? Math.round((recent7 / prior) * 100) / 100 : null;
        row.zeroDays = vals.filter((v) => v === 0).length;
        row.days = vals.length;
      }
      rows.push(row);
    }
    await sleep(DELAY_MS);
  }

  rows.sort((a, b) => b.relative - a.relative);

  if (jsonOnly) {
    console.log(
      JSON.stringify({ benchmark, mode: season ? 'season' : 'recent', rows, failed }, null, 2),
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
      const verdict = r.flat
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
    if (failed)
      console.log(`
[volume] ${failed}건 측정 실패`);
    return;
  }

  console.log(`[volume] 기준 "${benchmark}" = 100 · 최근 ${DAYS + 1}일 일별 평균 대비`);
  console.log('');
  console.log('  상대량  최근7일  추세   0인날  키워드');
  for (const r of rows) {
    if (r.note) {
      console.log(
        `  ${String(r.relative).padStart(6)}     -      -      -    ${r.term}  ← ${r.note}`,
      );
      continue;
    }
    const trend = r.trend == null ? '  -  ' : `×${String(r.trend).padEnd(4)}`;
    console.log(
      `  ${String(r.relative).padStart(6)}  ${String(r.recentRelative).padStart(6)}  ${trend}  ${String(r.zeroDays).padStart(3)}/${r.days}  ${r.term}`,
    );
  }
  if (failed) console.log(`\n[volume] ${failed}건 측정 실패`);
  console.log('');
  console.log('  해석: 0인 날이 많으면 검색이 산발적이라 트래픽이 안 쌓인다.');
  console.log('        상대량이 1 미만이면 기준 키워드의 1% 미만 — 1위를 해도 방문자가 거의 없다.');
}

main().catch((e) => {
  console.error('[volume] 실패:', e.message);
  process.exit(1);
});
