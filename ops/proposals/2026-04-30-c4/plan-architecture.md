# 아키텍처 옵션 3가지 — Plan (Cycle #4)

## 옵션 A — entity-graph + inline-glossary 묶음
- **구조**: `scripts/build-entity-graph.mjs` (prebuild) → `src/data/entity-graph.json` (120 entity × 4축 역참조) → `schema-validate.mjs`에 dangling @id 가드 추가 → 후속 inline-glossary 자동 anchor (issue/topic 본문 glossary term 자동 링크)
- **장점**: 누적 자산(120 subsidies + 30 glossary + topics/personas/situations)을 첫 통합 활용. PSI 영향 0. 빌드 +1초
- **단점**: 사용자 가시성 낮음 — 단기 트래픽 임팩트 약함. UI 노출(CrossRefRail 자동화)은 별도 P1

## 옵션 B — HowTo schema 확장
- **구조**: `src/components/schema/HowToSchema.astro` 신규 → `/guide`, `/quick`, `subsidies/[id]` 신청 절차에 step 배열 주입
- **장점**: Google rich result 신규 채널. 검색 노출 직접 효과
- **단점**: subsidy 신청 절차 데이터 품질 검증 필요 (gov24 110건 중 step 누락 다수 추정) — 데이터 캡처 선행. step 4개 미만이면 rich result 미노출

## 옵션 C — i18n 영문 hub `/en/`
- **구조**: 핵심 5~8 페이지 영문 stub + hreflang alternate
- **장점**: 외국인 노동자·동포 트래픽 흡수 가능성
- **단점 (치명)**: 정책 본문 LLM 번역하면 사실 추측 위험 — `editorial-policy`(일차 출처 원칙)와 충돌. 비영리 신뢰성 손상 리스크. 빌드 +3~5s 예상 (한도 +2s 초과)
- **권장하지 않음**

## 권장 P0 — **옵션 A**

**근거:**
1. Cycle #3 보류 항목 직결 (entity-graph + inline-glossary 본격)
2. 빌드 시간 예산 안전 (+1s ≤ +2s 한도)
3. PSI 4×100 무영향
4. 누적 자산(24 P0)을 처음 횡단 통합 — Cycle #5+ 기반
5. 옵션 B는 데이터 캡처 선행 후 Cycle #5 진행 권장
6. 옵션 C는 신뢰성 리스크로 보류

**시작 step:**
1. `scripts/build-entity-graph.mjs` (prebuild, <1s)
2. `schema-validate.mjs`에 dangling @id 가드
3. `inline-glossary` 자동 anchor (entity-graph 산출물 소비, issue/topic 본문 한정)

### 참조 파일
- scripts/build-entity-graph.mjs (신규)
- scripts/schema-validate.mjs
- package.json
- src/lib/entity-graph.ts (신규)
- src/components/CrossRefRail.astro
