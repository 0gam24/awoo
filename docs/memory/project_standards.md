---
name: Build standards (AGENTS.md 2026)
description: 사용자가 채택한 2026 표준 웹사이트 제작 지침 — §0→§23 순차 적용, CWV/GEO/E-E-A-T 통합
type: project
originSessionId: 6e3a0917-3f3b-4e4a-b07e-5a89395fc854
---
사용자는 자체 작성한 **AGENTS.md 2026.04 표준**을 본 프로젝트에 적용 요구. 핵심 강제 사항:

- **§0 Discovery 미완료 시 코딩 금지** — 추측 대신 질문 (§22-3)
- **§4 통합 CWV**: LCP ≤ 2.5s, **INP ≤ 150ms** (2026 강화), CLS ≤ 0.1, TTFB ≤ 600ms
- **§5 SSR/SSG 필수** — CSR 단독 금지 (AI 크롤러 가시성)
- **§11-3 robots.txt에 GPTBot/ClaudeBot/PerplexityBot 명시 허용** (GEO 가시성 기본값)
- **§12-7 llms.txt 필수**, §12-2 청킹 표준 (역피라미드, H2는 self-contained 질문)
- **§17 성능 예산**: 초기 JS ≤ 100KB gzip, Lighthouse 4 카테고리 모두 90+
- **§22-1 단계별 게이트**: lint/typecheck/test/build 통과 후 다음 단계 진행
- **§22-2 보고 형식**: ✅완료 / ⚠️부분 / ❌차단 / 🔍확인필요 / 📊지표 / 🔗파일

**Why:** 사용자가 본 표준을 신규/리뉴얼 모든 사이트에 단일 작업 지시서로 운영하므로 일관성 유지가 최우선. 2026 구글 코어 업데이트와 INP 150ms 강화에 맞춰진 게이트라 미준수 시 출시 후 트래픽·인용 손실 위험.

**How to apply:** 새 phase 시작 전 해당 §의 체크리스트 확인. 외부 라이브러리 추가는 사용자 승인 필요(§22-1). 미실행 결과를 "성공"으로 보고 금지(§22-3). 작업 종료 시 §22-2 형식으로 보고.
