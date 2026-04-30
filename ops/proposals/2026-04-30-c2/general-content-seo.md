# Content SEO — Cycle #2

## 발견

**현재 구조** (`src/pages/subsidies/[id].astro`):
- 본문 H2 순서: 지원 대상 → 혜택 내용 → 신청 방법 & 일정 / 필요 서류 → 비슷한 지원금 → 또 보는 것
- `GovernmentService` JSON-LD만 출력. `FAQPage` 스키마 부재
- 거절 사유·자주 묻는 질문 H2 없음 → 롱테일 키워드 ("월세지원 거절", "왜 떨어졌나") 미커버

**데이터 매칭 가능성:**
- `topics.json` 2건 (`youth-housing`·`newlywed-childcare`) 각각 `rejectionReasons[4]` + `faq[4]` + `relatedSubsidyKeywords[]` + `mainPersonas[]` 보유
- subsidy 119건 중 substring 키워드 매칭 시: 주거·복지 카테고리는 50~70% 히트, 창업·취업·자산은 0건 다수 → **오탐·미매칭 양극화**
- 안전 매칭식: `subsidy.category === topic.category` AND `subsidy.targetPersonas ∩ topic.mainPersonas ≠ ∅` (정밀도 우선)
- 0건 케이스: 매칭 토픽 없으면 H2 자체 미출력 (조건부 렌더 가드)

**glossary.json** (30건): `term` + `synonyms[]` 보유. 본문 자동 anchor 시 `s.eligibility[]`·`s.benefits[]` 문자열을 토큰 스캔. 오탐 방지 — 한 페이지당 동일 term 첫 1회만 anchor, 자기 카테고리 term 우선.

## 제안

### 1. subsidy [id]에 FAQ + rejectionReasons H2 (P0-A, score 10)
- 위치: 신청 방법 & 일정 / 필요 서류 다음, 비슷한 지원금 직전 (band)
- 매칭: category + persona 교집합 토픽 1건 우선 (점수 동률 시 첫 토픽)
- H2 카피 (질문형, 독자 중심):
  - "{title} 자주 거절되는 사유" → topic.rejectionReasons → cause/fix 2열 카드
  - "{title} 자주 묻는 질문" → topic.faq → details/summary accordion
- `FAQPage` JSON-LD 추가 (기존 govSchema와 별도 script 블록)
- 매칭 0건 가드: `if (matchedTopic) { ... }` 조건부 렌더

### 2. inline-glossary 자동 anchor (P1, score 6)
- 대상: `s.eligibility[]`·`s.benefits[]` 항목 텍스트
- 알고리즘: term + synonyms 합집합으로 정렬 (긴 토큰 우선, "청년 월세지원" > "월세")
- 페이지당 동일 glossary id 1회만 anchor (Set 추적)
- 출력: `<a href="/glossary/{id}/" class="gloss-link">term</a>` + 점선 underline
- 오탐 방지: 정확 매칭만 (부분 단어 X), 본문 외 hero·apply-rail 제외

### 3. glossary cross-ref 보강 (P1, score 5)
- glossary detail 페이지 하단에 "이 용어가 적용되는 지원금" 섹션 (2~4건)
- 매칭: glossary.related[] → topic.related → topic.mainPersonas → subsidy.targetPersonas
- 현재 glossary는 term-term 링크만. subsidy로 나가는 outbound 부재 → IA orphan 일부 해소

## 권장 P0

**1순위: subsidy FAQ + rejectionReasons + FAQPage schema** (P0-A score 10)
- 단일 PR, 119페이지 일괄 적용, 새 데이터 생산 0
- topics.json 2건만으로 주거·신혼 카테고리 ~30~40건 커버 (정밀 매칭식 기준)
- `FAQPage` schema → 구글 SERP rich snippet 노출 가능 (질문/답변 스니펫)
- 0건 케이스 다수 (창업·취업) → 후속 사이클에 topic 추가로 점진 확장
- 작업량: [id].astro에 ~50줄 + JSON-LD 블록 1개

**2순위: glossary 자동 anchor** (조용한 내부링크 ↑, 컴포넌트화 후 hub들에도 재사용)
**3순위: glossary → subsidy outbound** (IA·orphan 동시 개선)

PSI 4×100 영향: details/summary 네이티브 + JSON-LD 텍스트만 추가, CSS ~1.5KB 증가 예상.
