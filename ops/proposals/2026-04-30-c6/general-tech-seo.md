# Technical SEO — Cycle #6

## 발견
- `subsidies/[id].astro` GovService(line 99~) — `@id`/`mainEntityOfPage` 부재. canonical-WebPage 연결 없어 Google rich result 그래프 단절.
- `glossary/index.astro` DefinedTermSet — 이미 `#dts`로 @id 지정됨(line 25). 단, 자식 DefinedTerm에 `inDefinedTermSet` 역참조 누락 → set 멤버십이 schema 차원에서만 암묵적.
- `issues/[date]/[slug]` NewsArticle도 동일 패턴(mainEntityOfPage 미부여) 가능성.
- Cycle #5 entity-graph 169 entity의 `relatedSubsidyKeywords` 매칭 결과가 topics 페이지에 표시되지만 Schema.org `mentions[]`로 명시되지 않음 → AI 인용 신호 손실.

## 제안
1. **GovService.mainEntityOfPage** — `subsidies/[id]`에 `{ '@type':'WebPage', '@id': 'https://awoo.or.kr/subsidies/${s.id}/' }` + GovService 자체 `@id: '#govservice'` 부여. FAQ `#faq`와 동일 페이지 그래프 통합.
2. **DefinedTerm.inDefinedTermSet** — glossary index `hasDefinedTerm[]` 각 항목에 `inDefinedTermSet: { '@id': 'https://awoo.or.kr/glossary/#dts' }` 역참조 1줄 추가.
3. **NewsArticle.mainEntityOfPage** — issues 동적 라우트에 동일 WebPage @id 패턴 적용.
4. **topics/[id].mentions[]** — entity-graph 매칭 결과(top N entity)를 `{ '@type': 'Thing', name, url }` 배열로 schema에 주입.

## 권장 P0
- **P0-A**: 1번(GovService @id+mainEntityOfPage) — 영향 범위 최대(전 subsidies 페이지), 변경 5줄, rich result 안정성 직결.
- **P0-B**: 2번(inDefinedTermSet 역참조) — 1줄 변경, DefinedTermSet 그래프 완결성 즉시 확보.
- 3·4번은 P1로 보류(issues route·entity 매칭 로직 신규 결합 필요, 검증 비용 있음).
