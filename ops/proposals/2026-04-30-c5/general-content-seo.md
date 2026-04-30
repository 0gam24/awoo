# Content SEO — Cycle #5

## 발견

- **glossary 30개**: term + synonyms[] + related[] 완비. 본문에서 매칭 가능한 1차 어휘는 평균 1.7개/항목. `/glossary/[id]` 본문은 schema·관련 지원금까지 자동 매칭하나, related[] 링크가 본문 끝에 노출되지 않음 (CrossRefRail 외 추가 hub 없음).
- **gov24 region 신호**: 109개 항목 중 region 전용 필드는 없으나 `agency`(예: "인천광역시", "함안군")에 광역·기초 지자체명이 명시됨 — 정규식 추출로 지역 long-tail 가능. eligibility 본문에도 지역 키워드 빈출.
- **/personas/[id]**: byCategory count·flagshipTitle 자동 집계 인프라 이미 가동 중 — H2로 노출되지 않고 hub 카드 형태에 머무름.
- **/situations/[id]**: topCategoryFromMatched 동일 집계 존재하나 BLUF stat에만 사용 — H2 long-tail 미활용.
- **/issues/index**: trending[] (term·count) 데이터 hero 3장에만 활용 — `/subsidies/?q=` 사이드바 hint 부재. JS 0 정적 링크 가능.
- **/subsidies/[id]**: related (동일 category) 3건 + alsoSeen 4건 카드 노출 중. "비슷한 {category} N건 더 보기" 형태 텍스트 footer는 부재.

## 제안

1. **inline-glossary anchor** (단독 진행 가능): subsidy/topic/situation 본문 string에서 glossary term/synonyms 첫 등장 1회만 `/glossary/[id]/`로 자동 anchor (build-time 치환, JS 0). 어휘 부풀림 방지로 항목당 최대 3개 anchor cap.
2. **issues/index 트렌딩 hint**: hero 카드 아래 `<aside aria-label="키워드로 둘러보기">` — `<a href="/subsidies/?q={term}">"{term}" 지원금 둘러보기</a>` × top 5. 정적 링크, JS 0, 독자가 "지금 화제인 키워드로 검색"하는 행동을 한 클릭으로 단축.
3. **/personas/[id]·/situations/[id] 카테고리 H2**: 기존 byCategory 집계를 활용해 `<h2>{label}이 자주 받는 {top-category} 지원금 {count}건</h2>` × top 3 카테고리. count·대표 1건 인용으로 long-tail 진입.
4. **subsidy 본문 footer**: alsoSeen 카드 아래 `<p>비슷한 {category} 지원금 {related.length}건 더 보기 →</p>` 링크 (`/subsidies/?category={category}`). 동일 category·다른 페르소나로 확장 의도 만족.
5. **glossary "다음 용어"**: 본문 끝에 related[] 1~3건을 `<nav aria-label="다음 용어">` 형태로 — H2 + 카드 2~3장. CrossRefRail와 중복되지 않게 related[] 우선 (rail은 topic·subsidy 축).

## 권장 P0

**P0-1: inline-glossary anchor** (entity-graph 단독 진행 가능 결론 — graph는 산출물이고 anchor는 본문 치환이라 의존성 분리). build-time string replace + 첫 등장 1회 cap. `/subsidies/[id]`·`/topics/[id]`·`/situations/[id]` 3개 라우트 적용. PSI 영향 0 (정적 HTML), 어휘 신호 +30 term × 119 subsidy = 잠재 anchor 수천 개 (cap 후 ~360개 추정). 

**P0-2: issues 트렌딩 hint + persona/situation 카테고리 H2** (둘 다 5분 내 단일 PR 가능, 독립적 가치). 트렌딩 hint는 신선도 신호, H2는 24개(persona 6 × top3) + 36개(situation 12 × top3) long-tail 신규 슬롯.

P1 보류: subsidy footer·glossary "다음 용어" — 효과 작고 위 3건 후 측정 필요.
