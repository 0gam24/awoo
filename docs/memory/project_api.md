---
name: API plan
description: API 기획 — Cloudflare 스택, Phase A~D 단계별 엔드포인트, PSI 100 호환 원칙
type: project
originSessionId: 6e3a0917-3f3b-4e4a-b07e-5a89395fc854
---
awoo.or.kr 운영용 API 계획. 핵심 원칙: **첫 페이지 로드 시 API 호출 0건** (PSI 100 위해 SSG 위주). Runtime API는 사용자 액션 후만.

**전부 Cloudflare 스택 단일화** (벤더 분산 회피, 무료 티어로 첫 1년 $0):
- 런타임: Pages Functions (Astro Cloudflare 어댑터)
- DB: D1 / 객체: R2 / 캐시: KV / 큐: Queues / Cron: Cron Triggers
- 메일 수신: Email Routing → kjh791213@gmail.com / 발송: Resend
- 어드민: Cloudflare Access (50명 무료)
- AI: Workers AI + Vectorize 또는 Anthropic Claude Haiku (Phase D)

**Phase A (MVP, 출시 시):**
- POST /api/contact (Resend 발송)
- POST /api/feedback (D1 feedback 테이블)
- POST /api/vitals (web-vitals beacon → D1 또는 Analytics Engine)
- /llms.txt, /llms-full.txt (정적 우선)

**Phase B (운영, 1~3개월):**
- /admin/* (Cloudflare Access 보호)
- /api/admin/subsidies, /api/admin/issues CRUD
- /api/webhook/rebuild (Pages Deploy Hook)
- CMS: 출시는 MDX in Git → Decap CMS (Git-backed) 도입

**Phase C (외부 연동, 3~6개월):**
- /api/sync/policies (공공데이터포털 정책자금)
- /api/sync/bokjiro (복지로 RSS)
- /api/sync/median-income (통계청)
- Cron 매일 06~07시 KST 동기화 → 빌드 트리거

**Phase D (GEO·AI, 6개월~, 보류 검토 중):**
- /api/ask (RAG 기반 사이트 Q&A)
- /api/citation-pulse (AI 인용 추적 webhook)

**공통 보안 (§14):**
- Turnstile + Rate limit + Zod 입력 검증
- IP 해시만 저장 (개보법), PII 최소수집
- CSP / CSRF (Origin 헤더) / HSTS preload
- 7일 후 문의 항목 자동 익명화

**Why:** 정적 사이트라 대부분 데이터는 빌드타임에 처리해야 PSI 100 유지. Cloudflare 단일 스택은 1인 비영리에 무료 티어로 충분 + 운영 단순. Phase 분할은 Decap CMS 도입 시점, 외부 데이터 API 키 발급 시점, RAG 비용 발생 시점이 각각 다른 결정 포인트라.

**How to apply:**
- 새 API 추가 시 "이게 진짜 runtime이어야 하나? SSG로 못 하나?" 자문
- 모든 POST는 Turnstile + rate limit + Zod 필수
- D1 스키마 변경은 마이그레이션 파일로 (drizzle 또는 자체 SQL)
- API 응답 시간은 페이지 로드와 무관하지만 어드민 UX 위해 P95 200ms 목표
- Phase D RAG 도입은 비용 사전 검토 후
