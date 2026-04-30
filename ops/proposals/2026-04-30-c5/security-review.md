# 자동화 보안 — Cycle #5

## 발견
- `scripts/generate-issue-posts.mjs:184` Claude API 호출에 재시도 로직 없음 — 429/503/네트워크 일시 오류 시 즉시 throw, 일간 Top 3 중 1건만 실패해도 _fail-{date}.json 누적.
- `/api/contact`·`/api/feedback`은 `checkRateLimit` + KV/메모리 듀얼 백엔드 적용 완료. `/api/vitals`는 Origin 검증만, rate limit 없음 (sendBeacon 특성상 익명 다발 정상). `/api/health`는 인증 X·rate limit X (외부 모니터 polling 의도, 카운트만 노출).
- `.gitignore`는 `.env*`, `.dev.vars`, `dist/`, `.wrangler/` 보호. 그러나 `ops/_fail-*.json`·`ops/_cache-*.json` 명시 X — 운영 로그가 git에 들어갈 위험 (현재 미커밋이지만 가드 부재).
- `ops/observations/` 내 `_fail-{date}.json` 단일 일자 단위만 존재 — 추세(7일 누적) 미집계.

## 제안
1. **P0 Claude API 재시도** — `callClaude`에 3회 exponential backoff (1s·2s·4s), 429/503/network only. 4xx 본문 오류는 즉시 fail. 재시도 시도/성공을 stderr 로그로 남겨 OBSERVE에서 카운트.
2. **P0 _fail 7일 누적** — `cycle-runner` OBSERVE phase에 `factCheckFails`와 동일 패턴으로 `failsByDay` 집계, 임계 (7일 4건+) 초과 시 알림.
3. **P1 .gitignore 보강** — `ops/_fail-*.json`, `ops/_cache-*.json`, `ops/observations/_*.json` 라인 추가 (선제 가드).
4. **P2 /api/vitals rate limit** — IP 해시당 분당 60건 (정상 페이지뷰 여유) — 악성 beacon 폭주 차단. KV 의존 X, in-memory만으로 충분.
5. **P3 CSP nonce** — Cycle #6 별도 (대규모, 인라인 스크립트 전수조사 필요).

## 권장 P0
- Claude API 재시도 3회 backoff (생성 안정성 +)
- _fail 7일 누적 알림 (factCheckFails와 동형)
- .gitignore에 `ops/_fail-*.json`·`ops/_cache-*.json` 추가 (선제 가드, 변경 1줄)
