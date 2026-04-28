---
name: Design source
description: Claude Design (claude.ai/design) 핸드오프 번들 — 프로토타입 vs 실구현 차이
type: project
originSessionId: 6e3a0917-3f3b-4e4a-b07e-5a89395fc854
---
01_지원금가이드/project/ 폴더는 Claude Design에서 export한 HTML/CSS/JS 프로토타입. 실제 코드 아님 — 디자인 시안.

**프로토타입 구성** (총 6,738 라인):
- index.html (2,262) — 인라인 CSS + Babel CDN React UMD 로더
- styles.css (2,291), screens.jsx (969), data.jsx (455), components.jsx (175), app.jsx (86), icons.jsx (75), tweaks-panel.jsx (425)
- 5개 화면: home / issue / browse / detail / guide

**실구현 시 폐기 대상**:
- ❌ tweaks-panel.jsx + EDITMODE-BEGIN/END 마커 (디자인 도구 전용)
- ❌ Babel-in-browser, window 전역 등록 패턴
- ❌ index.html 인라인 CSS 2,262줄

**이식 대상**:
- ✅ :root 디자인 토큰 (Apple-inspired: --blue #0071e3, --bright-blue #2997ff, 9단계 타입스케일, 라운드 5/8/12/18/28/36/980)
- ✅ 컴포넌트 시각/레이아웃, IncomeChecker 계산 로직, 데이터 모델
- ✅ 다크/라이트 모드 [data-theme] 패턴

**Why:** 프로토타입을 그대로 실코드 취급하면 안 됨 — README가 명시적으로 "픽셀 단위 재현이 목표, 내부 구조 복사 금지"라고 함.

**How to apply:** 실코드는 Astro+React Islands로 새로 작성. 시각 결과만 1:1 매칭. tweaks-panel·EDITMODE는 첫 부트스트랩부터 제외.
