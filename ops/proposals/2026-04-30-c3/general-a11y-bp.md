# A11y / BP — Cycle #3

## 발견
- `src/components/HotkeyNav.astro` show()/hide() (47–48줄)는 `hidden` 토글만 — focus trap·이전 포커스 복귀·Tab 순환 모두 부재. WCAG 2.4.3 Focus Order, 2.4.11 Focus Not Obscured 위반 가능. 모달이 열려도 배경 컨텐츠로 Tab이 빠져나간다.
- `src/utils/` 디렉토리 자체가 없음 — 신규 생성 필요.
- `src/pages/api/`에 vitals·health·contact·feedback만 존재. CSP 리포트 엔드포인트 없음.
- `aria-modal="true"` + `role="dialog"` 마크업은 이미 정확. 트랩만 붙이면 됨.
- P0-7 FAQ `<details>`는 네이티브 키보드 처리 OK — 별도 작업 불필요.

## 제안 (focusTrap 유틸 + 적용)
1. **`src/utils/focusTrap.ts` 신규** — `createFocusTrap(root: HTMLElement)` 팩토리. 셀렉터 `a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`. `activate()`는 `document.activeElement` 저장 후 첫 노드 포커스, Tab/Shift+Tab keydown으로 first/last wrap, Esc는 옵션 콜백. `deactivate()`는 리스너 해제 + 저장된 노드 복귀.
2. **HotkeyNav 적용** — script 상단에서 dynamic import (`const { createFocusTrap } = await import('../utils/focusTrap')`) 또는 정적 import. show()에서 `trap.activate()`, hide()에서 `trap.deactivate()`. 기존 Esc 핸들러는 trap의 onEscape에 위임.
3. **`src/pages/api/csp-report.ts` 신규** — POST report-only 수신, `console.warn(JSON.stringify(report))`만. KV 의존 없음. Cloudflare adapter `export const prerender = false`.
4. **heading lint** — `scripts/audit/heading-hierarchy.mjs` h1 단일·h2→h3 순서 검증, `npm run audit:headings`를 빌드 직전 추가.
5. **Playwright skip-link 회귀** — `tests/e2e/skip-link.spec.ts` 1케이스: Tab 첫 입력시 skip-link 가시 + Enter로 `<main>` 포커스.

## 권장 P0
- **P0-A11y-1**: focusTrap.ts + HotkeyNav 적용 (WCAG AA 게이트)
- **P0-A11y-2**: csp-report.ts (report-only, console만)
- **P0-A11y-3**: heading-hierarchy 빌드 게이트 + skip-link Playwright 회귀
