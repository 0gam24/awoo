# 자동화 보안 — Cycle #2

## 발견
- `scripts/check-apply-urls.mjs:101` — `applyUrl` 검증이 `/^https?:\/\//` 정규식뿐. http 허용 + 임의 호스트 fetch 가능 → SSRF·내부망 프로빙·잘못 등록된 외부 단축 URL 추적 위험.
- `scripts/generate-issue-posts.mjs:365-370` — `topTrendingArticles` 전체를 그대로 user prompt에 직렬화 (`JSON.stringify(userInput, null, 2)`). 길이 캡 없음 → 토큰 폭증·비용 스파이크·max_tokens 컷오프로 JSON 파싱 실패.
- `scripts/generate-issue-posts.mjs:471-507` — fact-check 실패는 `_fail-{date}.json` + GH Step Summary로 단발 기록. 일자 누적 트렌드 없음 → 모델 회귀·소스 품질 저하 늦게 인지.
- `src/pages/api/contact.ts`·`feedback.ts` — `checkRateLimit`이 KV 없으면 per-isolate 메모리. Workers 다중 isolate 환경에서 글로벌 보장 X (KV는 외부 의존이라 본 사이클 보류).

## 제안
1. **(P0) check-apply-urls 호스트 화이트리스트** — `new URL(url)` 파싱 → `protocol === 'https:'` 강제 + host가 `\.(go|gov|or)\.kr$` 또는 `\.kr$` 정부·공공 도메인만 통과. 위반 시 `records.push` 단계에서 제외하고 `_link-health.json`에 `skipped` 카운터 누적. 30분 작업, score 5.
2. **(P0) generate-issue-posts 입력 캡** — `articlesForTopic`을 N≤10 + `JSON.stringify` 후 30KB 초과 시 뒤에서부터 잘라냄. 잘림 발생 시 `failures` 미적재 + `console.warn` + GH annotation. 비용·파싱 실패 동시 차단.
3. **(P1) fact-check 실패 누적 카운터** — `_history.json`에 `factCheckFails: { 'YYYY-MM-DD': n }` 필드 추가. cycle-runner OBSERVE phase에서 직전 7일 합계 ≥ 3이면 알림 라인 출력 (외부 의존 X, GH Step Summary만).
4. (보류) Rate limit 글로벌화 — KV namespace 신규 생성은 외부 계정 작업이라 본 사이클 제외.
5. (보류) `.env.local` 검증 lint — 이미 `.gitignore` 처리 + `loadEnv`가 silent fail. 현재 위험 낮음.

## 권장 P0
**1번 (호스트 화이트리스트)** — SSRF 가드 즉효, 30분, 외부 의존 0. **2번 (입력 캡)** 동반 진행 시 비용·실패율 동시 개선. 3번은 P1 EXECUTE 후 OBSERVE 통합.
