# awoo.or.kr — STRUCTURE.md

> 지원금가이드(awoo.or.kr)의 현재 구조 문서. 코드와 저장소를 직접 확인해 적었다.
>
> 마지막 갱신: 2026-11-16
> 이전 판(2026-05-07, 자매 사이트 연동 기준)은 git 이력에 있다.

## 1. 정체성

- 도메인: awoo.or.kr — 정부 지원금 안내 사이트
- 운영 주체: 스마트데이터샵 (편집책임자 김준혁, `/about/`·`/editor/jjh/`)
- 수익: 구글 자동 광고만 쓴다(수동 광고 칸 없음)
- 저장소: github.com/0gam24/awoo (main 푸시 → 자동 배포)

## 2. 지금의 운영 방침 (2026-11-16)

- 목표는 구글 색인 회복. 네이버 유입은 2026-11 웹사이트 영역 개편 뒤 크게 줄었다.
- 새 글 발행은 쉰다. 새벽 자동 발행(0400 클라우드 루틴)은 꺼져 있다.
- 색인 제외 장치: `src/data/noindex-paths.json`
  - `paths` 칸: 분류기(`scripts/index-prune-classify.mjs --write`)가 채운다. 기한 지난 글 등
  - `rework` 칸: 옛 틀이라 빼 둔 글. 글 파일에 `"reworkedAt"`을 적고 분류기를 다시 돌리면 되살아난다
  - `manual` 칸: 사람이 직접 넣는 칸
  - 여기 든 쪽은 BaseLayout이 noindex를 달고, 빌드 뒤 사이트맵·RSS에서 빠진다
- 고쳐 쓴 글의 구글 색인 요청 대기 목록: `node scripts/index-request-queue.mjs`
- 주간 기록: `docs/ops/GOOGLE-WEEKLY.md`, 사람이 읽는 제외 목록: `docs/ops/INDEX-PRUNE.md`

## 3. 기술 스택

- Astro 6.1.10 — `output: 'static'`, `trailingSlash: 'always'`, 모든 쪽을 빌드 때 미리 만든다
- React 19.2.5 — 계산기 같은 일부 화면 조각만 (`IncomeChecker.tsx`, `EitcCalculator.tsx`)
- Tailwind CSS 4.2.4, TypeScript 5.9.3 strict, Zod 4.3.6
- 웹폰트 없음 — 기기 기본 한글 글꼴 (2026-10-02 결정, `src/styles/global.css` 상단 주석)
- Biome 2.4.13(검사·정리), lefthook 2.1.6(커밋 전 검사, 푸시 전 빌드), Lighthouse CI 0.15.1
- Cloudflare Workers + 정적 자산, Wrangler 4.86.0, Node ≥ 22.12.0
- 패키지 관리자는 npm (pnpm 안 됨)

## 4. 콘텐츠와 데이터

| 위치 | 내용 |
|---|---|
| `src/data/issues/{날짜}/{slug}.json` | 정보 글 1편 = 파일 1개 (검사기 기준 411편) |
| `src/data/issues/_scheduled/` | 예약 발행 대기 글 (`publish-scheduled.mjs`가 기일에 옮김) |
| `src/data/issues/_drafts/` | 초안 (빌드에 안 실림) |
| `src/data/issues/_history.json` | 뉴스 트렌딩 주제 → 글 연결 기록 |
| `src/data/subsidies/_gov24/` | 보조금24 동기화 지원금 |
| `src/data/subsidies/_curated/` | 손으로 고른 지원금 (두 곳 합쳐 117개) |
| `src/data/subsidies/_archived/` | 마감 정리된 지원금 (410 응답) |
| `src/data/personas.json` 등 | 페르소나 6·상황·주제·지역·용어 사전 |
| `src/data/today-issue.json` | 첫 화면 "오늘의 이슈" (하루 2회 자동 갱신) |
| `src/data/noindex-paths.json` | 색인 제외 목록 (§2) |
| `src/content/guides/` | 긴 안내 글 (markdown) |

- 글 주소: 2026-07-10 이후 발행분은 `/issues/{slug}/`, 그 전은 `/issues/{날짜}/{slug}/` 유지 (`src/lib/issue-url.mjs`)
- 글 발행 조건은 `src/lib/issue-gate.mjs` 하나로 판정한다 — 상세·목록·뉴스 사이트맵이 같은 판정을 쓴다
- 새 글은 `contentVersion: 2` 규칙(`docs/ops/READER-UX-V2.md`)과 이중 노출 표준(`docs/ops/GOOGLE-NAVER-DUAL-STANDARD.md`)을 따른다
- 기존 글 정정 범위는 운영자 결재 사항이다

## 5. 화면 주소

정적:
`/` `/about/` `/ads-policy/` `/contact/` `/cookies/` `/demo/` `/editor/jjh/` `/editorial-policy/` `/feeds/` `/guide/` `/preferences/` `/privacy/` `/terms/` `/quick/` `/calculators/` `/calculators/eitc/` `/calculators/median-income/` `/404`

목록·묶음:
- `/issues/` · `/issues/all/[...page]` · `/issues/topics/[term]` · `/issues/main/`(다른 쪽으로 넘기는 쪽, 사이트맵 제외)
- `/issues/[...path]` — 글 상세 (날짜 있는 주소·없는 주소 모두)
- `/subsidies/` · `/subsidies/new/` · `/subsidies/[id]` · `/subsidies/archived/[slug]`(410) · `/subsidies/category/[category]/persona/[persona]`
- `/categories/[id]` · `/personas/[id]` · `/situations/[id]` · `/topics/[id]` · `/regions/[id]` · `/glossary/[id]` · `/guides/[slug]` (각각 목록 쪽 있음)

피드·기계용:
`/feed.xml` `/feed-issues.xml` `/feed.json` `/atom.xml` `/rss/[cat].xml` `/sitemap-news.xml` `/sitemap-index.xml` `/llms.txt` `/llms-full.txt`

서버 기능 (`src/pages/api/`, 요청 수 제한 있음):
`/api/contact` `/api/feedback` `/api/health` `/api/vitals`

## 6. 서버 (Cloudflare Worker)

- `src/worker.ts` (44줄)이 하는 일은 셋뿐이다
  - 옛 도메인 주인(워드프레스) 주소 → 410 (`src/lib/legacy-gone.ts`)
  - 없는 쪽 → 404 화면 + `x-robots-tag: noindex`
  - 나머지 → 정적 파일 그대로
- `wrangler.jsonc`: `run_worker_first`는 `/`와 404 경로만, 측정값은 Analytics Engine `awoo_vitals`
- 보안 머리글: `public/_headers` (HSTS·CSP 등), 넘기기 규칙: `public/_redirects`
- CSP의 스크립트 허용에 `'unsafe-inline'`이 남아 있다 — 광고·분석 태그 때문, 과제는 `docs/ops/CSP-NONCE.md`
- 한국에서 접속하면 Cloudflare 로스앤젤레스 서버로 가는 경우가 있다 (2026-11-16 측정, 첫 응답 1~2초)

## 7. 화면 부품

- `src/layouts/BaseLayout.astro` — 유일한 틀. 제목·설명·대표 주소·공유 카드, 구조화 데이터(Organization·WebSite·SiteNavigationElement), noindex 판정, 분석(GA4·네이버)·자동 광고 태그
- `src/components/` — Badge, BlufBox, Button, Chip, Container, CrossRefRail, FeedbackWidget, Footer, HotkeyNav, Icon, PageHeader, TopBar
- `src/components/home/` — NewsHero, UrgencyHook, IncomeChecker(.astro/.tsx), PersonaPicker, CategoriesGrid, OtherIssuesSection, QuickCheckCTA, RecentlyAdded
- `src/components/calculators/EitcCalculator.tsx`
- `src/lib/` — schema.ts(구조화 데이터), issue-url.mjs, issue-gate.mjs, related-posts.mjs, inline-glossary.ts, deadline-format.ts, subsidy-display.ts, subsidies-meta.ts, feed-content.ts, legacy-gone.ts, vitals.ts, anon-prefs.ts, api/(요청 제한·입력 검사·오류 기록)

## 8. 빌드

`npm run build` 순서:
1. `prebuild` — 공유 카드 이미지 생성 (`generate-og-images.mjs`)
2. `build-entity-graph.mjs` — 페르소나·상황·주제·지원금 연결표
3. `astro build`
4. `prune-sitemap-noindex.mjs` — noindex 쪽을 사이트맵에서 뺀다
5. `check-bundle-size.mjs` — 용량 관문

검사 명령: `npm run lint`(Biome), `npm run lint:content`(글 무결성, CI 관문), `npm run check`(astro check + tsc), `npm run lhci`(성능 점수 관문), `npm run verify`(전부)

자동 시험(단위·화면 시험) 코드는 없다.

## 9. 자동 작업 (`.github/workflows/`)

| 파일 | 하는 일 | 일정 (UTC) |
|---|---|---|
| ci.yml | 검사·빌드·성능 점수 관문 | 푸시·PR |
| deploy.yml | Cloudflare 배포 (md·docs·.github만 바뀌면 건너뜀) | main 푸시 |
| sync-issues.yml | 네이버 뉴스 → 오늘의 이슈, 바뀌면 빌드·배포·IndexNow | `0 21,7 * * *` |
| publish-scheduled.yml | 예약 글 발행 | `15 9 * * *` |
| sync-subsidies.yml | 보조금24 동기화 | `0 18 * * 0` |
| sweep-stale.yml | 마감 지원금 정리 | `0 18 * * 1` |
| check-apply-urls.yml | 신청 링크 살아 있는지 표본 확인 | `0 19 * * 2` |
| dep-audit.yml | 의존성 취약점 확인 | `0 19 * * 3` |
| citations.yml | AI 답변 인용 추적 | `0 23 * * 0` |
| indexnow.yml · traffic-probe.yml · auto-publish-0400.yml | 손으로 실행 | — |
| keyword-pipeline.yml · keyword-radar.yml · naver-rank.yml | 네이버 기준 작업, 일정 꺼 둠 (2026-11-11) | — |

- 오늘의 이슈는 뉴스에 묶을 주제가 없는 날 "그대로 둠"으로 정상 종료한다 (2026-11-16부터)
- 쓰는 저장소 비밀값: CLOUDFLARE_API_TOKEN·CLOUDFLARE_ACCOUNT_ID, NAVER_CLIENT_ID·NAVER_CLIENT_SECRET, NCP_API_KEY_ID·NCP_API_KEY(네이버 API HUB), NAVER_SEARCHAD_*(검색광고 API), DATA_GO_KR_KEY, INDEXNOW_KEY, PERPLEXITY_API_KEY, LHCI_GITHUB_APP_TOKEN
- 로컬 비밀값은 `.env.local` (gitignore)

## 10. 운영 스크립트 (`scripts/`, 54개)

- 데이터: sync-issues, sync-history, sync-subsidies, publish-scheduled, sweep-stale, tag-personas, update-today-md, merge-data-store
- 구글 정리: index-prune-classify, index-request-queue, prune-sitemap-noindex, indexnow-ping
- 빌드 보조: build-entity-graph, generate-og-images, generate-icons, check-bundle-size
- 검사: lint-content, audit-*(제목·소제목·건너뛰기 링크·RSS·구체성·본문 깊이), schema-validate, internal-link-audit, llms-freshness, keyword-coverage, check-apply-urls
- 키워드·네이버(지금은 거의 안 씀): keyword-pipeline, keyword-radar, keyword-volume, searchad-volume, next-wave, wave-split, wave-auto, naver-rank-check, build-cluster-intents, eye-offset, ingest-analytics, ingest-search-advisor, traffic-probe, citation-tracker
- 운영자 화면: ops-dashboard(`npm run ops:dashboard` → `docs/ops/dashboard.html`, gitignore), ops-widget
- 기타: cycle-runner, hwp-text(한글 파일 본문 추출)
- 공용 모듈: `scripts/lib/`

## 11. 글 작성 팀 (`.claude/`)

- 에이전트 12종 (`.claude/agents/`): keyword-scout, emerging-keyword-hunter, longtail-strategist, cluster-auditor, naver-serp-scout, post-writer, fact-checker, google-quality-auditor, naver-content-shaper, quality-gate, publish-gatekeeper, naver-rank-tracker
- 명령 9종 (`.claude/commands/`): /post, /sprint, /today, /목록, /naver, /naver-daily, /traffic, /cycle, /dashboard
- 수동 발행 절차: `docs/ops/MANUAL-POSTING.md`

## 12. 알아 둘 함정

- 프로젝트 경로에 `#` 쓰지 말 것 (Vite 빌드 실패)
- 푸시 전 빌드가 lefthook에서 돈다. 실패 판독은 요약 위 빌드 오류부터 (`lefthook.yml` 주석)
- 저장소는 공개다 — 광고 수익 금액을 파일·주석·커밋에 적지 않는다
- 사이트 화면·llms 파일에 AI 활용 표시를 넣지 않는다 (운영자 결정 2026-10-14)
