# IncomeChecker vanilla 단독 PR — Explore (4사이클 보류 청산)

## 발견 (코드 매핑 — 라인별)

### React 컴포넌트 구조 (IncomeChecker.tsx)
- **상태 관리** (L7-8): `useState(size: 1)`, `useState(income: 250)` — 가구원·월소득
- **계산 로직** (L10-22): 중위소득 % 계산 → badge 분류 (4단계: low/mid/mid2/high) → eligible 필터링
- **렌더 구조** (L24-146):
  - 좌측 입력: 라디오 (SIZES 1~6) + 슬라이더·텍스트 입력 양방향 동기화 (onChange)
  - 우측 결과: % 수치 + 색상 선택 → 바 트랙 (INCOME_THRESHOLDS tick) + 핀 위치 → eligible 리스트 (최대 4개)

### 데이터 의존성 (site-data.ts)
- **MEDIAN_INCOME**: Record<1~6, 239~808> — 2026년 중위소득 (L8-15)
- **INCOME_THRESHOLDS**: 8개 threshold 배열 — pct(30/40/.../150) → name/color/desc (L24-48)

### Astro wrapper (IncomeChecker.astro)
- L3: `import { IncomeChecker }` — React 컴포넌트
- L19: `<IncomeChecker client:visible />` — 하이드레이션 (클라이언트 JavaScript 주입)
- L30-467: 모든 CSS 스타일 `:global` — React 섬 내부 스타일 적용

### vanilla 패턴 (quick/index.astro)
- L305-366: 슬라이더 ↔ 텍스트 입력 양방향 동기화 (event listener)
- L340-366: `updateIncome()` — 가구원 수 변경 시 중위소득 % 재계산 및 tier 레이블 업데이트
- L363-365: 라디오 변경 리스너 등록
- 방식: DOMContentLoaded 후 `querySelector` 직접 조작 + `innerHTML` 동적 렌더

## 제안 (단계별 실행)

### 단계 1~2: 슬라이더·텍스트 입력 양방향 동기화 (복사·검증)
quick/index.astro L340-366 패턴을 IncomeChecker.astro `<script is:inline>` 이동
- `[data-income-slider]`, `[data-income-input]` DOM 셀렉터 유지
- `getIncome()`, `updateIncome()` 함수 그대로
- 라디오 변경 → `updateIncome()` 콜백 등록

### 단계 3: 가구원 라디오 + 중위소득 % + tier badge 렌더
- HTML: `<input type="radio" name="hh-size" value="1" checked>` 재사용
- JS: 계산 로직 (IncomeChecker.tsx L10-22 포팅)
  - `pct = Math.round((income / median) * 100)`
  - badge 4단계 (isLow, pct≤75/≤100, else) → className 동적 할당
  - `.ic-badge` 텍스트·배경색 변경

### 단계 4: 중위소득 % 바 트랙 + 핀 위치 계산
- HTML: `.ic-bar-track` 내 tick + pin 구조 유지 (L94-115)
- JS: tick/pin `style.left` = `pct / 1.5 %` 계산
  - INCOME_THRESHOLDS 배열 루프 → `<div class="ic-bar-tick">` 생성 (innerHTML)

### 단계 5: eligible 리스트 동적 렌더 (innerHTML)
- JS: `eligible = INCOME_THRESHOLDS.filter(t => pct <= t.pct).slice(0, 4)`
- HTML 문자열 생성 → `.ic-eligible` `innerHTML` 할당 (IncomeChecker.tsx L127-137 구조)

### 단계 6~9: 파일 삭제 + 빌드 검증
1. `src/components/home/IncomeChecker.tsx` 삭제
2. `astro.config.mjs` L8,52: `import react` + `react()` 제거
3. `package.json`: `@astrojs/react`, `react`, `react-dom`, `@types/react*` 4개 의존성 제거
4. `npm install` → `npm run build`
5. `dist/_astro/client.*.js` 검증 (제거됨 확인)
6. PSI 4×100 회귀 X
7. 수동 테스트: 슬라이더·텍스트·라디오 상호작용 + badge 색상 변화 + eligible 리스트 업데이트

## 권장 P0

- **회귀 위험 2/5**: UI 재현·상호작용 (슬라이더/라디오/텍스트 동기화) — quick/index.astro 패턴 검증됨
- **CSS 유지**: 모든 `.ic-*` 클래스 그대로 (Astro `:global` 스타일 재사용)
- **데이터 주입**: `INCOME_THRESHOLDS`, `MEDIAN_INCOME` `define:vars` 또는 `<script>` 내 하드코딩
- **번들 절감**: react 라이브러리 ~186KB raw / ~58KB gzip 완전 제거 확인 필수

---

**결론**: 4사이클 보류 청산. vanilla TS inline `<script>` 마이그레이션 → 단독 PR (quick/index.astro 패턴 재사용으로 저위험).
