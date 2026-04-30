# 최근 5 커밋 회귀 점검 — general-purpose

## 변경 요약 (커밋 SHA + 한 줄)
- `2bb5cae` CrossRefRail(4축 hub 진입점) 4 detail 페이지 + NewsHero trending → topic hub 매핑.
- `f64fc51` PageHeader / BaseLayout `breadcrumbs` prop / `lib/schema.ts` (BreadcrumbList·CollectionPage) / `--cat-` 7색 토큰 — 22 페이지 IA 통합.
- `4f40916` /issues/ 1+2 다층 hero·readingTimeMin·tag chip·`--accent-dark` 변수화.
- `e47fe38` Naver Search Advisor HTML 인증 파일 + 메타 태그 이중 인증.
- `5c8acaa` Google Discover Tier 1 — 메타·author·sources·헤드라인·신뢰 배지.

## 회귀 위험 지점
1. **JSON-LD 중복 — BreadcrumbList**: BaseLayout `breadcrumbs` prop이 자동 출력하지만 18 페이지가 이미 `application/ld+json` 자체 출력 중. 두 BreadcrumbList가 충돌하면 Google rich-result 경고 가능 (현재 grep상 `breadcrumbs` prop 사용 페이지에서 인라인 BreadcrumbList 직출력은 미확인 — `issues/topics/[term].astro`에 `breadcrumbSchema` 직접 출력 잔존, BaseLayout이 같은 데이터를 prop로도 받으면 이중 출력).
2. **카테고리 토큰 중복 정의**: `global.css`에 `.cat-주거~--cat-농업` 7개 헬퍼가 이미 승격됐는데 `pages/issues/index.astro` 327~334줄에 동일 토큰 재선언 — DRY 위반·dark mode 동기화 누락 위험 (issues 인덱스만 라이트값 하드코딩으로 다크모드 색상 차이 발생).
3. **`--accent-dark` 다크 가독성**: 다크모드 값 `#001a3d`은 `linear-gradient(--accent → --accent-dark)`에서 `bright-blue → 거의 검정`으로 그라데이션 콘트라스트 과대, hero-lg 흰 텍스트 위 가독성은 OK이나 시각적 의도(블루 그라데이션) 손실.
4. **target-size 24px**: CrossRefRail `.crr-card` padding 12·14px + label 14px + sub 12px → 약 48px ✅. NewsHero `.trend-pill` padding `3px 10px` font 12px → 약 22px (24px 미달, 단 부모 `.trend-link-auto`가 클릭 타겟이라 실질 OK이나 단독 시 위험). hero-rank pill `4px 12px` font 12px → 22px (단독 클릭 X).
5. **인라인 CSS 50KB 초과**: 최대 파일 issues/index 24KB, NewsHero 24KB, topics/[id] 18KB — 50KB 한참 미만 ✅.
6. **JSON-LD parse error 위험**: `buildBreadcrumb` 한글 name + 절대 URL 변환 OK. CollectionPage `numberOfItems` 0 케이스 미가드 — 빈 hub일 때 `itemListElement: []` 출력 (Google 무시하지만 Search Console 경고 가능).
7. **CrossRefRail `aria-label`**: nav에 한글 label OK, 빈 items 시 nav 자체 미렌더 ✅.
8. **Naver 인증 파일 중복**: 메타 태그 + 파일 이중. 파일 리네임 시 메타값 변경 누락 가능 — 현재는 OK.
9. **PageHeader `lead` `set:html`**: 외부 입력 없으니 XSS 위험 X, `<br />`만 의도 — 추후 cms 도입 시 위험.
10. **다층 hero 단일 카드 케이스**: heroCards 1개일 때 `.hero-sub-grid`가 렌더 X (length>1 가드) ✅, 0개일 때 `.hero-section` 통째 미렌더 ✅.

## 제안 (검증/보강)
- A. `pages/issues/index.astro` 327~334줄 `.cat-*` 로컬 정의 제거 → `global.css` 토큰만 사용 (다크모드 자동 동기).
- B. `lib/schema.ts buildCollectionPage`에 `if (items.length === 0) return null;` 또는 `numberOfItems` 0 가드, 호출부 falsy check.
- C. `issues/topics/[term].astro`의 인라인 `breadcrumbSchema` 출력을 BaseLayout `breadcrumbs` prop로 일원화 — 이중 출력 방지.
- D. `.trend-pill`·`.hero-rank` 등 12px 미니 pill에 `min-height: 24px; display: inline-flex; align-items: center;` 추가 — 단독 클릭 시도 안전.
- E. `--accent-dark` 다크모드 값 `#001a3d` → `#002952` 정도로 한 단계 위 — 그라데이션 의도 보존.
- F. `PageHeader.lead set:html` JSDoc에 "신뢰 입력 한정" 명시.

## 권장 P0
**A (cat-* 토큰 중복 제거)** + **C (BreadcrumbList 단일화 점검)** — 두 항목 모두 다크모드/SEO 회귀를 즉시 차단. D는 P1, B/E/F는 P2.
