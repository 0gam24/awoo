# A11y / BP — Cycle #5

## 발견
- BaseLayout.astro 116행: `<a href="#main" class="skip-link">본문으로 건너뛰기</a>` + `<main id="main">` 구조 정상. global.css 262–276행에 `.skip-link` (top: -100px → focus 시 top: 16px) 가시화 처리. 단, 회귀 차단 자동화 부재 — 마크업 순서·class·target id 변경 시 침묵 회귀 가능.
- audit-headings.mjs는 `process.exit(0)` 고정 (warn 모드). 218 페이지 위반 0 데이터 확보됨 — strict 전환 안전.
- global.css에 `prefers-contrast: more` 미디어쿼리 부재. WCAG 1.4.6 (AAA) 옵트인 사용자 대응 누락.
- focusTrap은 `src/utils/focusTrap.ts`로 일반화되어 HotkeyNav만 소비 — 향후 모달/팔레트 재사용 가능 자산.
- `_headers` CSP는 `unsafe-inline` 잔존 (P2 nonce 마이그 보류 유지 합의).

## 제안
1. **scripts/audit-skip-link.mjs** 신규 — dist HTML에서 `<body>` 첫 자식 `<a>` 추출, `href="#main"` + `class~="skip-link"` + `id="main"` target 존재 3종 검증. 218페이지 sweep, 위반 시 exit 1 (strict from day 1: 현재 마크업 일관성 확인됨).
2. **prefers-contrast: more** 토큰 오버라이드 추가 — `--text-2`를 `--color-gray-1` 수준으로 승격, `--border`를 `--border-2`로 치환, focus ring 굵기 +1px. light/dark 양쪽 분기 모두.
3. **audit-headings.mjs strict 전환** — `process.exit(violations > 0 ? 1 : 0)`. Cycle #4 데이터(위반 0) 근거. postbuild npm script에 체이닝.
4. focusTrap 재사용은 현재 모달 자산 부재 — 보류 (제안만, P2+).

## 권장 P0
- **P0-1**: audit-skip-link.mjs + npm run audit:a11y 통합 (skip-link + headings 합본). 회귀 게이트 강화.
- **P0-2**: prefers-contrast: more 토큰 추가 (global.css). WCAG 1.4.6 옵트인 대응, PSI 영향 0.
- **P0-3**: heading audit strict 전환 (warn → error). 빌드 게이트 회귀 차단.
