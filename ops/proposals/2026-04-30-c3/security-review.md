# 자동화 보안 — Cycle #3

## 발견
- `scripts/check-apply-urls.mjs:101` — `applyUrl`을 `/^https?:\/\//`로만 검증. 호스트 TLD 화이트리스트 부재 → 사칭 도메인(.com/.net) 통과 위험.
- `scripts/generate-issue-posts.mjs:365-370` — `articlesForTopic`이 Top 1 토픽일 때 `topTrendingArticles` 전체(10+건)를 무제한 주입. JSON.stringify 결과가 30KB 초과 시 토큰·비용 폭주, 프롬프트 인젝션 표면 확대.
- `src/data/issues/_history.json` — `byTerm`만 존재. fact-check 실패 누적 카운터 없음 → 회귀 감지 불가.
- `scripts/cycle-runner.mjs:122` — OBSERVE phase에 GH Step Summary 알림 훅 미존재.

## 제안 (구체 코드 위치)
1. **호스트 화이트리스트** — `check-apply-urls.mjs:101` 직후 `new URL(data.applyUrl)` 파싱 + `host.endsWith('.go.kr') || .endsWith('.gov.kr') || .endsWith('.or.kr')` 검사. 미통과 시 `records.push` 스킵 + `console.warn`.
2. **입력 캡** — `generate-issue-posts.mjs:366` 라인의 `articlesForTopic = todayIssue.topTrendingArticles`를 `.slice(0, 10)`로 제한, 직후 `while (JSON.stringify(articlesForTopic).length > 30000) articlesForTopic.pop();` 추가. 라인 369의 `slice(0, 8)`도 동일 가드 적용.
3. **fact-check 누적** — `_history.json`에 `factCheckFails: { [date]: n }` 필드 신설. fact-check 실패 시 +1. `cycle-runner.mjs` OBSERVE phase(L122 근처)에 7일 합계 ≥3이면 `process.env.GITHUB_STEP_SUMMARY`에 `## ⚠ fact-check 7d=N` 추가.
4. CSP nonce 마이그레이션 — 대규모, 보류.
5. .env.local lint — 이미 `.gitignore` 처리, P2.

## 권장 P0
1·2·3 본격. 4·5 보류.
