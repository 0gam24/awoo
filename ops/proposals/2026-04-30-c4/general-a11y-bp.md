# A11y / BP — Cycle #4

## 발견
- `src/components/HotkeyNav.astro` show()/hide()(47-48줄)가 `hidden` 토글만 — modal 열림 시 포커스가 트리거 위치에 잔류, Tab이 배경으로 새고 Esc 외 키보드 회수 동선 없음 (WCAG 2.4.3 Focus Order, 2.4.11 Focus Not Obscured 위반 가능).
- `src/utils/` 디렉토리 부재 — focus trap 로직을 둘 공용 위치 없음. 현재 인라인 스크립트 1곳만 존재.
- heading 검증 부재 — `scripts/`에 lint-content/schema-validate 등은 있으나 dist HTML heading 계층(h1 단일·h2→h3 순서) 게이트 없음. 이슈/페르소나 페이지가 점진 추가될수록 회귀 위험.
- skip-link은 `BaseLayout.astro:114` + `global.css:262` 마크업·스타일은 정상이나 회귀 테스트 0건 (focus 시 가시·`#main` 점프 동작이 빌드마다 보장 안 됨).

## 제안 (focusTrap + heading lint)
1. **`src/utils/focusTrap.ts` 신규** — `createFocusTrap(root, { onEscape, returnFocus })` 팩토리. tabbable 셀렉터(`a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])`), Tab/Shift+Tab wrap, Esc 콜백, activate 시 `document.activeElement` 저장 → deactivate 시 복원. 외부 의존 0.
2. **HotkeyNav 적용** — show()에서 `trap = createFocusTrap(panel)` activate + 첫 tabbable에 focus, hide()에서 deactivate. dialog role/aria-modal 이미 적용됨 — trap만 보강.
3. **`scripts/audit-headings.mjs` 신규** — `dist/**/*.html`을 `linkedom`(이미 의존성에 있을 가능성 높음, 없으면 정규식 fallback)로 파싱, 페이지당 h1=1·h2 이전 h3 금지·level skip 금지 검증. `npm run build` 후 `postbuild` 훅으로 게이트.
4. **skip-link 회귀** — Playwright 도입은 dev dep 추가지만 무게가 크므로 **vanilla 검증 스크립트 우선**: `scripts/audit-skip-link.mjs`로 dist HTML 첫 `<a>` href=`#main`·class 포함·`#main` target 존재 확인. Playwright는 #5 사이클 이후 별도 검토.

## 권장 P0
- **P0-1 focusTrap.ts + HotkeyNav 적용** (영향 큼·외부 의존 0·테스트 용이)
- **P0-2 audit-headings.mjs + postbuild 게이트** (회귀 차단·CI 비용 미미)
- **P1 skip-link audit 스크립트** (Playwright 보류, vanilla 회귀 우선)
