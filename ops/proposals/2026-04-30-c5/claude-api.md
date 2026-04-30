# Claude API — Cycle #5

## 발견

**Anthropic API 상태 (2026-04):**
- Prompt Caching: GA — explicit cache_control 블록 지원
- Structured Outputs: GA — `output_config.format: { type: "json_schema" }` 지원
- Cache 비용 구조: 캐시 쓰기 1.25x, 캐시 읽기 0.1x (90% 절감)

**현 상태:**
- `scripts/generate-issue-posts.mjs:203` messages 배열은 단일 string content (구조화 X)
- `src/data/personas.json` + `CAT_TO_PERSONAS` (L65-73) 정적 맵 = ~4KB, 매 요청 포함
- System prompt 1,400 토큰 ephemeral 캐시 적용 (Cycle #3 완료)
- JSON 응답: 수동 파싱 `parseJsonFromResponse()` (L290-303)
- 일 Top 3 × 월 30회 = 90회 호출 → cache hit ratio 1주 축적 가능 (Cycle #4 _cache-{date}.json 적재)

## 제안

### P0 — 정적 컨텍스트 추가 캐시 블록
**핵심**: messages user content를 array로 변환, personas + CAT_TO_PERSONAS 별도 cache_control

```js
// Before:
messages: [{ role: 'user', content: userPrompt }]

// After:
messages: [{
  role: 'user',
  content: [
    { type: 'text', text: STATIC_CONTEXT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: userPrompt },
  ]
}]
```
**효과**: +500 토큰 추가 캐시 (cache hit 시 0.1x 비용)
**소요**: ~30분

### P1 — Structured Outputs (json_schema)
**목표**: JSON 응답 강제 → parseJsonFromResponse() 제거
- 환각 응답(코드블록 혼입) 방지, 파싱 에러 0
- 1주 _cache-{date}.json 데이터 후 도입 권장
- 콘텐츠 톤 영향 가능성 점진적 검증

### P2 — 재시도 로직 (429/503 exponential backoff 3회)
- 일시 실패 대응
- ~30분

## 권장 P0
**정적 컨텍스트 추가 캐시 블록** — Cycle #5 EXECUTE에서 즉시. 외부 의존 0, ~500 토큰 추가 캐시, 월 ~3.6만 토큰 절감 추정. 1주 후 _cache-{date}.json 데이터 기반 P1 Structured Outputs 검토.
