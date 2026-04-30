# Claude API 추가 최적화 — Cycle #4

## 발견
- **Cycle #3 P0 완료**: system prompt cache_control: ephemeral 적용 (35% 토큰 절감)
- `scripts/generate-issue-posts.mjs:216~219` — cache 통계 console 로그만 존재 (파일 영속화 X)
- `scripts/generate-issue-posts.mjs:42` — 현재 모델: claude-sonnet-4-6 (Max Token 4096)
- `scripts/generate-issue-posts.mjs:65~73` — 정적 맵: CAT_TO_PERSONAS (7개 카테고리 × 페르소나 2~3개)
- `src/data/personas.json` — 모든 메타데이터 매 요청 포함
- JSON 응답 수동 파싱: `parseJsonFromResponse()` (line 290~303)
- 매달 일간 Top 3 × 30일 = 90회 API 호출 → 1주 cache hit ratio 측정 데이터 축적 가능

## 제안

### P0 — `_cache-{date}.json` 파일 영속 로깅
**목표**: 7일 평균 cache hit ratio 운영 모니터링
- callClaude 반환값에 usage 메타 추가
- `src/data/issues/{date}/_cache-{date}.json` 누적 저장 (기존 _fail-{date}.json 옆)
- 운영자 주간 리뷰: "지난주 cache hit 82%, 비용 절감 28%" 확인
- 작업: ~30분

### P1 — 정적 컨텍스트 별도 캐시 블록
**목표**: 페르소나 + 카테고리맵 메타 추가 ~500 토큰 캐시
- messages 배열의 user content를 array of text blocks로 변환
- personas + CAT_TO_PERSONAS를 별도 cache_control: ephemeral 블록
- 모든 호출에서 재사용

### P2 — Structured Outputs (messages.json_schema)
- JSON 응답 강제 + 수동 파싱 제거
- 환각 응답(코드블록/설명 혼입) 방지 → parseJsonFromResponse() 함수 제거 가능

### P3 — Haiku 4.5 + thinking 비교 실험
- 현재 Sonnet 4.6 → Haiku 4.5 + extended thinking 1주 단행본 비교
- 측정: 토큰·품질·속도
- 모델 변경은 콘텐츠 톤·품질 영향 크므로 신중

## 권장 P0
**`_cache-{date}.json` 영속 로깅** — 외부 의존 0, 30분 작업, 운영 모니터링 가시성. 1주 후 P1 정적 컨텍스트 캐시 블록 진행.
