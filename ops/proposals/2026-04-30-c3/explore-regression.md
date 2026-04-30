# 회귀 차단 (duplicate_@id + audit 한글 URL) — Explore

## 발견

**duplicate @id 5건 분석:**
- `about.astro` (L97-101): 자체 `orgSchema` inline 출력 + BaseLayout의 orgSchema 출력 → 2개 `#organization`
- `index.astro` (L77-86): 자체 orgSchema + WebSite inline + BaseLayout 다시 orgSchema → 3개 (`#organization` 2 + `#website` 1)
- 근본 원인: BaseLayout이 buildOrganization()/buildWebSite() 항상 출력(L106-107) + 특정 페이지에서 추가 inline 선언

**한글 URL 매칭 불일치:**
- `keyword-coverage.mjs` L182: `encodeURIComponent(c.id)` 사용 (`주거` → `%EC%A3%BC%EA%B1%B0`)
- `loadHtml()` L64: `routePath.replace(/^\//, '')` 후 파일 조회 (한글 디렉토리명 raw)
- `internal-link-audit.mjs` L61-64: 추출된 링크 normalize 없음 — `/categories/주거/` vs `/categories/%EC%A3%BC%EA%B1%B0/` 구분 불가
- 결과: categories avg_score 0 (모든 페이지 missing_html로 취급)

## 제안

1. **BaseLayout 선택적 스키마 출력**: Astro Props로 `skipOrgSchema`, `skipWebSite` bool 추가 → about.astro/index.astro에서 false 전달
2. **내부 감사 URL normalize**: 
   - `extractLinks()`: decodeURIComponent로 href 정규화 (`%EC%A3%BC%EA%B1%B0` → `주거`)
   - `loadHtml()`: encodeURIComponent로 route 정규화 (검색 시)
3. **keyword-coverage 라우트 일관성**: routes 생성 시 모두 encodeURIComponent → c.id 그대로 사용 (현재 혼동)

## 권장 P0

1. about.astro 제거/BaseLayout Prop 추가: 중복 @id 2건 해소
2. index.astro 정리: 중복 @id 3건 해소  
3. internal-link-audit.mjs L61 추가: `const clean = decodeURIComponent(href.split('#')[0].split('?')[0])`
4. keyword-coverage.mjs L182 유지 + loadHtml() normalize 추가: 한글 URL 일관화
