# GEO — Cycle #5

## 발견
- `src/pages/llms.txt.ts` 5블록(페르소나·신규·지원금·가이드·운영주체) — 카테고리·상황·용어집 entity 인덱스 부재. 페르소나는 6건 모두 출력하나 categories/situations/glossary 링크가 빠져 AI 크롤러 site-wide 그래프 빈약.
- `/about` BaseLayout Org·WebSite만 — AboutPage schema 미적용. 운영자 자기소개·운영원칙 4항·편집책임자 카드가 본문에 있으나 구조화 데이터 미연결.
- `/editorial-policy` schema 전무 — 시행일(2026-04-29)·편집책임자·1차자료 출처·AI 정책이 있으나 Article/dateModified 없음 → AI overview에서 "출처 신뢰도 신호" 누락.
- llms-full.txt에 issues 본문·subsidies coreFacts는 합본되었으나 categories(7개) commonEligibility 블록 부재 — 카테고리 페이지 BlufBox는 적용되어 있어 데이터는 이미 있음.
- issues NewsArticle audience 필드 Cycle #4 P1 보류분 — schema.org 권장 필드, 페르소나 매칭 신호로 활용 가능.

## 제안
1. **llms.txt 인덱스 보강** — 기존 5블록 사이에 `## 카테고리`(7개), `## 상황별`(12개 situations), `## 용어집`(glossary index) 3블록 추가 → 페르소나·카테고리·상황 3축을 AI 크롤러에 모두 노출.
2. **/about AboutPage schema** — `mainEntity: Organization(@id ref)` + `dateModified` + `audience: 정부 지원금 정보를 찾는 일반 시민` 출력. BaseLayout Org와 `@id` 참조로 중복 회피.
3. **/editorial-policy Article schema** — `headline`, `datePublished: 2026-04-29`, `dateModified`, `author: Person(김준혁)`, `publisher: Org(@id ref)`, `about: 편집정책` — E-E-A-T 신호.
4. **llms-full categories 섹션** — 7개 카테고리 commonEligibility + 매칭 subsidy 수 + 대표 3건 링크. issues·subsidies와 동일 구조로 합본.
5. **issues NewsArticle audience 추가** — `audience: { '@type':'PeopleAudience', audienceType: persona.label }` — 페르소나 매칭 정보 schema에 명시.

## 권장 P0
- **P0-1 llms.txt 카테고리·상황·용어집 인덱스 추가** (영향: 대형 — AI 크롤러 진입점 자체 보강, 누적 BlufBox 8 컨텍스트가 사이트 외부에서 발견 가능해짐)
- **P0-2 /about AboutPage + /editorial-policy Article schema** (영향: 중대 — E-E-A-T·publisher 신뢰도 신호, AI overview 인용 시 출처 명시)
- P1-1 llms-full categories 섹션 (175KB→약 195KB, 카테고리 페이지 자산 합본)
- P1-2 issues NewsArticle audience (페르소나 매칭 schema 신호)
