# awoo.or.kr 자매 사이트 — STRUCTURE.md

> smartdata HQ 가 본 사이트를 관리하기 위한 구조 문서.
> 본 문서는 본 repo 분석 결과 자동 생성.
>
> 마지막 갱신: 2026-05-07
> 분석 기준 commit: e76c61e (chore(data): 오늘의 이슈 자동 갱신 — 2026-05-07)

## 1. 정체성
- 도메인: awoo.or.kr
- 역할: 자매 (정부 지원금 신청 가이드)
- 메인: smartdatashop.kr 의 자매
- repo: github.com/0gam24/awoo

## 2. 기술 스택
- Astro 6.1.10 (output: static, trailingSlash: always)
- React 19.2.5 (Islands 전용 — IncomeChecker 등 일부)
- Tailwind CSS 4.2.4 (@tailwindcss/vite 플러그인)
- TypeScript 5.9.3 (strict, astro check + tsc --noEmit)
- Zod 4.3.6 (Content Collections schema)
- web-vitals 5.2.0
- Pretendard Variable 셀프호스팅 (KS X 1001 + Latin subset)
- Biome 2.4.13 (lint/format)
- Lighthouse CI 0.15.1 (4×100 게이트)
- Wrangler 4.86.0 (Cloudflare 배포)
- lefthook 2.1.6 (Git hook)
- Node ≥ 22.12.0

## 3. 라우트 (정적)
- /
- /about/
- /ads-policy/
- /contact/
- /cookies/
- /demo/
- /editor/jjh/
- /editorial-policy/
- /guide/
- /privacy/
- /terms/
- /preferences/
- /quick/
- /404
- /categories/
- /personas/
- /situations/
- /topics/
- /glossary/
- /guides/
- /issues/
- /issues/main/  *(meta-refresh redirect — sitemap 제외)*
- /subsidies/
- /subsidies/new/

## 4. 라우트 (동적)
- /categories/[id] — 카테고리 hub
- /personas/[id] — 페르소나 hub (6명)
- /situations/[id] — 상황 hub
- /topics/[id] — 주제 hub
- /glossary/[id] — 용어 사전 항목
- /guides/[slug] — flagship 가이드 (Cycle #39, markdown 본문)
- /issues/[date]/[slug] — 영구 이슈 포스트 (날짜+slug)
- /issues/all/[...page] — 이슈 페이지네이션
- /issues/topics/[term] — 트렌딩 토픽 영구 hub
- /subsidies/[id] — 지원금 상세 (gov24 + curated)
- /subsidies/archived/[slug] — 마감 후 410 처리
- /subsidies/category/[category]/persona/[persona] — 4축 cross-ref hub

## 5. API endpoints
- /api/contact — 문의 (rate-limited, Resend/Turnstile 연동 예정)
- /api/feedback — 피드백 위젯
- /api/health — 헬스체크
- /api/vitals — Web Vitals 수집 (Analytics Engine)
- /feed.xml — 신규 지원금 RSS
- /feed-issues.xml — 이슈 포스트 RSS
- /sitemap-news.xml — Google News sitemap
- /llms.txt — AI 크롤러용 사이트 요약
- /llms-full.txt — AI 크롤러용 풀 콘텐츠
- /sitemap-index.xml + /sitemap-0.xml — @astrojs/sitemap 자동 생성

## 6. 레이아웃
- BaseLayout.astro — SEO/OG/Twitter, canonical, RSS alternate, skip-link, Organization+WebSite+SiteNavigationElement JSON-LD, 다크모드 깜빡임 방지, idle 시 web-vitals lazy import. (단일 레이아웃)

## 7. 컴포넌트
- **MainBackrefBox.astro** — smartdatashop.kr (메인 데이터 저널) backref. variant: inline / sidebar / footer. persona 자동 매핑 (CATEGORY_MAP §3.2). 메인 토큰 #8b1538 좌측 라인. (Cycle #83 신설)
- Badge.astro — 상태 뱃지 (신청 가능 / 곧 마감 / 마감)
- BlufBox.astro — BLUF (Bottom Line Up Front) 요약 박스
- Button.astro — 공통 버튼 atom
- Chip.astro — 태그·필터 칩
- Container.astro — 레이아웃 폭 제한 wrapper
- CrossRefRail.astro — 페이지 간 cross-reference 사이드 레일
- FeedbackWidget.astro — 페이지 하단 피드백 박스
- Footer.astro — 사이트 푸터 (운영 주체·연락처·약관 링크)
- HotkeyNav.astro — 키보드 단축 네비게이션
- Icon.astro — SVG 아이콘 wrapper
- PageHeader.astro — eyebrow + h1 + lead 통일 헤더
- TopBar.astro — 상단 네비게이션 (메뉴 9종)
- home/CategoriesGrid.astro — 카테고리 그리드 (홈)
- home/IncomeChecker.astro — 소득 자가진단 wrapper
- home/IncomeChecker.tsx — React island (가구원·소득→중위소득% 산출)
- home/NewsHero.astro — 오늘의 이슈 hero
- home/OtherIssuesSection.astro — 추가 이슈 섹션
- home/PersonaPicker.astro — 페르소나 6종 진입점
- home/QuickCheckCTA.astro — 5분 진단 CTA
- home/RecentlyAdded.astro — 신규 추가 지원금
- home/UrgencyHook.astro — 마감 임박 hook (deadline 기반)

## 8. 지원금 가이드 페이지 list
콘텐츠 데이터 소스: `src/data/subsidies/`
- _gov24/ — 보조금24 sync 102개 (일반 신청 안내)
- _curated/ — 큐레이션 10개 (basic-livelihood, farm-startup, housing-monthly, job-card, maternity-grant, newlywed-housing, savings-account, senior-employment, small-biz-loan, startup-grant)
- _archived/ — 마감 sweep 6개 (410 응답)
- 총 합계: **활성 112개** (_gov24 102 + _curated 10), 아카이브 6개

각 항목은 `/subsidies/{id}/` 라우트로 발행. README 명시상 119개(아카이브 포함).

## 9. 자격 체크·마감 트래커
- /quick/ — 5분 진단 (페르소나·상황 매칭)
- IncomeChecker (홈) — 가구원 수 + 월 소득 → 중위소득 % → 자격 등급(차상위/중위 안/중간/외) 표시
- UrgencyHook (홈) — deadline 기반 마감 임박 hook
- src/lib/deadline-format.ts — 마감일 포맷·임박 판정 유틸
- sweep-stale 스크립트 — 마감 30일+ 항목 archive 자동화

## 10. lib 모듈
- anon-prefs.ts — 익명 사용자 prefs (localStorage)
- api/error-log.ts — API 에러 로깅
- api/rate-limit.ts — KV/in-memory rate limit (글로벌 분산 옵션)
- api/utils.ts — API 공용 헬퍼
- api/validation.ts — Zod 입력 검증
- deadline-format.ts — 마감일 포맷 + 임박 판정
- inline-glossary.ts — 본문 내 용어 자동 링크
- inline-markdown.ts — 인라인 마크다운 파서
- schema.ts — JSON-LD 헬퍼 (Organization/WebSite/Breadcrumb)
- subsidies-meta.ts — 지원금 메타 가공
- vitals.ts — Web Vitals 측정·전송 (idle import)

## 11. GitHub Actions
- ci.yml — push/PR — lint + check + build + LHCI 4×100
- deploy.yml — main push (md/docs 제외) — wrangler deploy → Cloudflare Workers
- sync-subsidies.yml — 보조금24 incremental sync + PR
- sync-issues.yml — daily 21:00 UTC (06:00 KST) — 네이버 뉴스 sync + Claude 영구 포스트 생성 + IndexNow ping + Cloudflare deploy
- sweep-stale.yml — 마감 항목 archive
- check-apply-urls.yml — 외부 applyUrl HEAD 헬스체크 (5% 샘플)
- indexnow.yml — Bing/Yandex IndexNow 색인 ping
- citations.yml — Perplexity/AI citation tracking
- dep-audit.yml — 의존성 취약점 audit

## 12. scripts
- audit-content-depth.mjs — 본문 thin content 검증 (AdSense 정합)
- audit-headings.mjs — h1/h2 구조 검증
- audit-rss.mjs — RSS 형식 검증
- audit-skip-link.mjs — a11y skip-link 검증
- audit-specificity.mjs — 모호 표현 검출 ("확인 필요" 등)
- audit-titles.mjs — 페이지 title 중복·길이
- build-entity-graph.mjs — entity-graph.json 빌드 (build 전제)
- check-apply-urls.mjs — 외부 신청 URL HEAD 체크
- check-bundle-size.mjs — 번들 사이즈 게이트 (build 후)
- citation-tracker.mjs — AI 답변엔진 인용 추적
- cycle-runner.mjs — 운영 사이클 status/advance/reset
- generate-issue-posts.mjs — Claude → /issues/{date}/{slug}.json 생성
- indexnow-ping.mjs — IndexNow 색인 ping
- internal-link-audit.mjs — 내부 링크 감사
- keyword-coverage.mjs — 키워드 커버리지
- lint-content.mjs — 콘텐츠 무결성 (slug/참조/schema) — CI 게이트
- llms-freshness.mjs — llms.txt 신선도 검증
- schema-validate.mjs — JSON-LD 검증
- sweep-stale.mjs — 마감 30일+ archive
- sync-issues.mjs — 네이버 뉴스 → today-issue.json
- sync-subsidies.mjs — 보조금24 → _gov24/*.json
- tag-personas.mjs — 페르소나 휴리스틱 backfill

## 13. 빌드·배포 명령
- `npm run dev` — 개발 서버 (localhost:4321)
- `npm run build` — entity-graph + astro build + bundle-size 게이트
- `npm run preview` — build + wrangler dev 로컬 Worker
- `npm run check` — astro check + tsc --noEmit
- `npm run lint` / `lint:fix` — Biome
- `npm run lint:content` — 콘텐츠 무결성 (CI 게이트)
- `npm run lhci` / `lhci:mobile` — Lighthouse CI 4×100
- `npm run verify` — lint + lint:content + check + build + lhci 일괄
- `npm run deploy` — build + wrangler deploy
- `npm run sync:subsidies[:new|:bootstrap]` — 보조금24 sync
- `npm run sync:issues` — 네이버 뉴스 sync
- `npm run generate:issues` — Claude 이슈 포스트 생성
- `npm run sweep:stale[:apply]` — 마감 sweep
- `npm run tag:personas[:apply]` — 페르소나 backfill
- `npm run check:apply-urls[:all]` — 외부 URL 헬스
- `npm run indexnow:ping` — IndexNow ping
- `npm run citations:track` — AI 인용 추적
- `npm run cycle:{status|advance|reset}` — 운영 사이클
- `npm run audit:{links|schema|llms|keywords|headings|skip-link|a11y|rss|titles|specificity|content-depth}`

## 14. 환경변수 의존
빌드/Worker 런타임은 `process.env` 직접 참조 거의 없음 (정적 출력 + Cloudflare 어댑터). 자동화 스크립트와 CI/Wrangler에서 다음 키 사용 (값 미공개):

**GitHub Actions secrets:**
- ANTHROPIC_API_KEY — Claude 이슈 포스트 생성
- NAVER_CLIENT_ID / NAVER_CLIENT_SECRET — 네이버 뉴스 API
- DATA_GO_KR_KEY — 보조금24 (data.go.kr) API
- INDEXNOW_KEY — Bing/Yandex IndexNow
- PERPLEXITY_API_KEY — citation tracker
- CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID — wrangler deploy
- LHCI_GITHUB_APP_TOKEN — Lighthouse CI GitHub 연동
- GITHUB_TOKEN — 자동 PR

**Wrangler runtime secrets (계획 / 미설정):**
- RESEND_API_KEY — 문의 메일
- TURNSTILE_SECRET_KEY — Cloudflare Turnstile (봇 차단)
- ADMIN_EMAIL — 알림 수신처 (기본 smartdatashop@gmail.com)

**Wrangler bindings:**
- ASSETS — 정적 자산
- ANALYTICS — Analytics Engine (awoo_vitals 데이터셋)
- DB / RATE_LIMIT_KV — D1 / KV (주석 처리, in-memory fallback 동작)

**스크립트 환경:**
- GITHUB_ACTIONS / GITHUB_STEP_SUMMARY (CI 컨텍스트)

## 15. 의존성 (핵심)
- astro@6.1.10
- @astrojs/cloudflare@13.2.2
- @astrojs/react@5.0.4
- @astrojs/sitemap@3.7.2
- @tailwindcss/vite@4.2.4
- tailwindcss@4.2.4
- react@19.2.5 / react-dom@19.2.5 / @types/react@19.2.14
- zod@4.3.6
- (dev) @astrojs/check@0.9.9, @biomejs/biome@2.4.13, @lhci/cli@0.15.1, lefthook@2.1.6, typescript@5.9.3, web-vitals@5.2.0, wrangler@4.86.0
- override: vite ^7

## 16. 배포
- 호스팅: Cloudflare Workers (Static Assets + Worker entrypoint)
- 프로젝트 이름: awoo (wrangler.jsonc `name: "awoo"`)
- 도메인: awoo.or.kr
- production branch: main
- compatibility_date: 2026-04-28
- compatibility_flags: ["global_fetch_strictly_public"]
- observability: enabled
- 자동 배포: main push 시 `.github/workflows/deploy.yml` (md/docs/.github 변경은 skip)
- cron 결과 즉시 반영: sync-issues.yml 내부에 wrangler deploy 직접 호출 (`[skip ci]` 우회)

## 17. 페르소나·톤 (분석된 내용)
- 주 타겟: 정부 지원금 수령 희망자 (대한민국 일반 시민)
- 페르소나: 6종 — office-rookie / self-employed / newlywed-family / student / senior / unemployed-career-shift (`src/data/personas.json`)
- 톤: 친근·단계별 안내·신뢰 (정부 출처 1차 인용, 신청 대행 X 명시)
- 콘텐츠 유형: 신청 가이드 (HowTo) · 자격 체크 (IncomeChecker / quick) · 마감 트래커 (UrgencyHook · sweep-stale) · 일간 트렌딩 이슈 포스트 (Claude 자동 생성)
- 운영 원칙: 회원가입 X / 개인정보 수집 X / 신청 대행 X / 정부 공식 사이트로 안내
- E-E-A-T: about.astro에 편집책임자(김준혁), 정정 정책, 검수 명시. /editor/jjh/ 상세 프로필.

## 18. JSON-LD / SEO
- Schema.org 사용: ✓ (사이트와이드 + 페이지별)
- 사용 type:
  - 사이트와이드 (BaseLayout): Organization (parentOrganization=스마트데이터샵 — Cycle #83) · WebSite · SiteNavigationElement · BreadcrumbList
  - 페이지별: AboutPage(/about), GovernmentService(/subsidies/[id]), HowTo(/guide, /quick, /editorial-policy), Article/NewsArticle(/issues/[date]/[slug]), FAQPage(/topics/[id], /glossary/[id], /guides/[slug])
- @id 앵커 정책 (entity 그래프 일관성): `https://awoo.or.kr/#organization` 등 절대 URL
- inLanguage: ko-KR 일괄
- canonical: ✓ (BaseLayout 기본 + 페이지 override)
- sitemap: ✓ (@astrojs/sitemap, daily/weekly/monthly priority 차등화, lastmod 자동 주입 — gov24 regDate / 이슈 publishedAt / 토픽 hub lastSeen)
- Google News sitemap: ✓ (/sitemap-news.xml)
- llms.txt + llms-full.txt: ✓ (AGENTS §12-7)
- robots.txt: AI 크롤러(GPTBot·ClaudeBot·PerplexityBot 등) 명시 허용
- naver-site-verification: ✓ (BaseLayout 인라인)
- Web Vitals: ✓ (idle import + Cloudflare Analytics Engine)
- Prefetch: prefetchAll + hover 전략
- inlineStylesheets: always (build-time inline)

## 19. 광고
- AdSense: ✗ (정책 페이지 `/ads-policy/` 와 audit 스크립트 주석에는 언급되나, 실제 통합 코드(adsbygoogle / data-ad-client) 미발견)
- AdSense client ID: 미설정
- 기타 광고: 없음
- 비고: README에 "비영리 정보 안내 사이트"로 명시. AdSense 승인 대비 콘텐츠 quality 게이트(audit-content-depth, audit-specificity)는 운영 중.

## 20. 현재 콘텐츠 통계 (분석 시점: 2026-05-07)
- 지원금 페이지: 활성 112개 (_gov24 102 + _curated 10) + 아카이브 6개
- 페르소나 hub: 6명
- 트렌딩 토픽 hub: `_history.json` 기준 다수 (피해지원금·공익수당 등)
- 영구 이슈 포스트: **9편** (2026-04-29 ~ 2026-05-07, 7일치 누적)
  - 일자별: 04-29(2), 05-01(1), 05-02(2), 05-04(1), 05-05(1), 05-06(2), 05-07(1) — `_*.json` (fail 마커) 제외
- flagship 가이드(/guides/[slug]): **0편 발행** (`_template.md`만 존재)
- 자격 체크 도구: 1개 (IncomeChecker — 가구원 수 + 월 소득)
- 5분 진단: 1개 (/quick)
- 마감 트래커: 1개 (UrgencyHook + sweep-stale 자동화)
- 마지막 deploy 일: 2026-05-07 (commit e76c61e — 자동 sync 결과)
- 활성 상태: 운영 중 (일간 자동 발행 cycle #82 기준 — 매일 3건 트렌딩 중심 발행 정책)

## 21. NETWORK.md 헌법 적용 가능성
- 디자인 토큰 (color/font) 메인과 일치: (미확인) — smartdatashop.kr 메인 토큰을 본 repo에서 확인 불가. 본 사이트는 자체 토큰(`src/styles/global.css` + Tailwind 4)·Pretendard Variable 사용. 메인과 정합 검증 필요.
- 4 절대 규칙 (신뢰성·실시간·정확성·출처표기) 준수: 부분 ✓
  - 신뢰성: editorial-policy + about(편집책임자·정정 정책) + Organization JSON-LD ✓
  - 실시간: 일간 sync-issues cron + IndexNow + lastmod 자동 갱신 ✓
  - 정확성: lint-content + audit-content-depth + audit-specificity + check-apply-urls 게이트 ✓
  - 출처표기: 정부 공식 발표 1차 인용 명시(README/about), 다만 본문 단위 SourceList 컴포넌트는 미확인
- 의무 컴포넌트 (TrustBar / SourceList / 메인 backref) 존재: 부분 ✓
  - TrustBar: 본 repo 컴포넌트 list에 없음 (Footer trust-badge가 부분 역할)
  - SourceList: 전용 컴포넌트 없음 — 출처는 본문 인라인·BlufBox로 처리
  - 메인 backref(smartdatashop.kr 링크): ✓ **MainBackrefBox 컴포넌트 추가 (Cycle #83)** — Footer 사이트 전역 + 지원금 상세 112개 + 영구 이슈 포스트 9개 + 페르소나 hub 6개에 적용. Organization JSON-LD에 parentOrganization=스마트데이터샵 entity 그래프.
- 안전 게이트 (smoke / verifier / fact-checker) 존재: 부분 ✓
  - smoke: 빌드 + LHCI + bundle-size 게이트 ✓
  - verifier: lint-content (slug/참조/schema) + schema-validate + audit 13종 ✓
  - fact-checker: 전용 컴포넌트·CI step 없음 — Claude 생성물은 사람 검수(편집책임자) 정책에 의존, 자동 fact-check 미설치
- 종합: 자체 운영 표준(AGENTS.md §1~§22)은 강력하나, NETWORK.md 헌법(자매 사이트 의무 컴포넌트·메인 backref)은 미적용 상태. 이식 시 TrustBar/SourceList/메인 backref 컴포넌트 추가 + 디자인 토큰 메인 동기화 + fact-checker 게이트 신설 필요.

## 22. 변경 이력
- 2026-05-07 — 초기 자동 생성 (commit e76c61e 기준)
- 2026-05-07 — Cycle #83: smartdatashop network backref 컴포넌트 신설 (MainBackrefBox.astro) + Footer/지원금/이슈/페르소나 적용 + Organization parentOrganization 추가
