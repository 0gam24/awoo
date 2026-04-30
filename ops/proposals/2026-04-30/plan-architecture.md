# 아키텍처 옵션 3가지 — Plan

## 옵션 A: hub 임계값/조합 완화 (재조합)
- **효과**: `subsidies/category/[c]/persona/[p]/` 4×7=28 외에 `situation×category` (12×7=84), `persona×situation` (6×12=72) 신규 cross-ref. ≥2 매칭 필터로 30~50개 실효 페이지. long-tail "출산 + 의료" 류 쿼리 흡수
- **비용**: getStaticPaths 2개 추가, SSG 빌드 +5~8초 (현재 ~119 subsidy). 카피 템플릿 1종 재사용
- **회귀 위험**: 중복 콘텐츠 → canonical/noindex 정책 필요. PSI는 정적이라 영향 0
- **Step**: (1) `/situations/[s]/category/[c].astro` 추가 (2) ≥2 매칭만 generate (3) personas hub에 역링크

## 옵션 B: 새 schema/라우트 — `/guides/[slug]` Q&A 허브
- **효과**: 토픽보다 좁은 "질문형 가이드" (예: "월세지원 부모소득 초과시"). decisionTree 단일 분기 깊이 추출 → 30~60 페이지. Google AI Overviews / GEO 인용 적합 (Q→A 명시)
- **비용**: 신규 collection `guides` (zod schema: question/answer/relatedSubsidy/relatedTopic/glossaryRefs), 라우트 1개, 빌드 +10~15초. 카피 1차 작성 부담 큼
- **회귀 위험**: topic과 의미 중복 → 정보 아키텍처 분리선(토픽=종합, 가이드=단일Q) 사전 합의 필수
- **Step**: (1) schema 정의 (2) topic decisionTree에서 seed 20개 추출 (3) `/guides/index` + sitemap

## 옵션 C: entity-linking 강화 (glossary↔topic↔subsidy 상호참조)
- **효과**: 기존 라우트 0 추가, 빌드 영향 0. glossary `related` 역색인 + topic·subsidy 본문 자동 mention 추출 → 각 페이지에 "이 페이지에서 언급된 용어 / 관련 지원금" 모듈. internal link density 2~3배, GEO entity-coverage 점수 직접 기여
- **비용**: 빌드 시 정적 인덱서 1개 (`src/lib/entity-graph.ts`), 컴포넌트 1개. 카피 변경 없음
- **회귀 위험**: 누락된 backlink 노출 시 신뢰 하락 → 빌드 시 "고아 용어" 리포트 필수
- **Step**: (1) `src/lib/entity-graph.ts` 정적 인덱서 (glossary `related` + synonym 매칭) (2) `<EntityMentions>` 컴포넌트 글로/토픽/서브시디 페이지 주입 (3) ops/observations에 backlink coverage 리포트

## 권장 P0
**옵션 C** — 라우트 0·빌드 영향 0·PSI 영향 0이면서 119 subsidy + 토픽 + 글로 모두에 즉시 entity 신호 부여.

시작 step: `src/lib/entity-graph.ts`에 glossary `related` + synonym 매칭 기반 정적 mention 인덱서 구현 → topic 상세 페이지 하단에 "언급된 용어 N개" 섹션 1차 적용.

### 참조 파일
- `src/data/glossary.json`
- `src/data/topics.json`
- `src/pages/topics/[id].astro`
- `src/pages/subsidies/[id].astro`
- `src/pages/subsidies/category/[category]/` (cross-ref 패턴)
