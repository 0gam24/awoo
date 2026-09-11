# 키워드 후보 보고 — 2026-09-11 (KST)

생성 2026-09-11 01:04Z · scripts/keyword-pipeline.mjs
SERP 실측: 사용 안 함 — naver-ranks 최근 측정 재사용(2026-09-10). 실측은 --serp
입력: cluster-intents 56건 · naver-ranks 39쿼리 · 레이더 candidates 49건(지역 후보 소스: radar.candidates) · volume-scale 계수 13 · big-keywords 12 · landgrab 9 · 글 256건
후보: T1 5 · T2 9 · T3 0 · 갱신 24 · 제외 78

## 오늘 후보

T1은 개시일 임박순(점수보다 우선), T2·T3는 점수순. 창 안 발행 상한 없음, 1지자체 1패밀리 1건(결정 #1). T2는 창 안 주 1~2건(결정 #10).

| # | 트랙 | 쿼리 | 근거 | 예상 유입/주 | 조건 |
|---|---|---|---|---|---|
| 1 | T1 B | 부안군 민생안정지원금 못 받았으면 · 변형: 부안군 민생안정지원금 9월 16일 출장 지급 이후 (부안) | 개시 09/16 D-5 · --check 부안×B PASS(기존 A 08-07·A 08-19) · 401/주, 접미형 r2. 개시일 언론 벽 방어용 D-3 = 9/13(계획 §5·§6 #2) · recent7 2.84(부안군 민생지원금, volume-scale) · 지역 헤드 "부안군 민생지원금" r2(2026-09-09) · SERP 미측정(타깃 쿼리 이력 없음 — --serp) · 계수 gun/null 70.9(n=4) · 점수 402.7 | 100~300 | 공고에서 B키 2개(출장 일정표·미수령자 창구·11/30) 확정 · 공고 go.kr URL 미확보(fact-checker 대조 필요) · 작성 기한 2026-09-13(D-2) |
| 2 | T1 A | 영암군 농촌기본수당 10만원 하반기 신청 · 변형: 영암 농촌기본수당 월출페이 9월 7일 (영암) | 개시 09/07 D+4 · --check 영암×A PASS · 언론 8곳 9/3~4, 인구 5.2만 군(계획 §6 #6) · recent7 미측정 → proxy 2.84(gun 접미형 중앙값) · SERP 미측정(타깃 쿼리 이력 없음 — --serp) · 계수 gun/null 70.9(n=4) · 점수 402.7 | 100~300 | yeongam.go.kr 고시공고 URL 확보(결정 #8) · 공고 go.kr URL 미확보(fact-checker 대조 필요) |
| 3 | T1 A 롤업 | 4차 민생지원금 지역별 지급 현황 · 변형: 4차 민생지원금 9월 신청 지역 / 4차 민생지원금 개시일 | 롤업 축 "4차" × A — 기존 롤업 chuseok-livelihood-recovery-region-check-2026-07-30(추석 축) · recent7 455·trend 2.46(volume-scale volumesUsed). rank-targets 2026-09-10: 자사 미노출·web4·본청 0 · rank-targets: 4차축 롤업 후보 자리. 2026-09-10 SERP: 자사 미노출·web4(블로그2·상업1·중원구청1), 본청 0·언론 0 · recent7 455.89(volume-scale) · SERP 이력 없음(--serp로 실측 필요) · 계수 rollup/null 50.5(n=1) · 점수 46044.9 | 50~500 | 변형 2개 webDocOffset <30%(결정 #4). 07-30 추석 롤업 잠식 시 noindex |
| 4 | T1 A | 정읍시 민생지원금 (정읍) | 실유입 "정읍시 민생지원금" 101/주 순위 미측정 · --check 정읍×A PASS(기존 V 08-09 — 같은 지역 다른 패밀리, 잠식 여부 확인) · 지역 헤드 "정읍 민생지원금" r1 · recent7 2.06(volume-scale) · SERP 미측정 · 계수 si/null 45.7(n=13) · 점수 188.3 | 현재 101/주(자사 미노출·미측정분 회수) | 공고 go.kr URL 확보 + 접미형·변형 SERP 실측 |
| 5 | T1 A | 창원 지원금 (창원) | 실유입 "창원 지원금" 60/주 순위 미측정 · --check 창원×A PASS(기존 V 08-28 — 같은 지역 다른 패밀리, 잠식 여부 확인) · 지역 헤드 "창원 민생지원금" r7 · recent7 1.83(radar) · SERP 미측정 · 계수 si/null 45.7(n=13) · 점수 167.3 | 현재 60/주(자사 미노출·미측정분 회수) | 공고 go.kr URL 확보 + 접미형·변형 SERP 실측 |
| 6 | T2 | 월세 세액공제 월세환급금 | big-keywords "월세 세액공제" alias "월세환급금" · recent7 23.15(big-keywords datalab rel30(proxy)) · SERP 이력 없음 · 클러스터 실유입 51/주 · 계수 national/null 36.8(n=1) · 점수 1703.8 | 511~1193 | SERP 미측정 — --serp로 openSlots ≥2·자매 0 확인 · 초안 있음(_drafts/monthly-rent-refund-lookup) — 신규 대신 초안 완성 여부 먼저 · 자매 주의: 연말정산 절세 각도는 smartdatashop.kr·asiatop.co.kr, 임대·부동산 각도는 homedata.kr 몫.  |
| 7 | T2 | 에너지바우처 잔액조회 | big-keywords "에너지바우처" alias "잔액조회" · recent7 10.09(big-keywords datalab rel30(proxy)) · "에너지바우처 잔액 조회" naver-ranks 2026-09-10: 자사 미노출 · openSlots 6 · 자매 0 · T2 open · 계수 national/null 36.8(n=1) · 점수 1485.2 | 223~520 | 자매 주의: 역할표에 직접 겹치는 자매 없음. 부동산·주거비 각도(homedata.kr)와만 거리 유지. · 인접 글 oil-relief-usage-period-merchants-2026-07-08 — 각도 분리 |
| 8 | T2 | 근로장려금 대상 기준 | big-keywords "근로장려금" alias "대상 기준" · recent7 10.93(radar) · SERP 이력 없음 · 클러스터 실유입 456/주 · 계수 national/null 36.8(n=1) · 점수 804.4 | 241~563 | SERP 미측정 — --serp로 openSlots ≥2·자매 0 확인 · 자매 주의: 세금·환급 각도는 smartdatashop.kr(세금·금융) 몫, 가족 인적공제 각도는 familydata.kr. awoo는  · 인접 글 eitc-property-requirement-jeonse-2026-07-17, eitc-review-status-early-payment-2026-07-27 — 각도 분리 |
| 9 | T2 | 월세 세액공제 경정청구 | big-keywords "월세 세액공제" alias "경정청구" · recent7 9.32(big-keywords datalab rel30(proxy)) · SERP 이력 없음 · 클러스터 실유입 51/주 · 계수 national/null 36.8(n=1) · 점수 686 | 206~480 | SERP 미측정 — --serp로 openSlots ≥2·자매 0 확인 · 초안 있음(_drafts/monthly-rent-refund-lookup) — 신규 대신 초안 완성 여부 먼저 · 자매 주의: 연말정산 절세 각도는 smartdatashop.kr·asiatop.co.kr, 임대·부동산 각도는 homedata.kr 몫.  |
| 10 | T2 | 실업급여 구직급여 | big-keywords "실업급여" alias "구직급여" · recent7 6.9(big-keywords datalab rel30(proxy)) · SERP 이력 없음 · 클러스터 실유입 340/주 · 계수 national/null 36.8(n=1) · 점수 507.8 | 152~355 | SERP 미측정 — --serp로 openSlots ≥2·자매 0 확인 · 자매 주의: 지원금 축은 awoo 고유. '실업급여 계산기' 각도는 calculatorhost.com, 사회초년생 첫 실직 각도는 asia · 인접 글 unemployment-credit-pension-2026-06-25, job-promotion-allowance-extra-benefits-2026-06-29 — 각도 분리 |

T2 나머지 4건(점수순, 큐 JSON에 있음): 기초연금 소득인정액(275.3), 실업급여 상실신고(195.8), 중위소득 계산(123.6), 주휴수당 포함 시급(119.2)

## 갱신 후보

결정 #2: 틀린 정보·바뀐 날짜만 고친다(사실 정정·updates[]·dateModified·표 행). 제목·slug·구조·전면 재작성 금지.

| # | 글 | 날짜 | 고칠 것 | 근거 |
|---|---|---|---|---|
| 1 | 추석 지원금 50만원 받는 지역, 의령·함평 대상 확인 (src/data/issues/2026-08-27/chuseok-grant-50man-uiryeong-hampyeong-2026-08-27.json) | 2026-09-11 D-day | 오늘 마감·지급일 — 당일 표기 | coreFacts.deadline "의령 2026.8.10~9.11(마감 임박) / 함평 2026.9.7~10.8(첫 주 9.7~11 출생연도 끝자리 5부제)" · 날짜 2026-09-11 D-day (+ 2026-09-07 D+4) · 갱신 이력 없음 · 계획 §5 이정표: 신청 마감 9/11(2026-09-11) |
| 2 | 추석 민생지원금 최대 50만원, 소비쿠폰과 중복 수급되나 (src/data/issues/2026-08-07/chuseok-livelihood-coupon-duplicate-2026-08-07.json) | 2026-09-11 D-day | 오늘 마감·지급일 — 당일 표기 | coreFacts.deadline "추석(9월 25일) 전 지급 목표 / 의령 신청 8.10~9.11, 부안 지급 9.16~18, 통영 이르면 8월 말 신청(지자체 공고로 확정)" · 날짜 2026-09-11 D-day · dateModified 2026-08-07 |
| 3 | 추석 민생회복지원금 우리 지역 대상·신청 조회 방법 (src/data/issues/2026-07-30/chuseok-livelihood-recovery-region-check-2026-07-30.json) | 2026-09-11 D-day | 오늘 마감·지급일 — 당일 표기 | coreFacts.deadline "2026 추석(9월 25일) 전 지급 지자체 증가 / 신청·지급·사용기한은 지자체 공고로 확정(속초 신청 7.20~9.11·나주 9.14부터)" · 날짜 2026-09-11 D-day (+ 2026-09-14 D-3) · dateModified 2026-07-30 |
| 4 | 4차 민생지원금 지급 여부, 지금 신청받는 건 지자체 지원금이다 (src/data/issues/2026-08-09/minsaeng-4th-round-payment-status-2026-08-09.json) | 2026-09-11 D-day | 오늘 마감·지급일 — 당일 표기 | coreFacts.deadline "고유가 피해지원금 사용기한 2026.08.31 24시(잔액 소멸·환수) / 지자체 추석 지원금은 지역별 공고(의령 8.10~9.11, 고창 9." · 날짜 2026-09-11 D-day · 갱신 이력 없음 |
| 5 | 속초 민생회복지원금 20만원, 7월 20일 신청 요일제 확인 (src/data/issues/2026-07-19/sokcho-livelihood-recovery-grant-2026-07-19.json) | 2026-09-11 D-day | 오늘 마감·지급일 — 당일 표기 | coreFacts.deadline "신청 2026.07.20~09.11 / 7.20~7.31 요일제는 방문 접수만 적용(온라인은 요일 무관) / 사용 기한 2026.11.30" · 날짜 2026-09-11 D-day · 갱신 이력 없음 |
| 6 | 의령군 민생안정지원금 50만원 지급일과 대상 기준 (src/data/issues/2026-08-12/uiryeong-livelihood-stability-grant-2026-08-12.json) | 2026-09-11 D-day | 오늘 마감·지급일 — 당일 표기 | coreFacts.deadline "신청·지급 2026.08.10~09.11 / 상품권 사용기한 2026.12.31" · 날짜 2026-09-11 D-day · 갱신 이력 없음 · 계획 §5 이정표: 신청 마감 9/11(2026-09-11) |
| 7 | 완주군 민생안정지원금 30만원 신청, 9월 8일 선불카드 (src/data/issues/2026-08-12/wanju-livelihood-stability-grant-2026-08-12.json) | 2026-09-13 D-2 | 2일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "신청·지급 2026.09.08~10.30(집중지급 9.08~9.13) / 사용기한 2026.12.31" · 날짜 2026-09-13 D-2 · 갱신 이력 없음 · 계획 §5 이정표: 위임장 대리신청 9/14 이후(9/2 위임장 공고)(2026-09-14) |
| 8 | 영암 — 대응 글 없음 | 2026-09-14 D-3 | 3일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | 계획 §5 이정표: 방문 신청 개시 9/14 · 날짜 2026-09-14 D-3 · 갱신 이력 없음 |
| 9 | 고흥 민생지원금 언제 나오나, 30만원 추진 상황 정리 (src/data/issues/2026-08-19/goheung-livelihood-grant-2026-08-19.json) | 2026-09-14 D-3 | 3일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "9월 1일 확정 발표: 2026.9.14~18 마을 방문 지급(1차), 9.21~10.30 읍면사무소 신청, 사용기한 2026.12.31(지류 " · 날짜 2026-09-14 D-3 · dateModified 2026-09-05T22:58:49.000Z · 계획 §5 이정표: 마을 지급 9/14~18 개시(2026-09-14) |
| 10 | 고흥군 민생회복지원금 30만원, 추석 전 고흥사랑상품권 지급 (src/data/issues/2026-08-17/goheung-livelihood-recovery-grant-2026-08-17.json) | 2026-09-14 D-3 | 3일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | 계획 §5 이정표: 마을 지급 9/14~18 개시 · 날짜 2026-09-14 D-3 · 갱신 이력 없음 |
| 11 | 생계·의료급여 수급 근로가구 희망저축계좌 9월 3차 모집 D-4 (src/data/issues/2026-08-28/hope-savings-account-type1-round3-2026-08-28.json) | 2026-09-14 D-3 | 3일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "Ⅰ유형 3차 접수 2026년 9월 1일~14일, 놓치면 4차 11월 2일~16일 예정" · 날짜 2026-09-14 D-3 · 갱신 이력 없음 |
| 12 | 문경 고유가 지원금 25만원, 9월 14일 신청 (src/data/issues/2026-08-16/mungyeong-high-oil-price-relief-2026-08-16.json) | 2026-09-14 D-3 | 3일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "신청 2026년 9월 14일~10월 23일 / 선불카드 사용기한 2026년 12월 31일까지" · 날짜 2026-09-14 D-3 · 갱신 이력 없음 |
| 13 | 문경 민생지원금 추석 전 지급되나, 9월 1일 추경 관건 (src/data/issues/2026-08-27/mungyeong-livelihood-grant-chuseok-payment-2026-08-27.json) | 2026-09-14 D-3 | 3일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "접수 2026년 9월 14일~10월 23일, 추석(9월 25일) 전 지급 목표는 9월 1일 시의회 추경 의결이 전제" · 날짜 2026-09-14 D-3 · 갱신 이력 없음 |
| 14 | 나주 민생회복지원금 5부제, 내 출생연도 신청일은 9월 며칠인가 (src/data/issues/2026-09-03/naju-livelihood-grant-rotation-days-2026-09-03.json) | 2026-09-14 D-3 | 3일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "온라인·방문 공통 2026.09.14~10.16(시 공식 게시물), 첫 주 9.14~18 출생연도 끝자리 5부제. 온라인 안내의 출생연도 무관 " · 날짜 2026-09-14 D-3 · 갱신 이력 없음 |
| 15 | 나주 민생회복지원금 20만원, 9월 14일 신청 시작 (src/data/issues/2026-08-07/naju-livelihood-recovery-grant-2026-08-07.json) | 2026-09-14 D-3 | 3일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "신청·지급 2026.09.14부터(9월 제2회 추경 의결 전제, 마감일은 공고 예정) / 사용기한 2026.11.30" · 날짜 2026-09-14 D-3 · dateModified 2026-09-03T07:10:00.000Z |
| 16 | 완주군 민생안정지원금 위임장 대리신청 서류와 9월 14일 이후 창구 (src/data/issues/2026-09-10/wanju-grant-proxy-application-after-sep14-2026-09-10.json) | 2026-09-14 D-3 | 3일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | 계획 §5 이정표: 위임장 대리신청 9/14 이후(9/2 위임장 공고) · 날짜 2026-09-14 D-3 · 갱신 이력 없음 |
| 17 | 청년월세지원 선정자 발표 9월 14일, 소급 지급 얼마? (src/data/issues/2026-09-10/youth-rent-support-selection-announcement-2026-09-10.json) | 2026-09-14 D-3 | 3일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "선정자 발표 2026년 9월 14일 예정" · 날짜 2026-09-14 D-3 · 갱신 이력 없음 |
| 18 | 울진군 민생안정지원금 30만원 부결, 9월 7일 예결위 이후 재상정 여부 (src/data/issues/2026-09-10/uljin-grant-300k-rejected-resubmission-2026-09-10.json) | 2026-09-10 D+1 | 마감·지급일 1일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "지급일 없음, 재상정 일정 미정 9월 10일 기준" · 날짜 2026-09-10 D+1 · 갱신 이력 없음 |
| 19 | 강릉 민생지원금 10만원 재상정안 통과 시 지급 시점과 정례회 일정 (src/data/issues/2026-09-03/gangneung-livelihood-grant-resubmission-2026-09-03.json) | 2026-09-09 D+2 | 마감·지급일 2일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "지급일 미정. 표결 후보는 제332회 정례회 9월 9일 제2차 본회의 또는 9월 22일 제3차 본회의(폐회일)이며 회기 중 조례안 접수·상임위 " · 날짜 2026-09-09 D+2 · 갱신 이력 없음 |
| 20 | 고창군 군민활력지원금 30만원 신청 대상과 기간 (src/data/issues/2026-08-09/gochang-resident-vitality-grant-2026-08-09.json) | 2026-09-07 D+4 | 마감·지급일 4일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "신청·지급 2026.09.01~10.16(9.1~9.7 출생연도 끝자리 5부제) / 사용기한 2026.12.31" · 날짜 2026-09-07 D+4 · 갱신 이력 없음 |

갱신 나머지 4건은 큐 JSON(track "갱신")에 있음.

## 제외(사유)

- [T1] 완주군 민생안정지원금 위임장 대리신청 — cluster-intents VETO: 완주 × B 이미 존재: wanju-grant-proxy-application-after-sep14(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 고흥 신규 — 신규 없음(knownPair A+V, 계획 §5)
- [T1] 고창 신규 — 창 닫힘(D+9). 교훈: 사용자 언어 선두(계획 §5) · 실유입 "고창군 민생지원금" 138/주 순위 미측정 · 실유입 "고창 지원금" 65/주 순위 미측정
- [T1] 영동 신규 — 신규 없음. knownPair(진짜 중복 쌍), 3건째 금지(계획 §5) · 실유입 "영동군 민생지원금" 66/주 순위 미측정
- [T1] 의령 신규 — "2위여도 유입 0" 사례 — 계수에 적재(계획 §5)
- [T1] 김해 B — 보류: 김해시 공고 게시 후 B키 2개 확정 시만(결정 #5) — A글 coreFacts에 상품권 키 이미 있음, 공고 0건(9/10). 언론은 "신청 없이 순차 지급" — A글 본문 수정 금지 · B 트리거: "김해 민생지원금" r8(2026-09-10) · 실유입 "2026 김해 민생지원금" 217/주 순위 미측정 · 실유입 "김해시 지원금" 216/주 순위 미측정 · 실유입 "김해 지원금" 167/주 순위 미측정 · 실유입 "김해시 지원금 10만원" 126/주 순위 미측정 · 실유입 "김해 추석 민생지원금" 98/주 순위 미측정 · 실유입 "김해시 추석지원금" 63/주 순위 미측정 · 실유입 "김해 10만원" 63/주 순위 미측정 · 실유입 "김해시 추석 민생지원금" 61/주 순위 미측정
- [T1] 강릉 — 보류: V글 보유. 신규 금지, bill.do 새 uid 감시(결정 #6)
- [T1] 당진 — 보류: V글 보유. 신규 금지, 가결 감시(결정 #6) · 실유입 "당진시 민생지원금" 75/주 순위 미측정
- [T1] 울진군 민생안정지원금 30만원 부결 — cluster-intents VETO: 울진 × V 이미 존재: uljin-grant-300k-rejected-resubmission-2026-09-10(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 광양 민생지원금 30만원 지급하나요 — cluster-intents VETO: 광양 × V 이미 존재: gwangyang-grant-300k-chuseok-postponed-2026-09-10(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 대구 V — 보류: 확인 불가 — 첫 주 제외(계획 §5)
- [T1] 경기 V — 보류: 확인 불가 — 첫 주 제외(계획 §5) · B 트리거: "경기도 민생지원금" rank null(통블록)(2026-09-10)
- [T1] 창원 B — B 트리거: "창원 민생지원금" r7(2026-09-10) → 지급 확정 글(A) 없음 — 부결·미확정 지역엔 지급 후 글이 성립하지 않음(기존: V)
- [T1] 완주 B — B 트리거: "완주 민생지원금" r10(2026-09-09) → cluster-intents VETO: 완주 × B 이미 존재: wanju-grant-proxy-application-after-sep14(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 완주 B — B 트리거: "완주군 민생지원금" rank null(통블록)(2026-09-09) → cluster-intents VETO: 완주 × B 이미 존재: wanju-grant-proxy-application-after-sep14(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 광양 B — B 트리거: "광양 민생지원금 30만원 지급하나요" rank null(통블록)(2026-09-10) → 지급 확정 글(A) 없음 — 부결·미확정 지역엔 지급 후 글이 성립하지 않음(기존: V)
- [T1] 울진 B — B 트리거: "울진군 민생안정지원금 30만원 부결" rank null(통블록)(2026-09-10) → 지급 확정 글(A) 없음 — 부결·미확정 지역엔 지급 후 글이 성립하지 않음(기존: V)
- [T1] 통영시 민생지원금 신청 — born "통영시 민생지원금 신청" 134/주 순위 미측정 → cluster-intents VETO: 통영 × A 이미 존재: tongyeong-livelihood-recovery-grant-2026-08-15(2026-08-15). 잠금 제외 2건(롤업·비민생) · coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts) — 기존 글 순위 재측정 대상
- [T1] 완주군 민생지원금 — 실유입 "완주군 민생지원금" 512/주 자사 미노출 → cluster-intents VETO: 완주 × A 이미 존재: wanju-livelihood-stability-grant-2026-08-12(2026-08-12). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 통영 지원금 신청 — 실유입 "통영 지원금 신청" 182/주 순위 미측정 → cluster-intents VETO: 통영 × A 이미 존재: tongyeong-livelihood-recovery-grant-2026-08-15(2026-08-15). 잠금 제외 2건(롤업·비민생) · coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts) — 기존 글 순위 재측정 대상
- [T1] 완주 민생지원금 — 실유입 "완주 민생지원금" 170/주 r10 → cluster-intents VETO: 완주 × A 이미 존재: wanju-livelihood-stability-grant-2026-08-12(2026-08-12). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 통영 민생지원금 신청 — 실유입 "통영 민생지원금 신청" 157/주 순위 미측정 → cluster-intents VETO: 통영 × A 이미 존재: tongyeong-livelihood-recovery-grant-2026-08-15(2026-08-15). 잠금 제외 2건(롤업·비민생) · coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts) — 기존 글 순위 재측정 대상
- [T1] 완주 지원금 — 실유입 "완주 지원금" 149/주 순위 미측정 → cluster-intents VETO: 완주 × A 이미 존재: wanju-livelihood-stability-grant-2026-08-12(2026-08-12). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts) — 기존 글 순위 재측정 대상
- [T1] 함평 지원금 — 실유입 "함평 지원금" 60/주 순위 미측정 → cluster-intents VETO: 함평 × A 이미 존재: hampyeong-livelihood-recovery-grant-2026-08-16(2026-08-16). 잠금 제외 2건(롤업·비민생) · coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts) — 기존 글 순위 재측정 대상
- [T2] 실업급여 이직확인서 — 축 잠금 — separation-certificate-request-10days-2026-09-09(2026-09-09) 제목이 "이직확인서" 축을 이미 잡고 있다
- [T2] 실업급여 조기재취업수당 — 축 잠금 — early-reemployment-allowance-2026-06-16(2026-06-16) 제목이 "조기재취업수당" 축을 이미 잡고 있다
- [T2] 실업급여 하한액 — 축 잠금 — unemployment-benefit-amount-calc-2026-07-10(2026-07-10) 제목이 "하한액" 축을 이미 잡고 있다
- [T2] 주휴수당 계산법 — 축 잠금 — weekly-holiday-pay-calculation-2026-08-10(2026-08-10) 제목이 "계산법" 축을 이미 잡고 있다
- [T2] 주휴수당 쿠팡 — 축 잠금 — coupang-weekly-holiday-pay-5day-condition-2026-09-09(2026-09-09) 제목이 "쿠팡" 축을 이미 잡고 있다
- [T2] 주휴수당 알바 조건 — 축 잠금 — weekly-holiday-pay-calculation-2026-08-10(2026-08-10) 제목이 "알바 조건" 축을 이미 잡고 있다
- [T2] 주휴수당 주 15시간 — 축 잠금 — weekly-holiday-pay-calculation-2026-08-10(2026-08-10) 제목이 "주 15시간" 축을 이미 잡고 있다
- [T2] 근로장려금 반기 — 축 잠금 — eitc-semiannual-vs-regular-payment-date-2026-07-01(2026-07-01) 제목이 "반기" 축을 이미 잡고 있다
- [T2] 근로장려금 지급일 — 축 잠금 — eitc-semiannual-vs-regular-payment-date-2026-07-01(2026-07-01) 제목이 "지급일" 축을 이미 잡고 있다
- [T2] 근로장려금 자녀장려금 — 축 잠금 — child-tax-credit-payment-2026-07-15(2026-07-15) 제목이 "자녀장려금" 축을 이미 잡고 있다
- [T2] 근로장려금 계산기 — recent7 0.8 < 1.5(radar)
- [T2] 근로장려금 현금수령 — 축 잠금 — eitc-refund-notice-cash-receipt-2026-08-07(2026-08-07) 제목이 "현금수령" 축을 이미 잡고 있다
- [T2] 중위소득 2027 — 축 잠금 — median-income-2027-livelihood-benefit-threshold-2026-08-01(2026-08-01) 제목이 "2027" 축을 이미 잡고 있다
- [T2] 기초연금 2027 개편 — 축 잠금 — basic-pension-2027-tiered-payment-2026-09-05(2026-09-05) 제목이 "2027 개편" 축을 이미 잡고 있다
- [T2] 기초연금 자동차 기준 — 축 잠금 — basic-pension-car-asset-2026-07-14(2026-07-14) 제목이 "자동차 기준" 축을 이미 잡고 있다
- [T2] 기초연금 차량가액 — 축 잠금 — basic-pension-car-asset-2026-07-14(2026-07-14) 제목이 "차량가액" 축을 이미 잡고 있다
- [T2] 에너지바우처 난방비 — recent7 0.23 < 1.5(big-keywords datalab rel30(proxy))
- [T2] 에너지바우처 사용기간 — 축 잠금 — summer-energy-voucher-cooling-2026-07-13(2026-07-13) 제목이 "사용기간" 축을 이미 잡고 있다
- [T2] 에너지바우처 동절기 — 축 잠금 — energy-voucher-usage-period-carryover-2026-07-01(2026-07-01) 제목이 "동절기" 축을 이미 잡고 있다
- [T2] 에너지바우처 신청 대상 — 축 잠금 — summer-energy-voucher-cooling-2026-07-13(2026-07-13) 제목이 "신청 대상" 축을 이미 잡고 있다
- [T2] 에너지바우처 가구원수 금액 — 축 잠금 — energy-voucher-household-size-amount-2026-07-19(2026-07-19) 제목이 "가구원수 금액" 축을 이미 잡고 있다
- [T2] 국가장학금 2차 — 축 잠금 — national-scholarship-2nd-round-2026-07-28(2026-07-28) 제목이 "2차" 축을 이미 잡고 있다
- [T2] 청년월세 주거급여 중복 — datalab 무응답(null = 미측정, 0 아님) — keyword-volume으로 측정 후 재판정
- [T2] 청년월세 선정자 — 축 잠금 — youth-rent-support-selection-announcement-2026-09-10(2026-09-10) 제목이 "선정자" 축을 이미 잡고 있다
- [T2] 청년월세 선정 발표 — 축 잠금 — youth-rent-support-selection-announcement-2026-09-10(2026-09-10) 제목이 "선정 발표" 축을 이미 잡고 있다
- [T2] 노란우산공제 중도해지 — 축 잠금 — yellow-umbrella-termination-other-income-tax-2026-09-09(2026-09-09) 제목이 "중도해지" 축을 이미 잡고 있다
- [T2] 노란우산공제 소득공제 한도 — 축 잠금 — yellow-umbrella-deduction-limit-2026-08-29(2026-08-29) 제목이 "소득공제 한도" 축을 이미 잡고 있다
- [T2] 노란우산공제 해지 세금 — 축 잠금 — yellow-umbrella-termination-other-income-tax-2026-09-09(2026-09-09) 제목이 "해지 세금" 축을 이미 잡고 있다
- [T2] 본인부담상한액 초과금 환급 — 축 잠금 — medical-copay-cap-refund-2026-08-31(2026-08-31) 제목이 "초과금 환급" 축을 이미 잡고 있다
- [T2] 2027 예산안 — mode update-only — 갱신 트랙 전용(지금은 1.77로 작고 하락 중(trend 0.56). 대응 글 0. 국회 심사(11월)·통과(12/2 법정)
- [T3] 중도퇴사 연말정산 — hold: peak ≥3 ✗(2.86 — 미달) + openSlots ≥2 + 자매 0 + 운영자 승인 + 자매 미러 확인(asiatop 사회초년생 퇴사 각도). 재측정에서 ≥3 나올 때만
- [T2] 검색량 미측정 23건(keyword-volume·레이더 측정 전 — 0이 아니라 "못 쟀다"): 실업급여 자발적 퇴사, 실업급여 면접 불참, 주휴수당 알바 계산기, 근로장려금 상반기, 중위소득 계산기, 기준 중위소득 표, 중위소득 가구원수, 기초연금 부부 감액, 기초연금 인상액, 월세 세액공제 신청 대상, 월세 세액공제 기한, 월세 세액공제 국세환급금 통지서, 국가장학금 서류, 국가장학금 서류제출 안 하면, 국가장학금 소득구간, 국가장학금 지급일, 청년월세 2027 주거급여, 청년월세 월세지원 사업, 노란우산공제 가입 조건, 노란우산공제 폐업 공제금, 본인부담상한액 환급 신청, 본인부담상한액 2026 상한액 표, 본인부담상한액 사후환급

## 다음 물결 감시

- 나주 — 개시 09/14 D-3 · 신규 없음. D-1·D+1 재측정, 4위 이하면 B(계획 §5)
- 문경 — 개시 09/14 D-3 · 신규 없음. 9/16 B 필요 여부 판단(계획 §5) (판단일 2026-09-16)
- 김해 — 개시 09/17 D-6 · 김해시 공고 게시 후 B키 2개 확정 시만(결정 #5)
- 강릉 — 개시일 미정 · V글 보유. 신규 금지, bill.do 새 uid 감시(결정 #6) · https://gncl.go.kr:8080/assembly/bill.do
- 당진 — 개시일 미정 · V글 보유. 신규 금지, 가결 감시(결정 #6)
- 대구 — 개시일 미정 · 확인 불가 — 첫 주 제외(계획 §5)
- 경기 — 개시일 미정 · 확인 불가 — 첫 주 제외(계획 §5)
- 설 2027 지자체 지원금 — watch · 감시 시작 2026-11-01 · 가결 트리거 — 지자체별 조례·추경 가결 또는 공고 확인 시 즉시(개시 D-7 안). 날짜 캘린더 아님
- 연말정산 월세 세액공제 — writeBy 2026-11-05(D-55) · 피크 1월 76.21
- 연말정산 부양가족 — writeBy 2026-11-15(D-65) · 피크 1월 16.51
- 연말정산 의료비 — writeBy 2026-11-25(D-75) · 피크 1월 14.08
- 연말정산 연금저축 — writeBy 2026-12-05(D-85) · 피크 1월 7.49
- 연말정산 경정청구 — writeBy 2026-12-20(D-100) · 피크 5월 12.9
- 난방비 지원 — writeBy 2026-10-15(D-34) · 피크 11월 14.83
- 부안 출장 지급 9/16~18 개시 — 2026-09-16(D-5) 갱신 예정 · buan-livelihood-stability-grant-2026-08-19
- 나주 계획 §7-2 기재 카운트다운 날짜(9/30 — 세부 내용 확인 불가) — 2026-09-30(D-19) 갱신 예정 · naju-livelihood-recovery-grant-2026-08-07, naju-livelihood-grant-rotation-days-2026-09-03
- 나주 신청 마감 10/16 카운트다운 정정(계획 §7-2) — 2026-10-16(D-35) 갱신 예정 · naju-livelihood-recovery-grant-2026-08-07, naju-livelihood-grant-rotation-days-2026-09-03
- 문경 신청 마감 10/23 — 2026-10-23(D-42) 갱신 예정 · mungyeong-high-oil-price-relief-2026-08-16, mungyeong-livelihood-grant-chuseok-payment-2026-08-27
- 영동 영동페이 신청 마감 10/2 — 2026-10-02(D-21) 갱신 예정 · local-livelihood-support-payment-2026-07-15, yeongdong-livelihood-stability-grant-2026-08-18
- 김해 지급 예정일 9/17 — 2026-09-17(D-6) 갱신 예정 · gimhae-livelihood-grant-2026-08-12

SERP 정찰 계획(--serp 시 일 25 = T1 15 / T2 5 / 재측정 5): T1 9건 · T2 7건 · 재측정 22건 — 재측정: 통영시 민생지원금 신청, 2026 김해 민생지원금, 김해시 지원금, 통영 지원금 신청, 문경시 지원금, 김해 지원금, 통영 민생지원금 신청, 완주 지원금 …

0400 자동 발행은 그대로 1건 나갑니다. 위 후보 중 쓸 것을 지시해 주세요.
