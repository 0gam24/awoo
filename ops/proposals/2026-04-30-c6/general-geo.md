# GEO — Cycle #6

## 발견
- `src/pages/llms-full.txt.ts` 카테고리 섹션은 한 줄 카운트만 출력 (L200~208) — site-data.ts CATEGORIES 7개의 `description`·`commonEligibility`(4항씩) 자산이 합본 누락. subsidies는 Cycle #4 P0-3에서 coreFacts 블록 적용됨.
- `src/pages/issues/[date]/[slug].astro` NewsArticle schema (L85~122)에 author·publisher·about은 있으나 `audience`·`mentions` 미적용 — relatedPersonas/relatedSubsidies 데이터는 이미 로드됨 (L77~81).
- `src/data/entity-graph.json` 에 mentionedGlossary 자산 존재 — issues 본문 용어 → glossary @id 매핑이 schema.org `mentions`로 노출되지 않음 (현재 subsidies/situations/topics만 활용).
- llms-full 200KB 한도 대비 현재 ~175KB (마진 25KB) — categories 확장 5~8KB는 안전 범위.
- subsidy 페이지 NewsArticle 추가는 부적절 (정책 정보는 GovService가 정확). issue 포스트만 NewsArticle 적합.

## 제안
1. **llms-full categories 섹션 확장** — 7 카테고리 × {description 1줄 + commonEligibility 4항 + 매칭 subsidy 수 + 대표 3건 링크}. 기존 한 줄 카운트 → 약 +6KB. AI 답변 엔진이 "주거 지원금 공통 자격" 류 질의에 카테고리 단위 청크로 인용 가능.
2. **issues NewsArticle.audience 추가** — `audience: { '@type':'PeopleAudience', audienceType: relatedPersonas.map(p=>p.label).join(', ') }`. 페르소나 매칭을 schema에 명시 → AI overview 페르소나 타겟팅 신호.
3. **issues NewsArticle.mentions 추가** — entity-graph.json `mentionedGlossary[slug]`를 읽어 `mentions: [{ '@id': '/glossary/{term}/#term' }, ...]` 배열로 노출 → 사이트 내 entity 그래프 연결, glossary 페이지 권위 누적.
4. **subsidy NewsArticle 신설은 보류** — GovService schema 유지가 정확. issue 포스트만 NewsArticle 강화.

## 권장 P0
- **P0-1 llms-full categories 섹션 확장** (영향: 중대 — AI 답변 엔진의 카테고리 단위 인용 가능, 한도 마진 안전)
- **P0-2 issues NewsArticle.audience + mentions 동시 추가** (영향: 중대 — 페르소나 매칭 schema 명시 + entity-graph glossary 링크 활성화, 단일 파일 수정으로 두 신호 동시 확보)
