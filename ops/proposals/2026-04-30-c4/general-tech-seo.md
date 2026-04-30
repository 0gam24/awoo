# Technical SEO — Cycle #4

## 발견
- `buildBreadcrumb()`(src/lib/schema.ts:86)는 `@id` 미부여 — Cycle #3에서 P1로 보류된 entity 일관성 갭. 다른 schema(`#organization`·`#website`·`#collection`)는 모두 `@id` 앵커 보유.
- `/guide`(src/pages/guide.astro)는 4단계 신청 흐름(`steps[]`)이 이미 데이터 구조화 완료 — `t·d` 필드로 `HowToStep.name·text` 1:1 매핑 가능. 8건 FAQPage schema는 기존재.
- `/quick`(src/pages/quick/index.astro)은 4스텝 stepper + 클라이언트 매칭 인터랙션 — `WebApplication`/`SoftwareApplication` 후보지만 schema 자체 부재.
- `feed.xml.ts`·`feed-issues.xml.ts`는 `xmlns:atom`만 선언, `dc:` namespace·`<dc:creator>`·channel `<atom:updated>` 부재 — Substack/AI 큐레이터 인용 친화성 갭.

## 제안
1. **buildBreadcrumb @id (P0)** — opt-in `pageUrl?` 인자 추가, 있으면 `@id: ${url}#breadcrumb` 부여. 호출부는 점진 마이그레이션 (회귀 0). 기존 호출부는 무변경 동작.
2. **/guide HowTo schema (P1)** — `@type: HowTo`, `name`, `step[]` (4단계 → `HowToStep`), `tool[]` (정부24·복지로 등 6채널). FAQPage와 `@graph` 또는 별도 script로 공존.
3. **/quick WebApplication schema (P1)** — `applicationCategory: GovernmentApplication`, `featureList: ["페르소나 매칭","소득 구간 진단","라이프이벤트 추천"]`, `browserRequirements: "JavaScript"`, `offers.price: 0`.
4. **RSS dc·atom 확장 (P0)** — 양 feed에 `xmlns:dc` 선언, item당 `<dc:creator>김준혁</dc:creator>`, channel `<atom:updated>${lastBuildISO}</atom:updated>` 추가. ORG.founder 단일 진실 소스 활용.

## 권장 P0
- (1) buildBreadcrumb `@id` opt-in + 호출부 7~10곳 마이그레이션 — entity 그래프 완결성
- (4) RSS dc·atom 확장 — AI agent·뉴스 큐레이터 인용 메타 강화 (저비용·고임팩트)

P1: (2) HowTo + (3) WebApplication — 페이지별 임팩트 크지만 중복 schema 검증 필요.
