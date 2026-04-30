# Content SEO — general-purpose

## 발견
- **페르소나/카테고리 본문이 단조**: `personas/[id].astro` h1 = `{label}`, h2 = `{label}이 받을 수 있는 지원금 N개` 단 1개. `pains/age/income/living` 데이터가 hero chip에만 노출, 본문 H2 키워드로 재활용 X. `categories/[id].astro`도 `일반 자격 요건` + `대표 지원금 N건` 두 H2에 그침.
- **subsidies/[id]의 longtail 부재**: `eligibility / benefits / documents`만 H2화. FAQ·자주 거절되는 사유·신청 D-day는 topic에만 있고 subsidy 단건엔 없음. 검색 진입 키워드("청년월세 거절 사유" 등) 미커버.
- **glossary 30개 vs 본문 인라인 링크 0개**: subsidy/persona/situation 본문에서 용어를 anchor + title로 자동 링크하는 mechanism 없음. topic만 `relatedGlossary`로 카드화.
- **comparison schema 미사용**: `topics.json`에 `comparison.headers/rows` 정형 데이터 보유하나 schema.org `Table` / FAQPage 외 추가 마크업 X.
- **published/modified 명시 부족**: subsidy는 `regDate / lastVerified` 노출, 그러나 persona/situation/category/topic/glossary는 `<time datetime>` 및 schema `dateModified` 모두 없음. E-E-A-T 신호 손실.

## 제안
1. **Persona/Situation H2 키워드 보강**: `{label} 주요 고민 3가지`, `{label}에게 가장 자주 매칭되는 분야`, `{age}·{income} 기준 자격선` 같은 H2 3개 추가 — `pains·age·income·living` 필드를 본문 텍스트로 재활용. title도 `{label} 정부 지원금 N개 — {sub}` 패턴으로 longtail.
2. **Subsidy [id] longtail H2 추가**: `이 지원금 자주 거절되는 사유`(topic.rejectionReasons에서 카테고리 매칭 끌어오기), `자주 묻는 질문 3선`(topic.faq 매칭), `신청 전 체크리스트` H2 3개. FAQPage schema 동시 출력.
3. **Entity-linking inline helper**: `src/lib/inline-glossary.ts` 신설 — eligibility/benefits/summary 텍스트에서 glossary `term + synonyms` 자동 매칭 → `<a href="/glossary/{id}/" title="{shortDef}">` 변환. subsidy·topic·situation 본문 모두 적용.
4. **Comparison schema 출력**: topic의 `comparison`을 `<table>` + `ItemList` JSON-LD로 마크업. 또 `decisionTree`의 q를 `Question`으로 추가 마크업.
5. **dateModified 통일**: 모든 페이지에 `<meta property="article:modified_time">` + 본문 footer `<time datetime>` 노출. data 파일의 마지막 git mtime 또는 별도 `_meta.json` 통합.

## 권장 P0
**P0-A**: Subsidy [id]에 FAQ + rejectionReasons H2 + FAQPage schema 추가 (topic 매칭 키워드로 자동) — longtail 즉효, PSI 영향 거의 0. **P0-B**: inline-glossary 자동 anchor 헬퍼 — 30개 용어 × N개 본문 entity link 폭증. **P0-C**: persona/situation H1·H2·meta 키워드 패턴 리라이트 (data 활용, 코드 변경 ≤5 파일).
