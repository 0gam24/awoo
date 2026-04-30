# Claude API — Cycle #6

## 발견
- Cycle #5 P0-7+8 완료: 재시도 backoff 3회 + 정적 컨텍스트 추가 cache block (multi-block ephemeral)
- _cache-{date}.json 영속 로깅 첫 데이터 1~2일 내 축적 예상 (방금 push된 직후)
- `parseJsonFromResponse()` 수동 파싱 — 코드블록 제거 + 정규식
- output_config.format json_schema GA 상태 (2026-04 Anthropic API)

## 제안

### P0 — 재시도 metric 영속 로깅
- `fetchWithRetry` 내부에 `retry_count` 누적 → callClaude 반환 usage에 포함
- _cache-{date}.json 의 calls_detail에 `retry_count`·`first_attempt_success` 필드 추가
- 운영 SLO: "1주 first-attempt success rate ≥ 95%"

### P0 — API 응답 시간 측정
- `Date.now()` before/after fetch
- duration_ms per call 기록
- p50/p95 분포 추적 (모델 성능 비교 근거)

### P1 — Structured Outputs (json_schema) 보류
- 1주 _cache-{date}.json 데이터 후 Cycle #7+에서 검토
- 콘텐츠 톤 영향 → 점진적 rollout 필요

### P2 — Haiku 4.5 + thinking 비교 실험 보류
- 콘텐츠 톤 변화 큼 — 사용자 승인 후

## 권장 P0
**재시도 metric + duration_ms 영속 로깅** — _cache-{date}.json calls_detail 확장. Cycle #5 인프라 위에 한 줄 추가, 외부 의존 0, 운영 SLO 가시성 확보.
