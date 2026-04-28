# 지원금가이드 (awoo.or.kr)

> 정부 지원금을 페르소나(생애·상황) 단위로 정리한 비영리 정보 안내 사이트.
> 신청 대행 없이 정부 공식 사이트로 안내합니다.

[![Live](https://img.shields.io/badge/Live-awoo.or.kr-0071e3?style=flat-square)](https://awoo.or.kr)
[![PSI Desktop](https://img.shields.io/badge/PSI%20Desktop-99%2F100%2F100%2F100-22c55e?style=flat-square)](https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fawoo.or.kr)
[![PSI Mobile](https://img.shields.io/badge/PSI%20Mobile-96%2F100%2F100%2F100-22c55e?style=flat-square)](https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fawoo.or.kr)

## 빠른 시작

```bash
git clone https://github.com/0gam24/awoo.git
cd awoo
nvm use                              # Node 22+
npm install --no-audit --no-fund
npm run dev                          # http://localhost:4321
```

> ⚠️ 프로젝트 경로에 `#`/한글/공백 사용 금지 (Vite 빌드 실패). `pnpm` 안 됨 — `npm` 사용.

## 다른 PC / 다른 사람에게 인계

**👉 [HANDOFF.md](./HANDOFF.md) 를 먼저 읽으세요.** 프로젝트 전체 상태·세팅·트랩·미완료 작업을 한 문서에 정리해 두었습니다.

## 기술 스택

- **Astro 6** + React 19 Islands + Tailwind 4 + TypeScript strict
- **Cloudflare Workers + Static Assets** 배포 (GitHub push → 자동 배포)
- **Pretendard Variable** 셀프호스팅 (KS X 1001 + Latin subset)
- **Astro Content Collections** (페르소나 6 / 지원금 10 / 이슈 4)
- 커스텀 도메인 [awoo.or.kr](https://awoo.or.kr)

## 주요 명령

| 명령 | 용도 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 + Wrangler 로컬 Worker 미리보기 |
| `npm run lint` | Biome 린트 |
| `npm run check` | astro check + tsc |
| `npm run lhci` | Lighthouse CI 4×100 게이트 (Chrome 필요) |
| `npm run verify` | lint + check + build + lhci 일괄 실행 |

## 운영 표준

본 프로젝트는 사용자 자체 [AGENTS.md](./AGENTS.md) 2026 표준을 따릅니다. 핵심:
- **§4 통합 CWV**: LCP ≤ 2.5s · INP ≤ 150ms · CLS ≤ 0.1
- **§11-3** robots.txt에 AI 크롤러(GPTBot·ClaudeBot·PerplexityBot 등) 명시 허용
- **§12-7** llms.txt + llms-full.txt 자동 생성
- **§17** 성능 예산 자동 검증 (Lighthouse CI 4×100 게이트)
- **§22-1** 단계별 게이트 (lint/typecheck/test/build 통과 후 다음)

## 디렉토리 (요약)

```
src/
├── content.config.ts           # Content Collections Zod 스키마
├── data/                       # 페르소나·지원금·이슈 JSON + site-data.ts
├── components/                 # Atom + home/* (UrgencyHook, NewsHero, IncomeChecker, ...)
├── layouts/BaseLayout.astro    # SEO/OG/Twitter/skip-link/theme
├── pages/                      # 정적 prerender 28페이지 + llms.txt 동적
└── styles/global.css           # Tailwind + 디자인 토큰 + 폰트 face

public/
├── _headers                    # Cloudflare HTTP 보안 헤더 (HSTS·CSP·Permissions)
├── robots.txt                  # AI 크롤러 명시 허용
├── og-default.png              # 1200×630 OG 이미지
└── fonts/PretendardVariable.subset.woff2

docs/memory/                    # Claude 작업 컨텍스트 (HANDOFF에서 참조)
```

## 운영 주체

**스마트데이터샵** (대표 김준혁) · 사업자등록 406-06-34485
인천광역시 계양구 새벌로 88, 효성동 · contact@awoo.or.kr

## 라이선스

본 프로젝트의 코드는 비공개이며 무단 복제·재배포를 허용하지 않습니다.
콘텐츠는 별도 표기가 없는 한 정부 부처 공식 발표를 1차 자료로 인용 작성됐습니다.

---

*상세 인계 사항은 [HANDOFF.md](./HANDOFF.md) 참조.*
