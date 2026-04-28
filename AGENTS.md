# AGENTS.md — 2026 표준 웹사이트 제작 바이브 코딩 지시사항

## 본 문서의 위상

이 파일은 AI 코딩 에이전트(Claude Code, Cursor, Windsurf, Cline, Aider 등)가 웹사이트를 신규 제작하거나 리뉴얼할 때 반드시 따라야 하는 **단일 표준 작업 지시서**이다.

2026년 3월 구글 코어/스팸 업데이트, 통합 Core Web Vitals 점수, 생성형 엔진 최적화(GEO), AI 답변 엔진 인용 표준을 모두 반영한다.

에이전트는 모든 단계를 건너뛰지 않고 순서대로 수행하며, 각 단계 종료 시 체크리스트를 자체 검증한 뒤 다음 단계로 넘어간다.

---

## 0. 작업 개시 전 — 컨텍스트 수립 (Discovery)

에이전트는 코드를 한 줄도 작성하기 전에 다음을 먼저 확정한다. 항목이 누락된 경우 사용자에게 즉시 질문한다.

### 0-1. 비즈니스 컨텍스트 확정

- 사이트의 1차 목표 (정보 제공 / 리드 생성 / 전자상거래 / SaaS / 미디어 / 포트폴리오 중 택일)
- 핵심 KPI (트래픽, 전환율, AI 인용 점유율, 회원 가입수, 매출 등)
- 타겟 시장 (국가, 언어, 디바이스 비율)
- 타겟 페르소나 (1차/2차 사용자, 검색 의도 패턴)
- 경쟁사 URL 3~5개 식별 및 벤치마크 항목 정의
- 브랜드 톤앤매너, 컬러 시스템, 로고 자산 확보 여부
- 법적 요건 (GDPR, CCPA, 한국 개인정보보호법, 쿠키 동의)

### 0-2. 검색·AI 가시성 전략 확정

- 핵심 키워드 클러스터 5~15개와 각 클러스터의 시드 키워드 정의
- Topical Authority 맵 작성: 메인 토픽 → 서브 토픽 → 롱테일 의도까지 트리 구조로
- AI 답변 엔진 타겟: ChatGPT / Google AI Overviews / Perplexity / Gemini 중 우선순위
- 인용 시나리오: AI가 어떤 질문을 받았을 때 본 사이트를 인용하게 만들 것인가? 최소 20개 시나리오 문서화
- 검색 의도 분류: Informational / Navigational / Commercial / Transactional 별 비중

### 0-3. 기술적 제약 확정

- 호스팅 환경 (Vercel / Cloudflare / AWS / 자체 서버)
- 도메인, 서브도메인, CDN 설정 권한
- 기존 사이트 존재 시 — 301 리다이렉트 매핑, 기존 URL 보존 정책
- 운영 인력의 기술 수준 (CMS 필요 여부)
- 예상 트래픽 규모와 확장성 요구

> ⛔ **0단계가 끝나지 않으면 절대 1단계로 진행하지 않는다. 누락된 정보는 추측하지 말고 질문한다.**

---

## 1. 기술 스택 선정 (Stack Decision)

### 1-1. 프레임워크 선정 원칙

2026년 표준은 **SSR(서버 사이드 렌더링)** 또는 **SSG(정적 생성)** 기반이다. CSR(클라이언트 사이드 렌더링) 단독은 AI 크롤러가 콘텐츠를 추출하지 못하므로 금지한다.

권장 스택 우선순위:
- 콘텐츠 중심 사이트: Astro 5+ / Next.js 15+ (App Router, RSC) / Nuxt 3+
- 앱 성격이 강한 사이트: Next.js 15+ / SvelteKit 2+ / Remix
- 블로그·문서: Astro / Hugo / 11ty
- e커머스: Next.js Commerce / Shopify Hydrogen / Medusa

### 1-2. 필수 보조 도구

- 타입 시스템: TypeScript strict mode 기본
- 린터/포매터: ESLint flat config + Prettier (또는 Biome 단일화)
- 패키지 매니저: pnpm 또는 bun
- CSS: Tailwind CSS 4 / vanilla-extract / CSS Modules — 런타임 CSS-in-JS는 INP에 악영향이므로 지양
- 이미지: 프레임워크 내장 이미지 컴포넌트 (next/image, astro:assets 등) 필수
- 분석: GA4 + Search Console + 자체 RUM(예: Vercel Speed Insights, Cloudflare Web Analytics)
- 에러 추적: Sentry 또는 동급 솔루션
- CMS: Sanity / Contentful / Strapi / Payload / 또는 MDX 파일 기반

### 1-3. 절대 사용 금지 패턴

- ❌ 클라이언트에서만 렌더링되는 SPA (단, 인증 후 대시보드 영역은 예외)
- ❌ 런타임 CSS-in-JS 라이브러리 중 hydration cost가 큰 것
- ❌ jQuery 신규 도입
- ❌ 자체 폰트 호스팅 없이 외부 폰트 CDN 직참조 (FOUT/FOIT 위험)

---

## 2. 정보 아키텍처 (IA) 설계

### 2-1. URL 구조 원칙

- 모두 소문자, 하이픈 구분, 영문 슬러그(또는 다국어 IDN)
- 깊이 3단계 이하 권장 (`/category/subcategory/post-slug`)
- 트레일링 슬래시 정책을 하나로 통일하고 리다이렉트 일관 적용
- 쿼리 스트링 기반 라우팅 금지 (필터링 외 콘텐츠 구분 용도로 사용 금지)
- 날짜 포함 URL은 콘텐츠 영구성에 영향 — 뉴스가 아니라면 날짜 제외

### 2-2. 사이트맵 설계

- 메인 토픽 → 허브(Pillar) 페이지 → 서브 토픽(Cluster) 페이지의 토픽 클러스터 모델 구축
- 모든 클러스터는 허브로, 허브는 다시 클러스터로 양방향 내부 링크
- 고아 페이지(Orphan) 0개 — 모든 페이지는 최소 한 곳에서 링크되어야 함
- 클릭 깊이(Click Depth) 3 이하 유지
- 페이지네이션은 `rel="next/prev"` 대신 무한 스크롤일 경우에도 검색용 정적 인덱스 페이지 별도 생성

### 2-3. 내비게이션 설계

- 글로벌 네비 항목은 5±2개
- 푸터에 사이트맵 요약, 회사 정보, 정책, 연락처 명시
- 빵부스러기(Breadcrumb)는 모든 하위 페이지에 노출하고 BreadcrumbList 스키마 부착

---

## 3. 디자인 시스템 구축

### 3-1. 디자인 토큰

- 컬러: primary, secondary, accent, neutral 0-950 단계, semantic(success/warning/error/info)
- 타이포그래피: heading 1~6, body, caption — 각 사이즈/줄높이/letter-spacing 토큰화
- 간격(spacing): 4px 또는 8px 그리드 기반 스케일
- 라운딩(radius), 그림자(shadow), 보더, 모션 duration/easing 토큰
- 다크 모드 컬러 페어링 — `prefers-color-scheme` 대응

### 3-2. 반응형 브레이크포인트

- 모바일 우선(Mobile First) 작성
- 표준 브레이크포인트: 360 / 480 / 768 / 1024 / 1280 / 1536 px
- 컨테이너 쿼리(`@container`) 활용으로 컴포넌트 단위 반응형 구현

### 3-3. 컴포넌트 라이브러리

- 원자(Atom) → 분자(Molecule) → 유기체(Organism) → 템플릿 → 페이지 5단계 분리
- 모든 컴포넌트는 props 타입 정의, Storybook 또는 Ladle 문서화
- 접근성 우선 라이브러리 사용: Radix UI / React Aria / Headless UI

---

## 4. 통합 Core Web Vitals 최적화 (2026 신규 기준)

> 2026년 3월 코어 업데이트 이후 LCP·INP·CLS는 합산 통합 점수로 평가된다. 단일 지표만 좋아도 통과하지 않는다. 셋 모두 "Good" 임계값 이내여야 한다.

### 4-1. 임계값 (필수 달성)

| 지표 | 2026 Good 임계값 | 비고 |
|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5s | 75th percentile |
| INP (Interaction to Next Paint) | ≤ 150ms | 2026년 200→150ms 강화 |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | |
| TTFB (Time to First Byte) | ≤ 600ms | |
| FCP (First Contentful Paint) | ≤ 1.8s | |

### 4-2. LCP 최적화 체크리스트

- LCP 요소 식별 (보통 hero 이미지 또는 hero 텍스트 블록)
- LCP 이미지에 `fetchpriority="high"` 부여
- LCP 이미지 `<link rel="preload">` 적용
- LCP 영역에는 외부 폰트 로딩 의존 제거 또는 `font-display: optional`
- hero 영역 above-the-fold 콘텐츠는 SSR/SSG로 즉시 렌더
- CDN 엣지 캐싱으로 TTFB 단축
- 이미지는 AVIF → WebP → JPEG 순으로 `<picture>` 폴백

### 4-3. INP 최적화 체크리스트 (2026 핵심)

- 메인 스레드 long task 50ms 초과 0건 목표
- 무거운 자바스크립트는 Web Worker로 오프로드
- 이벤트 핸들러 내부에 `requestIdleCallback` 또는 `scheduler.yield()` 활용
- React/Vue/Svelte 사용 시 — concurrent rendering, transition 활용
- hydration 비용 최소화: Islands 아키텍처(Astro), Partial Hydration, RSC 활용
- 서드파티 스크립트는 defer + Partytown으로 워커 격리
- 폼 입력, 드롭다운, 모달 오픈 등 자주 발생하는 인터랙션 INP 측정
- CSS animations 사용 시 GPU accelerated property(transform/opacity)만 사용

### 4-4. CLS 최적화 체크리스트

- 모든 `<img>`에 명시적 width/height 또는 aspect-ratio 지정
- 광고/임베드 슬롯 사전 공간 예약 (min-height)
- 폰트 로딩으로 인한 텍스트 시프트 방지: size-adjust, ascent-override 활용
- 동적으로 삽입되는 배너/쿠키 동의는 viewport 상단 고정으로 콘텐츠 밀어내지 않기

### 4-5. 측정 및 검증

- Lighthouse CI를 PR마다 자동 실행, 임계값 미달 시 머지 차단
- PageSpeed Insights 모바일 점수 90+ 확인
- WebPageTest 실측 (Slow 4G, Moto G4 환경)
- Real User Monitoring(RUM) 도입으로 실제 사용자 지표 수집
- CrUX 데이터를 Search Console에서 주간 모니터링

---

## 5. 렌더링 아키텍처

### 5-1. 페이지 유형별 렌더링 전략 매트릭스

| 페이지 유형 | 1차 권장 | 2차 권장 | 사유 |
|---|---|---|---|
| 홈, 랜딩 | SSG | ISR | 변경 빈도 낮음, 캐시 유리 |
| 블로그 글, 문서 | SSG | ISR | LCP/TTFB 최적, AI 크롤러 우호 |
| 카테고리/리스트 | ISR | SSR | 콘텐츠 추가 시 자동 갱신 |
| 검색 결과 | SSR | — | 동적 쿼리 |
| 사용자 대시보드 | SSR + 부분 CSR | — | 인증 의존 |
| 결제, 주문 | SSR | — | 보안·일관성 |
| 관리자 화면 | CSR(인증 후) | — | SEO 무관 |

### 5-2. 스트리밍 SSR / RSC 활용

- React Server Components 또는 SvelteKit/Nuxt streaming 사용 시 — above-the-fold는 동기 렌더, 아래는 Suspense로 스트리밍
- 가장 무거운 데이터 페치는 페이지 외 영역에 격리

### 5-3. AI 크롤러 가시성 보장

- User-Agent가 GPTBot, ClaudeBot, PerplexityBot, Google-Extended, OAI-SearchBot, CCBot 인 경우에도 완전한 HTML이 즉시 반환되어야 함
- curl로 User-Agent 위장 테스트: `curl -A "GPTBot" https://yoursite.com | grep "<main>"` — 핵심 콘텐츠가 HTML에 포함되어야 함
- 자바스크립트 실행 후에만 보이는 콘텐츠는 AI 크롤러에 노출 안 됨

---

## 6. 자바스크립트 최적화

- 초기 JS 번들 ≤ 100KB (gzipped) 목표
- 라우트 단위 코드 스플리팅
- 동적 import로 비핵심 컴포넌트 지연 로드
- Tree shaking이 작동하도록 ES modules 사용, sideEffects 명시
- 미사용 의존성 주기적 제거 (depcheck, knip)
- 폴리필은 modern/legacy 분기 빌드 적용
- 서드파티 스크립트(GA, Tag Manager, 챗봇)는 Partytown 또는 next/script strategy 적절히 적용

---

## 7. 폰트 최적화

### 7-1. 폰트 선정 및 로딩

- 가변 폰트(Variable Font) 1~2개로 통일 — 다중 weight 파일 로드 금지
- 셀프 호스팅 필수 (Google Fonts CDN 직참조 금지 — 개인정보 및 성능 이슈)
- 서브셋팅: 한국어 사이트는 KS X 1001 + 자주 쓰는 한자 + Latin 서브셋
- `font-display: swap` 기본, LCP 영역은 `optional` 검토
- 핵심 폰트 1개만 `<link rel="preload" as="font" type="font/woff2" crossorigin>`
- `size-adjust`, `ascent-override`, `descent-override`로 fallback 폰트 메트릭 매칭하여 CLS 0 달성

### 7-2. 한국어 사이트 추가 사항

- Pretendard, Spoqa Han Sans Neo, 또는 본고딕(Noto Sans KR)
- 한글 글자 수가 많아 서브셋팅 효과 큼 — 페이지별 동적 서브셋 검토

---

## 8. 이미지 최적화

- 프레임워크 내장 이미지 컴포넌트 사용 (수동 `<img>` 지양)
- AVIF → WebP → JPEG/PNG 순 자동 협상
- `srcset/sizes`로 디바이스별 적정 해상도 제공
- LCP 이미지 외에는 `loading="lazy"`, `decoding="async"`
- 명시적 width·height 또는 aspect-ratio로 CLS 방지
- 의미 전달 이미지는 alt 필수, 장식 이미지는 `alt=""`
- CDN 이미지 변환 활용 (Cloudinary, Cloudflare Images, Vercel Image Optimization)
- hero 이미지는 모바일·데스크탑 별도 크롭 제공 (`<picture>` + `<source media>`)

---

## 9. 캐싱 및 전송 최적화

### 9-1. HTTP 캐싱

- 정적 자산(JS/CSS/폰트/이미지): `Cache-Control: public, max-age=31536000, immutable`
- HTML 페이지: `Cache-Control: public, max-age=0, s-maxage=86400, stale-while-revalidate=604800`
- API 응답: 케이스별 적정 max-age + stale-while-revalidate
- ETag 또는 Last-Modified로 조건부 요청 지원

### 9-2. CDN 및 엣지

- 글로벌 CDN 필수 (Cloudflare, Fastly, Vercel Edge)
- HTML도 엣지 캐시 — 동적 페이지는 ISR/Edge Caching with revalidate
- HTTP/2 또는 HTTP/3 활성화
- Brotli 압축 활성화 (정적 사전 압축)
- Early Hints (103) 활용으로 핵심 자산 preload

### 9-3. 서비스 워커 (선택)

- PWA가 목적이 아니라면 캐시 파인 튜닝 외 사용 자제 — 잘못 쓰면 INP 악화

---

## 10. 구조화된 데이터 (Schema.org / JSON-LD)

> 모든 페이지는 최소 WebSite + Organization + 페이지 유형별 스키마를 부착한다.

### 10-1. 사이트 전체에 1회씩 (보통 홈)

- Organization (logo, sameAs, contactPoint, address)
- WebSite + SearchAction (사이트 내 검색)
- BreadcrumbList (모든 내부 페이지)

### 10-2. 페이지 유형별

- 블로그/뉴스: Article 또는 BlogPosting / NewsArticle (author, datePublished, dateModified, image, headline)
- 제품: Product + Offer + AggregateRating + Review
- FAQ: FAQPage (각 질문/답변 쌍)
- 방법 안내: HowTo (step별 image, text)
- 이벤트: Event
- 로컬 비즈니스: LocalBusiness 하위 적합 타입
- 레시피: Recipe
- 동영상: VideoObject (thumbnailUrl, contentUrl, uploadDate, duration)
- 저자 페이지: Person (jobTitle, sameAs, knowsAbout)

### 10-3. 검증

- Schema Markup Validator (https://validator.schema.org)
- Google Rich Results Test
- Search Console의 Enhancements 리포트

---

## 11. 메타데이터 및 기본 SEO

### 11-1. 페이지별 필수 메타

- `<title>` 50~60자, 핵심 키워드 + 브랜드
- `<meta name="description">` 140~160자, CTA 포함
- `<link rel="canonical">` 자기참조 또는 정본 지정
- Open Graph: og:title, og:description, og:image (1200×630), og:url, og:type, og:site_name
- Twitter Card: summary_large_image, twitter:title, twitter:description, twitter:image
- `<meta name="theme-color">` (브랜드 컬러)
- `<html lang="ko">` 또는 적절한 언어 코드
- viewport: `<meta name="viewport" content="width=device-width, initial-scale=1">`

### 11-2. 사이트 전체 파일

- `/robots.txt` — 명확한 Allow/Disallow + Sitemap 위치
- `/sitemap.xml` — 동적 생성, 1만 URL 초과 시 인덱스 사이트맵으로 분할
- `/sitemap-news.xml` (뉴스 사이트)
- `/sitemap-images.xml` (이미지 다수 사이트)
- `/.well-known/security.txt`
- `/llms.txt` — AI 크롤러용 사이트 요약 (LLM Friendly Index)
- `/llms-full.txt` — 전체 콘텐츠 마크다운 합본 (선택)

### 11-3. robots.txt 필수 항목 (2026)

```
User-agent: *
Allow: /

# AI 크롤러 명시적 허용 (가시성 확보 목적)
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: OAI-SearchBot
Allow: /

Sitemap: https://example.com/sitemap.xml
```

> AI 크롤러 차단 여부는 비즈니스 정책에 따라 결정. GEO 가시성 확보가 목표라면 허용이 기본값이다.

### 11-4. hreflang (다국어)

- 모든 언어 버전 페이지에 상호 hreflang 링크
- x-default 포함
- sitemap.xml에 hreflang 표기

---

## 12. 생성형 엔진 최적화 (GEO) — 2026 핵심

### 12-1. AI 인용 가능성(Citability) 설계 원칙

AI 답변 엔진은 **개체(Entity) 기반**으로 정보를 이해하고, **청크(Chunk) 단위**로 추출하며, **신뢰 신호(Trust Signal)**가 강한 소스를 인용한다.

### 12-2. 콘텐츠 청킹(Chunkability) 표준

- 역피라미드 구조: 결론을 첫 문단에 명시 → 근거 → 세부 사항
- 모든 H2/H3 헤딩은 자체 완결적 질문 또는 명확한 명사구
- 한 섹션은 단일 명제만 다룸 (2~5문단)
- 핵심 정의는 별도 박스/콜아웃에 격리 — `<dfn>` 태그 활용
- 단계별 안내는 `<ol>` 명시적 순서, 각 단계는 50자 이내 명령형
- 비교/대조는 표(table)로 — 행/열에 명확한 헤더
- 통계·수치는 단위와 출처를 명시한 `<figure><figcaption>` 패턴

### 12-3. 인용 친화 콘텐츠 패턴 (FOX Method 응용)

- **F**actual: 검증 가능한 사실, 1차 자료 인용
- **O**riginal: 자체 데이터, 인터뷰, 사례 연구 포함
- e**X**plicit: 결론과 핵심 수치를 모호함 없이 명시

### 12-4. 개체(Entity) 신호 강화

- 회사·인물·제품 등 핵심 개체는 About 페이지 별도 작성, Organization/Person/Product 스키마 부착
- sameAs에 위키데이터, 위키피디아, LinkedIn, 공식 SNS, GitHub 등 연결
- 일관된 NAP(Name, Address, Phone) — 모든 페이지·외부 디렉토리에서 동일
- 위키데이터 항목 생성 검토 (가능 시)

### 12-5. E-E-A-T 강화

- 저자 정보: 모든 글에 저자명, 직함, 약력, 사진, sameAs 링크
- 편집 정책 페이지: 사실 확인 절차, 정정 정책, 광고 정책 명시
- 연락처 페이지: 실주소, 사업자등록번호, 대표자, 전화, 이메일
- 발행일·수정일 명시, 오래된 글은 주기적 업데이트
- 의료·금융·법률 콘텐츠는 자격을 갖춘 전문가의 검수 표시
- 외부 권위 사이트로의 인용 링크 포함 (정부, 학술, 1차 자료)

### 12-6. AI 답변 엔진 노출 모니터링

- ChatGPT, Perplexity, Gemini, Google AI Overviews 각각에서 타겟 쿼리 20개 수동 테스트
- 인용 추적 도구 도입 (CitationWatch, Profound, AthenaHQ 등)
- 월간 인용 점유율(Citation Share) 리포트 작성
- 경쟁사 인용 우위 시 콘텐츠 갭 분석 → 개선

### 12-7. llms.txt 작성 표준

사이트 루트에 `/llms.txt` 배치, 다음 구조 따름:

```markdown
# 사이트명

> 한 문장 요약 (사이트 정체성)

핵심 가치 제안 2~3문장.

## 주요 콘텐츠

- [페이지 제목](https://...): 한 줄 설명
- [페이지 제목](https://...): 한 줄 설명

## 정책 및 정보

- [회사 소개](https://.../about)
- [편집 정책](https://.../editorial-policy)

## 선택

- [전체 마크다운 합본](https://.../llms-full.txt)
```

---

## 13. 접근성 (Accessibility / WCAG 2.2 AA)

### 13-1. 의미적 마크업

- 페이지당 `<h1>` 1개, 헤딩 계층 건너뛰지 않기
- 랜드마크: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>` 활용
- 버튼은 `<button>`, 링크는 `<a>` — `<div onClick>` 금지
- 폼 컨트롤마다 `<label>` 명시 연결

### 13-2. 키보드·포커스

- 모든 인터랙티브 요소 키보드 도달 가능
- 포커스 인디케이터 명확 (3:1 이상 대비, 2px 이상 두께)
- 스킵 링크 "본문으로 건너뛰기" 첫 포커스 가능 요소
- 모달 오픈 시 포커스 트랩, 닫을 때 트리거로 복귀

### 13-3. 색상·대비

- 본문 텍스트 4.5:1, 큰 텍스트 3:1, UI 요소 3:1 이상
- 색상 단독으로 정보 전달 금지 (아이콘·텍스트 병행)

### 13-4. ARIA

- 가능하면 네이티브 요소, 불가피할 때만 ARIA
- 동적 영역은 `aria-live` 적절히 적용
- 토글·탭·드롭다운 등 위젯은 ARIA Authoring Practices 준수

### 13-5. 미디어

- 이미지 alt, 동영상 자막(VTT), 음성 트랜스크립트
- 자동 재생 금지 (또는 음소거 기본)
- `prefers-reduced-motion` 존중

### 13-6. 검증

- axe-core 자동 검사 CI 통합, 위반 0건
- Lighthouse Accessibility 점수 95+
- 스크린 리더 수동 테스트 (NVDA / VoiceOver)
- 키보드만 사용 전체 플로우 통과

---

## 14. 보안

### 14-1. 전송 보안

- HTTPS 전체 강제, HTTP는 308로 HTTPS 리다이렉트
- HSTS: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- HSTS Preload 등록 검토
- TLS 1.3, 안전한 cipher suite

### 14-2. HTTP 보안 헤더

- `Content-Security-Policy` — 인라인 스크립트 nonce 또는 hash 기반
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — 사용 기능만 명시
- `X-Frame-Options: SAMEORIGIN` 또는 CSP frame-ancestors
- `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy` (격리 필요 시)

### 14-3. 인증·인가

- 비밀번호 해시: bcrypt/scrypt/argon2id
- OAuth/OIDC 표준 라이브러리 사용 (자체 구현 금지)
- 세션 쿠키: `Secure; HttpOnly; SameSite=Lax 또는 Strict`
- CSRF 토큰 (state-changing 요청)
- Rate limiting (로그인, 폼 제출, API)

### 14-4. 의존성·코드

- pnpm audit / npm audit CI 통합
- Renovate 또는 Dependabot으로 자동 업데이트 PR
- 시크릿은 환경변수, 절대 커밋 금지 (`.env*` gitignore + git-secrets)
- OWASP Top 10 점검

### 14-5. 봇 보호

- 폼·로그인에 reCAPTCHA v3 또는 Cloudflare Turnstile
- 단, 검색 봇·AI 크롤러는 차단하지 않을 것

---

## 15. 분석·추적·동의

### 15-1. 동의 관리(CMP)

- GDPR/CCPA/한국 개보법에 부합하는 쿠키 동의 배너
- 동의 전에는 비필수 쿠키·추적 스크립트 로드 금지 (Google Consent Mode v2 활용)
- 동의 철회 가능

### 15-2. 분석 설치

- GA4 + Search Console 연동
- 핵심 이벤트 정의 (페이지뷰, 스크롤 75%, 외부 링크, 폼 제출, 다운로드, 동영상 재생)
- 전환 이벤트 → KPI 매핑
- UTM 파라미터 캠페인 정책 문서화
- 1st-party 분석 검토 (Plausible, Fathom, Umami)

### 15-3. RUM (Real User Monitoring)

- CWV 실측 도입
- 에러율 (JS error, 4xx, 5xx) 모니터링
- 알림 임계값 설정

---

## 16. 국제화 (i18n) — 다국어 사이트 한정

- URL 전략 결정: 서브디렉토리(`/en/`) 권장 / 서브도메인 / ccTLD
- 모든 언어 페이지에 hreflang + x-default
- 번역은 기계 번역 단독 금지 — 최소한 후편집(MTPE) 또는 전문 번역
- 통화·날짜·숫자 포맷 로케일 대응
- RTL 언어 지원 시 `dir="rtl"` 및 논리 속성(`margin-inline-start` 등) 사용

---

## 17. 성능 예산 (Performance Budget)

PR마다 자동 검증, 초과 시 머지 차단:

| 자원 | 페이지당 한도 |
|---|---|
| 초기 HTML | ≤ 50 KB (gzipped) |
| 초기 JS (실행되는) | ≤ 100 KB (gzipped) |
| 초기 CSS | ≤ 30 KB (gzipped) |
| 초기 폰트 | ≤ 100 KB |
| LCP 이미지 | ≤ 200 KB |
| 페이지 전체 전송량 | ≤ 1 MB (above-the-fold) |
| 메인 스레드 long task | 0건 (>50ms) |
| Lighthouse Performance | ≥ 90 (모바일) |
| Lighthouse SEO | ≥ 95 |
| Lighthouse Accessibility | ≥ 95 |
| Lighthouse Best Practices | ≥ 95 |

---

## 18. 테스트 및 품질 보증

### 18-1. 자동화 테스트

- 단위 테스트: 비즈니스 로직 ≥ 80% 커버리지 (Vitest, Jest)
- 컴포넌트 테스트: Testing Library
- E2E 테스트: Playwright — 핵심 사용자 플로우
- 시각 회귀: Chromatic, Percy, Playwright snapshots
- 타입 체크: `tsc --noEmit` CI

### 18-2. SEO·GEO 회귀 테스트

빌드 후 자동 크롤링으로 다음 검증:
- 모든 페이지에 `<title>`, `<meta description>`, canonical 존재
- 깨진 링크(4xx/5xx) 0건
- `<h1>` 정확히 1개
- 이미지 alt 누락 0건
- 구조화된 데이터 검증 통과
- sitemap에 모든 인덱싱 대상 포함, noindex 페이지 미포함
- AI 크롤러 시뮬레이션: GPTBot/ClaudeBot User-Agent로 fetch 후 핵심 콘텐츠 HTML 포함 확인

### 18-3. 수동 검증 체크리스트

- 모바일 실기기 3종 이상 (저가 안드로이드 포함)
- 다크 모드 / 라이트 모드 시각 확인
- 느린 네트워크(Slow 3G) 사용 가능성 확인
- 자바스크립트 비활성화 시 핵심 콘텐츠 접근 가능 여부
- 인쇄 스타일시트(`@media print`) 확인

---

## 19. 배포·운영

### 19-1. CI/CD

- PR 단위 프리뷰 배포 (Vercel/Netlify Preview)
- main 머지 시 프로덕션 자동 배포
- 배포 단계: 빌드 → 자동 테스트 → 성능 예산 검증 → 보안 스캔 → Lighthouse CI → 배포
- 즉시 롤백 가능한 무중단 배포

### 19-2. 모니터링·알림

- Uptime 모니터링 (UptimeRobot, Pingdom 등)
- 에러 알림 (Sentry → Slack/Email)
- CWV 저하 알림
- Search Console Coverage 이슈 주간 점검

### 19-3. 백업·복구

- DB 일일 백업, 30일 보관
- 복구 절차 문서화 + 분기별 복구 훈련
- 콘텐츠 버전 관리 (CMS 자체 또는 Git)

---

## 20. 기존 사이트 마이그레이션 (해당 시)

- 기존 URL 인벤토리 추출 (Search Console + Analytics + 크롤러)
- 트래픽 상위 페이지·백링크 보유 페이지 우선 보존
- 301 리다이렉트 매핑 1:1 작성, 체인·루프 0건
- 기존 메타데이터·구조화된 데이터 보존 또는 개선
- 마이그레이션 직후 Search Console 주소 변경 도구 사용 (도메인 변경 시)
- 4주간 일일 트래픽·순위 모니터링, 비정상 변동 시 즉시 대응

---

## 21. 콘텐츠 운영 표준 (사이트 오픈 후 지속)

### 21-1. 콘텐츠 제작 절차

1. 키워드·검색 의도 분석
2. 토픽 클러스터 내 위치 확정
3. 경쟁사 SERP 및 AI 답변 분석
4. 콘텐츠 브리프 작성
5. 초안
6. 1차 자료·데이터 보강
7. 전문가 검수(해당 시)
8. 편집·교정
9. 메타·스키마·이미지
10. 발행
11. 내부 링크 보강
12. 성과 추적

### 21-2. 콘텐츠 품질 게이트

- 독창성: 표절 검사 통과, 자체 데이터·관점 포함
- 충분성: 검색 의도를 완전히 충족하는 깊이
- 정확성: 모든 사실 주장에 출처
- 최신성: 6~12개월마다 재검토 일정 등록
- 인용 가능성: 청킹 표준(§12-2) 준수

### 21-3. AI 생성 콘텐츠 정책

- AI 단독 생성 후 무편집 발행 금지 (2026 스팸 업데이트 표적)
- AI 보조 시 — 사람의 사실 확인, 1차 경험 추가, 편집 의무화
- AI 보조 사실 투명 공개 권장 (편집 정책 페이지)

---

## 22. 에이전트 작업 진행 규칙 (메타 지시)

### 22-1. 진행 절차

1. 본 문서의 0단계부터 순서대로 진행한다.
2. 각 단계 종료 시 해당 체크리스트를 자체 점검하고, 미충족 항목을 사용자에게 보고한다.
3. 단계 간 의존성이 있는 경우 — 예: 4단계 CWV는 5·6·7·8·9단계 결과에 의존 — 마지막에 통합 검증한다.
4. 코드 변경마다 lint, type-check, 테스트, 빌드를 순서대로 실행하여 모두 통과한 뒤에만 다음 작업으로 이동한다.
5. 외부 라이브러리 추가는 사용자 승인을 거친다 (번들 크기와 보안 영향 고려).

### 22-2. 보고 형식

모든 단계 완료 후 다음 형식으로 보고:

```
✅ 완료한 작업: ...
⚠️ 부분 완료: ...
❌ 차단된 항목 + 차단 사유: ...
🔍 사용자 확인 필요 사항: ...
📊 측정 지표 (LCP/INP/CLS/번들 크기 등): ...
🔗 변경 파일 경로 목록: ...
```

### 22-3. 추측·환각 금지

- 알 수 없는 비즈니스 사실은 추측하지 않고 질문한다.
- 라이브러리 API는 최신 공식 문서를 확인 후 사용한다 (필요 시 검색·MCP 도구 활용).
- 실제로 실행·검증하지 않은 결과를 "성공"으로 보고하지 않는다.
- 임시 해결책(workaround)을 사용한 경우 명시적으로 표기하고 후속 작업 항목으로 등록한다.

### 22-4. 변경 이력

- 모든 변경은 의미 있는 커밋 메시지(Conventional Commits)로 분리
- 본 AGENTS.md 자체의 수정도 PR 대상

---

## 23. 최종 출시 전 체크리스트 (Go-Live)

### 기술

- 모든 페이지 SSR/SSG 렌더 결과에 핵심 콘텐츠 포함 (curl로 검증)
- 통합 CWV: LCP ≤ 2.5s, INP ≤ 150ms, CLS ≤ 0.1 (모바일)
- Lighthouse 4개 카테고리 모두 90+ (모바일)
- 성능 예산 §17 통과
- HTTPS·HSTS·CSP·기타 보안 헤더 적용 (securityheaders.com A+ )
- 자동 테스트 전체 통과
- axe 위반 0건
- 깨진 링크 0건

### SEO·GEO

- robots.txt, sitemap.xml, llms.txt 게시
- 모든 페이지 title/description/canonical/OG/Twitter
- 페이지 유형별 구조화된 데이터 적용 + 검증 통과
- BreadcrumbList 전 페이지 적용
- hreflang (다국어 시) 검증
- Search Console 등록, 사이트맵 제출
- AI 크롤러 User-Agent 시뮬레이션 통과
- 청킹 표준 §12-2 적용된 핵심 페이지 ≥ 20개

### 운영

- GA4 + Search Console 데이터 흐름 확인
- 동의 배너 동작 (지역별)
- 에러 추적·Uptime·RUM 알림 동작
- 백업·롤백 절차 검증
- 운영자용 문서(README, 콘텐츠 작성 가이드, 응급 대응 매뉴얼) 작성

### 법·콘텐츠

- 개인정보처리방침, 이용약관, 쿠키 정책
- 사업자 정보·연락처 명시
- 저작권 표기, 외부 콘텐츠 라이선스 확인
- 회사 소개·저자 페이지·편집 정책 게시 (E-E-A-T)

---

## 부록 A — 빠른 명령 모음 (에이전트가 자주 쓰는 명령)

```bash
# 의존성 보안 점검
pnpm audit --audit-level=moderate

# 미사용 코드/의존성 검출
pnpm dlx knip
pnpm dlx depcheck

# 번들 분석
pnpm build && pnpm dlx source-map-explorer dist/**/*.js

# Lighthouse CI 로컬
pnpm dlx @lhci/cli autorun

# 접근성 자동 검사
pnpm dlx pa11y-ci --sitemap https://localhost:3000/sitemap.xml

# AI 크롤러 시뮬레이션
curl -A "GPTBot/1.0" https://example.com/ | grep -E "<h1|<main"
curl -A "ClaudeBot/1.0" https://example.com/ | wc -c

# Schema 검증
pnpm dlx schema-dts-gen ...

# Sitemap 검증
curl -s https://example.com/sitemap.xml | xmllint --noout -
```

---

## 부록 B — 자주 빠뜨리는 항목 Top 10

1. INP 150ms 임계값 (2026 강화) — 측정 자체를 안 함
2. AI 크롤러용 SSR 검증 — JS 실행 전 HTML에 핵심 콘텐츠 없음
3. 폰트 fallback 메트릭 매칭(size-adjust) 누락으로 발생하는 미세 CLS
4. 이미지 width·height 누락
5. canonical 자기참조 누락
6. 동일 콘텐츠 trailing slash 유무 차이로 중복
7. llms.txt 없음
8. 저자 페이지·편집 정책 페이지 없음 → E-E-A-T 약화
9. 깨진 hreflang (자기 참조 또는 x-default 누락)
10. 동의 전에 GA가 로드되어 GDPR 위반

---

**문서 버전**: 2026.04
**다음 검토 예정**: 다음 구글 코어 업데이트 발표 후 7일 이내
**소유**: 본 프로젝트 SEO·GEO 책임자
