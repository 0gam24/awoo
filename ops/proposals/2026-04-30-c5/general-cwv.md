# CWV — Cycle #5

## 발견
- /subsidies/ index `<li>` data-attr 3개(`data-cat`, `data-amount`, `data-deadline-rank`, `data-popularity-rank`) 카드별 반복 — 350+ 카드 × 4 attr ≈ 21KB 절감 여지. 단 정렬 스크립트가 직접 attr 참조하므로 통합 시 정렬 로직 동시 수정 필요.
- `lighthouserc.json` INP/TTI/SI 모두 `warn` — Cycle #4까지 perf 100 안정, error 승격 가능 (회귀 즉시 빌드 실패).
- `astro.config.mjs` `inlineStylesheets: 'always'` — 페이지당 CSS 인라인, 홈 22.6KB 한도 50KB로 여유. `'auto'`(4KB↓ 인라인) 전환은 cross-page 캐시 hit 증가하나 첫방문 LCP 회귀 리스크 — 5번째 보류 유지 권장.
- PSI Field Data(CrUX) 모니터링은 외부 CrUX API key 필요 — 제약 위반(외부 API 금지) → 제외.

## 제안
1. **P0-A**: /subsidies/ 카드 data-attr JSON 단일 통합 (`data-sort='{"a":N,"d":N,"p":N}'` + 정렬 스크립트 1회 파싱) — 추정 −18KB(통합 오버헤드 차감). 빌드 size guard 임계 무변경.
2. **P0-B**: `lighthouserc.json` INP `warn → error`(150ms), TBT 200ms 유지 — 회귀 게이트 강화. SI/TTI는 warn 유지(throttling 분산 큼).
3. 보류: inlineStylesheets `auto` (5번째 사이클, 데이터 부족), CrUX 모니터링 (외부 API 제약).

## 권장 P0
**P0-A**(−18KB 실효, /subsidies/ 28.3KB → ~10KB) + **P0-B**(INP error 승격) 동시 채택. 둘 다 측정 가능·롤백 단순·외부 의존 0.
