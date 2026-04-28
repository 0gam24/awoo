---
name: Deploy target
description: GitHub → Cloudflare Pages 배포, 로컬 개발 우선
type: project
originSessionId: 6e3a0917-3f3b-4e4a-b07e-5a89395fc854
---
- **배포**: GitHub repo → Cloudflare Pages 자동 빌드/배포
- **로컬 개발 먼저** 진행 후 도메인(awoo.or.kr) 연결
- **확정 스택 (Phase 1·2 완료)**: Astro 6 + React 19 Islands + Tailwind 4 + TS strict + **npm** (pnpm 미사용 — Z: 환경 문제) + `@astrojs/cloudflare` 어댑터(Phase A에서 활성화)
- 현재 `output: 'static'` (어댑터 비활성). API 추가 시 어댑터 켜고 페이지별 prerender 사용
- **배포 모델**: Cloudflare **Workers + Static Assets**(신형, Pages 아님). 라이브 URL https://awoo.kjh791213.workers.dev (커스텀 도메인 awoo.or.kr 연결 대기)
- **루트 wrangler.toml 두면 안 됨** — Pages/Workers Assets 자동 배포가 Worker로 오해석해 deploy 실패. Cloudflare 대시보드에서 모든 빌드/배포 설정. Phase A에서 어댑터가 dist/server/wrangler.json 자체 생성하므로 그것도 무방.
- **PSI 실측 결과 (2026-04-28, sha 3bee52a)**: 모바일·데스크톱·홈·about 모두 4×100. LCP 모바일 1.2~1.4s, CLS 0, TBT 20ms.
- 보안 헤더는 Cloudflare Pages `_headers` 파일로
- HTML 캐싱은 Cloudflare 엣지 (HTML도 `s-maxage=86400, stale-while-revalidate=604800`)

**Why:** 사용자가 GitHub→Cloudflare 워크플로 명시. Cloudflare는 Web Analytics 쿠키리스가 §15 동의 부담 줄여주고, 엣지 캐싱으로 §4 TTFB·LCP 자동 통과에 유리.

**How to apply:** Cloudflare 어댑터 호환되는 의존성만 사용. Node-only API 사용 시 Pages Functions 분리. 환경변수는 wrangler/Pages 대시보드. PR 프리뷰 자동 배포 활용.
