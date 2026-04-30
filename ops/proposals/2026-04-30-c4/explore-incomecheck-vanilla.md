# IncomeChecker vanilla 전환 — Explore

## 발견 (React 의존 위치 + /quick 패턴 비교)

**React 유일성 확인:**
- 1개 island만 존재: `src/components/home/IncomeChecker.tsx` (React 18, 5.2KB)
- `IncomeChecker.astro` wrapper: `client:visible` directive 적용 (스크롤 진입 시만 hydration)
- 다른 React 도입처 ZERO — `client:visible|client:load|client:idle|client:only` grep → 1건만 매칭
- React runtime 부담: `dist/_astro/client.*.js` ~186KB raw / ~58KB gzip — 홈 페이지 전용

**Vanilla 패턴 이미 검증됨:**
- `/quick/index.astro` 페이지 레벨 — 동일 UI(가구원·소득 입력) 100% vanilla `<script is:inline>` 구현
- 인터랙션 복잡도 유사: 슬라이더↔수치 양방향 동기화, 상태 업데이트, 동적 렌더링
- 번들 증명: /quick은 2.3KB inlined vanilla로 처리 (React 없이도 가능)

## 제안 (단계별 구현)

### 1. Astro + vanilla TS로 변환 (5.2KB 유지)
- useState → DOM 직접 조작 (getElement, .value, classList)
- useEffect → DOMContentLoaded + event listeners
- style prop → classList toggle & CSS variables

### 2. 구조 유지 (스타일·계산 로직 그대로)
- `IncomeChecker.astro`: 마크업 + inline script
- CSS: `:global` 스타일 그대로 (이미 Astro 호환)
- INCOME_THRESHOLDS / MEDIAN_INCOME: frontmatter import

### 3. 테스트 (PSI 회귀 차단)
- 빌드 후 dist 확인: `client.*.js` 사라짐
- 홈 페이지 스크롤 진입 후 슬라이더 조작 동작 확인
- badge 색상 변화 (isLow/mid/mid2/high) 재현 검증

### 4. 패키지 정리 (1주차 이후)
- `@astrojs/react` integration 제거 (`astro.config.mjs`)
- `react` / `react-dom` / `@types/react*` 의존성 제거 (`package.json`)

## 권장 P0 (위험 평가 + 우선순위)

**위험 LOW:**
- 단일 island → 회귀 범위 매우 좁음
- /quick 패턴 이미 프로덕션 (vanilla 작동 증명)
- 스타일 zero-change

**효과:**
- 홈 페이지 React 런타임 ~58KB gzip 제거
- 모바일 hydration·INP 측정창 부담 사라짐
- 빌드 size guard 영향 음수 (감소)

**차단 조건:**
- PSI 4×100 유지 (회귀 시 롤백)
- 폼 UI 정확성 (모든 input 동기, badge 색상 변화)

**P0 권장**: vanilla 전환 + @astrojs/react 제거 + react·react-dom 의존성 제거 — 단독 PR로 진행.
