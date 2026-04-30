# 기존 SEO/GEO 구현 현황 — Explore

## 발견 (Findings)
1. **Meta/OG 완비** — `src/layouts/BaseLayout.astro`에 title·description·canonical·og:image·twitter cards·og:locale(ko_KR) 모두 박힘
2. **AI 크롤러 명시 허용** — `public/robots.txt`에 GPTBot·ClaudeBot·PerplexityBot·Google-Extended·OAI-SearchBot·CCBot 모두 Allow
3. **Sitemap lastmod 자동 주입** — `astro.config.mjs`가 `_gov24/_manifest.json`의 regDate(ISO)를 페이지별 lastmod로 매핑 → 신선도 신호 활성
4. **RSS 이중 피드** — `src/pages/feed.xml.ts` (신규 지원금) + `src/pages/feed-issues.xml.ts` (이슈 포스트)
5. **JSON-LD 부분 적용**:
   - `BreadcrumbList`: `subsidies/[id]`, `subsidies/index` 만
   - `GovernmentService`: `subsidies/[id]` 완전 (provider·audience·serviceUrl)
   - `NewsArticle` + `FAQPage`: `issues/[date]/[slug]` 완전 (author E-E-A-T 강함)
   - `CollectionPage` + `ItemList`: `subsidies/index` hub
6. **GEO 신호** — `llms.txt`(마크다운 인덱스)·`llms-full.txt`(전체 본문) 자동생성, NEW_WINDOW_DAYS 명시

## 미흡 영역
- **`issues/index`·`issues/main`·`personas/*`·`categories/*`·`situations/*` 에 BreadcrumbList 미적용** → 발견성·sitelink 손실
- **루트 `Organization` + `WebSite` schema 없음** → 사이트 wide entity 신호 부재
- **lastmod 신선도 신호가 hub 페이지(category/persona)로 전파 안 됨** → 갱신감 누락

## 제안 (Proposals)
### 1. 모든 hub 페이지에 BreadcrumbList 추가
- 효과: sitelink·navigation 신호 강화 → CTR↑
- 비용: S (BaseLayout breadcrumbs prop 활용 또는 PageHeader.astro 확장)
- 외부 의존: 없음 / 회귀: 낮음

### 2. BaseLayout footer에 Organization + WebSite 루트 schema 1회 선언
- 효과: 모든 페이지 entity 상속 + AI 인용 시 운영주체 명확
- 비용: S
- 외부 의존: 없음 / 회귀: 낮음 (구조화 데이터 lint 통과 확인)

### 3. hub 페이지에 lastmod 전파
- 효과: GSC last crawl 신선도 + AI Overviews 우선순위
- 비용: M (각 hub의 자식 페이지 max(lastmod) 계산)
- 외부 의존: 없음 / 회귀: 낮음

## 권장 P0
1. **모든 hub에 BreadcrumbList 추가** (이슈 index·페르소나·카테고리·상황·토픽·글로)
2. **BaseLayout 루트 Organization + WebSite schema** (1회 선언, 모든 페이지 상속)
