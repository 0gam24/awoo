# 아키텍처 옵션 3가지 — Plan (Cycle #2)

## 옵션 A — Cycle #1 자산 횡전개 (저위험·점진형)
- BlufBox 미적용 hub 4곳 확장: `glossary/index`, `subsidies/index`, `subsidies/category/[c]/persona/[p]`, `quick/index` (현재 4 hub → 8개로 2배). subsidies-meta.ts 자동 카운트로 추측 0
- Org @id 참조 강화: `subsidies/[id].astro`의 `GovernmentService.provider`를 `{"@id": "/#organization"}` 참조로 전환. NewsArticle.publisher(issues)도 동일 패턴
- `buildBreadcrumb`/`buildCollectionPage` 미사용 라우트 감사 후 일괄 적용
- 빌드 영향: 컴포넌트·헬퍼 재사용이라 +0.3s 이내. 홈 KB 0 증가
- 한계: 신규 키워드·rich result 슬롯 0. SEO 곡선 평탄화 위험

## 옵션 B — 신규 schema·세부 라우트 (중위험·rich result 확장)
- `subsidies/[id]` FAQPage schema + 본문 H2 "rejectionReasons"·"FAQ" 자동 생성 (content collection 필드 추가, 미정의 시 skip)
- `glossary/[id]`에 `DefinedTerm` + `DefinedTermSet` schema (기존 Article 위에). `inDefinedTermSet: /glossary/#set` @id 참조 → entity graph 씨앗
- `topics/[id]`에 `HowTo` schema 후보 평가 (절차형 토픽만, 추측 금지 가드)
- 빌드 영향: 220 페이지 schema 직렬화 추가 → +0.5~1.0s 추정. KB는 page-local이라 홈 무영향
- 한계: content collection 스키마 변경 시 대규모 lint·검증 필요. Cycle #1 보류분 4건 중 2건 직접 해결

## 옵션 C — Entity-graph 정적 인덱서 (고가치·구조 변화)
- `scripts/build-entity-graph.mjs`: glossary↔topic↔subsidy↔persona 4축 정적 인덱스 → `src/data/entity-graph.json`
- 라우트 0 추가 (제약 준수). 활용처: CrossRefRail · inline-glossary 자동 anchor · llms-full.txt 섹션 헤더
- @id 참조 그래프: 각 entity의 `mentions·about·isPartOf`를 schema.org 절대 URL @id로 교차 연결
- 빌드 영향: 인덱서 +1~2s, 220 페이지 빌드는 lookup으로 영향 미미
- 한계: 초기 투자 크지만 Cycle #1 보류 4건 중 3건(entity-graph·inline-glossary·llms 강화)을 한 번에 해소

## 권장 P0
**옵션 C (entity-graph 정적 인덱서)** — Cycle #1 plan-architecture가 명시한 보류 P0 자산. 옵션 A·B의 후속 효과 모두 증폭.

**시작 step:**
1. `scripts/build-entity-graph.mjs` 스캐폴드 — `getCollection('glossary'|'topics'|'subsidies'|'personas')` 4축 로드, `mentions·relatedTerm` 양방향 인덱스 생성, `src/data/entity-graph.json` 산출
2. `package.json` `prebuild` 훅에 인덱서 추가 (Astro getStaticPaths 이전 실행 보장)
3. `src/lib/entity-graph.ts` 타입 안전 reader (`getMentions(id)`, `getRelated(id, axis)`)
4. `scripts/schema-validate.mjs`에 graph 정합성 체크 추가 (dangling @id 0건). 빌드 시간 +2s 한도

### 참조 파일
- src/lib/schema.ts
- scripts/schema-validate.mjs
- src/pages/subsidies/[id].astro
- src/components/CrossRefRail.astro
- package.json
