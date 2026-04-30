# Claude API caching 본격 도입 — Cycle #3

## 발견 (구체 코드 라인)
- `scripts/generate-issue-posts.mjs:194` — system 필드 현재 **string 형식** (`system: systemPrompt`)
- `agents/seo-geo-news-poster.md` — **521줄 ≈ 1,400 토큰** (일일 3회 동일 반복)
- `scripts/generate-issue-posts.mjs:183~207` — callClaude() fetch 직접 호출 (SDK 없음)
- 일간 패턴: Top 3 토픽 = 동일 system prompt **3회** → 캐시 히트 기회 100%
- 응답 json.usage: cache_creation_input_tokens / cache_read_input_tokens 필드 기존 로깅 X

## 제안

### P0 — system 필드를 array + cache_control로 변경
**파일**: `scripts/generate-issue-posts.mjs:194`

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
- 1회차: `cache_creation_input_tokens ≈ 1,400` (full cost)
- 2~3회차: `cache_read_input_tokens ≈ 1,400` (90% 절감)
- 일간 절감: **약 35% 토큰** (2,800 → 1,820 토큰)
- 월간: ~26,400 → 17,160 토큰 (**35% 비용 절감**)

### P1 — 응답 usage 로깅
`callClaude()` 반환값에 cache 통계 추가:
```js
return {
  content: json.content?.[0]?.text,
  usage: {
    cache_creation_input_tokens: json.usage?.cache_creation_input_tokens || 0,
    cache_read_input_tokens: json.usage?.cache_read_input_tokens || 0,
  }
}
```

이후 `_cache-{date}.json` 누적 로깅 (운영 모니터링용)

### P2 — Sonnet 4.6 vs Haiku 4.5 + thinking 비교
현재 모델: `claude-sonnet-4-6` — 외부 API 신규 등록 X 영역에서 비용/품질 trade-off 검토.

## 권장 P0
**system prompt cache_control: ephemeral 적용** — 20분 작업, 외부 의존 0, 회귀 위험 최저, 일 35% 토큰 절감 확보. Cycle #1·#2 보류 사항 → 이번에 본격 도입.
