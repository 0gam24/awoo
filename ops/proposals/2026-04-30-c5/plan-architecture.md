# 아키텍처 옵션 3가지 — Plan (Cycle #5)

## 옵션 A — 4사이클 보류 묶음 청산 (entity-graph + inline-glossary + IncomeChecker vanilla)
- **구조**:
  1. `scripts/build-entity-graph.mjs` (prebuild, <1s) → `src/data/entity-graph.json` (120 subsidies + 30 glossary + 6 personas + 12 situations + 2 topics, 4축 역참조) → `schema-validate.mjs` dangling @id 가드
  2. entity-graph 산출물 소비 → `src/lib/inline-glossary.ts` 자동 anchor (issue/topic 본문 1회/term, 첫 등장만)
  3. `IncomeChecker.tsx` → `IncomeChecker.astro` `<script is:inline>` (이미 `/quick`에서 검증된 vanilla 패턴) → `@astrojs/react` + react/react-dom 의존성 제거
- **장점**: 4사이클 누적 보류 3건 동시 청산. 홈 페이지 React runtime ~58KB gzip 제거 → PSI/INP 직접 개선. entity-graph는 후속 모든 옵션의 기반
- **단점**: 작업 범위 넓음 — 단일 PR 시 회귀 표면 큼. 단계 분리 필요
- **빌드 영향**: prebuild +1s, React 제거 -1~2s → 순감소 가능

## 옵션 B — Schema 채널 신규 3개 (HowTo + WebApplication + DefinedTermSet)
- **구조**:
  1. `HowToSchema` → `/guide` 신청 절차 + `subsidies/[id]` step 4개 이상
  2. `WebApplicationSchema` → `/quick` (applicationCategory: FinanceApplication)
  3. `DefinedTermSet` → `/glossary/` 인덱스 (30 term, inLanguage: ko)
- **장점**: Google rich result 신규 채널 3개. 정적 schema → 빌드 영향 +0.1s
- **단점**: HowTo는 step 4개 이상·image 권장 → gov24 110건 중 step 부족 자료 다수 추정 (선별 필요). HowTo desktop 노출 축소 사례
- **빌드 영향**: +0.5s 미만

## 옵션 C — 사이트맵 priority 동적화 (Algorithmic SEO)
- **구조**: `compute-link-graph.mjs` (prebuild) → 모든 내부 링크 스캔 → incoming count 기반 동적 priority (log scale)
- **장점**: 사이트 내부 링크 그래프 기반 SEO 신호 정밀화
- **단점**: Google이 sitemap priority를 사실상 무시 (2017+ 공식 입장). ROI 약함
- **빌드 영향**: +1.5s

## 권장 P0 — **옵션 A (단계 분리 실행)**

**근거:**
1. 4사이클 누적 보류 3건이 옵션 A에 집결 — Cycle #5에서 청산하지 않으면 Cycle #6 PLAN에 동일 항목 재등장
2. entity-graph는 옵션 B·C의 전제 자산 — A 선행 시 후속 사이클이 더 작은 표면적
3. IncomeChecker vanilla는 PSI/INP 직접 개선 + 보안 표면 감소 + 빌드 시간 감소
4. 옵션 B는 데이터 품질 검증(step 4개 이상 subsidies) 선행 필요 → Cycle #6
5. 옵션 C는 Google priority 무시 정책상 ROI 약 → Cycle #7+ 또는 LLM 우선순위 가중치로 재정의

**실행 순서 (P0 분리, 회귀 표면 최소화):**
1. **P0-1**: `scripts/build-entity-graph.mjs` 신규 + `package.json` build 스크립트 prebuild + `schema-validate.mjs` dangling @id 가드 (UI 무영향, 빌드 +1s)
2. **P0-2**: IncomeChecker vanilla 전환 → astro.config react 제거 → react·react-dom·@astrojs/react·@types/react* 제거 (PSI 4×100 회귀 검증 후 머지)
3. **P0-3**: inline-glossary 자동 anchor — entity-graph 산출물 소비, issue/topic 본문 한정, term별 첫 등장만 1회. 빌드타임 변환 (런타임 JS 0)

**빌드 시간 수지**: prebuild +1s, React 제거 -1~2s → 순감소 또는 0 (한도 +2s 안전).

### Critical Files
- scripts/schema-validate.mjs
- src/components/home/IncomeChecker.tsx
- astro.config.mjs / package.json
- src/pages/quick/index.astro (참조 패턴)
