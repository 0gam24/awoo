# CWV — Cycle #3

## 발견
- `dist/_astro/client.Bb9RgPrt.js` = 186KB raw (≈58KB gzip) — React 18 런타임. `IncomeChecker` 1개 island만 위해 홈에서 다운로드·파싱. 본 island 코드는 5.2KB. 가시 영역 진입 시(`client:visible`) hydration 발생, 모바일 INP 측정창 안에 들어갈 가능성. 폼 상호작용 빈도 낮을 것 → ROI 검증 필요.
- `BaseLayout` `<script>import('@/lib/vitals')` Cycle #2 `requestIdleCallback` 디퍼 적용 완료. `vitals.BjeG2hGV.js` 6.1KB 별도 청크 OK.
- 홈 LCP 후보 `news-headline` 폰트는 `font-display: swap` + `Pretendard Adjusted size-adjust 100.6%` — preload 없이 fallback metric 일치로 CLS 0 유지. 현 전략 회귀 없음, 변경 X.
- Tailwind 4 `@import 'tailwindcss'` JIT 자동 purge 동작 중. 단, `IncomeChecker.astro` 등 `<style is:global>` 블록(약 440줄)은 Tailwind 외부, 항상 인라인. 사용 안 되는 ic-* 셀렉터 없음 — 모두 tsx에서 사용. purge 여지 작음.
- /quick/ HTML 133KB raw (gzip 28.1KB) — 압축률 79% 양호. stepper·persona·CATEGORIES·EVENTS UI 인라인 CSS가 대부분. JS는 `page.Dh7lx_Q1.js` 2.3KB로 매우 작음 (vanilla, React 0).
- `inlineStylesheets: 'always'` — 홈 23.5KB·평균 13.2KB 한도 마진 충분, 외부 CSS 분리 시 추가 RTT > 인라인 비용. 유지.

## 제안
1. **IncomeChecker React → vanilla 변환** (P0 후보): 5.2KB tsx + 186KB React 런타임 → 8KB vanilla TS + 0KB 런타임. /quick/ 페이지가 이미 동일 패턴(vanilla `page.Dh7lx_Q1.js` 2.3KB)으로 가구원·소득 입력 처리 중 → 같은 패턴 복제. 홈 hydration 비용 0, INP 측정창 깨끗. 회귀 위험 2 (UI 동일 재현 검증 필요).
2. **client.js 청크 자체 제거**: IncomeChecker가 유일한 React island → vanilla 전환 시 `@astrojs/react` 통합 자체를 `astro.config.mjs`에서 제거 가능. 빌드 산출물에서 `client.Bb9RgPrt.js` 186KB 사라짐. (단, MDX/issues에 React 컴포넌트 사용처 있는지 사전 확인 필수.)
3. **IncomeChecker `<style is:global>` 분리 미실행 권고**: ic-* 스타일 모두 tsx에서 사용 중, purge 여지 없음. Cycle #3 범위 외.
4. **/quick/ size 28.1KB는 한도 70KB의 40%** — 즉시 개입 불요. 차회 사이클에서 평균 페이지 65KB 도달 시 stepper·persona 카드 CSS 토큰 공통화 검토.
5. **preload critical-path 자원**: 홈 LCP h1은 system fallback 페인트 → 폰트 preload 시 LCP 후 swap 시점만 약간 앞당김, FCP 손해 가능. 현 전략 유지.

## 권장 P0
**P0-1: IncomeChecker React → vanilla TS 전환 + `@astrojs/react` 통합 제거** — 홈에서 React 런타임 186KB(gzip ~58KB) 제거. 모바일 hydration·INP 측정창 부담 사라짐. /quick/ vanilla 패턴 복제로 작업량 약 2시간. 사전 grep으로 다른 React island 부재 확인 필요. 회귀 위험 2, 빌드 size guard 영향 음수(감소). PSI Perf 점수 직접 영향은 작을 수 있으나 모바일 저성능 단말 INP 안정성 큰 개선.

P0-1 단독 실행 → Cycle #2 `requestIdleCallback` 디퍼와 합쳐 모바일 메인 스레드 부담 ~70KB JS 축소. 추가 P0 없음.
