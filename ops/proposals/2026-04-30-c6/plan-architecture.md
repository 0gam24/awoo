# 아키텍처 옵션 3가지 — Plan (Cycle #6)

## 옵션 A — entity-graph 첫 활용 묶음 (inline-glossary + dangling 정정 + llms-full categories)
- **구조**:
  1. `src/lib/inline-glossary.ts` 신규 — entity-graph 30 glossary 소비, issue/topic 본문 빌드타임 변환, term별 첫 등장 1회 anchor (`<a href="/glossary/[id]/">`), 런타임 JS 0
  2. glossary related[] dangling 8건 정정 — entity-graph stats 활용
  3. llms-full categories 섹션 확장 — entity-graph categories 인덱스 (commonEligibility + 매칭 subsidy 수)
- **장점**: Cycle #5 산출 entity-graph 본격 소비 → 자산 ROI 최대화. 5사이클 누적 보류 1건 청산. 빌드타임 anchor → PSI 무영향
- **단점**: inline-glossary 변환 정규식 본문 토큰화 정확도 검증 필요 (HTML 태그 내부 회피)
- **빌드 영향**: +0.8s (한도 +2s 안)

## 옵션 B — IncomeChecker vanilla 단독 PR
- **구조**: IncomeChecker.tsx → IncomeChecker.astro inline script (vanilla TS) → @astrojs/react integration 제거 → react·react-dom·@types/react* 의존성 제거 → 검증
- **장점**: 홈 -186KB raw / -58KB gzip 라이브러리 즉시 제거. INP/PSI 직접 개선. 의존성 보안 표면 감소. 단일 PR 회귀 표면 좁음
- **단점**: 다른 React 컴포넌트 잔존 시 integration 제거 불가 (사전 grep 필요 — Cycle #5 explore에서 0건 확인됨)
- **빌드 영향**: -1~2s 순감소

## 옵션 C — /subsidies data-attr 통합 + 추가 schema 보강
- **구조**: /subsidies/index 카드 5 attr → 1 JSON `data-sort` 통합(-3KB gzip) + mainEntityOfPage (subsidy 119) + DefinedTermSet @id 정규화
- **장점**: CWV(LCP/CLS) 개선 + schema canonical 강화로 GEO 품질 상승
- **단점**: 카드 통합 회귀 표면 큼 — sort UI 동시 수정. schema 변경 ROI 점진적
- **빌드 영향**: +0.3s

## 권장 P0 — **옵션 A (entity-graph 첫 활용)**

**근거:**
1. Cycle #5에서 산출한 entity-graph가 소비되지 않으면 자산 가치 0 — 즉시 활용이 ROI 최대
2. inline-glossary는 5사이클 누적 보류 → Cycle #7 재등장 차단
3. 빌드타임 변환 → PSI 4×100 안전, 한도 +2s 안전
4. 옵션 B는 IncomeChecker vanilla 단독 PR로 본 사이클 P1 또는 별도 진행 권장
5. 옵션 C 카드 통합은 회귀 표면 큼 → 단일 PR로 분리

**실행 순서:**
- **P0-1** `src/lib/inline-glossary.ts` 신규 + topics/[id] longDef·subsidies/[id] eligibility 본문 적용
- **P0-2** glossary related[] dangling 8건 정정 (콘텐츠 변경)
- **P0-3** llms-full categories 섹션 확장 (+~6KB)

### 참조 파일
- src/data/entity-graph.json
- scripts/build-entity-graph.mjs
- src/data/glossary.json
- src/pages/llms-full.txt.ts
- src/pages/subsidies/[id].astro / topics/[id].astro
