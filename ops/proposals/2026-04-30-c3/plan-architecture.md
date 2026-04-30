# 아키텍처 옵션 3가지 — Plan (Cycle #3)

## 옵션 A — Entity-graph 정적 인덱서 + inline-glossary (Cycle #2 P0 이월·구조 자산형)
- **효과**: glossary↔topic↔subsidy↔persona 4축 양방향 인덱스 → CrossRefRail 자동화 + inline-glossary anchor + schema `mentions/about/isPartOf` @id 그래프 완성. Cycle #1·#2 보류 P1 3건 동시 해소
- **비용**: `scripts/build-entity-graph.mjs` 신규 + `src/lib/entity-graph.ts` reader + `prebuild` 훅. 빌드 +1.5s 추정
- **위험**: 인덱서 산출 JSON 정합성 — schema-validate에 dangling @id 0건 가드. 라우트 0 추가
- **단계**: 인덱서 → reader → CrossRefRail 주입 → glossary inline anchor → llms-full 섹션 헤더 graph 활용

## 옵션 B — Decision tree 라우트 분리 `/decide/[topic-id]/`
- **효과**: topic.decisionTree 단일 라우트 분리 → Q&A 페이지 ~30개 신규. FAQPage + HowTo schema 이중 적용 가능, AI 답변 엔진 인용 표적 확장
- **비용**: 라우트 1개 + topic 본문 BLUF 요약화. 빌드 +0.5s
- **위험**: topic ↔ decide 콘텐츠 중복 우려 — canonical 1:1 분리 + decisionTree 본문은 decide 라우트만 보유
- **단계**: 라우트 스캐폴드 → BLUF·BreadcrumbList·HowTo schema → topic 본문 link out → llms-full 신규 섹션

## 옵션 C — 쿼리형 라우트 `/q/[query-slug]/`
- **효과**: 사용자 검색 키워드별 단일 답 페이지. SGE/sitelink 흡수 잠재력 최대
- **비용**: queries.json 신규 + 라우트 + 50~100 페이지
- **위험**: **추측 콘텐츠 위험 최대** — thin/doorway page 패널티 가능. AGENTS.md 추측 0 원칙 위배 우려
- **단계**: GSC·llms 인용 로그에서 실제 키워드 채굴 → 데이터 → 라우트

## 권장 P0 — **옵션 A**
**근거**: Cycle #2 plan-architecture에서 P0로 명시되었으나 시점 사유로 보류된 이월 자산. 옵션 B·C의 효과도 entity-graph 있어야 정확히 증폭. 추측 0 원칙 안전, 빌드 +2s 한도 안.

**시작 step:**
1. `scripts/build-entity-graph.mjs` 스캐폴드 — 4축 getCollection 로드, 양방향 인덱스 생성, `src/data/entity-graph.json` 산출
2. `package.json` `prebuild` 훅 등록
3. `src/lib/entity-graph.ts` 타입 안전 reader (`getMentions(id)`, `getRelated(id, axis)`)
4. `scripts/schema-validate.mjs`에 graph 정합성 체크 추가
5. `CrossRefRail.astro`에 graph 주입 — 수동 prop 의존 제거

### 참조 파일
- scripts/schema-validate.mjs
- src/components/CrossRefRail.astro
- src/pages/topics/[id].astro
- src/content.config.ts
- package.json
