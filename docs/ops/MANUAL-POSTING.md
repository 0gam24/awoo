# 수동 포스팅 운영 표준 (Manual Posting Runbook)

> **목적**: 운영자가 메인화면 트렌딩 키워드 1개를 던지면 Claude(AI 보조)가 SEO/AEO/GEO 양식의 영구 포스트를 1회 흐름으로 발행해 **검색 트래픽을 빠르게 유입**시킨다.
>
> **단일 진실 소스** — 운영 절차·체크리스트·게이트 정의는 본 문서가 표준이다.
>
> 작성일: 2026-05-27 · 운영자: 김준혁 (kjh791213@gmail.com)

---

## 1. 운영 모드 (2026-05-27 전환)

| 항목 | 자동 | 수동 |
|---|---|---|
| 메인화면 트렌딩 키워드 (`today-issue.json`) | ✅ 매일 06KST | — |
| 매칭 지원금·카테고리 chips | ✅ sync-issues가 처리 | — |
| 보조금24 신규/갱신 sync | ✅ 매주 월 03KST | — |
| 외부 applyUrl 헬스체크 | ✅ 매주 수 04KST | — |
| **영구 포스트** (`src/data/issues/[date]/[slug].json`) | ❌ **삭제됨** | ✅ **본 표준** |
| fact-check 자동 게이트 | ❌ **삭제됨** | ✅ 수동 승인 = 발행 결재 |
| Cloudflare 자동 배포 | ✅ main push 시 | — |

**삭제 배경**: 자동 발행은 fact-check 게이트의 보수적 판정으로 일주일 3~4일 발행 0건이었고, 검색 의도 매칭이 약해 트래픽 유입 효과 미흡. → 운영자가 트렌딩 키워드를 직접 골라 롱테일로 발행하는 게 더 빠른 트래픽 유입.

---

## 2. 입력 인터페이스

### 간단형 (권장)
```
/post 유가연동보조금
```
또는 자연어:
```
유가연동보조금으로 글 하나 써줘
```

### 명시적 hint
```
/post 유가연동보조금 angle=금액비교 persona=self-employed urgency=high
```

| hint | 값 |
|---|---|
| `angle` | 자격진단 / 금액비교 / 시기성 / 신청절차 / 지역별 / 질문형 |
| `persona` | office-rookie · self-employed · newlywed-family · senior · low-income · farmer |
| `urgency` | high (D-7 이내) · normal |

---

## 3. 8단계 파이프라인

```
[입력] 키워드
   ↓
STEP 1  중복 체크 (today.md 30일 + git log) ─── GATE-A ▶ 유사도 70%↑ 새 각도 요구
   ↓
STEP 2  데이터 풀 매칭 (_gov24 + _curated grep) ─ GATE-B ▶ 매칭 0건 시 외부소스 발행 승인
   ↓
STEP 3  6축 롱테일 7±2개 생성 ─────────────── GATE-C ▶ 운영자 1개 angle 확정
   ↓
STEP 4  JSON 초안 작성 (SEO·AEO·GEO 분산 매트릭스)
   ↓
STEP 5  자동 검증 (lint:content + build) ── 실패 시 2회 자동 수정 재시도
   ↓
STEP 6  발행 결재 ─────────────────────── GATE-D ▶ "발행 / 수정 / 취소"
   ↓
STEP 7  git commit + push (KST 날짜 3중 일치 강제)
   ↓
STEP 8  발행 후처리 ── IndexNow + SC 안내 + today.md 갱신 + (선택) Naver Advisor
   ↓
[출력] https://awoo.or.kr/issues/{date}/{slug}/
```

### 4 게이트

| 게이트 | 위치 | 조건 | 액션 |
|---|---|---|---|
| **GATE-A** | STEP 1 후 | 중복 유사도 > 70% | 운영자 승인 ("새 각도?") |
| **GATE-B** | STEP 2 후 | 매칭 지원금 0건 | 운영자 승인 ("외부 소스만?") |
| **GATE-C** | STEP 3 후 | 항상 | 7±2 후보 중 1개 angle 확정 |
| **GATE-D** | STEP 6 발행 직전 | 항상 | "발행 / 수정 / 취소" |

---

## 4. 6축 롱테일 확장 매트릭스 (STEP 3)

시드 키워드 → 7±2개 롱테일 (자격·금액·마감 3축 필수)

| 의도축 | 변형 패턴 | 시드 "유가연동보조금" 예시 |
|---|---|---|
| **자격** ⭐ | `{시드} 신청 자격 / 누가 받나` | 유가연동보조금 신청 자격 |
| **금액·연도** ⭐ | `2026년 {시드} 금액` | 2026년 유가연동보조금 단가 인상 |
| **시기·마감** ⭐ | `{시드} 마감일 / D-N` | 유가연동보조금 6월 신청 마감 |
| **페르소나** | `{페르소나} {시드}` | 자영업 화물차 유가연동보조금 |
| **지역** | `{지자체명} {시드}` | 경기도 유가연동보조금 |
| **절차·서류** | `{시드} 신청 방법 / 서류` | 유가연동보조금 온라인 신청 단계 |
| **비교·중복** | `{시드} vs / 차이 / 중복` | 유가연동보조금 vs 유가보조금 차이 |

> **빠른 트래픽 우선순위**: 시기·마감 > 자격 > 금액 (검색 의도 즉시성 순)

---

## 5. SEO·AEO·GEO 분산 배치 매트릭스 (STEP 4)

| 위치 | 1순위 패턴 | 효과 |
|---|---|---|
| `title` ≤60자 | 시드 + 2026 + 페르소나/지역 + 숫자 | SEO CTR |
| `metaDescription` 150~160 | 시드 + 금액·마감 수치 | SERP 클릭 유도 |
| `sections[].heading` (H2) | 자격·금액·마감 각 1개, 질문형 권장 | SEO 구조 + AEO 발췌 |
| `tldr` 5개 | 첫 항목 첫 문장에 수치 | **AEO 직접답변 최우선** |
| `faq` 5개 / 답변 80자 | "누가/얼마/언제까지/어디서/중복?" | Google FAQ + ChatGPT 인용 |
| `table` headers | 구분·대상·금액·마감·신청처 | AEO 표 발췌 |
| `tags` 5~8 | 시드 + 페르소나ID + 카테고리 + "2026" | 내부 4축 cross-ref |
| `sources` ≥3 | publisher 2개 기관 이상, 정부 1차 출처 우선 | **GEO 신뢰도** |
| `sections[].body` 내부링크 | relatedSubsidies/glossary 용어 첫 등장 시 `[용어](/경로)` 1개 이상 | 내부링크 가중·AI 본문 인용 |

### AEO·GEO 즉시 인용 트리거 (필수)
- `tldr` 첫 항목 첫 문장 = 단독으로 답이 되도록
- `faq.acceptedAnswer.text` 첫 문장에 수치 포함, "네, 가능합니다" 금지
- atomic facts: 한 줄 한 문장, 끝에 `(출처: 기관명 고시 YYYY-NNN)` 인라인 인용
- `factCheckScore ≥ 0.7` 시 ClaimReview schema 자동 emit (코드 처리)

---

## 6. JSON 필수 필드 (lint:content 강제)

```json
{
  "title": "...",              // ≤60자, 시드+연도+페르소나/지역+숫자
  "slug": "...",               // {topic}-{type}-{YYYY-MM-DD}, 영문 소문자·하이픈
  "metaDescription": "...",    // 150~160자
  "tldr": ["...", "..."],      // ≥3 권장 5, 첫 항목 첫 문장에 수치
  "category": "...",           // 주거/취업/창업/교육/복지/자산/농업 중 1
  "tags": ["..."],             // 5~8개
  "coreFacts": {
    "who": "...",
    "amount": "...",
    "deadline": "...",
    "where": "..."
  },
  "sections": [                // ≥3
    { "heading": "...", "lead": "...", "body": "..." }
  ],
  "table": {                   // 선택
    "title": "...",
    "headers": ["..."],
    "rows": [["..."]]
  },
  "faq": [                     // ≥3 권장 5
    { "q": "...", "a": "..." }
  ],
  "relatedSubsidies": ["..."], // 실제 존재하는 ID만
  "relatedPersonas": ["..."],  // 6종 중
  "sources": [                 // ≥3, publisher 2개 기관 이상
    { "title": "...", "url": "...", "publisher": "...", "pubDate": "YYYY-MM-DD" }
  ],
  "publishedAt": "...",        // ISO 8601
  "date": "YYYY-MM-DD",        // 디렉토리·slug suffix와 일치 ★
  "factCheckScore": 1,         // 0~1
  "sourceConfidence": "high",  // high/medium/low
  "sourcePublisherCount": 5,   // sources 고유 publisher 수
  "reportType": "...",         // 5종 중
  "matchedSubsidies": []       // 비어있지 않게
}
```

### reportType 5종

| reportType | sections 헤더 | FAQ | table |
|---|---|---|---|
| **weekly-essentials** | 핵심 5선·자격·우선순위 | 누가/얼마/마감/중복/어디서 | 5개 지원금 × [대상·금액·마감·신청처] |
| **issue-followup** | 무엇이 바뀌었나·전후 비교·대응 | 왜/소급/재신청/영향/공식발표일 | 변경 전·후 2열 |
| **deadline-imminent-weekly** | 마감 TOP·서류·신청 경로 | 오늘 가능?/필수서류/늦으면?/대안/접수시간 | 지원금 × [마감일·D-day·URL] |
| **new-subsidies-weekly** | 이번 주 신규·자격·우선순위 | 누가/얼마/마감/중복/신청처 | 신규 5건 비교 |
| **new-subsidies-detail** | 신규 1건 심층·자격·신청절차·금액 | 누가/얼마/마감/필수서류/신청처 | 단일 지원금 × [대상·금액·마감·신청처] |

---

## 7. 운영자 18항목 체크리스트 (STEP 5 자동 검증)

**메타** ① title 60자 + 연도/페르소나 ② metaDescription 150~160 + 금액·마감 수치 ③ slug = topic-type-YYYY-MM-DD ④ **publishedAt ↔ date ↔ 디렉토리 3중 일치** ⑤ reportType 정의된 5종

**본문** ⑥ tldr ≥3 권장 5, 첫 항목 첫 문장 수치 ⑦ sections ≥3, heading 질문형/숫자 ⑧ 각 lead 자체 완결 ⑨ coreFacts 4개 빈 문자열 금지 ⑩ table ≥3행 ⑪ FAQ ≥3 권장 5, 답변 첫 문장 단독 완결 + 수치

**관계·신뢰** ⑫ relatedSubsidies 실제 ID ⑬ relatedPersonas 정의된 6종 ⑭ sources ≥3, publisher 2개 기관 ⑮ category 7종

**점수·매칭** ⑯ factCheckScore 0~1 ↔ sourceConfidence 정합 ⑰ sourcePublisherCount = sources 고유 publisher 수 ⑱ matchedSubsidies 비어있지 않음

---

## 8. 빠른 트래픽 유입 보강 (수동 발행 특화)

### A. 발행 직후 자동 (STEP 8)
0. `npm run sync:history` — 메인 트렌딩 카드 'term→포스트' 링크 **자동 연결**(포스트의 `freshness.trendingTerm` 기준 derive). **수기 `_history.json` 편집 불필요.**
   - 트렌딩 포스트는 JSON에 `freshness.trendingTerm`(매핑 키)을 반드시 넣는다.
   - 같은 날 같은 term으로 2건 이상 발행하면, 트렌딩 카드가 가리킬 대표 글에 `freshness.trendingPrimary: true` 를 표시(없으면 최신 발행순).
1. `npm run indexnow:ping` — Bing·Yandex 즉시
2. `npm run update:today` — today.md 갱신
3. **Google Search Console 색인 요청 URL 안내** (운영자 1클릭)
4. **Naver Search Advisor 신규 URL 등록 안내** (1주차 신규 도메인 최강 채널)

### B. 시기성 angle 우선
- `urgency=high` 시 Claude는 `deadline-imminent-weekly` reportType 선호
- title에 D-N 패턴 자동 강조 ("D-7 마감 임박")
- 트렌딩 발견 후 24시간 이내 발행이 검색 의도 매칭 ↑

### C. Naver 우회 (신규 도메인 권위 부족 대응)
- 발행 후 운영자 결정 시: Naver 블로그·카페에 syndication, canonical은 awoo 유지
- 지식iN/Tip 답변에 awoo URL 인용 (UGC 백링크)
- sitemap-news.xml 별도 등록 — Naver 뉴스성 색인 가속

### D. Hub-Spoke 자산화
- 시드 키워드 → `/topics/{slug}/` hub로 자동 연결
- 매일 spoke (D-N · weekly · 지역별) → hub로 역백링크
- 1주 후 hub에 "지난 회차" 섹션으로 영구 보존 → long-tail 누적

---

## 9. 5/24 → 5/27 사례 (날짜 오기재 정정)

**사전 차단**: `lint:content`에 날짜 3중 일치 규칙 — `publishedAt` ↔ `date` ↔ 디렉토리명 ↔ slug suffix 셋(혹은 넷) 불일치 시 build 실패

**사후 정정 절차**:
1. `git mv src/data/issues/{wrong}/{slug}.json src/data/issues/{correct}/{slug}.json`
2. 파일 내부 `publishedAt`·`date`·slug suffix 동시 수정 (sed 일괄)
3. `public/_redirects`에 옛 URL → 정정 URL 301 매핑 추가
4. `npm run update:today` 재실행
5. `npm run indexnow:ping` 재핑

**롤백 안전장치**: push 후 5분 이내 운영자 "취소" 시 `git revert HEAD` + IndexNow 410 ping

---

## 10. 자동 vs Claude(LLM) 분담

**스크립트가 처리 (결정적)**
- 중복 체크 (today.md grep + git log)
- 데이터 풀 매칭 (지원금 ID 인덱싱)
- lint:content / build / update:today / indexnow:ping
- git commit·push
- 슬러그 생성 규칙 강제

**Claude가 매번 판단**
- 6축 롱테일 7±2개 변형
- angle 결정 (운영자 hint 없을 때 후보 제시)
- title·metaDescription·tldr·sections 본문 작성
- table 구조 설계
- faq 질문 선정 + 답변 80자 완결
- sources 큐레이션 (publisher 2개 기관 이상)
- 중복 발견 시 새 각도 제안

**결정 기준**: 정답이 검색·정규식·임계값으로 나오면 스크립트, 의도·문맥·서사가 필요하면 Claude.

---

## 11. 운영자 명령 cheatsheet

```bash
# 첫 키워드 던지기 (가장 단순)
/post 유가연동보조금

# 시기성 강조
/post 유가연동보조금 urgency=high

# 페르소나 단독
/post 청년주택드림 persona=office-rookie

# 지역별
/post 농업인수당 angle=지역별

# 다음 단계 (Claude 안내)
# → GATE-C에서 angle 7±2 후보 보고 1개 확정
# → STEP 5 자동 검증
# → GATE-D에서 "발행" 명령
```

발행 후 운영자가 수동으로 해야 할 것 (3분):
1. Google Search Console → URL 색인 요청 (Claude가 안내 URL 출력)
2. Naver Search Advisor → 새 URL 등록
3. (선택) 본인 SNS·블로그에 링크 공유

---

## 12. 참고

- 기존 발행 23+건 (4/29~5/27): `src/data/issues/2026-*/`에 보존, SEO/색인 누적은 그대로
- 골든 샘플: `src/data/issues/2026-05-27/self-employed-essentials-weekly-2026-05-27.json` (운영자가 처음 참조할 JSON)
- 관련 문서: [HANDOFF.md](../../HANDOFF.md) · [AGENTS.md](../../AGENTS.md) · [INDEXNOW.md](./INDEXNOW.md) · [SEARCH-CONSOLE.md](./SEARCH-CONSOLE.md) · [NAVER-SEARCH-ADVISOR.md](./NAVER-SEARCH-ADVISOR.md)
- 자동 발행 로직 제거 커밋: `683bde1` (2026-05-27)
