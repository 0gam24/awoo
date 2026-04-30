# 자동화 보안 — Cycle #7

## 발견
- **/api/contact**: IP해시당 시간당 3건 (`RATE_LIMIT_MAX=3`, `WINDOW=3600s`) + Turnstile + Origin 화이트리스트. 적정.
- **/api/feedback**: IP해시당 시간당 10건. 페이지당 1회 + 정정 여유 — 적정.
- **inline-glossary.ts**: `<a>` 안 회피 + 태그 속성(`<...attr=`) 안 회피만 구현. `<script>·<style>·<code>` 안 토큰은 anchor 치환됨 — 입력이 sanitize된 HTML이라는 호출부 가정에 의존. 회귀 위험 존재.
- **build-entity-graph.mjs**: 출력 `entity-graph.json` 빌드 시점 schema 검증 없음. 손상 시 schema-validate.mjs dangling @id 가드가 false negative.
- **6사이클 보류**: `_fail-{date}.json` 7일 누적 알림, `_history.json` atomic write 미해결.

## 제안
1. **(P0)** inline-glossary 회피 영역 확장 — `<script>·<style>·<code>·<pre>` 안 토큰 skip 로직 추가 (lastOpenA/lastCloseA 패턴 일반화).
2. **(P0)** entity-graph zod 스키마 — `scripts/_lib/entity-graph-schema.mjs` 정의, build-entity-graph.mjs 출력 직전 + schema-validate.mjs 로드 직후 양방 검증.
3. **(P1)** `_fail-{date}.json` 7일 누적 OBSERVE 알림 (factCheckFails 동형 reducer 재사용).
4. **(P1)** `_history.json` atomic write — `writeFile(tmp)` → `rename(tmp, target)` 패턴, 동시 빌드 충돌 방지.

## 권장 P0
**제안 1 (inline-glossary 회피 확장)** + **제안 2 (entity-graph zod)**. 둘 다 빌드타임 정적 검증·회귀 차단 효과 크고 런타임 영향 0. 외부 API/계정 의존 없음.
