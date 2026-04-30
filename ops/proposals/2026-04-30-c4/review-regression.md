# 회귀 점검 — Cycle #4

## 회귀 위험 지점

1. **CATEGORY_FAQS 카테고리 키 미스매치** — site-data.ts에 7카테고리(주거·취업·창업·교육·자산·복지·농업) × 3 = 21 FAQ 정의되어 있으나, subsidy `s.category` 값이 위 7개 정확히 일치하지 않으면 `CATEGORY_FAQS[s.category] ?? []` 빈 배열로 떨어져 fallback 실패. 카테고리 라벨이 "주거지원"·"청년주거" 등 변형 시 무력화. (PLAN 본문의 5×3=15 표기는 실제 21건과 불일치 — 기록 정정 필요.)
2. **subsidies/[id] BLUF 0/null 가드 부재** — `formatWon(s.amount)`은 amount=0이면 "0원" 출력, `s.deadline`이 null이면 BlufBox stat label 비고 노출, `personaSummary`는 빈 배열 시 "대상 확인 필요" 처리되나 `s.amountLabel`·`s.status` null 검사 없음. 119건 중 status 누락 케이스 시 빈 chip 노출.
3. **topics/[term] BlufBox totalCount/daysActive** — `entry.totalCount<3` 페이지는 generate 자체 차단되어 0건은 안전. 단 `entry.firstSeen`·`lastSeen` null 시 summary 문장에 "undefined부터 undefined까지" 출력 가능.
4. **NewsArticle.publisher @id 의존** — schema.ts에서 `#organization` @id resolve는 동일 페이지 내 orgSchema가 함께 emit되어야 작동. issues/[date]/[slug] 페이지에 orgSchema 동봉 여부 미확인 시 Google rich-result 경고 가능.
5. **check-apply-urls 정규식 `/\.(go|gov|or)\.kr$/`** — `parsed.host`가 IDN(punycode)이거나 포트 포함(`example.go.kr:8080`) 시 `$` 앵커 미스. 또한 합법적인 정부기관 `.kr` 도메인(예: `nts.kr`, `epeople.kr`)·서브도메인 `online.gov.kr` 은 통과하지만 일부 위탁기관은 `.com`·`.net` 사용 → 합법 URL이 화이트리스트 밖으로 빠질 수 있음.
6. **generate-issue-posts 30KB 캡** — articles 단순 길이 기준 pop이라 본문 매우 긴 단일 기사 1건도 30KB 근접 시 잘림. 정상 케이스에서 잘림 빈도·loss 카운트 로깅 부재.
7. **Claude API ephemeral cache** — system prompt 1400 토큰은 cache 최소 임계(1024 토큰 sonnet 기준) 충족하나 첫 호출 응답의 `cache_creation_input_tokens` 로깅 없음 → 캐시 hit 여부 사후 검증 불가.
8. **about.astro inline orgSchema 제거 결과** — BaseLayout이 전역 orgSchema를 emit하는지, Footer 표기 정보가 schema와 일치하는지 확인 필요(NAP 일관성).

## 검증·보강 제안

- subsidy `category` enum 정합성 lint: collectionSchema에 7카테고리 z.enum 강제 → CATEGORY_FAQS 키와 동일 source.
- BLUF stats 빈 값 필터: `blufStatsSubsidy.filter(x => x.value && x.label)` 로 자동 제외.
- topics BLUF: `entry.firstSeen ?? '최근'` fallback 한 줄.
- check-apply-urls: `parsed.hostname`(포트 제거) + `nts.kr`·`korea.kr` 등 화이트리스트 추가, skippedHost 리포트 임계 알림.
- generate-issue-posts: 잘림 발생 시 `console.warn('[trim] N→M')` + 보고서 카운터.
- Claude API 응답에서 `usage.cache_creation_input_tokens`·`cache_read_input_tokens` 로깅 1줄 추가.
- schema.ts orgSchema가 BaseLayout 전역 emit되는지 1회 grep 확인.

## 권장 P0

- **P0-A**: subsidy collectionSchema에 `category: z.enum([...7])` 강제 + lint (회귀 1).
- **P0-B**: BLUF 0/null 자동 필터 + topics firstSeen fallback (회귀 2·3).
- **P0-C**: check-apply-urls hostname+포트 처리 + 정부 위탁기관 도메인 추가 (회귀 5).
- **P0-D**: Claude API usage 토큰 캐시 hit 로그 1줄 (회귀 7).
