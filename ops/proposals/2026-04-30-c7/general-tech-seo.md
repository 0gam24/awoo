# Technical SEO — Cycle #7

## 발견
- `src/pages/subsidies/[id].astro` `govSchema`에 `mentions` 필드 미존재. 그러나 `entity-graph.json` `entities.subsidies.{id}.mentionedGlossary[]`(URL 배열)이 이미 사전 계산돼 있어 schema 주입 즉시 가능.
- `src/pages/topics/[id].astro` `faqSchema`만 존재. `matchedSubsidies` / `relatedGlossaryItems` 둘 다 페이지 내 이미 계산되지만 `mentions` 미연결.
- `src/pages/glossary/[id].astro` `definedTermSchema`에 `subjectOf` 미존재. `matched`(지원금 6) / `matchedTopics`(토픽 3)가 이미 도출돼 백레퍼런스 자료 충분.
- `src/pages/llms.txt.ts` / `llms-full.txt.ts` 존재하나 `referenced_routes` ↔ 실제 빌드 라우트 diff 검증 스크립트 부재 (`scripts/audit-*.mjs` 3종은 headings/rss/skip-link 한정).

## 제안
1. **subsidies/[id] GovService.mentions** — entity-graph `mentionedGlossary` URL 배열을 schema `mentions: [{@type:'DefinedTerm', @id: <glossary>/#term}]` 매핑. 빈 배열은 omit.
2. **topics/[id] mentions** — `matchedSubsidies` → `GovernmentService @id`, `relatedGlossaryItems` → `DefinedTerm @id` 합본을 `Article`(혹은 신규 `WebPage`) `mentions`로 노출. FAQPage는 분리 유지.
3. **glossary/[id] DefinedTerm.subjectOf** — `matched`/`matchedTopics`의 `@id` 배열을 `subjectOf: [{@type:'WebPage', @id}]`로 추가 (역참조 그래프 폐쇄).
4. **llms-routes audit 스크립트** — `scripts/audit-llms-routes.mjs` 신설. `dist/client/llms.txt` 파싱한 경로 vs `astro build` 산출 라우트 set diff → 누락/유령 라우트 0건 보증, lint에 편입.

## 권장 P0
- **P0-1**: 제안 1 (subsidies mentions) — 119건 즉시 schema 강화, 데이터 소스 무가공.
- **P0-2**: 제안 3 (glossary subjectOf) — 30 용어 entity-graph 폐쇄, GEO 인용 backref.
- **P0-3**: 제안 4 (llms audit) — 빌드 회귀 감지, Cycle #5 P1 미완 청산.
- 제안 2는 P1 보류 (topics 2건만 → ROI 후순위).
