#!/usr/bin/env node
/**
 * searchad-volume — 네이버 검색광고 API로 검색어별 한 달 실제 검색 수와 광고 벽을 잰다.
 *
 * 데이터랩(keyword-volume.mjs)은 실업급여=100 기준 상대값이라 "한 달에 몇 번"을 모르고,
 * 웹문서 검색 API는 통합검색 화면에서 웹문서가 얼마나 밀리는지 모른다. 이 두 빈칸을 메운다.
 *   - 월간 검색 수: PC·모바일 실제 횟수(10 미만은 "< 10")
 *   - 평균 노출 광고 수: 그 검색어에 파워링크 광고가 평균 몇 개 붙는지 — 많을수록 웹문서가 아래로 밀린다
 *   - 광고 경쟁 정도: 높음·중간·낮음
 *
 * 사용:
 *   node scripts/searchad-volume.mjs "소상공인 지원금" "유보통합포털"
 *   node scripts/searchad-volume.mjs --json "..."
 *
 * 키: .env.local의 NAVER_SEARCHAD_CUSTOMER_ID · NAVER_SEARCHAD_ACCESS_LICENSE · NAVER_SEARCHAD_SECRET_KEY.
 * 비어 있으면 무엇을 채워야 하는지 알려 주고 종료 코드 2로 끝난다. 키 값은 출력하지 않는다.
 */
import { keywordStats, loadSearchAdKeys } from './lib/naver-searchad.mjs';

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const queries = argv.filter((a) => !a.startsWith('--'));

if (!queries.length || argv.includes('--help')) {
  console.log('사용: node scripts/searchad-volume.mjs [--json] "검색어1" "검색어2" ...');
  process.exit(queries.length ? 0 : 2);
}

const keys = await loadSearchAdKeys();
if (keys.missing.length) {
  console.error(
    [
      '[searchad] 검색광고 API 키가 아직 비어 있어요.',
      `  채울 칸: ${keys.missing.join(', ')}`,
      '  .env.local 끝의 "네이버 검색광고 API" 칸에서 = 뒤에 값을 붙여 넣으세요(따옴표·공백 없이).',
      '  발급: searchad.naver.com 로그인 → 도구 → API 사용 관리',
    ].join('\n'),
  );
  process.exit(2);
}

let stats;
try {
  stats = await keywordStats(queries, keys);
} catch (err) {
  console.error(`[searchad] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

if (JSON_OUT) {
  console.log(
    JSON.stringify({ measuredAt: new Date().toISOString(), rows: [...stats.values()] }, null, 2),
  );
  process.exit(0);
}

const fmt = (n) => n.toLocaleString('ko-KR');
console.log('[searchad] 네이버 검색광고 키워드 도구 — 최근 한 달 기준\n');
console.log('  월간 합계   PC        모바일     광고 평균 노출  광고 경쟁  검색어');
for (const q of queries) {
  const s = stats.get(q.trim());
  if (!s) {
    console.log(
      `  ${'-'.padStart(9)}  ${'-'.padEnd(8)}  ${'-'.padEnd(9)}  ${'-'.padEnd(13)}  ${'-'.padEnd(8)}  ${q}  ← 결과 없음(검색 수가 너무 적거나 광고 금지 검색어)`,
    );
    continue;
  }
  const depth = s.adDepth == null ? '-' : s.adDepth.toFixed(1);
  console.log(
    `  ${fmt(s.total).padStart(9)}  ${s.pcRaw.padEnd(8)}  ${s.mobileRaw.padEnd(9)}  ${depth.padEnd(13)}  ${String(s.competition ?? '-').padEnd(8)}  ${q}`,
  );
}
console.log(
  '\n  읽는 법: 광고 평균 노출이 많고 경쟁이 "높음"이면 통합검색 맨 위가 광고로 채워져 웹문서가 밀릴 가능성이 커요.',
);
