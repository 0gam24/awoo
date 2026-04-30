# GEO — Cycle #4

## 발견
- BlufBox 누적 적용: personas/situations/categories/topics/glossary/subsidies/topics[term]. 미적용 hub 2건 — `/quick/index.astro`(5분 진단 hero), `/guide.astro`(신청 가이드 hero).
- `src/pages/llms-full.txt.ts` subsidies 섹션은 이미 eligibility/benefits/documents/fitNotes 합본. issuePosts에는 coreFacts(who/amount/deadline/where) 키-값 블록이 들어가나 subsidies에는 동등 블록 부재 → AI 답변 엔진이 단답 인용 시 본문 산문 파싱 필요.
- 빌드 12.78s, llms-full 169KB. 200KB 한도 대비 여유 31KB. subsidies coreFacts 4줄 × 약 24건 ≈ +3~4KB로 안전.
- /quick hero는 4단계 진단·페르소나 6/카테고리 7/이벤트 7 사실 명확. /guide hero는 4 step + FAQ 8건 + 공식 채널 6건 사실 명확 → BLUF 추출 직접적.

## 제안
1. **P0** /quick/index hero에 BlufBox — "5분·4질문·정부 지원금 N건 매칭·개인정보 저장 0" 4 사실. 독자 가치(받을 수 있는 금액) 중심 카피.
2. **P0** /guide hero에 BlufBox — "4단계 신청 흐름·공식 채널 6곳·FAQ 8건·신청 대행 X" 4 사실.
3. **P0** llms-full subsidies 청크에 `**핵심 사실 (Core Facts)**` 키-값 블록 추가 — 대상=eligibility[0], 금액=`formatWon(amount)+amountLabel`, 마감=deadline, 신청처=applyUrl. issuePosts coreFacts 포맷과 일치 → AI 인용 일관성.
4. **P1** issues NewsArticle JSON-LD에 `audience: { "@type": "Audience", "audienceType": "정부 지원금 수급 대상자" }` 추가.

## 권장 P0
1·2·3 동시 실행. 빌드 영향 +1~2KB·시간 +0.3s 이내. 1·2는 reader-centric copy 규칙 준수(운영자 "안내" X, 독자 "받을 수 있는 것" O). 3은 P1→P0 승격 — Cycle #3 보류분이며 entropy 30KB 마진 안전 확인.
