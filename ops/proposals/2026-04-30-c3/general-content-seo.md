# Content SEO — Cycle #3

## 발견
- `topics.json`은 현재 2건(주거·복지)만 존재 → `_curated`(10건)+`_gov24`(110건) 중 비매칭 카테고리(창업·교육·자산·취업·농업) 약 **104건의 subsidy 페이지에 FAQ/거절사유 미노출**. C2 자산이 5/7 카테고리에서 사장 중.
- `CATEGORIES.commonEligibility[]`는 카테고리 페이지에만 노출, subsidy 상세에서는 미사용 — fallback 후보로 즉시 활용 가능.
- `lastVerifiedAt`은 `_gov24/_manifest.json` 기준으로 함수만 존재(`getLastVerifiedKR`)하고 페이지 푸터에는 노출되나, **`<time datetime>` 마크업 없음** → E-E-A-T 시그널 손실.
- `applyMethod` 필드는 110건 전체 부재 → HowTo schema 즉시 적용은 불가, 카테고리 공통 절차 fallback 필요.
- `issues/index.astro` 트렌딩 사이드바는 링크는 있으나 **검색 진입 hint 없음**.

## 제안
1. **[P0] subsidy [id] FAQ fallback** — `matchedTopic` 미스 시 `CATEGORIES.commonEligibility`를 "이 분야 지원금 공통 자격" H2 섹션으로 출력 + 카테고리별 일반 FAQ 3건씩(총 5×3=15건)을 `topics.json`에 보강(category-only 매칭 허용). subsidy 페이지 FAQ 커버리지 80→100%.
2. **[P0] `<time datetime>` 마크업** — hero 또는 verified-info에 `<time datetime={lastVerifiedISO}>마지막 동기화: {lastVerifiedKR}</time>` + GovernmentService schema에 `dateModified` 추가 (최신성 신호).
3. **[P1] 카테고리 자동 H2** — subsidy 본문 상단에 "{persona 라벨}이 자주 받는 {category} 지원금" 형태 sub-headline (matchedPersonas[0].label + s.category 조합, 텍스트만).
4. **[P1] issues 검색 hint** — 트렌딩 카드에 "이 키워드로 둘러보기" CTA(JS-free, `/subsidies/?q={term}` 정적 링크).

## 권장 P0
**P0-A: topics.json 카테고리 공통 FAQ 보강 + commonEligibility fallback 노출** (5×3=15 FAQ + 5 카테고리 H2 섹션, subsidy 100건+ 즉시 enrich, FAQPage schema 누락분 일괄 회수)
**P0-B: `<time datetime>` + GovernmentService.dateModified** (E-E-A-T·freshness, 코드 ~10줄)
