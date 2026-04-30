# 🔁 awoo (지원금가이드) — 작업 인계 문서

> 본 문서는 다른 PC 또는 미래의 작업 세션에서 본 프로젝트를 **컨텍스트 손실 없이** 이어 작업할 수 있도록 작성됐습니다.
> 처음 보시는 분은 위에서 아래로 순서대로 읽으세요.

---

## 1. 한 줄 요약

**지원금가이드** — 정부 지원금을 페르소나(생애·상황) 단위로 정리한 비영리 정보 안내 사이트. 도메인 [awoo.or.kr](https://awoo.or.kr) 라이브, 운영 주체 **스마트데이터샵 (대표 김준혁, 사업자등록 406-06-34485)**.

- **GitHub**: https://github.com/0gam24/awoo
- **배포 URL**: https://awoo.or.kr (커스텀 도메인) / https://awoo.kjh791213.workers.dev (Worker 기본)
- **배포 방식**: GitHub push → Cloudflare Workers + Static Assets 자동 배포

---

## 2. 현재 상태 (2026-04-29 기준)

### ✅ 완료한 단계

| Phase | 내용 |
|---|---|
| **Phase 1** | Astro 6 + React 19 Islands + Tailwind 4 + TS strict 부트스트랩, Lighthouse 4×100 게이트 통과 |
| **Phase 2** | 디자인 시스템 — Pretendard Variable 셀프호스팅 + Atom·Layout 컴포넌트 (Button, Chip, Badge, Container, TopBar, Footer) |
| **Phase 3** | Astro Content Collections (페르소나 6개·지원금 119건·이슈 자동 생성) + site-data(중위소득·카테고리) |
| **Phase 4** | 홈 페이지 — UrgencyHook + NewsHero + IncomeChecker(React Island) + OtherIssues + PersonaPicker + CategoriesGrid. `/personas/[id]/`, `/subsidies/`, `/subsidies/[id]/`, `/guide/` 페이지 |
| **Phase 5** | 법적 페이지 5종(privacy/terms/cookies/editorial-policy/contact), `@astrojs/sitemap`, `/llms.txt`+`/llms-full.txt` 자동생성, OG PNG, A11y target-size |
| **Phase A** | API 라우트 3종 (`/api/vitals`, `/api/feedback`, `/api/contact`) + Cloudflare Analytics Engine `awoo_vitals` 데이터셋 |
| **자동 콘텐츠** | 보조금24 API → `_gov24/_manifest.json` 주간 incremental sync (119건) + 네이버 뉴스 → 트렌딩 N-gram 추출 → `today-issue.json` 일간 + Claude Sonnet 4.6 → `issues/[date]/[slug].json` 일간 SEO/GEO 포스트 |
| **9-스프린트 (4/29 일괄)** | 시청자 니치 → 보안 → 운영 → IA → SEO 9단계 일괄 적용 (아래 §2-1 참고) |

### 2-1. 4/29 9-스프린트 결과

| 스프린트 | 핵심 |
|---|---|
| **1차 (Tier 1 — niche)** | 홈 페르소나 그리드 매칭 카운트·대표 지원금 / 이슈 포스트 끝 next action CTA 4박스 / 지원금 목록 정렬 3종 / 페르소나 인덱스 카드 대표 지원금 |
| **2차 (보안+SEO)** | XSS sanitize (set:html 제거) / CSP 8 directive / `lint-content.mjs` (slug 충돌·참조 무결성·schema) / BreadcrumbList JSON-LD 3종 |
| **3차 (운영)** | 데이터 소스 단일화 (TODAY_NEWS 800줄 제거) / prompt-injection 강화 / Claude 실패 알림 (`_fail-{date}.json`) / manifest atomic write + lastVerifiedAt / sync workflow PR 모드 |
| **4차 (IA 확장)** | `/issues/topics/[term]/` 트렌딩 토픽 영구 페이지 / `/subsidies/category/[c]/persona/[p]/` 4축 cross-ref hub / `/subsidies/archived/[slug]/` 410 / sweep-stale workflow |
| **5차 (데이터)** | `tag-personas.mjs` 휴리스틱 backfill — 109건 중 103건(94%) 자동 태깅 / cross-ref hub 1 → 18 페이지 / sync-subsidies에 inferPersonas 통합 |
| **6차 (UX)** | `/quick/` URL 직렬화 (#persona=…&result=1) + 클립보드 공유 / lighthouserc INP ≤ 150ms 어설션 / 가이드 FAQ 4 → 8건 |
| **7차 (전환)** | `/subsidies/[id]` "이 지원금 받는 분들이 또 보는 것" cross-pollination / 페르소나 horizontal nav (6 칩 + 이전·다음) / target-size 보강 |
| **8차 (UX hooks)** | `/situations/` 우선순위 Top 3 hero + 카운트 / `/categories/` 자주 등장 태그·페르소나 hook / `check-apply-urls.mjs` HEAD 헬스 체크 |
| **9차 (운영 자동화)** | `check-apply-urls.yml` 매주 수 cron (5% 샘플) / `/personas/[id]` hub 카드 대표 지원금 미리보기 / HANDOFF 갱신 |

### 📊 라이브 PSI 측정값

| 페이지 / 폼팩터 | Perf | A11y | BP | SEO | LCP | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` Mobile | 96 | 100 | 100 | 100 | 2.0~2.1s | 0 | 150ms |
| `/` Desktop | 99 | 100 | 100 | 100 | 0.8s | 0 | 0ms |
| `/issues/main/` Mobile | 99 | 100 | 100 | 100 | 1.9s | 0 | 30ms |
| `/subsidies/` Mobile | 99 | 100 | 100 | 100 | 1.8s | 0 | 140ms |

> 모바일 홈 96은 Lighthouse 시뮬레이터 4× CPU + 6 섹션 인라인 CSS 37KB 한계. 실제 디바이스에서는 더 좋게 나올 가능성 높음 — CrUX Field 데이터(2~4주 후)로 검증 예정.

### ⏸️ 보류 / 다음 단계 후보

| 항목 | 우선순위 | 비고 |
|---|---|---|
| Sentry / Cloudflare Logpush 통합 | 중간 | 런타임 에러 추적, 현재는 Workers Dashboard 로그만 |
| API rate limit (`/api/contact`, `/api/feedback`) | 중간 | IP 기반 시간당 N회 제한 — DDoS·spam 방어 |
| `/api/feedback`·`/api/contact` D1 통합 활성화 | 중간 | wrangler.jsonc d1_databases 주석 해제 + 마이그레이션 |
| Search Console 등록 | 즉시 가능 | sitemap-index.xml 제출 |
| 모바일 Perf 100 끝장내기 | 선택 | Critical CSS 분리(Critters/Beasties), JS 번들 추가 축소 |
| 페르소나 자동 태깅 정밀도 향상 | 선택 | 현 휴리스틱 94% → ML 분류기로 nudge (불필요할 수 있음) |
| 카테고리 hub × 페르소나 임계 3건 상향 | 운영 단계 | 페르소나 태깅이 더 풍부해지면 자동으로 활성화 |
| `/feed-issues.xml` RSS 신설 | 선택 | issue 포스트용 별도 피드 (AI agent 인용 친화) |
| Phase D RAG (사이트 Q&A) | 보류 | Workers AI 또는 Anthropic SDK |

---

## 3. 새 PC에서 시작하기 (Setup)

### 3-1. 필수 환경
- **Node.js >= 22.12.0** (`.nvmrc`로 명시 — `nvm use` 또는 fnm 사용)
- **npm** (pnpm 사용 안 함 — 본 프로젝트 경로 제약 때문)
- **Git** + GitHub 인증 (HTTPS는 PAT, 또는 SSH 키)

### 3-2. 클론·설치·실행

```bash
# 1. 어디든 clone (단, 경로에 # 문자 / 한글 / 공백은 피하기)
git clone https://github.com/0gam24/awoo.git
cd awoo

# 2. Node 22+ 보장
nvm use   # .nvmrc 자동 적용

# 3. 의존성 설치
npm install --no-audit --no-fund

# 4. 환경변수 (선택, Phase A에서 필요)
cp .env.example .env
# .env 편집: DATA_GO_KR_KEY (디코딩 키), RESEND_API_KEY, TURNSTILE_SITE_KEY/SECRET_KEY, ADMIN_EMAIL

# 5. 개발 서버
npm run dev          # http://localhost:4321

# 6. 빌드 + 미리보기
npm run build
npm run preview      # wrangler dev로 실제 Worker 환경 시뮬

# 7. 검증 게이트
npm run lint         # Biome
npm run check        # astro check + tsc
npm run lhci         # Lighthouse 4×100 desktop 게이트 (Chrome 필요)
```

### 3-3. ⚠️ 경로 제약 (중요)

- **`#`, 한글, 공백 포함 경로 사용 금지** — Vite가 `null bytes` 에러로 빌드 실패
- **네트워크 드라이브(Z: 등) 사용 시 pnpm 안 됨** — 심볼릭 링크 store가 작동 안 함, npm 사용 필수
- **권장 경로**: `C:\dev\awoo`, `~/projects/awoo` 등 ASCII 깨끗한 위치
- 이전 PC에서는 Z: 네트워크 드라이브의 한글·`#` 경로 문제로 `C:\dev\awoo`에서 작업 + Z: 위치에 `AWOO_PROJECT_LOCATION.md` 포인터 파일만 둠

### 3-4. Git 신원

```bash
git config user.email "kjh791213@gmail.com"
git config user.name "김준혁"
```

---

## 4. 기술 스택 & 아키텍처 결정

### 4-1. 핵심 스택
- **프레임워크**: Astro 6.1.10 (`output: 'static'` + `@astrojs/cloudflare` 어댑터)
- **UI**: React 19 Islands (현재 IncomeChecker만 `client:visible`)
- **CSS**: Tailwind 4 (via `@tailwindcss/vite` 플러그인) + Astro scoped `<style>`
- **타입**: TypeScript strict (extends `astro/tsconfigs/strictest`)
- **린트/포맷**: Biome 2 (단일 도구, ESLint+Prettier 대체)
- **콘텐츠**: Astro Content Collections (`src/data/personas.json`, `src/data/subsidies/*.json`, `src/data/issues.json`)
- **폰트**: Pretendard Variable subset (KS X 1001 + Latin), 셀프호스팅 `public/fonts/`, fallback 메트릭 매칭(`size-adjust: 100.6%`)

### 4-2. 빌드 설정 (`astro.config.mjs`)
- `output: 'static'` — 모든 페이지 prerendered (Worker 함수 미사용, 속도 최우선)
- `trailingSlash: 'always'` — URL 일관성
- `inlineStylesheets: 'always'` — render-blocking CSS 0
- `prefetch: { defaultStrategy: 'hover' }` — 호버 시 다음 페이지 프리페치
- `@astrojs/sitemap` 통합 → `dist/client/sitemap-index.xml`

### 4-3. 배포 (Cloudflare Workers + Static Assets)
- 루트 `wrangler.jsonc` — Cloudflare 자동생성, 손대지 말 것
- `public/.assetsignore` — `_worker.js`, `_routes.json` 무시
- Cloudflare Pages가 아닌 **Workers + Static Assets** 모델 (신형)
- 빌드 명령: `npm run build` / 출력: `dist`

### 4-4. ⚠️ Cloudflare AI Bot 차단 설정 — 끄기

도메인 추가 시 Cloudflare가 자동으로 "Block AI bots" 활성화 → robots.txt에 ClaudeBot/GPTBot/Google-Extended 등을 자동 Disallow 처리 → **AGENTS.md §12 GEO 정책 위반 + Lighthouse SEO 92 회귀**.

대시보드 → 도메인 → **Security → Bots → AI Audit (또는 Block AI bots) → Off**

본 프로젝트는 GEO 가시성 우선이므로 AI 크롤러 명시적 허용 (robots.txt에 코딩됨).

---

## 5. 디렉토리 구조

```
awoo/
├── .github/workflows/
│   ├── ci.yml                    # Lint+Typecheck+lint:content+Build+Lighthouse 게이트
│   ├── deploy.yml                # main push → Cloudflare 자동 배포
│   ├── sync-subsidies.yml        # 매주 월 03KST 보조금24 동기화 (PR 모드 옵션)
│   ├── sync-issues.yml           # 매일 06KST 네이버 뉴스 트렌딩 큐레이션
│   ├── sweep-stale.yml           # 매주 화 03KST 마감 30일+ 항목 archive
│   └── check-apply-urls.yml      # 매주 수 04KST 외부 applyUrl 헬스 체크 (5% 샘플)
├── .nvmrc                        # Node 22
├── agents/
│   └── seo-geo-news-poster.md    # Claude system prompt (2026 SEO/GEO/FOX/BLUF)
├── scripts/                      # 빌드/운영 자동화
│   ├── sync-subsidies.mjs        # 보조금24 API → _gov24/{slug}.json + atomic manifest
│   ├── sync-issues.mjs           # 네이버 뉴스 → today-issue.json (안전 clean·길이 캡)
│   ├── generate-issue-posts.mjs  # Claude API → issues/[date]/[slug].json (.fail.json 로그)
│   ├── tag-personas.mjs          # _gov24 휴리스틱 페르소나 태깅 (94% 자동)
│   ├── sweep-stale.mjs           # 마감 30일+ → _archived/ 이동
│   ├── check-apply-urls.mjs      # 외부 applyUrl HEAD 헬스 체크 (5% 샘플 + 재시도)
│   └── lint-content.mjs          # 빌드 게이트: slug 충돌·참조 무결성·schema·XSS 패턴
├── public/
│   ├── _headers                  # CSP·HSTS·X-Frame·Permissions·CORP
│   ├── _redirects                # /issues/main → /issues/ 등 301
│   ├── favicon.svg / og-default.png / robots.txt
│   └── fonts/PretendardVariable.subset.woff2   # KS X 1001 + Latin
├── src/
│   ├── content.config.ts         # Content Collections + _archived/** 제외 패턴
│   ├── data/
│   │   ├── personas.json         # 6 페르소나
│   │   ├── situations.json       # 12 라이프 이벤트
│   │   ├── today-issue.json      # 일간 자동 큐레이션 결과 (sync-issues 출력)
│   │   ├── site-data.ts          # 중위소득·CATEGORIES·formatWon (TODAY_NEWS 제거됨)
│   │   ├── subsidies/
│   │   │   ├── _gov24/           # 보조금24 자동 (110+건) + _manifest.json
│   │   │   ├── _curated/         # 수동 큐레이션 핵심 10건
│   │   │   └── _archived/        # 마감 30일+ sweep — collection 제외 / 410 안내
│   │   └── issues/
│   │       ├── [date]/[slug].json    # Claude 생성 SEO/GEO 포스트
│   │       ├── _history.json     # 트렌딩 term 누적 통계
│   │       └── _fail-{date}.json # Claude 실패 로그
│   ├── components/                  # Container/Button/Chip/Badge/Icon/TopBar/Footer
│   │   └── home/
│   │       ├── NewsHero.astro    # today-issue.json 단일 소스 + 듀얼 CTA
│   │       ├── PersonaPicker.astro  # 6 카드 + 매칭 카운트 + 대표 지원금
│   │       └── ...
│   ├── layouts/BaseLayout.astro
│   ├── lib/
│   │   ├── vitals.ts             # web-vitals beacon
│   │   └── subsidies-meta.ts     # manifest 기반 isNew·recentlyAdded·lastVerifiedAt
│   ├── pages/
│   │   ├── index.astro / about / contact / editorial-policy / privacy / terms / cookies
│   │   ├── guide.astro           # 신청 가이드 8 FAQ + FAQPage + Breadcrumb
│   │   ├── quick/index.astro     # 5분 진단 + URL 해시 직렬화 (#persona=…&result=1)
│   │   ├── personas/index.astro  # 페르소나 인덱스 + 카드 대표 지원금 미리보기
│   │   ├── personas/[id].astro   # 페르소나 상세 + hub + horizontal nav
│   │   ├── situations/[id].astro # 라이프 이벤트 12종 + 우선순위 Top 3
│   │   ├── categories/[id].astro # 카테고리 7종 + Top 태그·페르소나 hook
│   │   ├── issues/index.astro    # 1위 hero + 월별 아카이브
│   │   ├── issues/[date]/[slug].astro    # Claude 생성 영구 포스트 + 4-CTA
│   │   ├── issues/topics/[term].astro    # 트렌딩 토픽 영구 페이지 (totalCount ≥ 3)
│   │   ├── subsidies/index.astro # 카테고리 필터 + 정렬 (인기/금액/마감)
│   │   ├── subsidies/[id].astro  # 상세 + GovService + Breadcrumb + cross-pollination
│   │   ├── subsidies/category/[c]/persona/[p].astro  # 4축 cross-ref hub (≥2건)
│   │   ├── subsidies/archived/[slug].astro  # 410 안내 (noindex)
│   │   ├── subsidies/new.astro   # 신규 14일 윈도우
│   │   ├── llms.txt.ts / llms-full.txt.ts
│   │   └── api/                  # Phase A — vitals·feedback·contact (Cloudflare adapter)
│   └── styles/global.css         # Tailwind + 디자인 토큰 + .sr-only 유틸
├── astro.config.mjs              # output:static + Cloudflare adapter
├── lighthouserc.json             # 4×100 + LCP·CLS·TBT + INP ≤ 150ms warn
├── biome.json / lefthook.yml / tsconfig.json / wrangler.jsonc
└── HANDOFF.md / AGENTS.md / README.md
```

---

## 6. 디자인 시스템 핵심 약속

### 6-1. 디자인 토큰 (Apple-inspired)
- 라이트모드 본문 secondary는 `--gray-2 #6e6e73` (WCAG AA 5.0:1) — `#86868b`(3.7:1)는 큰 텍스트(18pt+)에만
- 다크모드 자동 추적: `[data-theme]` 속성 + `prefers-color-scheme` (BaseLayout 인라인 스크립트)
- 폰트: `Pretendard Variable` → `Pretendard Adjusted`(size-adjust matched fallback) → 시스템

### 6-2. 페르소나 6개 그라데이션
- `persona-blue`(사회초년생) / `persona-orange`(자영업) / `persona-pink`(신혼육아) / `persona-green`(중장년) / `persona-purple`(저소득) / `persona-amber`(농업)

### 6-3. 분야별 tint
- `tint-주거`(blue) / `tint-자산`(cyan) / `tint-교육`(violet) / `tint-창업`(orange) / `tint-복지`(pink) / `tint-취업`(green) / `tint-농업`(amber)

### 6-4. ⚠️ A11y 규칙 (WCAG 2.2)
- 인접 터치 타겟 spacing **24px** 이상 (gap 24px가 기본) — 16px 이하 시 `target-size` 위반
- 인라인 텍스트 링크는 `padding: 6px 0; min-height: 24px;` 필수
- 본문 secondary 색상 `#6e6e73` 고정 (WCAG AA 통과)
- 모든 인터랙티브 요소 `:focus-visible { outline: 2px solid var(--accent) }`
- `prefers-reduced-motion: reduce` 시 모든 애니메이션 즉시 종료

### 6-5. 성능 약속 (PSI 100 호환 원칙)
- **첫 페이지 로드 시 API 호출 0건** — 모든 데이터는 빌드타임(SSG)
- React Island는 `client:visible` 권장 (`client:load` 회피)
- 이미지: SVG > AVIF > WebP > PNG/JPEG 우선순위, `width/height` 명시
- Footer만 `content-visibility: auto` 허용 (페이지 본문 sections에는 사용 X — Lighthouse 측정 충돌)
- 인라인 CSS 50KB 미만 유지 (현재 홈 ~37KB)

---

## 7. 운영 주체 정보 (코드/푸터에 노출)

| 항목 | 값 |
|---|---|
| 상호 (legalName) | 스마트데이터샵 |
| 대표자 | 김준혁 |
| 사업자등록번호 | 406-06-34485 |
| 소재지 | 인천광역시 계양구 새벌로 88, 효성동 |
| 이메일 | contact@awoo.or.kr |
| 사업자 유형 | 간이과세자 (개인사업자) |

> 🔒 **절대 노출 금지**: 생년월일, 정확한 동/호수(302동 1007호) — 개인정보

---

## 8. AGENTS.md 2026 표준 (사용자 운영 지침)

본 레포지토리 루트의 [AGENTS.md](./AGENTS.md) 참조. 핵심 강제 항목:

- **§0 Discovery 미완료 시 코딩 금지** — 추측 대신 질문
- **§4 통합 CWV**: LCP ≤ 2.5s, **INP ≤ 150ms**(2026 강화), CLS ≤ 0.1, TTFB ≤ 600ms
- **§5 SSR/SSG 필수** — CSR 단독 금지
- **§11-3** robots.txt에 GPTBot/ClaudeBot/PerplexityBot 명시 허용
- **§12-7** llms.txt 필수 — 본 프로젝트는 `/llms.txt` + `/llms-full.txt` 자동 생성
- **§17 성능 예산**: 초기 JS ≤ 100KB gzip, Lighthouse 4 카테고리 모두 90+
- **§22-1 단계별 게이트**: lint/typecheck/test/build 통과 후 다음 단계 진행
- **§22-2 보고 형식**: ✅완료 / ⚠️부분 / ❌차단 / 🔍확인필요 / 📊지표 / 🔗파일

---

## 9. 외부 서비스 / 자격 증명

### 9-1. 보유 중
- **공공데이터포털 인증키**: 사용자 보유 (디코딩 형태). `.env`의 `DATA_GO_KR_KEY`로 등록 — Phase A에서 사용
- **Cloudflare 계정**: kjh791213@gmail.com — Workers + Static Assets 활성, AI Bot 차단 OFF 설정 완료
- **awoo.or.kr 도메인**: Cloudflare Nameserver 위임 완료

### 9-2. 미설정 (Phase A 진입 시 필요)
- **Resend** (이메일 발송): `kjh791213@gmail.com`으로 가입 → `RESEND_API_KEY`
- **Cloudflare Turnstile** (폼 봇 차단): 대시보드에서 사이트 키·시크릿 발급
- **Cloudflare Email Routing**: `contact@awoo.or.kr` → `kjh791213@gmail.com` 포워딩
- **Cloudflare Access**: 어드민 페이지 보호용 (50명 무료 티어)

---

## 10. 작업 재개 시 권장 순서

1. **이 문서 + AGENTS.md** 정독 (10분)
2. `git pull` 으로 최신 동기화
3. `npm run dev` 으로 로컬 확인 → http://localhost:4321
4. https://awoo.or.kr 라이브 상태 확인 (PSI 재측정 옵션)
5. [docs/memory/](./docs/memory/) 의 Claude 메모리 파일 훑어보기 (프로젝트 컨텍스트)
6. 다음 작업: 사용자가 우선순위 결정한 항목 (Phase A API / 콘텐츠 확장 / 모바일 100 등)

---

## 11. 자주 마주칠 트랩

| 증상 | 원인 | 해결 |
|---|---|---|
| Vite `null bytes` 빌드 에러 | 경로에 `#`/한글/공백 | C:\dev\awoo 같은 ASCII 경로로 이동 |
| `pnpm install` 심볼릭 링크 EPERM | 네트워크 드라이브 / 권한 | npm 사용 |
| `astro check` Node v20 거절 | Astro 6은 Node ≥22.12 | `nvm use` 또는 Node 22+ 설치 |
| Lighthouse Chrome 임시폴더 EPERM (Windows) | Chrome 정리 시점 권한 | 로그상 에러지만 결과는 정상 — `.lighthouseci/*.json` 확인 |
| Cloudflare 빌드 후 deploy 실패 (`[assets] directory` 요구) | 루트 `wrangler.toml` 충돌 | `wrangler.jsonc`만 두고 `wrangler.toml` 제거 (이미 정리됨) |
| robots.txt에 ClaudeBot Disallow 자동 삽입 | Cloudflare AI Bot 차단 ON | 대시보드 Security → Bots → Off |
| Mobile Lighthouse target-size 오탐 | sections에 `content-visibility: auto` | 본문 sections 에서 cv 제거 (Footer만 허용) |
| Lighthouse 캐시버스터 URL(`?v=...`) 사용 시 측정 왜곡 | Cloudflare CDN 응답 분기 | 정상 URL + `--disable-cache` 사용 |

---

## 11-A. 운영 사이클 하네스 (2026-04-30~)

본 프로젝트는 SEO/GEO 트래픽 성장을 KPI로 한 **수동 트리거 운영 사이클**을 사용한다.

### 사용법
사용자가 채팅에 "**사이클**" 또는 `/cycle`을 입력하면 Claude가:
1. `ops/OPS_CYCLE.md`의 현재 phase 확인
2. 다음 phase 자동 실행
3. 산출물 `ops/`에 저장 + 커밋 (푸시 X)

### Phase 흐름
```
PLAN (11 에이전트 소환) → REVIEW (격리·우선순위) → EXECUTE (P0 구현)
  → OPERATE (audit 4종) → OBSERVE (지표·회귀) → 다음 PLAN
```

### 디렉토리
- `ops/OPS_CYCLE.md` — 현재 phase·이력 (단일 진실 소스)
- `ops/backlog-external.md` — 외부 의존·유료 항목 동결 (사이클 자동 격리)
- `ops/proposals/{date}/` — PLAN 산출물 (에이전트별)
- `ops/reviews/{date}.md` — REVIEW 합성
- `ops/execute-log/{date}.md` — EXECUTE 결과
- `ops/observations/{date}.md` — OPERATE+OBSERVE 지표

### 신규 audit 스크립트 (외부 호출 0)
- `npm run audit:links` — 내부 링크 그래프 (고립·딥페이지·dangling)
- `npm run audit:schema` — JSON-LD 무결성
- `npm run audit:llms` — llms.txt 신선도
- `npm run audit:keywords` — persona/situation/category 키워드 커버리지

### 디스패처
- `npm run cycle:status` — 현재 phase·다음 phase 확인
- `npm run cycle:advance` — 수동 phase 전이
- `npm run cycle:reset` — cycle_no 1, phase PLAN 초기화

### 푸시 정책
- 모든 phase 로컬 커밋 자동, **푸시는 사용자 "푸쉬" 명시 시에만**
- EXECUTE phase는 `cycle/{n}-{date}` 브랜치에서 작업

### 외부 의존 키워드 자동 격리
REVIEW phase는 PLAN 산출물에서 결제·외부 키 등록·계정 가입 등의 키워드를 정규식으로 매칭하여 발견 시 `backlog-external.md`로 자동 이관. 사이클은 절대 외부 의존 항목을 EXECUTE에 포함시키지 않는다.

---

## 12. 변경 이력

| 날짜 | 커밋 | 내용 |
|---|---|---|
| 2026-04-28 | `2754286` | Phase 1 부트스트랩 (Astro 6 + React + Tailwind 4) |
| 2026-04-28 | `b59acbc` | Phase 2 디자인 시스템 — Pretendard 셀프호스팅 + Atom 컴포넌트 |
| 2026-04-28 | `a146420` | GitHub Actions CI Lighthouse 4×100 게이트 |
| 2026-04-28 | `9822a3b` | Node 22 fix |
| 2026-04-28 | `3bee52a` | wrangler.toml 제거 (Cloudflare 배포 충돌) |
| 2026-04-28 | `ce69f01` | Cloudflare Workers 자동 설정 머지 |
| 2026-04-28 | `9971c36` | Phase 3+4 프로토타입 디자인 본격 이식 |
| 2026-04-28 | `23adaa9` | content-visibility 추가 (이후 부분 회귀로 제거됨) |
| 2026-04-29 | `6f7a6a3` | Phase 5 — issues/main, 법적 페이지, sitemap, llms 자동 생성, OG PNG, UrgencyHook 애니 |
| 2026-04-29 | `886c25d` | A11y target-size + content-visibility 측정 충돌 해소 |
| 2026-04-29 | (이 커밋) | HANDOFF.md + AGENTS.md + memory 백업 |
| 2026-04-30 | (이 커밋) | 운영 사이클 하네스 — `/cycle` + `ops/` + audit 4종 + 11 에이전트 PLAN 패턴 |

---

## 13. 연락처

- **운영자**: 김준혁 / kjh791213@gmail.com
- **사이트**: https://awoo.or.kr
- **레포**: https://github.com/0gam24/awoo

---

*다른 PC에서 막히면: 이 문서의 §3, §11을 먼저 확인.*
