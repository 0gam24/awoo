# A11y / BP — Cycle #2

## 발견
- `HotkeyNav.astro`: `role="dialog" aria-modal="true"` 선언했지만 focus trap·초기 포커스·복귀 포커스 모두 부재. `?` 토글 시 키보드 사용자가 모달 뒤 본문으로 Tab 빠져나감 → WCAG 2.4.3(focus order)·2.4.11(focus not obscured) 미준수 가능.
- `src/utils/` 디렉터리 비어 있음 — 재사용 유틸 신규 추가 부담 없음.
- `public/_headers`: CSP enforce 1줄만 송출. Report-Only 동시 송출·report-uri 미설정 → `unsafe-inline` 잔존을 측정할 자가관측 채널 없음.
- `src/pages/api/`: contact·feedback·vitals·health 패턴 확보 — 동일 origin `/api/csp-report` 추가 진입장벽 0.
- heading hierarchy·skip-link 회귀 게이트 부재(빌드 시 검증 X).

## 제안
- **P0-A**: `src/utils/focusTrap.ts` 신규 — `trap(container, {onEscape, returnFocus})` 시그니처. tabbable 셀렉터·Shift+Tab 양방향 wrap·sentinel 노드 X(쿼리 기반). `HotkeyNav` show()에서 활성화·hide()에서 해제+이전 포커스 복귀.
- **P0-B**: `_headers`에 `Content-Security-Policy-Report-Only` 동시 송출(`unsafe-inline` 제거판) + `report-uri /api/csp-report`. `src/pages/api/csp-report.ts`는 `application/csp-report` 파싱 후 console.warn만(KV·외부 X). 외부 의존 0, 격리 충족.
- **P1**: `scripts/audit/heading-hierarchy.mjs` — dist HTML 파싱해서 h1 단일·level skip 0 검증, `pnpm audit:headings` 빌드 게이트.
- **P2**: `prefers-contrast: more` 토큰 — `--border`·`--text-2` 대비 강화 분기 1블록.
- **P2**: skip-link `:focus-visible` 가시화 회귀 — Playwright 1 케이스(Tab 1회 후 좌상단 노출).

## 권장 P0
**focus trap 유틸 + HotkeyNav 적용** (P0-A) 1건. 효과 확실(키보드 사용자 실차단 해소)·범위 좁음(파일 2개)·PSI 영향 0(런타임 ms 단위)·롤백 단순. CSP report-only(P0-B)는 동일 사이클 묶음 가능하나 `unsafe-inline` 제거 후보 식별까지 1주 관측 필요 → 별도 진행 권장. P1·P2는 Cycle #3 이월.
