# entity-graph 본격 구현 — Explore

## 발견 (현재 상태 + 활용 가능 자원)

**현황:**
- glossary.json (30건) + topics.json (2건) + personas.json (6건) + situations.json (12건) + subsidies (120건: 10 curated + 110 gov24) 모두 단독 JSON 파일
- 데이터 간 관계: `related[]`(glossary), `relatedSubsidyKeywords[]·relatedGlossary[]·mainPersonas[]·mainSituations[]`(topics), `tags[]·targetPersonas[]`(subsidies) — 모두 **문자열 ID 기반**
- schema.ts에서 @id 절대 URL 명시(Organization/#organization 참조), 다만 **entity 간 @id 역참조 없음**
- schema-validate.mjs는 현재 JSON-LD 무결성만 점검 (null literal·필드 존재 확인), dangling @id 감지 X
- 빌드 hook: package.json "build" = "astro build && node scripts/check-bundle-size.mjs" (2초 이내 PSI 유지)

**활용 자원:**
- astro.config.mjs 내 `slugToLastmod` 맵 패턴 — 정적 빌드타임 단계 존재
- script 관례: fs read + JSON.parse → 정적 메타 산출 (sync-subsidies.mjs, sweep-stale.mjs 등)
- Zod (package.json 기재) — 스키마 검증 가능

## 제안 (구체 구조 + 빌드 hook + 단계)

**1단계 (P0):** build-entity-graph.mjs 신규
- 입력: src/data/{glossary,topics,personas,situations,subsidies}.json
- 출력: src/data/entity-graph.json (각 entity의 @id + mentions[]·about[]·isPartOf[] 역참조)
- 로직: ID 수집 → 관계 해석(related/relatedGlossary/tags/targetPersonas 등을 @id 뷰로 변환) → dangling @id 검출

**2단계 (P1):** astro.config.mjs에 prebuild hook 또는 package.json에 "prebuild" 스크립트
- npm run build 호출 시 자동 실행되도록 package.json "build" 수정: "prebuild && astro build && node scripts/check-bundle-size.mjs"

**3단계 (P2):** src/lib/entity-graph.ts 타입 안전 reader
- export function loadEntityGraph(): Map<string, Entity> — getCollection 외부에서도 사용 가능
- 지선 활용: sidebar/nav 자동 생성 또는 "관련 주제" 동적 주입

## 권장 P0 (1~2단계)

**P0-1:** build-entity-graph.mjs 작성
- 로직: 120개 entity ID 수집 → 4축 관계 해석 → JSON 산출
- 시간 예상: <1초 (단순 fs read·JSON parse·loop)

**P0-2:** schema-validate.mjs에 dangling @id 가드 추가
- 기존 검증에 +1 항목: entity-graph.json 로드 → mentions/about/isPartOf의 모든 @id가 실제 entity에 존재하는지 확인
- Fail: process.exit(1) 동일 (빌드 fail)

**선택 P1:** package.json "build"에 "prebuild" 추가 (또는 astro integration으로 후행)
- 현재 astro build 단계 이미 정적 파일 처리 안정적 → integration 추가는 선택사항

---
최소 침투: P0-1·P0-2만으로 entity-graph.json 정적 인덱서 완성. 120개 entity + 4축 관계 무결성 보장.
