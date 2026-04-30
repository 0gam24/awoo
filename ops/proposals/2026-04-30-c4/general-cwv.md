# CWV — Cycle #4

## 발견
- `/subsidies/` 28.6KB는 268개 카드 SSR + sort/filter UI inline 스크립트가 주범 — `compactSubsidies` JSON 임베드 없이 DOM data-attr 기반 정렬이라 JSON payload는 0이지만 카드 HTML 자체가 길어 마진 70%대(한도 100KB) 유지.
- `/quick/` 28.1KB는 vanilla stepper + `compactSubsidies`/`compactPersonas` JSON 임베드 형태 — 268건 × 필수 필드 9개로 JSON 비중이 페이지 50% 이상 추정. 클라이언트 매칭 위해 불가피하나 `summary` 필드 trim 여지.
- `astro.config.mjs:48` `inlineStylesheets: 'always'` — Tailwind 4 native purge 후에도 BaseLayout CSS가 모든 페이지 HTML에 inline. CSS 캐시 재사용 0, 첫 페이지 FCP는 우위지만 2번째 이후 페이지뷰 손실. Cycle #1·#2·#3 3회 보류.
- 폰트 preload 부재 (의도적 회피) — 시스템 폰트 스택만 사용 중이라면 추가 액션 불필요. `BaseLayout`에서 webfont `<link rel="preload">` 미사용 확인 시 현 정책 유지.
- HTTP/2·HTTP/3는 Cloudflare 자동 — 별도 server push 설정 불필요 (RFC 9113 deprecated).

## 제안
1. **/quick compactSubsidies trim (P0)** — `summary` 필드를 `compact`에서 제거하고 매칭 결과 카드 렌더 시 `targetPersonas`·`tags`만 사용. 268건 × 평균 60자 → 약 16KB 감소 추정, /quick 28.1KB → 약 12KB 영역 진입.
2. **inlineStylesheets 'always' → 'auto' (P2 보류 유지)** — 4번째 보류. PSI 4×100 회귀 위험 vs 캐시 이득 불확실. Cycle #5 이후 Lighthouse CI 실측 데이터 누적 후 재평가.
3. **/subsidies/ 카드 마크업 압축 (P1)** — `data-deadline-rank`·`data-popularity-rank` 등 정렬 키 attr 5개 → 단일 `data-sort` JSON 직렬화로 통합. 카드당 약 80B × 268 = 약 21KB 절감 가능.
4. **Lighthouse CI 실측 vs Lab 모니터링 (P1)** — `ops/audit/` 스크립트에 PSI Field Data(CrUX) fetch 추가, Lab 100/100/100/100과 실측 LCP·CLS·INP 차이를 weekly 로그.

## 권장 P0
- (1) /quick compactSubsidies `summary` 필드 제거 — 약 16KB 페이로드 감축, JS 매칭 로직 무영향(요약은 매칭 키 아님), 결과 카드는 collection refetch로 표시 가능.

P1: (3) /subsidies/ data-attr 통합, (4) CrUX field data 모니터링 도입.
보류: (2) inlineStylesheets — 4 cycle 연속 위험 우위, Cycle #5 데이터 축적 후 재논의.
