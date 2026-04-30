# 회귀 점검 — Cycle #3

## 회귀 위험 지점

1. **`buildCollectionPage` null 반환 vs 호출부 falsy 미처리** (회귀 위험 高)
   - `src/lib/schema.ts:124` — items 0건이면 `null` 반환.
   - 그러나 **6개 hub 페이지(`categories`/`glossary`/`personas`/`situations`/`topics`/`subsidies/index`)** 모두 `<script type="application/ld+json" set:html={JSON.stringify(collectionSchema)} />` 그대로 호출. items 0이 되는 순간 `"null"` 리터럴이 JSON-LD로 출력 → Search Console 파싱 에러. 현재는 데이터 0건 케이스가 없어 잠복 중.
2. **Footer 5열 mobile 회귀**: `Footer.astro:113-134` — 480px 이하 2열 + brand `grid-column: 1/-1` 처리는 정상이나, 카테고리 raw `c.id`(`주거`·`자산`)가 한글 1~2자라 줄바꿈 안 일어남 → OK. 단 480~960px 사이 3열에서 5번째 컬럼(법적 고지) 폭 좁아짐.
3. **`/issues/main/` sitemap filter**: 외부 인바운드는 페이지 자체가 빌드되어 직접 접근 OK이나, `/demo/`도 함께 제외(L57). 필터 조건이 의도 외 경로 흡수 위험. 추가 라우트 도입 시 회귀 가능.
4. **Safari `contain: layout style paint`**: NewsHero L381·L793 — Safari 15.4+ 지원 (현 99%+ 커버). 회귀 거의 없음.
5. **`requestIdleCallback` fallback**: `BaseLayout.astro:125-129` `setTimeout(_, 2500)` 적용됨. Safari 정상.
6. **GovService.isBasedOn = applyUrl 119건**: applyUrl이 신청처 URL이라 schema.org `isBasedOn`(원본 자료) 의미와 약간 어긋남 — Google 페널티는 없으나 정확도 측면 P1 정정 후보.

## 검증·보강 제안

1. **6개 hub `collectionSchema` falsy 가드** (1줄, 회귀 0):
   `{collectionSchema && <script type="application/ld+json" set:html={JSON.stringify(collectionSchema)} />}` 패턴으로 일괄 변경.
2. **빈 ItemList CI 가드**: `scripts/audit-jsonld.mjs`(존재 시) 또는 schema-validate에 `numberOfItems === 0` 또는 `JSON-LD === "null"` 검출 추가 — Cycle #2 audit-tools P1 보류분 일부 해소.
3. **sitemap filter 명시 allow-list 전환 검토** (P2): `denylist` 방식은 신규 라우트 누수 리스크 — `/issues/main/`·`/demo/` 명시 X 정규식 화이트리스트 고려.
4. **isBasedOn 의미 정정** (P1, 콘텐츠 백필): 1차 자료(보도자료·고시) 옵셔널 필드 `primarySources[]` 추가 후 매핑. 공석 시 applyUrl 유지 fallback.

## 권장 P0

1. **6개 hub `collectionSchema && ...` 가드** — `JSON.stringify(null)` 누수 방지. 1파일당 1줄 × 6 = 6줄.
2. **schema-validate에 numberOfItems 0 + null literal 검출** — CI에서 미래 회귀 차단.
