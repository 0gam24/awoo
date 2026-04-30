# Claude API prompt caching — Cycle #2

## 발견 (Findings)
- `scripts/generate-issue-posts.mjs`는 fetch로 `messages.create` 직접 호출 (SDK 없음 / 추가 npm 의존성 X)
- `agents/seo-geo-news-poster.md` system prompt **521줄 ≈ 1,400 토큰**, 매 호출 정적 동일
- 일간 처리: Top 3 토픽 → **동일 system prompt 3회 반복** = 캐시 히트 기회 큼
- 정적 컨텍스트 (페르소나·카테고리 맵)도 매 호출 동일 (현재 user prompt 인라인)

## 제안 (Proposals)

### P0 — system prompt에 cache_control 마킹
**파일**: `scripts/generate-issue-posts.mjs:183~207` 부근 (callClaude 함수)

**변경**:
```js
// before
system: systemPrompt

// after
system: [
  {
    type: 'text',
    text: systemPrompt,
    cache_control: { type: 'ephemeral' }
  }
]
```

**효과**:
- 1회차 호출: `cache_creation_input_tokens ≈ 1400`
- 2~3회차: `cache_read_input_tokens ≈ 1400` (90% 절감)
- 일간 절감: 약 35% 토큰 (월 ~12,600 토큰)

**비용**: S (30분) / 외부 의존: 없음 (이미 사용 중인 키) / 회귀 위험: 낮음

### P1 — 정적 페르소나·카테고리 맵을 별도 cache block
- user prompt에서 personas.json + CATEGORIES를 별도 텍스트 블록 + cache_control로 분리
- 추가 ~500 토큰 캐시

### P2 — 응답 usage 로깅
- 응답 `json.usage.cache_creation_input_tokens / cache_read_input_tokens` 로그
- `_fail-{date}.json` 옆에 `_cache-{date}.json` (선택)

## 권장 P0
**system prompt cache_control: ephemeral 적용** — 30분 작업, 외부 의존 0, 회귀 위험 최저, 일 35% 토큰 절감 확보.
