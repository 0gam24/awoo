// NAVER API 호출량 집계 + 한도 대비 여유 계산
//
// 한도는 Ncloud 콘솔 > API 관리 화면 실측(2026-09-09, Application "awoo").
// 검색 API 8종(이미지·지식iN·성인검색어·블로그·오타변환·뉴스·웹문서·카페)은
// 한 덩어리로 한도를 공유한다. 데이터랩 검색어트렌드는 일 제한이 없고 월 한도만 있다.
//
// 레거시 오픈API 시절 한도(일 25,000)와 수치가 같지만, 월 한도는 HUB에서 새로 생겼다.

export const QUOTA = {
  search: {
    label: 'NAVER 검색 (지식iN·블로그·카페·뉴스·웹문서 등 8종 공유)',
    daily: 25_000,
    monthly: 775_000,
  },
  datalab: {
    label: 'DataLab 검색어트렌드',
    daily: null, // 제한 없음
    monthly: 50_000,
  },
};

// 한 번의 실행이 이 횟수를 넘으면 루프 버그로 보고 즉시 멈춘다.
// 정상 실행은 레이더 55회 / sync-issues 3회다. 한도를 태우기 전에 잡는 안전핀.
const RUN_CEILING = 500;

const counts = new Map(); // "group:name" → n

/** API 호출 1건 기록. group은 QUOTA의 키(search|datalab). */
export function countCall(group, name) {
  const key = `${group}:${name}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
  const total = totalCalls();
  if (total > RUN_CEILING) {
    throw new Error(
      `[api-quota] 한 실행에서 ${total}회 호출 — 상한 ${RUN_CEILING} 초과. 호출 루프를 확인하라.`,
    );
  }
}

const totalCalls = () => [...counts.values()].reduce((s, v) => s + v, 0);

/** group별 합계 */
function byGroup() {
  const g = {};
  for (const [key, n] of counts) {
    const group = key.split(':')[0];
    g[group] = (g[group] ?? 0) + n;
  }
  return g;
}

/** 세부(API별) 내역 */
function detail() {
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

/**
 * 이번 실행 실측 + 하루 runsPerDay회 도는 스케줄 기준 일·월 추정치.
 * 실제 누적이 아니라 "이 스케줄대로 돌면 얼마를 쓰는가"의 산출값이다.
 */
export function usageReport(runsPerDay) {
  const groups = byGroup();
  const out = { runsPerDay, thisRun: totalCalls(), detail: detail(), groups: {} };

  for (const [group, q] of Object.entries(QUOTA)) {
    const perRun = groups[group] ?? 0;
    if (perRun === 0) continue;
    const perDay = perRun * runsPerDay;
    const perMonth = perDay * 30;
    out.groups[group] = {
      perRun,
      perDay,
      perMonth,
      dailyQuota: q.daily,
      monthlyQuota: q.monthly,
      dailyPct: q.daily ? Math.round((perDay / q.daily) * 10000) / 100 : null,
      monthlyPct: Math.round((perMonth / q.monthly) * 10000) / 100,
      dailyHeadroom: q.daily ? q.daily - perDay : null,
      monthlyHeadroom: q.monthly - perMonth,
    };
  }
  return out;
}

/** 콘솔 출력용 요약 */
export function formatUsage(report) {
  const lines = [
    `[api-quota] 이번 실행 ${report.thisRun}회 (하루 ${report.runsPerDay}회 실행 기준)`,
  ];
  for (const [group, g] of Object.entries(report.groups)) {
    const q = QUOTA[group];
    const day = g.dailyQuota
      ? `일 ${g.perDay.toLocaleString()}/${g.dailyQuota.toLocaleString()} (${g.dailyPct}%)`
      : `일 ${g.perDay.toLocaleString()}/제한없음`;
    lines.push(
      `  ${q.label}\n` +
        `    ${day} · 월 ${g.perMonth.toLocaleString()}/${g.monthlyQuota.toLocaleString()} (${g.monthlyPct}%)` +
        `\n    남는 여유: 월 ${g.monthlyHeadroom.toLocaleString()}회`,
    );
  }
  return lines.join('\n');
}
