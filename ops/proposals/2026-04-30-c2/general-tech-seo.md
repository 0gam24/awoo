# Technical SEO — Cycle #2

## 발견
- `/issues/main/` 은 `meta refresh + noindex` 정적 fallback이지만 **sitemap-0.xml 에 그대로 포함** (Cloudflare `_redirects` 301 보다 빌드 산출물이 우선 제출됨) → 인덱싱 노이즈·크롤 예산 낭비.
- `src/pages/subsidies/[id].astro` 의 `GovernmentService` JSON-LD 에 `provider`·`audience`·`termsOfService` 는 있으나 **1차 자료 URL 신호 부재** (`isBasedOn` / `mainEntityOfPage` 미사용). `applyUrl` 은 `z.string().url()` 로 이미 검증됨 → 안전하게 `isBasedOn`(또는 `mainEntityOfPage`)으로 노출 가능.
- `src/lib/schema.ts` `buildCollectionPage` 가 `items.length === 0` 일 때도 빈 `ItemList`(`numberOfItems: 0`) 출력 → Google rich result 가이드라인 위반 위험 (CollectionPage 는 항목이 있어야 유효).
- `robots.txt` + `sitemap-index.xml` + canonical 흐름 자체는 정상. 다만 위 `/issues/main/` 누수가 신뢰 신호를 갉아먹음.

## 제안
1. **P0 — sitemap filter**: `astro.config.mjs` 의 `@astrojs/sitemap` 에 `filter: (page) => !page.endsWith('/issues/main/')` 추가. 동시에 `src/pages/issues/main.astro` 는 `meta refresh` 그대로 두되 sitemap 에서만 제거 (외부 인바운드 보호).
2. **P0 — `isBasedOn` 추가**: `[id].astro` `govSchema` 에 `isBasedOn: s.applyUrl` (정부24·복지로 등 1차 신청처 URL) 1줄 추가. 119건 GovernmentService 모두 자동 적용. AI 인용 신뢰도·E-E-A-T·GEO citation 모두 강화.
3. **P1 — 빈 CollectionPage 가드**: `buildCollectionPage` 에서 `if (opts.items.length === 0) return null;` 분기 추가, 호출부(BaseLayout 또는 hub 페이지)에서 `null` 이면 schema 블록 자체를 렌더링하지 않도록 변경.
4. **P1 — canonical 절대 URL 회귀 테스트**: `scripts/audit-*.mjs` 류에 `link[rel=canonical][href^="https://awoo.or.kr"]` 100% 일관성 체크 1줄 추가 (현재 통과 중이지만 회귀 방지).

## 권장 P0
- **#1 sitemap filter `/issues/main/` 제거** — 1줄, 영향 즉각, 인덱싱 노이즈 차단.
- **#2 `isBasedOn: s.applyUrl`** — 1줄, 119건 일괄 적용, GEO/AI 인용 핵심 신호.
