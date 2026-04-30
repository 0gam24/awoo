# 자동화 보안 — Cycle #4

## 발견
- `_history.json`(`src/data/issues/_history.json`)은 현재 `byTerm`만 보유 — 누적 실패 시그널 부재.
- `generate-issue-posts.mjs:441-462` fact-check 실패 시 `failures.push`로 메모리 누적 → `_fail-{date}.json`(L491) 일별 출력. 그러나 history에는 반영 X → 7일 추세 모니터링 불가.
- `cycle-runner.mjs` OBSERVE phase 별도 알림 라인 없음(L123 cycle_no 증가만 처리). GH Step Summary/`::warning` hook 미연결.
- `loadHistory/saveHistory/updateHistory`(L142–186) 패턴 이미 검증됨 — 재사용 가능.

## 제안 (구체 코드 위치)
1. **`_history.json` 스키마 확장** — 최상위 `factCheckFails: { 'YYYY-MM-DD': n }` 추가. `loadHistory` 결과 `?? {}` fallback로 하위호환.
2. **`generate-issue-posts.mjs:460` 직전** — fact-check fail 분기 안에 `history.factCheckFails ??= {}; history.factCheckFails[date] = (history.factCheckFails[date] ?? 0) + 1;` 한 줄 추가. 기존 `saveHistory(history)` (L486) 한 번에 atomic write.
3. **`cycle-runner.mjs` OBSERVE 알림** — `advance` 분기에서 `completed === 'OPERATE' && next === 'OBSERVE'`일 때 `_history.json` 읽어 최근 7일 합계 계산, ≥3이면 `console.warn` + CI 환경(`process.env.GITHUB_STEP_SUMMARY`) 시 `::warning title=Fact-check 7d≥3::sum=N` 출력. 새 헬퍼 `sumRecentFactCheckFails(history, days=7)`.
4. **CSP nonce 마이그레이션** — 범위 큼, Cycle #5 이후 보류 유지.

## 권장 P0
- **P0-1**: 제안 1+2 (스키마 + 카운터 +1) — 5분, 회귀 위험 0(필드 추가만).
- **P0-2**: 제안 3 (OBSERVE 7일 합계 알림) — 헬퍼 1개 + advance 분기 1블럭, ~15분.
