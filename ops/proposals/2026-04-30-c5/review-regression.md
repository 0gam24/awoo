# 회귀 점검 — Cycle #5

## 회귀 위험 지점
- **P0-8 callClaude 반환 구조 변경**: `string → {content, usage}`. 호출부 1곳(generate-issue-posts)만 typeof 가드로 처리. 다른 스크립트가 callClaude 직접 호출 시 raw string 기대로 깨질 위험. 현재 호출부 1곳뿐이라 안전하지만 명세 미문서화.
- **P0-3 BlufBox stat 필터**: `s.value && s.label && trim()` 필터 OK. 단 `value=0`(숫자) 케이스 falsy로 누락 가능 — 현재 호출부 모두 string("23건") 사용이라 영향 없음.
- **P0-5 RSS dc/atom xmlns**: `feed.xml.ts`/`feed-issues.xml.ts` 둘 다 `xmlns:dc`/`xmlns:atom` 선언 + 사용. RSS reader 호환 OK 가능성 높으나 `atom:updated` ISO 8601 Z-suffix 검증 필요.
- **P0-7 _history.json 스키마 변경**: `factCheckFails` 필드 추가. atomic write 미사용 시 동시 실행에서 손상 가능 — 현재 cycle-runner 직렬 실행이라 잠복 위험.
- **P0-6 focusTrap dynamic import**: Safari 14 미만 dynamic import 미지원. 현재 BaseLayout 모달 미사용이라 실호출 0건, 잠복.
- **P0-2 카테고리 자동 H2**: `matchedPersonas[0]?.label` optional chaining OK. heading audit exit 0 정책상 회귀 시 빌드 통과되어 감지 누락 가능.

## 검증·보강 제안
1. `callClaude` JSDoc에 반환 타입 명시 + 다른 스크립트 호출부 grep 1회 (`scripts/**/*.mjs`).
2. BlufBox stats 타입을 `value: string` 명시 (현재 string union 강제 X).
3. `npm run build` 후 `dist/feed-issues.xml`을 `xmllint --noout` 또는 fast-xml-parser로 lint — Cycle #5 audit에 추가.
4. _history.json write를 `writeFile(tmp) → rename` 패턴으로 atomic 전환 (P1 후순위).
5. heading audit `--strict` 플래그 추가 — main 머지 전 PR CI에서만 strict, 로컬은 warn.

## 권장 P0
- **P0**: feed-issues.xml RSS lint audit 추가 (xmlns 검증 + atom:updated ISO format)
- **P1**: callClaude 반환 타입 JSDoc + 호출부 grep 보고
- **P1**: heading audit strict 플래그 (PR CI 게이팅 정책 명문화)
- **P2**: _history.json atomic write 전환
