# Technical SEO — Cycle #3

## 발견
- `src/pages/issues/[date]/[slug].astro` NewsArticle.publisher가 인라인 Organization (name·url·logo) — `#organization` @id 미참조. entity 일관성 약화 (Cycle #2의 GovService.publisher 참조 패턴과 불일치).
- `src/lib/schema.ts buildBreadcrumb` — `@id` 누락. canonicalUrl#breadcrumb 앵커가 없어 NewsArticle/CollectionPage에서 상호 참조 불가.
- `src/pages/feed-issues.xml.ts` RSS — `<dc:creator>` (편집책임자 김준혁) · `<atom:updated>` 부재. Substack·뉴스 큐레이터의 author 메타 누락.
- `src/pages/guide.astro` — 4단계 신청 흐름이 정확히 HowTo schema 구조 (steps 배열). 현재 FAQPage만 있음.
- `src/pages/quick/index.astro` — 4단계 인터랙티브 진단. WebApplication or Quiz schema 적용 가능 (현재 schema 0건).

## 제안
1. **NewsArticle.publisher → @id 참조**: `{ '@id': 'https://awoo.or.kr/#organization' }` 한 줄로 축약. logo·url 중복 제거, entity 그래프 강화.
2. **buildBreadcrumb @id 추가**: 옵셔널 `pageUrl` 인자로 `${pageUrl}#breadcrumb` 부여. 호출부 7~10곳 점진 마이그레이션.
3. **/guide HowTo schema**: name·step[]·tool[](복지로·고용24 등) — 4단계 흐름을 그대로 매핑. FAQPage와 공존.
4. **RSS dc:creator + atom:updated**: `xmlns:dc` 선언 후 각 item에 김준혁, channel에 atom:updated.
5. **/quick WebApplication schema**: applicationCategory=GovernmentApplication, browserRequirements, featureList(페르소나·소득·관심분야·이벤트).

## 권장 P0
**제안 1 (NewsArticle publisher @id)** — 단일 파일 5줄 수정, 즉시 entity 일관성 ↑, Cycle #2 GovService 패턴 완성. 위험 0, FAQPage 80건 + 이슈 NewsArticle 전체에 즉시 효과.
