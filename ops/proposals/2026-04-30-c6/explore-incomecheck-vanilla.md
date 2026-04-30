# IncomeChecker vanilla 본격 — Explore (3사이클 보류 끝)

## 발견 (코드 매핑)

### 현황
- **IncomeChecker.tsx** (150줄): React 컴포넌트로 useState 2개 (size, income) 기반 실시간 계산·렌더
  - 가구원 수: 1~6인 라디오 버튼 (초기 size=1)
  - 월소득: 슬라이더 (0~1000, 10단계) + 수직 텍스트 입력 양방향 동기화
  - 결과: 중위소득 % 계산 → badge 4단계 (isLow/mid/mid2/high) → eligible 필터 (0~4개 행)
  - 시각화: 색상 진행바 8개 marker + slider pin 위치 연동

- **IncomeChecker.astro** (467줄): wrapper로 client:visible + global 스타일 (모두 .ic-* 클래스)
  - 스타일 의존: slider 커스텀 thumb/track, badge background/color 4가지, bar animation

- **astro.config.mjs 라인 8, 52**: 
  - L8: `import react from '@astrojs/react'`
  - L52: `react()` integration 등록

- **package.json 라인 51~58**:
  - `@astrojs/react: 5.0.4`
  - `react: 19.2.5`
  - `react-dom: 19.2.5`
  - `@types/react: 19.2.14`
  - `@types/react-dom: 19.2.3`

- **검증 사례**: /quick/index.astro (305~366줄) — 슬라이더 + 숫자 입력 양방향, updateIncome() 함수로 동기화하는 vanilla 패턴 확인

### 번들 영향 추정
- dist/_astro/client.*.js 사라짐 (React 런타임 제거)
- 현 크기: 미측정이나 @astrojs/react 통상 ~186KB raw / ~58KB gzip

## 제안 (단계별 명세 + 검증 게이트)

### P1. IncomeChecker.tsx → IncomeChecker.astro inline script 변환
1. **state 맵핑** (2개 → 문서 변수)
   - size (number, 1~6) ← querySelector('input[name="hh-size"]:checked').value
   - income (number, 0~2000) ← querySelector('#ic-income').value

2. **계산 함수** (renderLess)
   - updateIncome(): median 조회 → pct 계산 → badge 4단계 결정 → eligible 필터 (0~4개)
   - DOM 직접 갱신 (미리 정의한 .ic-pct-num, .ic-badge 등)

3. **이벤트 리스너** (DOMContentLoaded)
   - 슬라이더 ↔ 텍스트 입력 양방향 동기화 (addEventListener input/change)
   - 가구원 수 변경 → updateIncome() 호출

4. **결과 렌더** (innerHTML)
   - .ic-badge className 동적 (low/mid/mid2/high)
   - .ic-pct-value 색상 (style={color: top?.color || var(--text-3)})
   - .ic-eligible 루프 (top 4개 항목) → li 추가/제거

### P2. CSS 유지 (0 변경)
- 기존 스타일 블록 그대로 → IncomeChecker.astro <style is:global>

### P3. 파일 정리
- IncomeChecker.tsx 삭제
- IncomeChecker.astro 유일 source (script + style inline)

### P4. 의존성 제거 (astro.config.mjs + package.json)
- L8: react import 삭제
- L52: react() 호출 삭제
- package.json: 5개 항목 제거 (@astrojs/react, react, react-dom, @types/react*, 2개)

### P5. 검증 게이트
- **빌드**: `npm run build` → dist/_astro/client.*.js 사라짐 확인
- **기능**: localhost:3000/quick 로드 → 슬라이더 좌우 → 숫자 입력 동기화 ✓
- **시각**: badge 4단계 색상 정확 (pct에 따라: red→orange→cyan→purple)
- **PSI**: 4×100 유지 (회귀 절대 X)

## 권장 P0
3사이클 보류 해제 → Cycle #6 EXECUTE P1 직진. 단독 PR (UI 재현 검증 위험 2). 푸시 X.
