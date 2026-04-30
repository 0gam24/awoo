# GEO / AI 인용 친화도 — general-purpose

## 발견

### 1. llms.txt / llms-full.txt — 구조 양호, 신선도 신호는 부분적
- `src/pages/llms.txt.ts` — `recentlyAddedSlugs(15)` + `lastBatchAtISO`로 "신규 등록(최근 N일)" 섹션 노출. 페르소나·지원금·가이드·운영주체 5블록 분리.
- `src/pages/llms-full.txt.ts` — `today-issue.json` 헤드라인·hookCopy 인용, 지원금 N종 전체 마크다운 합본, 중위소득 표·페르소나별 매칭 카운트까지 포함. 마지막 갱신 ISO 자동 stamp.
- 문제: **issues 컬렉션 전체 dump는 있으나 issues `[date]/[slug]` 본문(sections·tldr·table·faq)은 llms-full에 미반영** — AI가 인용할 때 `awoo.or.kr/issues/`만 참조, 본문 청크 미접근.

### 2. issues 본문 BLUF·청킹 — 정상 작동, 다른 hub는 미적용
- `src/pages/issues/[date]/[slug].astro` — `tldr[]` 4개 불릿 + `coreFacts` 4박스(대상/금액/기간/신청) + 질문형 H2 5개(`heading: "누가 받나요?"`) + table·FAQ·sources 모두 schema에 박힘. NewsArticle + FAQPage JSON-LD.
- 반면 `src/pages/personas/[id].astro`, `src/pages/subsidies/[id].astro`, `src/pages/situations/[id].astro` — **BLUF 박스·tldr·질문형 H2 모두 부재**. hero 카피는 운영자 시점 설명 위주(`{p.label}이 받을 수 있는 지원금 N개`).
- AI 답변 엔진이 hub에서 인용 가능한 자기충족 청크(80~120자) 부족 → 사이트 인용 시 issues 페이지로만 편향.

### 3. 출처/저자 schema — issues는 모범, 다른 페이지는 GovernmentService만
- issues: `author[Person+Organization]` + `publisher` + `mainEntityOfPage` + `inLanguage` + `articleSection` + sources 풋노트 자동 렌더. E-E-A-T 강력.
- subsidies: `GovernmentService` schema에 `provider`·`audience`·`termsOfService`·`dateCreated`까지 박혀 있으나 **`isBasedOn`(공식 발표 PDF/보도자료 1차 자료 URL) 미노출**. `applyUrl`만 `availableChannel.serviceUrl`로 사용.
- personas/situations/topics — schema 자체 없음(BaseLayout WebSite/Org만).

### 4. robots.txt — AI 크롤러 5종 명시 허용 (GPTBot/ClaudeBot/PerplexityBot/Google-Extended/OAI-SearchBot/CCBot) — 양호.

### 5. 인용 단위 청크 길이 — issues lead 대체로 50~80자, body는 2~4문단(150자/문단) — AI 인용 적정 구간 충족. 다만 hub 페이지는 청크 자체가 없음.

## 제안

### P0 — 모든 hub 페이지 hero 직하 BLUF 박스 추가
- 페르소나/상황/카테고리/토픽 hub 첫 화면 직하에 `summary-bluf` 컴포넌트(80~120자 한 문장 + 핵심 숫자 1개) 신규.
- 예: 페르소나 `office-rookie` → "사회초년생이 받을 수 있는 정부 지원금은 N건, 이 중 주거 분야가 K건으로 가장 많고 평균 지원금은 M만원입니다(2026년 기준)." (사실은 매칭 데이터에서 자동 계산, 추측 X).
- 비용 S(1~2시간), 회귀 낮음. 독자에게도 "이 페이지에서 무엇을 얻는지" 즉답.

### P0 — llms-full.txt에 issues 본문 sections·tldr·faq 청크 합본
- 현재 `issues` 컬렉션은 `headline·summary`만 dump. `src/data/issues/*/*.json`에서 `tldr[]`, `sections[].heading+lead`, `faq` 추가 직렬화.
- 효과: AI가 사이트 외부 인용 시 본문 단위(질문형 H2 + BLUF lead) 정확 인용. 신선도 신호도 강화.
- 비용 S(2~3시간 · 기존 glob 패턴 재사용).

### P1 — subsidies schema에 `isBasedOn` + `citation` 추가
- 1차 자료(부처 보도자료 URL·고시 번호)를 `subsidies` collection schema 옵셔널 필드(`primarySources: [{title,url,publisher,issuedAt}]`)로 추가하고 GovernmentService schema의 `isBasedOn[]`에 매핑.
- 신청 페이지 하단에도 "이 정보의 출처" 섹션 노출(이미 issues에서 검증된 패턴 재사용).
- 비용 M(콘텐츠 백필 필요 — 신규 항목부터 점진 적용).

### P1 — 답변형 H2 표준화 가이드(에디토리얼 룰)
- `seo-geo-news-poster.md`에 이미 명시된 질문형 H2 패턴(❌"지원 내용" / ✅"얼마를 받을 수 있나요?")을 hub 페이지(personas/situations/topics)의 정적 카피에도 적용.
- 예: "받을 수 있는 지원금" → "사회초년생, 무엇부터 받을 수 있나요?".

### P2 — 페르소나/상황 페이지에 mini-FAQ(3건) 추가
- 각 hub 마지막에 FAQPage JSON-LD 부착 가능한 자기충족 Q&A 3건. 데이터는 `pains`·`fitNotes` 재사용.

## 권장 P0

**1) 모든 hub에 BLUF 박스 + 자동 통계 한 문장 — AI 인용·독자 모두에게 즉시 효과, 회귀 위험 거의 없음.**
**2) llms-full.txt에 issues 본문 sections·tldr·faq 합본 — 본 사이트의 가장 큰 자산(매일 누적되는 issues)을 AI 답변 엔진이 정확 인용 가능하게 만드는 가장 저비용 작업.**

두 작업 모두 외부 API/계정/결제 의존 없음, PSI 영향 없음(빌드타임 prerender), 카피는 독자 가치 중심으로 작성 가능.
