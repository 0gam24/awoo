# IncomeChecker vanilla 전환 — Explore (Cycle #5 단독 진행)

## 발견

**React 컴포넌트:**
- `src/components/home/IncomeChecker.tsx` (5.2KB)
- `useState(size)` + `useState(income)` — 2개 상태
- 계산: `pct = (income / median) * 100`
- 자격: `INCOME_THRESHOLDS.filter(t => pct ≤ t.pct)`
- 배지: isLow/mid/mid2/high 4단계
- UI: 라디오 6개, 슬라이더, 텍스트 입력, 진행률 바, 적격 리스트

**Wrapper:** `IncomeChecker.astro` `<IncomeChecker client:visible />` + `<style is:global>` 468줄

**Vanilla 패턴 (참조):** `/quick/index.astro` 100% vanilla `<script is:inline>` + 동일 슬라이더↔텍스트 동기화, 점수 계산, 동적 렌더링 검증됨

**React 의존성:**
- `@astrojs/react` 5.0.4 / `react` 19.2.5 / `react-dom` 19.2.5 / `@types/react*`
- `astro.config.mjs:8,52` import + integration
- 다른 React island 0건 (grep `client:` → IncomeChecker만)

## 제안 (단계별 구현)

### Step 1: tsx → astro inline script
- React JSX → HTML 구조 + DOM 쿼리
- useState → `input.value` / `:checked` 직접 읽기
- onChange → `addEventListener('input/change')`
- style prop → `element.style.color`
- className → `classList.add/remove`

### Step 2: 상태 동기화
- 슬라이더 input event → 텍스트 동기화
- 텍스트 input event → 슬라이더 동기화
- 라디오 change event → 중위소득 재계산

### Step 3: 계산·렌더링
- 매 입력 변화마다 pct·eligible·badge 재계산
- ic-pct-num color 동적·ic-pct-value·ic-badge·ic-bar-pin·ic-eligible 업데이트

### Step 4: 빌드 정리
- `astro.config.mjs` line 8 + 52 react 제거
- `package.json` react·react-dom·@astrojs/react·@types/react* 제거

### Step 5: 검증
- 빌드 후 `dist/_astro/client.*.js` 사라짐
- 슬라이더·텍스트·라디오 상호작용 동작
- 배지 색상 4단계 정확 전환
- PSI 4×100 회귀 절대 X

## 권장 P0
**vanilla 전환 + react 의존성 제거** — /quick 패턴 동일 적용. 단독 PR 권장 (UI 재현 검증 필요). 효과: client.*.js ~186KB raw / ~58KB gzip 제거 + 빌드 시간 -1~2s + 보안 표면 감소.
