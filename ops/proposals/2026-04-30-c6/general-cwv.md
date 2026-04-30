# CWV — Cycle #6

## 발견
- `/subsidies/index.astro`: 카드 1개당 4개 data-attr (`data-cat`·`data-amount`·`data-deadline-rank`·`data-popularity-rank`) — 카드 약 60개 기준 240 attr·중복 키 문자열 누적 약 18KB raw HTML 부담. /subsidies 28.7KB 중 상당 비중이 attr 직렬화에 소비됨.
- 정렬 스크립트 (l.183~194)는 attr 3개를 분기 분기 `Number()` 캐스팅 — JSON 1회 parse 후 캐싱하면 정렬 비교 함수 단순화 + INP 개선 여지.
- `lighthouserc.json` (l.23~24): `interaction-to-next-paint`·`max-potential-fid` 모두 warn — Cycle #5 보류 안건. 현 빌드 통과 → error 승격해도 회귀 fail-fast 가능.
- Cycle #3·#4·#5 계속 보류된 IncomeChecker React → vanilla (홈 -186KB raw)는 단독 P1 사이클 권장.

## 제안
1. **/subsidies 카드 data-attr JSON 통합** — `data-sort='{"a":N,"d":N,"p":N,"c":"주거"}'` 1개로 압축. 정렬 스크립트는 `JSON.parse(li.dataset.sort)` 후 메모리 캐시 (`WeakMap<HTMLElement, SortKeys>`)로 재정렬 시 parse 1회만. 예상 -15~18KB raw (gzip 후 약 -3KB).
2. **lighthouserc.json INP/FID error 승격** — `interaction-to-next-paint` 150ms·`max-potential-fid` 150ms warn → error. 정렬 토글·필터 chip 클릭 회귀 즉시 빌드 fail.
3. **prefetch hover 실측** — `<head>` `<link rel="prefetch">` 트리거 페이지 목록 빌드 후 의도 외 페이지(예: /quick 항상 prefetch) 검증, 필요 시 viewport 전략 조정 검토.

## 권장 P0
- **P0-1** /subsidies data-attr JSON 통합 (≈-3KB gzip, INP 개선)
- **P0-2** lighthouserc.json INP/FID error 승격 (회귀 게이트)
- P1 후속: IncomeChecker vanilla 전환 (단독 사이클).
