# Technical SEO — general-purpose

## 발견
- **canonical**: `BaseLayout.astro:32`에서 `Astro.url.pathname` 기반 자동 생성, `trailingSlash: 'always'`와 정합 — 정상.
- **robots meta**: `max-image-preview:large, max-snippet:-1` 이미 적용 (Discover 와이드 카드 OK). 404는 `noindex` 정상.
- **JSON-LD 엔티티**: BaseLayout에는 `BreadcrumbList`만. **`Organization`·`WebSite`(SearchAction) 사이트-와이드 누락** — 지식 그래프·sitelinks searchbox 신호 없음.
- **sitemap**: `changefreq: 'weekly'` / `priority: 0.7` 전 페이지 동일. subsidies 상세는 `lastmod` 주입 OK이나 hub(/subsidies/, /issues/, /personas/)와 evergreen(/glossary/, /about/) 차등 X.
- **RSS feed**: `feed.xml.ts`는 atom self-link·lastBuildDate·escapeXml 모두 정상. `<item>`에 `<author>`·`<dc:creator>` 누락 — Google News/AI 크롤러 author 신호 약함.
- **robots.txt**: AI 크롤러 명시 허용 + Sitemap 디렉티브 OK.

## 제안
1. **`Organization` + `WebSite` JSON-LD를 BaseLayout에 사이트-와이드 주입** — `@id` 앵커(`#organization`, `#website`)로 `lib/schema.ts`의 `isPartOf` 참조 안정화. SearchAction `urlTemplate`은 `/subsidies/?q={query}` 같은 파라미터 라우트 없으면 생략(가짜 신호 X).
2. **sitemap serialize 차등화** — hub 인덱스 `priority: 0.9 / changefreq: daily`, subsidies 상세 `0.8 / weekly`, glossary·about evergreen `0.5 / monthly`. lastmod 미주입 페이지는 빌드 시각 fallback.
3. **RSS `<dc:creator>` + `<atom:updated>` 추가** — Organization name 또는 카테고리별 시그니처. `xmlns:dc` 네임스페이스 선언 필요.
4. **dialect 신호 보강** — `<html lang="ko">` → `lang="ko-KR"` (지역 dialect 명시, hreflang 대체 약신호).

## 권장 P0
**P0-1: Organization·WebSite JSON-LD 사이트-와이드 주입** (`lib/schema.ts`에 `buildOrganization()`·`buildWebSite()` 추가 + BaseLayout `<head>` 출력). 노출 가시성 즉효, 코드 변경 작음, PSI 영향 0.
**P0-2: sitemap 페이지-타입 차등 priority/changefreq** (`astro.config.mjs` serialize 분기 확장). 크롤 예산 hub 집중 → 신선도 신호 강화.
