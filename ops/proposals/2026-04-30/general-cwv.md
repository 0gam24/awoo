# CWV / 성능 — general-purpose

## 발견
- **인라인 CSS 비대 원인 = 8개 컴포넌트 통합**: `index.astro`가 `UrgencyHook → NewsHero → QuickCheckCTA → RecentlyAdded → IncomeChecker → OtherIssuesSection → PersonaPicker → CategoriesGrid` 8섹션을 한 페이지에 직렬로 import. `inlineStylesheets: 'always'` + `cssCodeSplit: true` 조합이라 모든 섹션 CSS가 첫 HTML에 인라인 — `NewsHero.astro`만 700+ 라인 (애니메이션·그라디언트·sidebar). Above-the-fold(`UrgencyHook` + `NewsHero` 상단)와 below-the-fold(`PersonaPicker`·`CategoriesGrid`)가 동일 우선순위로 인라인됨.
- **LCP 후보**: `news-headline` `clamp(28px, 3.6vw, 44px)` 텍스트로 추정 — 폰트 swap 의존. `BaseLayout`이 Pretendard preload 의도적 회피 + Adjusted fallback metric matched. 다만 `--ease-standard`·`--shadow-pop`·`color-mix()` 변수가 Above 직전에 평가됨 → critical inline 후보 좁힐 여지.
- **JS 비용**: BaseLayout `<script>import('@/lib/vitals').then(...)</script>` — module preload 없이 dynamic import → INP 시점 첫 측정에 `web-vitals` 청크 fetch 누적. `IncomeChecker` `client:visible` 1개만 hydration 대상이라 TBT 안전.
- **CLS 가드**: `urgency-hook` `padding: 32px 0 16px` 정적 + `news-stat-strip` `grid-template-columns: repeat(4,1fr)` 고정 → 텍스트 폭만 흔들 가능. `core-fact` `cf-sub` `white-space: nowrap` 1줄 ellipsis라 reflow 0.
- **빌드 가드 부재**: `lighthouserc.json` Lab 어설션은 있으나 **번들/인라인 CSS 임계값 빌드 fail 룰 없음** — 회귀 시 PSI 100 깨질 때까지 감지 불가.

## 제안
1. **P0 — Above-the-fold만 인라인, 나머지 외부 lazy**: `astro.config.mjs` `inlineStylesheets: 'auto'`로 변경(임계값 4KB) + `UrgencyHook`·`NewsHero` `is:inline` style 유지, `OtherIssuesSection`·`PersonaPicker`·`CategoriesGrid` 외부 stylesheet 강제(컴포넌트 `<style is:global>` X). 첫 HTML 페이로드 ~37KB → ~15KB 목표.
2. **P0 — 번들 size 가드**: `package.json` postbuild로 `dist/index.html` gzip size 측정 + 50KB 초과 시 `process.exit(1)`. `lighthouserc.json`에 `total-byte-weight` `["error", { "maxNumericValue": 150000 }]` 추가.
3. **P1 — Vitals beacon idle 디퍼**: `BaseLayout` `<script>` → `requestIdleCallback(() => import('@/lib/vitals')...)` 래핑. INP 첫 입력에 측정 청크 fetch 안 끼게.
4. **P1 — NewsHero 애니메이션 분리**: `urgency-hook`의 `uh-word`·`uh-pulse-glow` 9개 word + keyframe 2개를 prefers-reduced-motion 외 `<noscript>` fallback 유지하되 컴포넌트 단일 `<style scoped>` 안에서 `contain: layout style` 추가 → 페인트 영역 축소.
5. **P2 — `color-mix()` 사용처 경량화**: `news-actions` `cta-primary:hover` `color-mix(in oklch, ...)` 1회만이라 OK. 회귀 시 사전 계산 토큰화.

## 권장 P0
**P0-1: 인라인 CSS Above-only 분리** (`astro.config.mjs` `inlineStylesheets: 'auto'` + below-fold 컴포넌트 `<style>` 그대로 유지). LCP 모바일 2.0s → 목표 1.6s, Perf 96 → 100 직접 효과.
**P0-2: 빌드타임 size guard** (`scripts/check-bundle-size.mjs` + `npm run build` postbuild hook + `lighthouserc.json` `total-byte-weight` 어설션 추가). 회귀 시 빌드 즉시 fail — PSI 4×100 안전망.
