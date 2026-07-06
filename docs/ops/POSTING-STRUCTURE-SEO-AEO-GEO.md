# 포스팅 표준 구조 — SEO · AEO · GEO 노출 극대화 (단일 진실 소스)

> 목적: 운영자 1인이 **매번 이 문서대로만 작성하면 모든 포스트가 자동으로 최대 노출 구조**를 갖추도록 한다.
> 범위: `src/data/issues/<date>/<slug>.json` 이슈 포스트.
> 관계: 발행 절차는 `docs/ops/MANUAL-POSTING.md`(단일 진실 소스), 본 문서는 **구조·필드·노출 표준**.
> 검증일: 2026-06-02 (repo 직접 확인 — 추측 아님). **v2 확장: 2026-07-07 (§9 — v1 P0~P2 전부 코드 반영 확인 후 신규 필드 3종 + JSON-LD 강화 적용).**

---

## 1. 결정 요약

현재 포스팅 파이프라인은 이미 매우 성숙하다. Article/NewsArticle 자동 분기, FAQPage+Speakable, ClaimReview(factCheckScore≥0.7), HowTo 자동감지, E-E-A-T 풀스택(author/reviewedBy/publisher @id), dateModified freshness 갱신, thin-post auto-noindex, hub-spoke 내부링크, 빌드 차단 lint가 모두 작동 중이다. **이미 구현된 것은 재발명하지 않는다.**

repo 검증으로 확인된 **진짜 갭**은 6가지이며, 모두 "신규 포스트 자동 최적화"에 직결되고 기존 46건 회귀를 피하도록 설계한다.

1. **reportType enum 분열(P0·결정적)** — 실사용 5종(new-subsidies-detail 18 / weekly-essentials 14 / issue-followup 8 / new-subsidies-weekly 4 / deadline-imminent-weekly 2). 그런데 `RT_LABELS`에 최다 2·3순위인 weekly-essentials·issue-followup 라벨이 없어 **46건 중 22건이 배지 없이 렌더**. 동시에 persona-weekly/category-weekly/trending-persona-angle은 데이터 0건 죽은 코드. runbook의 regional-detail도 0건(오기). lint는 reportType을 검증조차 안 함.
2. **이미지 자격 미달(P0·저비용)** — 모든 포스트가 `og-default.png` 단일 문자열. `articleSchema.image`가 dimension 없는 raw string, `og:image:width/height` 메타 부재. Discover/카카오 대형 미리보기 자격의 즉효 부분(dimension 명시)만 먼저 확보(동적 OG 생성은 별도 사이클).
3. **AEO 규칙이 문서 권고일 뿐 강제 안 됨(P0·저비용)** — tldr 첫 항목 수치, faq 답변 형식, table 행수, 제목/메타 길이가 lint 게이트에 없음. 결정적 계산값만 err, 나머지는 warn으로 신규 포스트만 자동 표준화.
4. **본문 문맥 내부링크 부재(P1)** — 두 샘플 모두 `sections[].body`에 `[text](/path)` 0건. inline-markdown은 링크 지원하나 작성 규칙·lint가 유도하지 않음.
5. **llms-full.txt 포스트 청크에 출처 URL·factCheckScore 미포함(P1)** — AI 크롤러가 합본만 읽으면 1차 출처·검증점수 attribution이 끊김.
6. **HowTo 마크다운 패턴 100% 의존(P1)** — 동일 reportType 내에서도 작성 방식에 따라 HowTo 유무가 갈림.

**제외(비용>효과 또는 근거 약함):** @graph 대규모 통합(분리 블록 정상작동 — faqSchema에 @id/isPartOf/inLanguage 3필드만 추가로 해결), 정부출처 dofollow 전환(효과 근거 약함), anchor id 키워드화(기존 deep-link 단절 위험), FAQ 전체 open(첫 1개만), 동적 OG 1차 도입(effort L — dimension 명시로 대체).

---

## 2. reportType별 JSON-LD 보장 매트릭스

`articleType = reportType ? 'Article' : 'NewsArticle'`. 정식 enum 5종은 모두 reportType 보유 → **전부 Article + isBasedOn(정부 출처)**. NewsArticle은 reportType 없는 속보 전용(현재 실데이터 거의 없음).

| reportType | articleType | isBasedOn | ClaimReview | HowTo | Table | FAQPage | freshness |
|---|---|---|---|---|---|---|---|
| `weekly-essentials` | Article | 정부출처 시 | score≥0.7 시 | 신청섹션 있으면 권장 | **필수** | 필수 | 생략(evergreen) |
| `issue-followup` | Article | 정부출처 시 | score≥0.7 시 | 해당 시 | **필수** | 필수 | **필수**(트렌딩) |
| `new-subsidies-weekly` | Article | 정부출처 시 | score≥0.7 시 | 해당 시 | **필수**(비교) | 필수 | 선택 |
| `new-subsidies-detail` | Article | 정부출처 시 | score≥0.7 시 | **권장**(신청절차) | **필수** | 필수 | 선택 |
| `deadline-imminent-weekly` | Article | 정부출처 시 | score≥0.7 시 | 해당 시 | **필수**(마감표) | 필수 | 선택 |

공통 보장(이미 emit·유지): Article/NewsArticle, mainEntityOfPage, articleSection, inLanguage ko-KR, wordCount, author(Person+Organization), reviewedBy(score≥0.7), publisher @id, isPartOf(CollectionPage), mentions(GovernmentService), audience(PeopleAudience), potentialAction(ApplyAction, applyUrl 시), dateline/copyrightHolder/copyrightYear, dateModified(freshness lastSeen), FAQPage+SpeakableSpecification, BaseLayout의 Organization/WebSite/SiteNavigationElement/Breadcrumb.

신규 보장 추가: ImageObject(width 1200/height 630), og:image:width/height, head keywords·author 메타.

---

## 3. 필드별 표준 규칙

| 필드 | 규칙 | 게이트 |
|---|---|---|
| `title` | 한 문장, 접미사 ` \| 지원금가이드` 포함 시 40자 이하 권장. 클릭베이트 금지 | lint warn(40자 초과) |
| `slug` | 영숫자·하이픈만. 파일명=slug | 기존 |
| `metaDescription` | 60~110자. 첫 문장에 핵심 수치/대상. 전역 중복 금지 | lint warn(범위 밖·중복) |
| `tldr[]` | 3~6개(5 권장). **tldr[0] 첫 문장은 단독 완결 + 숫자/금액/날짜 포함**. 출처는 문장 끝 괄호 1개로 통일 | lint warn(개수·tldr[0] 수치) |
| `category` | 화이트리스트 7종(주거/취업/창업/교육/자산/복지/농업) | lint warn |
| `tags[]` | 5~10개. 같은 어근 반복 금지(스터핑 회피). head keywords로 최대 8개 노출 | — |
| `coreFacts` | who/amount/deadline/where 4필드 모두 채움(문장형 허용) | err(누락) |
| `reportType` | **정식 enum 5종 중 하나 필수** | **err(enum 위반·누락)** |
| `factCheckScore` | 0~1 숫자. ≥0.7이면 ClaimReview/reviewedBy emit, <0.6이면 noindex | err(범위/타입) |
| `sourceConfidence` | high\|medium\|low. low면 disclaimer 노출 | err(enum) |
| `sourcePublisherCount` | **= `new Set(sources.map(s=>s.publisher)).size` 와 일치** | **err(불일치 — 결정적 계산값)** |
| `answer` **(v2)** | **한 줄 정답 ≤120자, 수치+날짜 포함, 그 자체로 답.** H1 직후 정답 박스로 렌더 + Article `abstract`/speakable. 없으면 tldr[0] 폴백(이때 tldr 리스트에서 첫 항목 제외 렌더) | warn(누락·2026-07-07 이후 발행분 / >200자 / 수치 없음), err(빈 문자열) |
| `definitions[]` **(v2)** | 선택 1~3개. `{term, definition(≤160자 한 문장), glossarySlug?}` — 본문 전문용어를 "용어 먼저 정리" 박스(`<dfn>`) + DefinedTermSet JSON-LD로 노출 | err(term/definition 누락), warn(glossarySlug 미존재·정의 200자+) |
| `updates[]` **(v2)** | 갱신 발행 시 `{date: "YYYY-MM-DD", note}` append. 가시 "업데이트 내역" 로그 + dateModified(트렌딩 lastSeen과 max) 반영 | err(형식 위반), warn(발행일보다 과거) |
| `sections[]` | 3개 이상(미만이면 path skip). 각 heading/lead/body 필수 | err(필드 누락) |
| `table` | **필수**. headers 2~5열, **모든 rows 셀 수 = headers 길이**, rows 3행 이상 권장 | **err(셀 수 불일치)** / warn(부재·3행 미만) |
| `faq[]` | 3~7개. **각 답변 첫 문장 단독 완결 + 수치/고유명사, "네,"/"예," 시작 금지** | lint warn |
| `sources[]` | 3건 이상. url은 http(s)://, publisher 문자열 | warn(<3) / err(url 형식) |
| `relatedSubsidies`/`relatedPersonas` | 존재하는 id만 | warn/err(미존재) |
| `freshness` | issue-followup 등 트렌딩 포스트는 trendingTerm 필수. evergreen은 생략 | warn(있는데 trendingTerm 빈값) |
| `publishedAt`/`date` | ISO / YYYY-MM-DD, 디렉토리 일치 | err(기존) |

---

## 4. 섹션 · 헤딩 패턴

- **H1 = post.title 단일**(렌더 보장).
- **H2 = sections[].heading**, 전부 **질문형** 권장(예: "이의신청이 왜 13만건이나 몰렸나요?"). AEO People-Also-Ask·발췌 단위.
- 헤딩 중 최소 1개에 `tags[0]` 또는 `freshness.trendingTerm` 토큰 포함(키워드 정합) — lint warn.
- 6축 의도(자격/금액/마감/절차/대상/방법)를 섹션에 분산 배치(`MANUAL-POSTING §4`).
- 각 섹션: `lead`(단독 완결 한 문장, 따옴표/접속사 시작 금지) → `body`(answer-first 첫 문단, 수치 포함).
- 신청/절차 섹션은 body에 `**1단계: 제목** — 설명` … `**4단계: …**` 패턴으로 작성 → HowTo 자동 emit. (2단계 이상)
- **본문 문맥 내부링크**: relatedSubsidies/glossary 용어 첫 등장 시 `[용어](/subsidies/{id}/)` 형태로 1개 이상. (P1, lint warn)
- anchor는 현행 `#sec-N` 유지(기존 deep-link 보존). 키워드 anchor는 신규 포스트만 선택 적용 가능하나 표준은 sec-N.
- ToC(sections≥3)·prev/next·next-actions·hub-pill 자동 — 유지.

---

## 5. AEO · GEO · 네이버 작성 규칙

### AEO (AI Overviews / Perplexity / Featured Snippet / 음성)
- **tldr[0] 첫 문장 = 그 자체로 답.** 수치+날짜 포함, 출처 괄호는 문장 끝 1개.
- **역할 분리**: `coreFacts`=사실 수치(누가/얼마/언제/어디서), `tldr`=왜·맥락·변화(배경·논란·영향). 같은 문장 반복 금지 — lint가 토큰 중복(자카드≥0.6) 2개+ 시 warn.
- **faq 답변 첫 문장 = 단독 완결.** "네, 가능합니다" 류 빈답 금지 — 첫 문장에 수치/조건 명시.
- **table 1개 이상**(헤더 의미 명확, 3행+) → 표 스니펫·네이버 스마트블록 표.
- **lead = self-contained 한 문장** → speakable 청크.
- 신청형은 N단계 패턴 → HowTo do-intent 답변.

### GEO (생성형 인용 신뢰)
- **본문 atomic fact 옆 출처는 클릭 가능 링크로**: `(출처: 매체)` 평문 대신 `([매체 2026-06-01](https://원문URL))`. inline-markdown이 렌더함. (P1)
- 정부 1차 출처(.go.kr/.gov.kr/bokjiro)는 isBasedOn에 자동 노출 — sources에 정부 출처 1건 이상 포함 권장.
- factCheckScore·sourcePublisherCount 정확히 기입(ClaimReview/disclaimer 신뢰 신호 좌우).
- **llms-full.txt 포스트 청크에 sources(publisher/url) + factCheckScore emit**(P1) → AI 합본 읽기 시 attribution 확보.

### 네이버
- **head `<meta name="keywords">`**: tags 최대 8개(스터핑 회피). 네이버 참고 신호, 구글 무해.
- **head `<meta name="author">`**: 김준혁(byline E-E-A-T/C-Rank).
- **og:image:width/height 1200/630**: 카카오 공유 미리보기 안정화.
- title 한글 15~32자 본문 + 접미사(절단 방지), metaDescription ~80자대 권장.
- table/faq/HowTo 보유 → 스마트블록 진입(신규 도메인은 단일키워드 1위보다 블록 다출처 노출이 현실적 경로).
- 사이트맵: 네이버 서치어드바이저엔 sitemap-index만 제출(도메인당 1개 정책). robots의 news 라인은 구글용 유지.

---

## 6. 골든 템플릿 JSON 예시

```json
{
  "title": "고유가 피해지원금 이의신청 13만건 — 사유·기한·방법 총정리",
  "slug": "oil-relief-objection-guide-2026-06-02",
  "metaDescription": "고유가 피해지원금 이의신청이 열흘 만에 13만건을 넘었습니다. 신청 사유, 지자체별 기한, 온라인·방문 신청 방법을 한 번에 정리했습니다.",
  "answer": "고유가 피해지원금 이의신청은 정부24 또는 주민센터에서 지급 후 30일 이내 접수하며, 인용 시 1인당 최대 25만원까지 차액이 지급됩니다.",
  "definitions": [
    { "term": "건강보험료 기준", "definition": "소득 하위 70% 판정에 쓰는 기준으로, 가구원 수별 건강보험료 납부액으로 소득 구간을 가르는 방식입니다.", "glossarySlug": "health-insurance-premium" }
  ],
  "tldr": [
    "고유가 피해지원금 이의신청이 지급 시작 5월 18일부터 열흘 만에 13만건을 넘어섰습니다(연합뉴스·이데일리 2026-05-31 보도).",
    "이의신청 기한은 지자체별 공고로 다르며 대부분 지급 후 30일 이내입니다.",
    "온라인은 정부24, 방문은 주민센터에서 접수하며 본인 명의 통장과 신분증이 필요합니다.",
    "건강보험료 기준 소득 하위 70%가 핵심 자격이며 가구원 수에 따라 기준이 달라집니다.",
    "1인당 최대 25만원, 가구·소득 구간별로 차등 지급됩니다."
  ],
  "category": "복지",
  "tags": ["고유가 피해지원금", "이의신청", "정부24", "건강보험료 기준", "소득 하위 70%", "지급 기한", "신청 방법"],
  "coreFacts": {
    "who": "고유가 피해지원금 대상에서 제외·과소 지급된 가구",
    "amount": "1인당 최대 25만원(소득·가구별 차등)",
    "deadline": "지급·신청 2026.05.18~07.03 / 이의신청은 지자체 공고 확인",
    "where": "정부24 온라인 또는 주민센터 방문"
  },
  "reportType": "issue-followup",
  "factCheckScore": 0.9,
  "sourceConfidence": "high",
  "sourcePublisherCount": 3,
  "freshness": { "trendingTerm": "고유가 피해지원금 이의신청", "daysActive": 5, "totalCount": 12, "rankToday": 2 },
  "sections": [
    {
      "heading": "이의신청이 왜 13만건이나 몰렸나요?",
      "lead": "지급 시작 열흘 만에 이의신청이 13만건을 넘은 이유는 건강보험료 기준 소득 판정에서 누락된 가구가 많았기 때문입니다.",
      "body": "지급이 시작된 5월 18일부터 이의신청이 급증했습니다. 주된 사유는 [건강보험료 기준](/glossary/health-insurance-premium/) 소득 판정 시점과 실제 소득 변동의 차이입니다. ([연합뉴스 2026-06-01](https://example.go.kr/news))"
    },
    {
      "heading": "이의신청은 어떻게 하나요?",
      "lead": "이의신청은 정부24 온라인 또는 주민센터 방문으로 30일 이내 접수합니다.",
      "body": "**1단계: 자격 확인** — 정부24에서 지급 결과와 사유를 조회합니다.\n**2단계: 서류 준비** — 신분증, 본인 명의 통장, 소득 증빙을 준비합니다.\n**3단계: 접수** — 온라인 제출 또는 주민센터 방문 접수합니다.\n**4단계: 결과 확인** — 14일 내외로 심사 결과가 통보됩니다."
    },
    {
      "heading": "내가 받을 수 있는 금액은 얼마인가요?",
      "lead": "1인당 최대 25만원이며 가구원 수와 소득 구간에 따라 차등 지급됩니다.",
      "body": "소득 하위 70% 이내에서 구간별로 금액이 달라집니다. 관련 지원은 [고유가 연계 지원금](/subsidies/oil-linked-subsidy/) 페이지에서 함께 확인하세요."
    }
  ],
  "table": {
    "title": "이의신청 구분·대상·기한",
    "headers": ["구분", "대상", "기한"],
    "rows": [
      ["지급 누락", "자격 충족인데 미지급", "지급 후 30일"],
      ["과소 지급", "구간 오판정", "지급 후 30일"],
      ["자격 이의", "소득 판정 불복", "지자체 공고"]
    ]
  },
  "faq": [
    { "q": "이의신청 기한이 지나면 어떻게 되나요?", "a": "기한 경과 후에는 원칙적으로 접수가 불가하며, 지자체별 공고 기한을 반드시 확인해야 합니다." },
    { "q": "온라인 신청이 어려우면 어떻게 하나요?", "a": "주민센터를 방문해 신분증과 통장을 지참하면 담당 공무원이 접수를 도와줍니다." },
    { "q": "결과는 언제 나오나요?", "a": "접수 후 14일 내외로 심사 결과가 통보되며, 인용 시 차액이 추가 지급됩니다." }
  ],
  "relatedSubsidies": ["oil-linked-subsidy"],
  "relatedPersonas": ["low-income-household"],
  "sources": [
    { "title": "고유가 피해지원금 이의신청 13만건", "url": "https://example.com/yna", "publisher": "연합뉴스", "pubDate": "2026-06-01" },
    { "title": "이의신청 사유 분석", "url": "https://example.com/edaily", "publisher": "이데일리", "pubDate": "2026-05-31" },
    { "title": "지급 기준 안내", "url": "https://example.go.kr/notice", "publisher": "행정안전부", "pubDate": "2026-05-30" }
  ],
  "publishedAt": "2026-06-02T00:00:00.000Z",
  "date": "2026-06-02"
}
```

> 채움 가이드: **answer=시드 질문에 대한 직답 한 문장(수치 필수, tldr[0] 재서술 금지 — 더 압축)** / tldr[0]=수치+날짜+출처괄호 / 모든 section.heading 질문형 / 신청섹션은 N단계 / body에 내부링크·출처링크 / table 셀수 일치 / faq 답변 "네," 금지 / sourcePublisherCount=고유 publisher 수 / definitions=본문 전문용어 1~3개(쉬우면 생략) / 갱신 발행 시 updates append.

---

## 7. 코드 · lint 변경 (우선순위·적용 위치) — ✅ 전 항목 적용 완료 (2026-07-07 repo 재검증)

### P0 — 즉시, 저비용, 신규 자동화의 핵심
1. **reportType enum 동기화** — `src/pages/issues/[date]/[slug].astro` `RT_LABELS`(L421-428)에 `weekly-essentials`/`issue-followup` 라벨·색상 추가, 죽은 3종(persona-weekly/category-weekly/trending-persona-angle) 제거. `MANUAL-POSTING.md §6` 표를 실사용 5종으로 정정(regional-detail 삭제).
2. **lint REPORT_TYPES enum** — `scripts/lint-content.mjs` 이슈 루프에 `const REPORT_TYPES = ['weekly-essentials','issue-followup','new-subsidies-weekly','new-subsidies-detail','deadline-imminent-weekly']` + 위반/누락 시 **err**. `reportType`/`factCheckScore`/`sourceConfidence`/`sourcePublisherCount`를 검사 대상에 추가(factCheckScore 0~1 err, sourceConfidence enum err).
3. **결정적 계산값 err** — `sourcePublisherCount !== new Set(sources.publisher).size` → err. `post.table` 있을 때 `rows[i].length !== headers.length` → err, headers 2~5 범위·rows 3행 권장 warn.
4. **ImageObject 승격** — `src/lib/schema.ts`에 `buildImageObject({url,width:1200,height:630,caption})` 신규. `[slug].astro:200` `image`를 ImageObject로 교체.
5. **og:image dimension + author/keywords 메타** — `BaseLayout.astro` Props에 `keywords?: string[]` 추가, head에 `<meta property="og:image:width" content="1200">`·height 630, `ogType==='article'`일 때 `<meta name="author">`(ogArticle.author ?? '김준혁'), `keywords` 있으면 `<meta name="keywords">`(최대 8 slice). `[slug].astro` 호출부에서 `keywords={post.tags.slice(0,8)}` 전달.
6. **AEO/길이 warn** — lint에 tldr 개수 3~6·tldr[0] 수치(`/[0-9０-９]|만원|일|%|건/`) 없으면 warn, faq.a "네,/예," 시작 또는 첫 문장 수치 없음 warn, faq 개수 3~7, title(접미사 8자 포함) 40자 초과 warn, metaDescription 60~110자 밖 warn, metaDescription **전역 중복** warn.

### P1 — 중효과, 점진
7. **본문 문맥 내부링크** — lint에 "sections.body 내 `[..](/..)` 내부링크 0건" warn + 본문 `(출처:` 평문 있고 같은 문장에 링크 없으면 warn. `MANUAL-POSTING §5` 매트릭스에 '본문 내부링크' 행 추가.
8. **llms-full.txt 출처/점수 emit** — `src/pages/llms-full.txt.ts` 포스트 루프에 `**출처**` 블록(sources publisher/url 마크다운 링크) + factCheckScore(%)·sourcePublisherCount 한 줄 추가.
9. **HowTo 비일관 보완** — lint에 "신청/절차 heading 있는데 N단계 패턴 없음" warn. (2차 선택: `post.steps[]` 필드 + `[slug].astro` 폴백.)

### P2 — 정밀화, 저비용
10. **faqSchema 그래프 보강** — `[slug].astro:370-385` faqSchema에 `@id:${canonicalUrl}#faq`·`url`·`inLanguage:'ko-KR'`·`isPartOf:{@id:canonicalUrl}` 3~4필드 추가(대규모 @graph 통합 불필요).
11. **speakable 정밀화** — cssSelector `.lead` 과다매칭 제거 → `['.tldr li','.faq-section']` 또는 `.hero .lead`로 한정.
12. **table HTML 보강** — `<caption>{table.title}</caption>` + thead th `scope="col"`.
13. **가시 수정일** — dateModified가 publishedAt보다 최신일 때만 hero meta에 '업데이트 {date}' 칩(JSON-LD dateModified와 동일 변수). OG modifiedTime도 동일 변수로 통일.

> **회귀 안전 원칙:** 신규 lint 규칙은 전부 **warn**, **err은 결정적 계산값만**(reportType enum, sourcePublisherCount 불일치, table 셀 수 불일치). 기존 46건은 빌드 차단되지 않음.

---

## 8. 발행 전 체크리스트

- [ ] **(v2) answer(한 줄 정답) ≤120자, 수치 포함, tldr[0] 재서술 아닌 직답인가**
- [ ] (v2) 본문에 전문용어 있으면 definitions 1~3개(한 문장 정의, glossarySlug 연결)인가
- [ ] (v2) 갱신 발행이면 updates[]에 {date, note} append 했는가
- [ ] reportType이 정식 enum 5종 중 하나인가
- [ ] tldr 3~6개, tldr[0] 첫 문장에 수치+날짜, 출처는 끝 괄호 1개인가
- [ ] 모든 section.heading 질문형, 최소 1개에 tags[0]/trendingTerm 토큰 포함인가
- [ ] 각 section.lead 단독 완결 한 문장(따옴표/접속사 시작 아님)인가
- [ ] 신청·절차 섹션 body에 `**N단계:**` 2개 이상인가(HowTo)
- [ ] body에 내부링크(`[용어](/...)`) 1개 이상, 핵심 fact 출처는 클릭 링크인가
- [ ] table 1개 이상, 모든 rows 셀 수 = headers 길이, 3행 이상인가
- [ ] faq 3~7개, 각 답변 첫 문장 단독 완결 + 수치, "네,"/"예," 시작 아님인가
- [ ] sources 3건 이상, 정부 1차 출처(.go.kr 등) 1건 이상 포함인가
- [ ] sourcePublisherCount = 고유 publisher 수와 일치하는가
- [ ] factCheckScore 0~1, sourceConfidence high/medium/low, 3자 정합인가
- [ ] title(접미사 포함) 40자 이하, metaDescription 60~110자·중복 아님인가
- [ ] 트렌딩 포스트면 freshness.trendingTerm 채웠는가
- [ ] `npm run lint:content` err 0건(warn은 검토)인가

---

## 9. v2 업그레이드 (2026-07-07 적용) — 정답 청크 · 인용 그래프 · 갱신 이력

v1(§7)이 전부 코드에 반영된 상태에서 repo 재검증으로 확인된 다음 갭을 적용했다. 원칙 동일: **신규 필드는 전부 optional(레거시 회귀 0), err은 신규 필드의 결정적 형식만.**

### 신규 필드 3종 (작성자 인터페이스)

1. **`answer` — 한 줄 정답 (AEO 핵심)**: H1 직후 `.answer-box`로 렌더 + Article `abstract` + speakable 1순위 청크 + llms-full 최상단. 없으면 tldr[0] 자동 폴백(이때 tldr 리스트에서 첫 항목 제외 렌더 → 레거시 60여건도 정답 박스 자동 획득). Featured Snippet·AI Overviews·네이버 지식스니펫이 집는 "그 자체로 답인 한 문장".
2. **`definitions[]` — 용어 먼저 정리 (AEO/GEO)**: 본문 최상단 `<dfn>` 박스 + `DefinedTermSet`/`DefinedTerm` JSON-LD + glossary hub 링크 + llms-full "핵심 용어" 청크. AGENTS §12-2 "핵심 정의 격리" 표준의 이슈 포스트 구현.
3. **`updates[]` — 갱신 이력 (freshness)**: 가시 "업데이트 내역" 로그 + `dateModified`=max(트렌딩 lastSeen, 최신 update date) 단일 변수(JSON-LD·OG·hero 칩 동일). 갱신 발행 워크플로우(/traffic 갱신 후보)의 구조 지원.

### JSON-LD·메타 강화 (자동 — 작성자 작업 없음)

4. **`citation` 전 출처 승격**: isBasedOn(정부 1차 한정)과 별개로 언론 포함 전체 sources(최대 8건)를 Article `citation`으로 emit — 정부 도메인은 GovernmentOrganization publisher. GEO attribution 그래프 완성.
5. **`about` entity 승격**: string → `Thing{name, url(토픽 hub 존재 시)}` — 토픽 hub와 entity 연결.
6. **`speakable`을 Article 레벨에도 명시** (spec상 Article/WebPage 소속): `['.answer-box','.tldr li']`. FAQPage speakable에도 `.answer-box` 추가.
7. **`news_keywords` 메타** (BaseLayout, article 한정): keywords와 동일 소스 — Google News 토픽 매핑.
8. **`<time datetime>` 시맨틱**: hero 발행일·업데이트 내역 날짜.

### lint 게이트 (v2)

- err: `answer` 빈 문자열 / `updates[]` 형식(`{date: "YYYY-MM-DD", note}`) / `definitions[]` term·definition 누락
- warn: answer 누락(**2026-07-07 이후 발행분만** — 레거시 침묵) / answer 200자+·수치 없음 / definitions.glossarySlug 미존재 / updates.date가 발행일보다 과거

### 문서 정합 정정

- MANUAL-POSTING §5·§6, post-writer agent의 `metaDescription 150~160자` → **60~110자**로 정정 (lint·본 문서 §3과 드리프트 제거).

### 적용 파일

- `src/pages/issues/[date]/[slug].astro` — answer 박스·용어 박스·업데이트 로그 렌더 + abstract/citation/about/speakable/DefinedTermSet JSON-LD + `<time>`
- `src/layouts/BaseLayout.astro` — news_keywords 메타
- `scripts/lint-content.mjs` — v2 필드 게이트 (glossary.json id 인덱스 검증 포함)
- `src/pages/llms-full.txt.ts` — 한 줄 정답 + 핵심 용어 청크
