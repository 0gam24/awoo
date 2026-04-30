# GEO — Cycle #7

## 발견
- llms-full.txt 현재 181KB / 200KB 한도, 마진 19KB → 실질 추가 가능 ~11KB.
- 현 합본: personas·중위소득·subsidies(coreFacts 포함)·CATEGORIES(commonEligibility+top3)·issues 큐레이션·issuePosts 30일 본문(tldr/coreFacts/sections/faq)·운영주체.
- 미합본: topics.json의 decisionTree·comparison·timeline·rejectionReasons·faq, glossary.json의 longDef.
- 정보 페이지(/about·/editorial-policy·/contact)에 BlufBox 미적용 → AI 답변 엔진의 "운영자/정책" 질의 인용 청크 부족.
- issues NewsArticle JSON-LD에 `about` 미설정 → 카테고리 분야 시맨틱 약함.

## 제안
1. **llms-full topics 본문 합본** — 토픽별 decisionTree(질문→가지)·comparison(테이블)·rejectionReasons·faq를 H4 청크로 추가. 토픽 2건 × ~3KB ≈ +6KB.
2. **llms-full glossary longDef 합본** — `## 용어집` 아래 term/shortDef/longDef 30건 → ~+4KB.
3. **/about·/editorial-policy·/contact BlufBox** — 독자 가치 1문장(누가 운영하는 정보 사이트인지·편집 원칙·문의 가능 범위)으로 BLUF 박스.
4. **issues NewsArticle.about 추가** — `about: { @type: Thing, name: 카테고리명 }`로 분야 시맨틱 보강 (articleSection 보완).

## 권장 P0
- **P0-A: llms-full topics 본문 합본** — GEO 인용 밀도 최대 효과, +6KB로 한도 안전(총 187KB).
- **P0-B: /about·/editorial-policy·/contact BlufBox** — 운영주체·정책 질의 답변 청크 확보, 독자 가치 카피로 작성.
- glossary longDef·NewsArticle.about은 P1로 후순위 (한도 여유·시맨틱 미세 보강).
