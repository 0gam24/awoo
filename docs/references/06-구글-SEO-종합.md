# 📘 Google 검색 SEO 종합 레퍼런스

> **원전**: developers.google.com/search/docs (Google Search Central 공식 문서)
> **분류**: SEO 외부 — Google 검색 노출 전략
> **smartdatashop.kr 적용 영역**: Google News 신청 / 인덱싱 / 리치 결과 / Core Web Vitals
> **라이선스**: 원문 CC BY 4.0

---

## 1. 핵심 개념 빠르게

| 영역 | 핵심 메시지 | 우리 사이트 적용 포인트 |
|---|---|---|
| **Search Essentials** | 기술 요건 + 스팸 정책 + 주요 권장사항 | 메인 + 9개 자매 모두 적용 |
| **E-E-A-T** | Experience·Expertise·Authoritativeness·Trustworthiness 중 **신뢰성이 최상위** | verifiedBy + 1차 출처 + 저자 이력 = 신뢰성 강화 |
| **사용자 중심** | 검색엔진이 아닌 **사람을 위한 콘텐츠** | "한국의 데이터를 매일 5분으로" 포지션 그대로 유지 |
| **AI 콘텐츠** | AI 사용 자체는 OK. **순위 조작 목적**의 양산만 위반 | AI 정책 페이지 + "어떻게 만들어졌는가" 공개 = 적합 |
| **확장된 콘텐츠 악용** | 가치 없이 AI로 다량 페이지 양산 = 즉시 위반 | 1차 출처 + 운영자 검토 + verifiedBy로 차별화 |
| **사이트 인지도 악용** | 호스트 사이트의 신뢰도를 빌려 양산 써드파티 콘텐츠 게시 | 자매 사이트 각자의 페르소나 = 호스트 신뢰도 도용 아님 |
| **Core Web Vitals** | LCP < 2.5s, INP < 200ms, CLS < 0.1 | Astro 정적 빌드 + Pagefind WASM = 유리한 출발점 |
| **구조화된 데이터** | Article·Breadcrumb·FAQ·Organization 등 | 데이터 저널 = Article + Dataset 마크업이 핵심 |
| **301 리디렉트** | 영구 이전은 **반드시 서버 측 301** | smartdata-shop.com → smartdatashop.kr 마이그레이션 |
| **사이트맵** | 페이지 500개 이하 + 잘 연결되면 필수 아님 | 현재 39페이지지만 **뉴스 사이트맵은 권장** (Google News 목표) |

---

## 2. Google Search Essentials

세 가지 기능:

1. **기술 요구사항** — Googlebot 차단 안 됨 / HTTP 200 / 인덱싱 가능 콘텐츠
2. **스팸 정책** — 위반 시 순위 강등 또는 검색 결과에서 완전 삭제 (§6 참조)
3. **주요 권장사항** — 사용자 중심의 유용한 콘텐츠 / 검색 가능한 단어를 자연스럽게 배치 / 링크는 `<a href>` 사용 / 사이트 홍보 / 이미지·동영상·구조화 데이터 권장사항 준수 / 표시 방식 개선 기능 활용

> **중요**: Google 검색에 표시되는 데에는 **어떤 경우에도 비용이 들지 않는다**.

확인: `site:smartdatashop.kr` 검색하여 결과가 나오면 인덱스에 포함된 것.

---

## 3. Google 검색 작동 방식

### 3.1 페이지 발견 경로

1. **다른 페이지의 링크** — 가장 일반적
2. **사이트맵 제출**
3. **Search Console URL 검사 도구** — 단일 URL 재크롤링 요청

### 3.2 변경사항 반영 시간

며칠 ~ 몇 개월. 변경 결과를 평가하려면 **최소 몇 주 대기**.

### 3.3 Googlebot이 사용자처럼 페이지를 보게 하라

CSS, JavaScript, 이미지 등 모든 리소스 접근 가능해야 함. robots.txt 등으로 차단 시 페이지 이해 실패 → 순위 하락.

---

## 4. E-E-A-T와 사용자 중심

### 4.1 4대 덕목

| 덕목 | 의미 | smartdatashop.kr 적용 |
|---|---|---|
| **Experience (경험)** | 직접 사용·방문·체험 | 1인 사업자 운영자(김준혁) 본인 경험 기반 콘텐츠 |
| **Expertise (전문성)** | 주제에 대한 깊이 있는 지식 | 데이터 출처·해석 방법론 명시 |
| **Authoritativeness (권위)** | 해당 분야 권위자로 인정 | 1차 출처 인용 + 저자 이력 공개 |
| **Trustworthiness (신뢰성)** | **가장 중요한 덕목** | verifiedBy + AI 정책 + 편집 정책 + 제휴 공시 |

> Google은 사람들의 건강·재정·안전·사회 안녕에 영향을 주는 주제(YMYL — Your Money or Your Life)에 더 높은 E-E-A-T 가중치를 부여한다. 우리 사이트의 **세금/금융, 정책, 시장, 통계** 카테고리가 모두 YMYL에 해당한다.

### 4.2 콘텐츠 자기 평가 — 핵심 질문

- 고유한 정보·보고·조사·분석이 있는가?
- 주제에 대해 본질적이고 포괄적인 설명을 제공하는가?
- 뻔하지 않은 분석이나 흥미로운 정보가 있는가?
- 다른 출처를 사용할 때, 단순 복사가 아닌 가치와 독창성을 더하는가?
- 제목이 과장되거나 충격적이지 않은가?
- 북마크하거나 공유할 만한 페이지인가?
- 검색결과의 다른 페이지에 비해 상당한 가치를 제공하는가?

### 4.3 '누가 / 어떻게 / 왜' 프레임워크

이 세 질문에 명확히 답할 수 있을 때 Google 시스템이 보상할 가능성이 높다.

#### **누가** (Who)
- 콘텐츠 작성자가 누구인지 방문자가 분명히 알 수 있는가?
- 바이라인이 있고, 작성자의 배경·전문 분야가 추가 정보로 제공되는가?
- → **smartdatashop.kr 적용**: 모든 기사에 김준혁 명시 + AuthorCard 컴포넌트

#### **어떻게** (How)
- 콘텐츠 제작 과정(테스트·조사·자동화 사용 여부)이 투명하게 공개되어 있는가?
- AI 또는 자동화를 사용한다면 어떻게 사용하는지 배경 제공
- → **smartdatashop.kr 적용**: AI 정책 페이지 + 각 글 하단 verifiedBy + previewMode 배너

#### **왜** (Why) — **가장 중요한 질문**
- 사람들을 돕기 위해, 사이트 방문자에게 유용하게 만든 콘텐츠인가?
- → **YES**라면 핵심 자체 시스템의 보상 대상에 부합
- → **검색엔진 트래픽이 주목적**이라면 Google이 보상하지 않으며, 스팸 정책 위반 가능성

---

## 5. 생성형 AI 콘텐츠 정책

> **요약**: AI 사용 자체는 위반이 아니다. **검색 순위 조작이 주목적인 양산**이 위반이다.

### 5.1 위반이 되는 경우

- AI 등 자동화 도구로 사용자 가치 없이 다량의 페이지 양산 = **확장된 콘텐츠 악용** (스팸 정책 §6.11)
- 노력·독창성·부가가치가 거의 없는 기본 콘텐츠 양산
- 다른 사이트 콘텐츠를 약간 변형(동의어 교체, 번역, 다듬기)으로 재게시

### 5.2 권장 사항

- 콘텐츠가 어떻게 작성되었는지 정보를 공유 (= "어떻게" 답변)
- AI 자동화의 사용 방식과 이유를 배경 정보로 제공
- 적합한 요청자에게 알리는 메타데이터 추가 (이미지의 경우 `IPTC DigitalSourceType`)

### 5.3 smartdatashop.kr 적용

✅ 적합 사례:
- AI 보조로 초안 → 운영자 검토 → 출처 확인 → 발행
- AI 정책 페이지에 사용 방식·검토 프로세스 명시
- verifiedBy 필드로 검수자 표시
- 저자 이력 공개

❌ 위반 위험 사례:
- AI로 자동 생성 → 검토 없이 대량 발행
- 다른 매체 기사를 AI로 paraphrase 후 재게시
- 페르소나 별 콘텐츠 차별화 없이 동일 내용 9개 사이트 동시 발행

---

## 6. 스팸 정책 (위반 시 강등 또는 삭제)

자동화 시스템 + 필요시 사람 검토(수동 조치)로 감지.

### 6.1 ~ 6.17 주요 위반 유형

1. **클로킹** — 사용자와 검색엔진에 다른 콘텐츠
2. **도어웨이 악용** — 검색이용으로만 만든 페이지
3. **만료 도메인 악용** — 이전 신뢰도 활용 위해 재사용
4. **해킹된 콘텐츠** — 보안 취약점으로 무단 설치
5. **숨겨진 텍스트/링크** — CSS로 숨김
6. **키워드 반복** — 부자연스러운 키워드·숫자 반복
7. **링크 스팸** — 인위적 링크 생성·교환·구매
8. **머신 생성 트래픽** — 자동 검색어 전송 등
9. **멜웨어/악성 행위**
10. **혼동을 일으키는 기능** — 가짜 PDF 변환기 등
11. **확장된 콘텐츠 악용** — AI 양산 등 (가장 주의)
12. **스크래핑** — 다른 사이트 콘텐츠 자동 가져오기
13. **사이트 인지도 악용** — 호스트의 신뢰도를 빌려 양산 써드파티 콘텐츠
14. **부적절한 리디렉트** — 검색엔진과 사용자에게 다른 콘텐츠
15. **빈약한 제휴 페이지** — 부가가치 없는 affiliate
16. **사용자 생성 스팸**
17. **법적 삭제 / 개인정보 삭제 / 정책 회피 / 사기**

### smartdatashop.kr 차별화

> **§6.11 (확장된 콘텐츠 악용)** + **§6.12 (스크래핑)** + **§6.13 (사이트 인지도 악용)** 이 우리 운영 모델의 가장 큰 위험. 이를 차단하는 것이:
>
> - 1차 출처 명시 + 운영자 검수 + verifiedBy
> - 자매 사이트 각자의 명확한 페르소나·카테고리·자체 신뢰 자산
> - 동일 토픽 다중 발행 시 페르소나·관점·결론 차별화

---

## 7. 크롤링 및 인덱스 생성

### 7.1 사이트맵

#### 필요한 경우
- 사이트 규모가 크다 (페이지 잘 연결 안 될 가능성)
- 외부 링크가 적은 신규 사이트
- 동영상·이미지·뉴스가 많은 사이트
- **Google News에 표시되길 원하는 사이트** ← smartdatashop.kr 해당

#### 종류
- **일반 사이트맵** (`sitemap.xml`)
- **이미지 사이트맵**
- **뉴스 사이트맵** — Google News 전용, 24시간 이내 발행 기사만
- **동영상 사이트맵**

> **smartdatashop.kr 권장**: 일반 사이트맵 + 뉴스 사이트맵 (이미 `news-sitemap.xml` 보유). 자매 사이트는 카테고리에 따라 이미지 사이트맵 추가 검토.

### 7.2 robots.txt

크롤러에게 어떤 URL을 가져올지 알려주는 표준. **인덱스 생성 차단 도구가 아니다** — 차단된 URL이라도 외부 링크가 있으면 인덱스에 등록될 수 있다.

> 인덱스에서 제외하려면 `noindex` 메타 태그를 사용하라.

### 7.3 메타 태그 (인덱스·미리보기 제어)

- `<meta name="robots" content="noindex">` — 인덱스 생성 차단
- `<meta name="robots" content="nofollow">` — 페이지 내 링크를 따르지 않음
- `<meta name="robots" content="nosnippet">` — 스니펫·AI 미리보기 차단
- `<meta name="robots" content="max-snippet:[숫자]">` — 스니펫 최대 길이
- `<meta name="robots" content="max-image-preview:[none|standard|large]">` — 이미지 미리보기 크기
- `<meta name="robots" content="noarchive">` — 캐시 링크 차단

#### Google-Extended

Google의 다른 시스템(AI 학습/그라운딩)에서 사이트 사용을 제한하려면:
```
User-agent: Google-Extended
Disallow: /
```

이는 **검색 인덱스 생성에는 영향이 없다**.

---

## 8. URL 구조와 표준화 (Canonical)

### 8.1 설명적인 URL

✅ `https://smartdatashop.kr/policy/comprehensive-income-tax-guide`
❌ `https://smartdatashop.kr/2/6772756D707920636174` (의미 없는 식별자)

### 8.2 디렉토리로 주제별 그룹화

```
/policy/         정책
/tax-finance/    세금·금융
/market/         시장
/statistics/     통계
/ai-tech/        AI·기술
```

### 8.3 표준화 (Canonicalization)

여러 URL이 같거나 유사한 콘텐츠를 가리킬 때, Google이 **하나의 표준(canonical) URL**을 선택해 인덱스에 등록한다.

#### 지정 방법 (효과 순)

1. **`<link rel="canonical">` 태그** — `<head>`에 추가
2. **HTTP 헤더 `Link: <URL>; rel="canonical"`** — PDF 등 비-HTML 파일에 적용
3. **사이트맵 포함** — 표준 URL만 사이트맵에 넣음
4. **301 리디렉트** — 중복 URL을 표준 URL로 영구 이전

#### 자기 참조 canonical

모든 페이지에 자기 자신을 가리키는 canonical을 추가하는 것이 안전함. 파라미터·트래킹 코드 등에 의한 중복을 방지한다.

#### 도메인 전체 표준화

- `https://example.com/` → `https://www.example.com/`
- `http://` → `https://`

위 4가지 변형이 모두 동일 페이지에서 접근 가능하다면, 하나로 301 리디렉트하고 canonical도 그쪽을 가리켜야 한다.

---

## 9. 사이트 이전과 301 리디렉트

### 9.1 리디렉트 종류

| 의도 | HTTP 상태 |
|---|---|
| **영구 이전** (검색결과를 새 URL로 교체) | `301 Moved Permanently` ★ 또는 `308` |
| **임시** (검색결과는 원래 URL 유지) | `302 Found`, `303`, `307` |

### 9.2 권장 우선순위

1. **서버 측 리디렉트** (HTTP 301/302) — Google이 가장 정확하게 해석
2. **meta refresh** — 서버 측이 불가능할 때
3. **JavaScript** — 위 둘 다 불가능할 때만. JS 렌더링 실패 시 리디렉트 자체를 인식 못 할 수 있음

### 9.3 이전 체크리스트 (URL 변경 동반)

> **smartdatashop.kr 적용**: 폐기된 datafive.kr 계획 + smartdata-shop.com Naver 차단 도메인 → smartdatashop.kr로의 마이그레이션 시점에 활용.

1. **테스트** — 스테이징에서 새 사이트 검증
2. **Search Console 등록** — 새 도메인 등록 + 소유권 확인
3. **단계적 출시** — 가능하면 일부 섹션만 먼저 이전
4. **모든 이전 URL → 새 URL 1:1 매핑** — 홈페이지로의 일괄 리디렉트 피한다
5. **301 리디렉트 적용** — 서버 측 우선
6. **사이트맵 업데이트** — 새 URL로 작성하여 새 도메인의 Search Console에 제출
7. **이전 사이트맵을 한시적으로 유지** — Google이 변경을 감지하도록
8. **내부 링크 업데이트**
9. **외부 링크 업데이트 요청** — 가능한 범위에서
10. **Search Console > 주소 변경 도구** 사용
11. **모니터링** — 트래픽·에러·커버리지 보고서 추적, 최소 180일 유지

---

## 10. JavaScript SEO

Astro 정적 빌드 사용 시 JS SEO 측면에서 매우 유리하다. 대부분의 페이지가 빌드 시점에 생성된 HTML로 출력된다.

### 권장 사항
- 링크는 `<a href>`로 (JS의 `onclick`만으로는 크롤링되지 않음)
- 실제 콘텐츠는 SSR 또는 정적 빌드
- 클라이언트 사이드 라우트는 `pushState`로 history API 사용
- lazy loading은 Intersection Observer 또는 native `loading="lazy"`
- render-blocking JS 최소화 (INP에 직결)

### 200 응답 코드 필수
JS로 404 처리(soft 404)는 권장하지 않는다. 서버에서 실제 404·410 상태 코드를 반환하라.

---

## 11. 페이지 경험과 Core Web Vitals

### 11.1 Core Web Vitals — 3가지 측정 항목

| 측정 항목 | 측정 대상 | 좋은 임계값 |
|---|---|---|
| **LCP** (Largest Contentful Paint) | 로딩 성능 — 최대 콘텐츠 렌더링 시점 | **2.5초 이내** |
| **INP** (Interaction to Next Paint) | 반응성 — 페이지 상호작용 응답 시간 (2024년 3월부터 FID 대체) | **200밀리초 이내** |
| **CLS** (Cumulative Layout Shift) | 시각적 안정성 — 동적 레이아웃 변경 정도 | **0.1 이내** |

> 75 백분위수에서 모든 측정 항목이 '좋음'에 들어야 종합 평가가 통과된다.

### 11.2 페이지 경험 신호 종합

Core Web Vitals 외에:
- 모바일 친화성
- HTTPS 보안
- 방해되는 전면 광고(intrusive interstitials) 없음
- 안전한 탐색

### 11.3 측정 도구

- Search Console > Core Web Vitals 보고서 (실제 현장 데이터, 28일)
- PageSpeed Insights — 단일 URL 분석
- Chrome User Experience Report (CrUX) — BigQuery·CrUX API
- `web-vitals.js` 라이브러리 — 자체 데이터 수집
- Lighthouse — 실험실 데이터

### 11.4 LCP 개선 (Astro 환경)
- 이미지 사전 로드 + `<img loading="eager">` (히어로 이미지)
- WebP/AVIF 포맷, 적절한 크기·디바이스별 srcset
- 폰트 사전 로드 + `font-display: swap`
- CDN으로 정적 자산 배포
- TTFB 단축 (서버 응답 시간)

### 11.5 CLS 개선
- 이미지·iframe·동영상에 `width`/`height` 속성 명시
- 광고·임베드 슬롯 미리 예약
- 동적 삽입 콘텐츠는 사용자 액션에만 반응

---

## 12. 구조화된 데이터

### 12.1 개요

JSON-LD 형식 권장. 마크업의 모든 정보는 페이지에 실제로 표시되어야 함 (필수 속성 모두 포함).

### 12.2 데이터 저널/뉴스 사이트에서 우선 적용할 타입

#### `Article` / `NewsArticle`
- headline (110자 이하 권장)
- image (1x1, 4x3, 16x9 비율)
- datePublished, dateModified
- author (Person)
- publisher (Organization with logo)

#### `BreadcrumbList`
- 사이트 계층을 검색결과에 표시

#### `Organization`
- 사이트 전역 1회

#### `Dataset` (1차 출처 데이터에 강력 권장)
- 데이터 저널리즘의 핵심
- 1차 데이터 공개 페이지에 적용하면 Google Dataset Search에 노출
- creator, license, url, description

#### `FAQPage`
- ⚠️ **2023년 8월 변경 이후** 정부·헬스 사이트 등 일부 권위 있는 사이트의 FAQ만 리치 결과로 표시. 일반 사이트는 리치 결과에 표시 안 될 수 있으나 마크업 자체는 유효.

### 12.3 단계적 중단된 타입

- **연습 문제** — 표시 중단
- **사실 확인** — 일부 시그너처 권한 보유 매체만
- **HowTo, FAQPage** — 권한 있는 출처 위주

### 12.4 검증 도구

- 리치 검색결과 테스트 (search.google.com/test/rich-results)
- Schema Markup Validator (validator.schema.org)
- Search Console > 개선 사항 보고서

---

## 13. 외양 및 검색 노출

### 13.1 제목 링크 (Title Link)

검색결과에서 클릭 가능한 첫 번째 줄. Google은 다음 신호를 종합:
- `<title>` 태그
- 페이지의 주요 제목 (`<h1>`)
- 강조된 콘텐츠
- 다른 페이지에서 이 페이지로 연결되는 앵커 텍스트

#### `<title>` 작성 권장사항

- 모든 페이지에 고유하고 설명적인 title
- 페이지 콘텐츠를 정확히 묘사
- 키워드 스터핑 금지
- 50-60자 권장 (모바일은 더 짧음)
- 사이트 이름 끝에

```html
<title>2026년 종합소득세 신고 가이드 — 스마트데이터샵</title>
```

### 13.2 스니펫

검색결과의 페이지 설명. Google이 자동 생성하며 다음을 활용:
- `<meta name="description">` 태그
- 페이지 콘텐츠 자체
- 구조화된 데이터

#### `meta description` 권장사항
- 모든 페이지에 고유한 설명
- 페이지의 핵심 가치 전달
- 150-160자 권장
- 키워드 스터핑·중복 금지

### 13.3 파비콘 (Favicon)

- 8픽셀 이상의 정사각형 (48x48 이상 권장)
- 사이트 브랜드를 대표
- 적절한 콘텐츠 (폭력·성인 금지)

### 13.4 사이트 이름 (Site Name)

도메인 대신 검색결과에 표시되는 이름. `Organization` 또는 `WebSite` 구조화 데이터로 영향 줄 수 있다.

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "스마트데이터샵",
  "alternateName": "SmartDataShop",
  "url": "https://smartdatashop.kr"
}
```

### 13.5 사이트링크 (Sitelinks)

직접 제어할 수는 없지만 다음으로 영향:
- 명확한 사이트 구조와 내비게이션
- 의미 있는 페이지 이름
- 잘 표시되는 내부 링크

### 13.6 Google Discover

Google 앱·홈 화면의 콘텐츠 피드. 검색이 아니라 사용자 관심사 기반으로 자동 추천된다.

#### Discover에 표시되기 위한 조건

- **고화질 이미지** 사용 — 최소 1200픽셀 폭, `max-image-preview:large` 메타 또는 AMP 사용 권장
- 검색 정책 + Discover 콘텐츠 정책 준수
- 클릭베이트·과장된 제목 피하기
- 명확한 게시 날짜

```html
<meta name="robots" content="max-image-preview:large">
```

> **2026년 2월 디스커버 핵심 업데이트**: 지역 관련 콘텐츠 우대, 클릭베이트·점 진성 강등, 특정 분야 전문성 우대. 데이터 저널 포지션과 정확히 부합한다.

---

## 14. 핵심 업데이트 (Core Updates)

### 14.1 핵심 업데이트란

Google이 1년에 몇 차례 검색 알고리즘에 적용하는 광범위한 변경. 검색 사용자에게 유용하고 신뢰할 만한 콘텐츠를 제공하기 위한 개선이다.

특징:
- **특정 사이트나 페이지를 대상으로 하지 않는다** — 전체 평가 방식 자체의 변경
- **스팸 정책 위반과 무관** — 핵심 업데이트로 인한 강등은 위반 조치가 아니다
- **이전에 잘 평가받던 페이지가 상승하기도 한다**
- 출시 완료까지 1-3주 소요

### 14.2 영향 받았을 때 대응

1. **Search Console에서 분석**
   - 핵심 업데이트의 정확한 시작·종료일 (검색 상태 대시보드)
   - 핵심 업데이트 적용 전 일주일 vs 적용 후 일주일 비교
2. **가장 영향받은 페이지·검색어 식별**
3. **자가 평가** — '유용한 콘텐츠 만들기' 페이지의 질문 목록 활용
4. **개선 후 대기** — 회복은 즉시 일어나지 않는다. **다음 핵심 업데이트까지 기다려야** 할 수 있음
5. **소규모 핵심 업데이트는 중간에 시행** — 발표 없이 콘텐츠 회복 가능

> **개선이 보장된 경우에만 회복된다**. 사이트 소유자가 적용한 변경이 실제 개선이 아니면 회복되지 않는다.

---

## 15. Search Console 및 디버깅

### 15.1 시작하기

1. **소유권 확인**
   - 도메인 속성 (DNS TXT 레코드) — 모든 하위 도메인·프로토콜 포함
   - URL 접두사 속성 (HTML 파일·메타 태그·Google Analytics·Tag Manager·DNS)
2. **사이트맵 제출**
3. **모바일 친화성·Core Web Vitals 확인**

### 15.2 핵심 보고서

| 보고서 | 용도 |
|---|---|
| **실적** | 클릭·노출·CTR·순위 |
| **인덱스 생성 > 페이지** | 인덱스 등록 상태, 제외 사유 |
| **인덱스 생성 > 사이트맵** | 사이트맵 처리 상태 |
| **익스피리언스 > 페이지 경험** | Core Web Vitals 종합 |
| **개선 사항** | 구조화된 데이터 오류·경고 |
| **수동 조치** | 검토자에 의한 직접 조치 |

### 15.3 트래픽 감소 디버그

#### 1단계: 어떤 종류의 감소인가?

- **갑작스럽고 급격한 감소** — 사이트 문제 (수동 조치, 기술 문제, 보안)
- **점진적 감소** — 알고리즘 변화, 경쟁 증가, 콘텐츠 노후화
- **계절성 감소** — 정상

#### 2단계: 어디서 감소했는가?

- 모든 페이지 vs 특정 페이지
- 모든 검색어 vs 특정 검색어
- 모든 국가 vs 특정 국가
- 모든 디바이스 vs 모바일/데스크톱

#### 3단계: 가능한 원인 점검

- **수동 조치** — Search Console > 보안 및 수동 조치
- **인덱스 문제** — 페이지 보고서, robots.txt, noindex 태그
- **사이트 가동중단** — 서버 로그, 호스팅 모니터링
- **구조 변경** — URL 변경 후 리디렉트 누락
- **정책 위반** — 스팸 정책 자가 점검
- **AI 개요·AI 모드 도입** — 일부 검색에서 자체 정보 제공 영향
- **스니펫·디스커버 배치 변경** — 검색결과 시각적 변화

---

## 16. 국제 및 다국어 사이트

### 16.1 hreflang 태그

```html
<link rel="alternate" hreflang="ko" href="https://example.com/ko/page">
<link rel="alternate" hreflang="en" href="https://example.com/en/page">
<link rel="alternate" hreflang="x-default" href="https://example.com/page">
```

- 모든 언어 버전이 서로를 가리켜야 한다 (양방향)
- 자기 자신도 포함

### 16.2 smartdatashop.kr 적용

현재 한국어 단일 언어 사이트이므로 hreflang 불필요. 향후 영문 버전 도입 시:
- 도메인은 그대로 + 하위 디렉터리 `/en/`

---

## 17. AI 검색 환경에서의 SEO

### 17.1 핵심 메시지

AI 개요(AI Overviews)·AI 모드 등 새 환경에서도 **기존 SEO 기본이 그대로 적용된다**. 추가 요구사항·특별 최적화는 없다.

### 17.2 AI 환경에서 성공하기 위한 5가지

1. **고유하고 만족스러운 콘텐츠** — 다른 곳에서 찾을 수 없는 가치
2. **우수한 페이지 경험** — Core Web Vitals + 모바일 최적화 + 광고 균형
3. **기술 요구사항 충족** — 크롤·렌더·인덱스 가능
4. **표시 환경설정 컨트롤** — `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`로 노출 정도 관리
5. **구조화된 데이터** — 페이지 콘텐츠와 일치하도록 마크업

### 17.3 AI 학습 분리 (Google-Extended)

검색 인덱스에 활용은 허용하되 Bard/Gemini 등 AI 학습은 차단:
```
User-agent: Google-Extended
Disallow: /
```

---

## 18. smartdatashop.kr 즉시 적용 항목

### 메타 태그 (BaseLayout 추가)

- [ ] `<meta name="naver-site-verification" content="${env}">`
- [ ] `<meta name="google-site-verification" content="${env}">`
- [ ] `<meta name="author" content="김준혁">`
- [ ] `<meta name="robots" content="index,follow,max-image-preview:large">` — Discover 노출
- [ ] `<meta property="og:image:width" content="1200">` + height 1200
- [ ] `<meta property="og:image:type" content="image/png">`

### 페이지별 키워드 (선택, Naver 영향)

- [ ] `meta keywords` — 페이지 frontmatter `tags`에서 자동 생성

### 구조화된 데이터 추가

- [ ] `Dataset` JSON-LD 헬퍼 (1차 데이터 공개 페이지에 적용 가능)
- [ ] `Article` author URL → /authors/junhyuk-kim/

### RSS / Sitemap

- [ ] RSS body content 전체 포함 확인 (현재 description만일 가능성)
- [ ] News sitemap 검증 (48시간 freshness)

### Search Console 등록 (사용자 직접)

- [ ] DNS TXT로 도메인 속성 등록
- [ ] sitemap-index.xml 제출
- [ ] news-sitemap.xml 제출

---

## 출처 페이지

- 책 메인: https://developers.google.com/search/docs?hl=ko
- Search Essentials: https://developers.google.com/search/docs/essentials?hl=ko
- 스팸 정책: https://developers.google.com/search/docs/essentials/spam-policies?hl=ko
- 핵심 업데이트: https://developers.google.com/search/docs/appearance/core-updates?hl=ko
- 생성형 AI 콘텐츠: https://developers.google.com/search/docs/fundamentals/using-gen-ai-content?hl=ko
- Core Web Vitals: https://developers.google.com/search/docs/appearance/core-web-vitals?hl=ko
- 트래픽 감소 디버그: https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops?hl=ko
