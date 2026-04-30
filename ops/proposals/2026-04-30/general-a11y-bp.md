# A11y / Best Practices — general-purpose

## 발견
- CSP에 `script-src 'unsafe-inline'`·`style-src 'unsafe-inline'` 잔존 — Astro 인라인 스타일·테마 부트스트랩 의존. nonce 전환 미적용.
- `Reporting-Endpoints`/`Report-To` 헤더 부재 — CSP/COOP violation 자가관측 채널 없음(외부 의존 제약 하에 동일 origin `/api/csp-report` 활용 여지).
- `HotkeyNav` 모달: `role=dialog`·`aria-modal` 정확하나 **focus trap·초기 포커스·복원 미구현** — 키보드 사용자가 Tab 이탈 시 배경으로 빠짐.
- `FeedbackWidget` 라벨링 양호(`aria-labelledby`·`role=status/alert`·`sr-only` for textarea), honeypot `aria-hidden` OK.
- Heading: 다수 페이지가 h1 단일 보장. `404`·`subsidies/[id]` 등 h2 7건 사용처는 hierarchy 회귀 가능 영역.
- 다크모드 `--text-3 #86868b on #000` ≈ 5.5:1 (AA Normal 통과), `--text-2 #a1a1a6` ≈ 9.1:1 — 안전.
- 카테고리 토큰 `--cat-자산 #0891b2` 라이트모드 4px 좌측 바 한정 사용은 텍스트 전경 아니므로 대비 비대상.

## 제안
1. **CSP nonce 전환 (P1)**: Astro 인라인 스크립트/스타일에 nonce 부여하여 `'unsafe-inline'` 제거. Cloudflare Pages Function middleware로 nonce 주입 가능.
2. **CSP 자가 리포팅 (P0)**: `Content-Security-Policy-Report-Only`로 강화안 동시 송출 + 동일 origin `/api/csp-report` 엔드포인트(외부 의존 0). violation 카운트만 KV에 적재.
3. **Modal focus trap 유틸 (P0)**: `HotkeyNav` 열림 시 첫 포커스(`hk-close`) → Tab cycle 가둠 → 닫힘 시 트리거로 복원. 향후 dialog 재사용을 위해 `src/utils/focusTrap.ts` 분리.
4. **Heading hierarchy 자동 검사 (P2)**: 빌드 시 `astro-check` 또는 간단 lint 스크립트로 페이지별 h1=1·h2 직속 자식 외 h3 금지 룰.
5. **Skip link 가시화 회귀 테스트 (P2)**: `.skip-link:focus` 위치·z-index Playwright 스냅샷.
6. **`prefers-contrast: more` 보강 (P2)**: 토큰에 high-contrast variant 추가하여 시스템 강제 대비 대응.

## 권장 P0
- **#3 focus trap** 즉시 적용 — WCAG 2.1.2 No Keyboard Trap 역방향(가둠 부재) 위반은 아니나 2.4.3 Focus Order·2.4.11 Focus Not Obscured(2.2 신규) 관점에서 모달 UX 결함. 외부 의존 0, 회귀 위험 낮음.
- **#2 self-host CSP report-only** 다음 — 외부 엔드포인트 없이 violation 가시화 → #1 nonce 전환 안전 마이그레이션 토대.
