#!/usr/bin/env node
/**
 * 실제 방문 흐름 조회 — 서치어드바이저 리포트는 며칠 늦어서, 지금 무슨 일이 일어나는지 볼 수 있는 자료를 모은다.
 *   1) Analytics Engine(awoo_vitals): 브라우저가 보내는 Web Vitals 비콘 수 = 날짜별·경로별 실제 페이지 조회의 근사치
 *   2) Cloudflare 존 분석: 유입 사이트(referer)·검색로봇 요청·응답 코드(권한이 있을 때만)
 * 환경변수: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. 출력은 집계 숫자뿐이고 키는 출력하지 않는다.
 * 공개 저장소라 실행 기록(run)은 읽은 뒤 지운다: gh run delete <id>
 */
const T = process.env.CLOUDFLARE_API_TOKEN;
const A = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!T || !A) throw new Error('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 필요');
const H = { Authorization: `Bearer ${T}` };

async function sql(q) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${A}/analytics_engine/sql`, {
    method: 'POST',
    headers: H,
    body: q,
  });
  const t = await r.text();
  if (!r.ok) return { error: `${r.status} ${t.slice(0, 300)}` };
  return JSON.parse(t);
}

console.log('=== 1) 날짜별 페이지 조회 근사치(TTFB 비콘 수, 표본 보정)');
const days = await sql(
  `SELECT toDate(timestamp) AS d, SUM(_sample_interval) AS views FROM awoo_vitals WHERE blob1 = 'TTFB' AND timestamp > NOW() - INTERVAL '60' DAY GROUP BY d ORDER BY d FORMAT JSON`,
);
if (days.error) console.log(days.error);
else for (const r of days.data) console.log(r.d, r.views);

for (const [label, from, to] of [
  ['10/05~10/11', '2026-10-05', '2026-10-12'],
  ['10/12~10/18', '2026-10-12', '2026-10-19'],
  ['10/19~10/25', '2026-10-19', '2026-10-26'],
  ['10/26~11/01', '2026-10-26', '2026-11-02'],
]) {
  console.log(`=== 2) 경로 상위 25 ${label}`);
  const top = await sql(
    `SELECT blob2 AS path, SUM(_sample_interval) AS views FROM awoo_vitals WHERE blob1 = 'TTFB' AND timestamp >= toDateTime('${from} 00:00:00') AND timestamp < toDateTime('${to} 00:00:00') GROUP BY path ORDER BY views DESC LIMIT 25 FORMAT JSON`,
  );
  if (top.error) console.log(top.error);
  else for (const r of top.data) console.log(r.views, r.path);
}

console.log('=== 3) 기기별(TTFB 비콘)');
const dev = await sql(
  `SELECT toDate(timestamp) AS d, blob3 AS device, SUM(_sample_interval) AS views FROM awoo_vitals WHERE blob1 = 'TTFB' AND timestamp > NOW() - INTERVAL '10' DAY GROUP BY d, device ORDER BY d, device FORMAT JSON`,
);
if (dev.error) console.log(dev.error);
else for (const r of dev.data) console.log(r.d, r.device, r.views);

console.log('=== 4) 존 분석(권한이 있을 때만)');
const zr = await fetch('https://api.cloudflare.com/client/v4/zones?name=awoo.or.kr', {
  headers: H,
});
const zj = await zr.json().catch(() => ({}));
const zone = zj.result?.[0]?.id;
console.log('zone 조회', zr.status, zone ? '성공' : JSON.stringify(zj.errors ?? zj).slice(0, 200));
if (zone) {
  const end = new Date();
  const start = new Date(end.getTime() - 23 * 3600 * 1000);
  const gql = async (dim, filter = '') => {
    const query = `query { viewer { zones(filter:{zoneTag:"${zone}"}) { httpRequestsAdaptiveGroups(limit:40, orderBy:[count_DESC], filter:{datetime_geq:"${start.toISOString()}", datetime_lt:"${end.toISOString()}"${filter}}) { count dimensions { ${dim} } } } } }`;
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const j = await r.json();
    if (j.errors?.length) return console.log(dim, 'ERR', JSON.stringify(j.errors).slice(0, 300));
    for (const g of j.data.viewer.zones[0].httpRequestsAdaptiveGroups)
      console.log(g.count, JSON.stringify(g.dimensions));
  };
  console.log('--- 유입 사이트(HTML 요청, 최근 23시간)');
  await gql('clientRefererHost', ', edgeResponseContentTypeName:"html"');
  console.log('--- 응답 코드(최근 23시간)');
  await gql('edgeResponseStatus');
  console.log('--- 네이버 로봇 응답 코드(Yeti, 최근 23시간)');
  await gql('edgeResponseStatus clientRequestPath', ', userAgent_like:"%Yeti%"');
  console.log('--- 보안 조치(최근 23시간)');
  await gql('securityAction securitySource', ', securityAction_neq:"unknown"');
}
