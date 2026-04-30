# 자동화 보안 — Cycle #6

## 발견
- `src/pages/api/vitals.ts`: Origin 화이트리스트(`awoo.or.kr`, `www.awoo.or.kr`)만 검증, IP 기반 제한 없음. sendBeacon은 same-origin이라 외부 스팸은 어렵지만 동일 출처 봇/탭 폭주 시 ANALYTICS writeDataPoint 비용 무방비.
- `src/lib/api/rate-limit.ts`: 이미 듀얼 백엔드(KV/in-memory) 완비 — `checkRateLimit(key, max, windowSec)` + `rateLimitHeaders()` 즉시 재사용 가능. 외부 의존 0.
- `scripts/cycle-runner.mjs:122-145`: `factCheckFails` 7일 합계 ≥3 임계 알림 패턴 OPERATE→OBSERVE 전이에 이미 동작 중. `_fail-{date}.json`도 동형 합산 가능 (issues posts fail 카운터).
- entity-graph dangling 8건: 콘텐츠 무결성 영역, 보안 침해면 X — content-seo 축으로 위임.

## 제안
1. **vitals IP 해시 rate limit** (P0): SHA-256(IP+salt) 키로 `checkRateLimit(\`vitals:${ipHash}\`, 60, 60)` — 분당 60건. 초과 시 429 + `Retry-After`. 메모리 백엔드라 외부 의존 0, beacon은 응답 무시하므로 UX 영향 0.
2. **_fail-{date}.json 7일 누적 OBSERVE 알림** (P1): cycle-runner OPERATE→OBSERVE 블록에 factCheckFails와 동형 추가. 임계 ≥5 (생성 실패는 fact-check보다 잦음) `::warning` 발신.
3. entity-graph dangling 정정은 보안 축 제외 — content-seo 제안서 참조.

## 권장 P0
**vitals rate limit** 단건 — 기존 rate-limit 모듈 재사용으로 LOC ~15, 회귀 위험 최저, ANALYTICS 비용 즉각 차단.
