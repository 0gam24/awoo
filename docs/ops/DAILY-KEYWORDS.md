# 키워드 후보 보고 — 2026-09-25 (KST)

생성 2026-09-25 05:41Z · scripts/keyword-pipeline.mjs
SERP 실측: scout 23/35건(T1 15·T2 5·재측정 5)
입력: cluster-intents 68건 · naver-ranks 57쿼리 · 레이더 candidates 45건(지역 후보 소스: radar.candidates) · volume-scale 계수 13 · big-keywords 12 · landgrab 16 · 글 295건
후보: T1 1 · T2 4 · T3 8 · 갱신 13 · 제외 99

## 오늘 후보

노출 가능성 높은 순(자리 열림·빈자리·위에 관공서 없음·블록 위치 눈 확인 + 실유입·신생·개시 임박). 미측정은 아래 실측 대기. 창 안 발행 상한 없음, 1지자체 1패밀리 1건. 순위는 웹문서 검색 API 기준(2026-09-15~) — 통합검색 화면 순위와 다르고, 언론 수는 잴 수 없어 뉴스 벽은 경고로만 적는다.

| # | 노출 가능성 | 트랙 | 쿼리 | 왜 | 예상 유입/주 | 조건 |
|---|---|---|---|---|---|---|
| 1 | 높음 75 | T2 | 2026 주휴수당 포함 시급 | 자리 열림 · 빈자리 5 · 위에 관공서 없음 | 현재 94/주 | [보류] 검색 결과 실측 필요 |
| 2 | 높음 70 | T2 | 알바 주휴수당 계산기 | 자리 열림 · 빈자리 10 · 위에 관공서 없음 | 현재 81/주 | [보류] 검색 결과 실측 필요 |
| 3 | 높음 70 | T2 | 실업급여 상실신고 | 자리 열림 · 빈자리 5 · 위에 관공서 없음 | 59~137 | [보류] 자매 주의: 지원금 축은 awoo 고유. '실업급여 계산기' 각도는 calculatorhost.com, 사회초년생 첫 실직 각도는 asia |
| 4 | 중간 65 | T2 | 4차 민생쿠폰 신청 | 자리 열림 · 자사 8위 — 다른 의도로 재진입 | 현재 81/주 | [보류] — |
| 5 | 중간 55 | T1 A | 창원 지원금 (창원) | 자리 열림 · 위에 관공서 없음 · 공고 URL 필요 | 현재 60/주(자사 미노출·미측정분 회수) | 공고 go.kr URL 확보 + 접미형·변형 SERP 실측 |

### 실측 대기 8건
검색 결과를 아직 안 봤다. 수요(실유입·검색량) 큰 순. `--serp` 회차나 `--scout="쿼리"`로 잰다.

| # | 쿼리 | 수요 | 트랙 |
|---|---|---|---|
| 1 | 난방비 지원 | 검색량 미측정 | T3 |
| 2 | 10월 대체공휴일 휴일근무 수당 | 검색량 미측정 | T3 |
| 3 | 독감 무료 예방접종 65세 연령별 날짜 | 검색량 미측정 | T3 |
| 4 | 부가세 예정고지 세부(안내면·가산세) | 검색량 미측정 | T3 |
| 5 | 기초연금 10월 지급일 | 검색량 미측정 | T3 |
| 6 | 청년미래적금 2차 신청 개시(10/7~16) | 검색량 미측정 | T3 |
| 7 | 청년도약계좌 10월 가입 신청기간 | 검색량 미측정 | T3 |
| 8 | 국가건강검진 2026 대상자(짝수년) 연내 마감 | 검색량 미측정 | T3 |

## 갱신 후보

결정 #2: 틀린 정보·바뀐 날짜만 고친다(사실 정정·updates[]·dateModified·표 행). 제목·slug·구조·전면 재작성 금지.

| # | 글 | 날짜 | 고칠 것 | 근거 |
|---|---|---|---|---|
| 1 | 부안군 민생안정지원금 30만원, 대상 기준일과 지급 일정 (src/data/issues/2026-08-19/buan-livelihood-stability-grant-2026-08-19.json) | 2026-09-25 D-day | 오늘 마감·지급일 — 당일 표기 | scout 2026-09-25: "부안군 민생안정지원금 못 받았으면" r1, "부안군 민생안정지원금 9월 16일 출장 지급 이후" r1 — B 쿼리를 기존 A글이 받는다 · B키 사실("부안군 민생안정지원금 못 받았으면")을 기존 글에 updates[]·표 행으로 추가 |
| 2 | 추석 민생지원금 최대 50만원, 소비쿠폰과 중복 수급되나 (src/data/issues/2026-08-07/chuseok-livelihood-coupon-duplicate-2026-08-07.json) | 2026-09-25 D-day | 오늘 마감·지급일 — 당일 표기 | coreFacts.deadline "추석(9월 25일) 전 지급 목표 / 의령 신청 8.10~9.11, 부안 지급 9.16~18, 통영 이르면 8월 말 신청(지자체 공고로 확정)" · 날짜 2026-09-25 D-day (+ 2026-09-18 D+7) · dateModified 2026-08-07 |
| 3 | 추석 민생회복지원금 우리 지역 대상·신청 조회 방법 (src/data/issues/2026-07-30/chuseok-livelihood-recovery-region-check-2026-07-30.json) | 2026-09-25 D-day | 오늘 마감·지급일 — 당일 표기 | coreFacts.deadline "2026 추석(9월 25일) 전 지급 지자체 증가 / 신청·지급·사용기한은 지자체 공고로 확정(속초 신청 7.20~9.11·나주 9.14부터)" · 날짜 2026-09-25 D-day · dateModified 2026-07-30 |
| 4 | 2026 국군의날 임시공휴일, 10월 1일 목요일 쉬나요? (src/data/issues/2026-09-24/armed-forces-day-temporary-holiday-2026-09-24.json) | 2026-09-24 D+1 | 마감·지급일 1일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "2026-10-01 목요일, 9월 24일 기준 미지정" · 날짜 2026-09-24 D+1 · 갱신 이력 없음 |
| 5 | 추석 농축산물 할인 참여 마트, 9월 30일까지 한도 없이 최대 40% (src/data/issues/2026-09-17/chuseok-agri-livestock-discount-mart-2026-09-17.json) | 2026-09-24 D+1 | 마감·지급일 1일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "2026-09-30 종료, 한우 자조금 할인은 9월 24일" · 날짜 2026-09-24 D+1 · 갱신 이력 없음 |
| 6 | 고흥군 민생회복지원금 30만원, 추석 전 고흥사랑상품권 지급 (src/data/issues/2026-08-17/goheung-livelihood-recovery-grant-2026-08-17.json) | 2026-09-24 D+1 | 마감·지급일 1일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "추석 연휴(2026.09.24~09.27) 전 지급 목표 / 신청 개시일·지급일은 추경 확정 후 공고 / 상품권 사용기한 발행일부터 5년" · 날짜 2026-09-24 D+1 (+ 2026-09-27 D-2) · 갱신 이력 없음 |
| 7 | 기초연금 9월 지급일 23일 수요일로 당겨진 이유와 10월 입금일 (src/data/issues/2026-09-17/basic-pension-september-payment-date-chuseok-2026-09-17.json) | 2026-09-23 D+2 | 마감·지급일 2일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "2026년 9월 23일 수요일 입금" · 날짜 2026-09-23 D+2 · 갱신 이력 없음 |
| 8 | 김해시 민생지원금 10만원 신청 대상, 9월 17일 지급 (src/data/issues/2026-08-12/gimhae-livelihood-grant-2026-08-12.json) | 2026-09-23 D+2 | 마감·지급일 2일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "신청 2026-09-17 09:00~10-30 18:00(첫 주 9/17~23 출생연도 끝자리 요일제), 사용기한 2026-11-30 23:59" · 날짜 2026-09-23 D+2 · dateModified 2026-09-16 |
| 9 | 횡성군 민생지원금 20만원, 추석에 왜 안 나왔나 (src/data/issues/2026-09-23/hoengseong-livelihood-grant-200k-october-2026-09-23.json) | 2026-09-23 D+2 | 마감·지급일 2일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "10월 지급 추진, 9월 23일 기준 공고 없음" · 날짜 2026-09-23 D+2 · 갱신 이력 없음 |
| 10 | 양산시 민생회복지원금 10만원 부결 경위와 재추진 가능성 (src/data/issues/2026-09-23/yangsan-livelihood-grant-rejected-2026-09-23.json) | 2026-09-23 D+2 | 마감·지급일 2일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "2026-09-14 본회의 찬 9·반 10 부결. 재상정 여부는 9월 23일 기준 미정" · 날짜 2026-09-23 D+2 · 갱신 이력 없음 |
| 11 | 창원 민생지원금 지급하나요? 8월 27일 미지급 결정 (src/data/issues/2026-08-28/changwon-livelihood-grant-not-paid-2026-08-28.json) | 2026-09-21 D+4 | 마감·지급일 4일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "미지급 결정 2026년 8월 27일, 지류 누비전 9월 1일 200억원(취약계층 우선구매일), 일반 판매 9월 2일 오전 9시, 지류 2차 9월" · 날짜 2026-09-21 D+4 · 갱신 이력 없음 |
| 12 | 추석 온누리상품권 환급 참여시장과 6만7천원에 2만원 받는 법 (src/data/issues/2026-09-16/chuseok-onnuri-voucher-refund-market-2026-09-16.json) | 2026-09-20 D+5 | 마감·지급일 5일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "2026-09-20 환급 마감, 예산 소진 시 조기 종료될 수 있음" · 날짜 2026-09-20 D+5 · 갱신 이력 없음 |
| 13 | 9월 18일 신설 배우자 유산·사산휴가, 유급은 며칠일까 (src/data/issues/2026-09-01/spouse-miscarriage-stillbirth-leave-2026-09-01.json) | 2026-09-18 D+7 | 마감·지급일 7일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "2026년 9월 18일 시행. 신청 방법·서류는 시행 전까지 별도 공지 예정" · 날짜 2026-09-18 D+7 · 갱신 이력 없음 |

## 제외(사유)

- [T1] 완주군 민생안정지원금 위임장 대리신청 — cluster-intents VETO: 완주 × B 이미 존재: wanju-grant-proxy-application-after-sep14(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 고흥 신규 — 신규 없음(knownPair A+V, 계획 §5)
- [T1] 고창 신규 — 창 닫힘(D+9). 교훈: 사용자 언어 선두(계획 §5) · 실유입 "고창군 민생지원금" 138/주 순위 미측정 · 실유입 "고창 지원금" 65/주 순위 미측정
- [T1] 영동 신규 — 신규 없음. knownPair(진짜 중복 쌍), 3건째 금지(계획 §5) · 실유입 "영동군 민생지원금" 66/주 순위 미측정
- [T1] 의령 신규 — "2위여도 유입 0" 사례 — 계수에 적재(계획 §5)
- [T1] 김해 B — 보류: 김해시 공고 게시 후 B키 2개 확정 시만(결정 #5) — A글 coreFacts에 상품권 키 이미 있음, 공고 0건(9/10). 언론은 "신청 없이 순차 지급" — A글 본문 수정 금지 · B 트리거: "김해 민생지원금" r8(2026-09-12) · 실유입 "2026 김해 민생지원금" 217/주 순위 미측정 · 실유입 "김해시 지원금" 216/주 순위 미측정 · 실유입 "김해 지원금" 167/주 순위 미측정 · 실유입 "김해시 지원금 10만원" 126/주 순위 미측정 · 실유입 "김해 추석 민생지원금" 98/주 순위 미측정 · 실유입 "김해시 추석지원금" 63/주 순위 미측정 · 실유입 "김해 10만원" 63/주 순위 미측정 · 실유입 "김해시 추석 민생지원금" 61/주 순위 미측정
- [T1] 강릉 — 보류: V글 보유. 신규 금지, bill.do 새 uid 감시(결정 #6)
- [T1] 당진 — 보류: V글 보유. 신규 금지, 가결 감시(결정 #6) · 실유입 "당진시 민생지원금" 75/주 순위 미측정
- [T1] 울진군 민생안정지원금 30만원 부결 — cluster-intents VETO: 울진 × V 이미 존재: uljin-grant-300k-rejected-resubmission-2026-09-10(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 광양 민생지원금 30만원 지급하나요 — cluster-intents VETO: 광양 × V 이미 존재: gwangyang-grant-300k-chuseok-postponed-2026-09-10(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 영암군 농촌기본수당 10만원 하반기 신청 — cluster-intents VETO: 영암 × A 이미 존재: yeongam-rural-basic-allowance-100k(2026-09-14). 잠금 제외 1건(롤업·비민생) · coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 대구 V — 보류: 확인 불가 — 첫 주 제외(계획 §5)
- [T1] 경기 V — 보류: 확인 불가 — 첫 주 제외(계획 §5) · B 트리거: "경기도 민생지원금" rank null(통블록)(2026-09-11)
- [T1] 완주 B — B 트리거: "완주 민생지원금" r10(2026-09-09) → cluster-intents VETO: 완주 × B 이미 존재: wanju-grant-proxy-application-after-sep14(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 완주 B — B 트리거: "완주군 민생지원금" rank null(통블록)(2026-09-09) → cluster-intents VETO: 완주 × B 이미 존재: wanju-grant-proxy-application-after-sep14(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 완주군 민생지원금 — 실유입 "완주군 민생지원금" 512/주 자사 미노출 → cluster-intents VETO: 완주 × A 이미 존재: wanju-livelihood-stability-grant-2026-08-12(2026-08-12). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 통영 지원금 신청 — 실유입 "통영 지원금 신청" 182/주 순위 미측정 → cluster-intents VETO: 통영 × A 이미 존재: tongyeong-livelihood-recovery-grant-2026-08-15(2026-08-15). 잠금 제외 3건(롤업·비민생) · coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts) — 기존 글 순위 재측정 대상
- [T1] 완주 민생지원금 — 실유입 "완주 민생지원금" 170/주 r10 → cluster-intents VETO: 완주 × A 이미 존재: wanju-livelihood-stability-grant-2026-08-12(2026-08-12). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 통영 민생지원금 신청 — 실유입 "통영 민생지원금 신청" 157/주 순위 미측정 → cluster-intents VETO: 통영 × A 이미 존재: tongyeong-livelihood-recovery-grant-2026-08-15(2026-08-15). 잠금 제외 3건(롤업·비민생) · coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts) — 기존 글 순위 재측정 대상
- [T1] 완주 지원금 — 실유입 "완주 지원금" 149/주 순위 미측정 → cluster-intents VETO: 완주 × A 이미 존재: wanju-livelihood-stability-grant-2026-08-12(2026-08-12). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts) — 기존 글 순위 재측정 대상
- [T1] 통영시 민생지원금 신청 — 실유입 "통영시 민생지원금 신청" 134/주 순위 미측정 → cluster-intents VETO: 통영 × A 이미 존재: tongyeong-livelihood-recovery-grant-2026-08-15(2026-08-15). 잠금 제외 3건(롤업·비민생) · coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts) — 기존 글 순위 재측정 대상
- [T1] 함평 지원금 — 실유입 "함평 지원금" 60/주 순위 미측정 → cluster-intents VETO: 함평 × A 이미 존재: hampyeong-livelihood-recovery-grant-2026-08-16(2026-08-16). 잠금 제외 3건(롤업·비민생) · coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts) — 기존 글 순위 재측정 대상
- [T2] 실업급여 이직확인서 — 축 잠금 — separation-certificate-request-10days-2026-09-09(2026-09-09) 제목이 "이직확인서" 축을 이미 잡고 있다
- [T2] 실업급여 조기재취업수당 — 축 잠금 — early-reemployment-allowance-2026-06-16(2026-06-16) 제목이 "조기재취업수당" 축을 이미 잡고 있다
- [T2] 실업급여 하한액 — 축 잠금 — unemployment-benefit-amount-calc-2026-07-10(2026-07-10) 제목이 "하한액" 축을 이미 잡고 있다
- [T2] 주휴수당 계산법 — 축 잠금 — weekly-holiday-pay-calculation-2026-08-10(2026-08-10) 제목이 "계산법" 축을 이미 잡고 있다
- [T2] 주휴수당 포함 시급 — recent7 0.9 < 1.5(radar)
- [T2] 주휴수당 쿠팡 — 축 잠금 — coupang-weekly-holiday-pay-5day-condition-2026-09-09(2026-09-09) 제목이 "쿠팡" 축을 이미 잡고 있다
- [T2] 주휴수당 알바 조건 — 축 잠금 — weekly-holiday-pay-calculation-2026-08-10(2026-08-10) 제목이 "알바 조건" 축을 이미 잡고 있다
- [T2] 주휴수당 주 15시간 — 축 잠금 — weekly-holiday-pay-calculation-2026-08-10(2026-08-10) 제목이 "주 15시간" 축을 이미 잡고 있다
- [T2] 근로장려금 반기 — 축 잠금 — eitc-semiannual-vs-regular-payment-date-2026-07-01(2026-07-01) 제목이 "반기" 축을 이미 잡고 있다
- [T2] 근로장려금 지급일 — 축 잠금 — eitc-semiannual-vs-regular-payment-date-2026-07-01(2026-07-01) 제목이 "지급일" 축을 이미 잡고 있다
- [T2] 근로장려금 자녀장려금 — 축 잠금 — child-tax-credit-payment-2026-07-15(2026-07-15) 제목이 "자녀장려금" 축을 이미 잡고 있다
- [T2] 근로장려금 대상 기준 — 축 잠금 — eitc-2026-eligibility-criteria(2026-09-13) 제목이 "대상 기준" 축을 이미 잡고 있다
- [T2] 근로장려금 계산기 — recent7 0.14 < 1.5(radar)
- [T2] 근로장려금 현금수령 — 축 잠금 — eitc-refund-notice-cash-receipt-2026-08-07(2026-08-07) 제목이 "현금수령" 축을 이미 잡고 있다
- [T2] 중위소득 계산 — 축 잠금 — median-income-calculation-guide-2026-09-19(2026-09-19) 제목이 "계산" 축을 이미 잡고 있다
- [T2] 중위소득 2027 — 축 잠금 — median-income-2027-livelihood-benefit-threshold-2026-08-01(2026-08-01) 제목이 "2027" 축을 이미 잡고 있다
- [T2] 기준 중위소득 표 — 축 잠금 — median-income-calculation-guide-2026-09-19(2026-09-19) 제목이 "기준 중위소득 표" 축을 이미 잡고 있다
- [T2] 기초연금 소득인정액 — 축 잠금 — basic-pension-income-recognition-calc(2026-09-12) 제목이 "소득인정액" 축을 이미 잡고 있다
- [T2] 기초연금 2027 개편 — 축 잠금 — basic-pension-2027-tiered-payment-2026-09-05(2026-09-05) 제목이 "2027 개편" 축을 이미 잡고 있다
- [T2] 기초연금 자동차 기준 — 축 잠금 — basic-pension-car-asset-2026-07-14(2026-07-14) 제목이 "자동차 기준" 축을 이미 잡고 있다
- [T2] 기초연금 차량가액 — 축 잠금 — basic-pension-car-asset-2026-07-14(2026-07-14) 제목이 "차량가액" 축을 이미 잡고 있다
- [T2] 에너지바우처 잔액조회 — 축 잠금 — energy-voucher-balance-check-carryover(2026-09-12) 제목이 "잔액조회" 축을 이미 잡고 있다
- [T2] 에너지바우처 난방비 — recent7 0.23 < 1.5(big-keywords datalab rel30(proxy))
- [T2] 에너지바우처 사용기간 — 축 잠금 — summer-energy-voucher-cooling-2026-07-13(2026-07-13) 제목이 "사용기간" 축을 이미 잡고 있다
- [T2] 에너지바우처 동절기 — 축 잠금 — energy-voucher-usage-period-carryover-2026-07-01(2026-07-01) 제목이 "동절기" 축을 이미 잡고 있다
- [T2] 에너지바우처 신청 대상 — 축 잠금 — summer-energy-voucher-cooling-2026-07-13(2026-07-13) 제목이 "신청 대상" 축을 이미 잡고 있다
- [T2] 에너지바우처 가구원수 금액 — 축 잠금 — energy-voucher-household-size-amount-2026-07-19(2026-07-19) 제목이 "가구원수 금액" 축을 이미 잡고 있다
- [T2] 월세 세액공제 월세환급금 — 축 잠금 — monthly-rent-refund-amended-return(2026-09-14) 제목이 "월세환급금" 축을 이미 잡고 있다
- [T2] 월세 세액공제 경정청구 — 축 잠금 — monthly-rent-refund-amended-return(2026-09-14) 제목이 "경정청구" 축을 이미 잡고 있다
- [T2] 월세 세액공제 기한 — 축 잠금 — monthly-rent-refund-amended-return(2026-09-14) 제목이 "기한" 축을 이미 잡고 있다
- [T2] 국가장학금 2차 — 축 잠금 — national-scholarship-2nd-round-2026-07-28(2026-07-28) 제목이 "2차" 축을 이미 잡고 있다
- [T2] 청년월세 주거급여 중복 — 축 잠금 — youth-rent-support-exclusion-criteria-2026-09-20(2026-09-20) 제목이 "주거급여 중복" 축을 이미 잡고 있다
- [T2] 청년월세 선정자 — 축 잠금 — youth-rent-support-selection-announcement-2026-09-10(2026-09-10) 제목이 "선정자" 축을 이미 잡고 있다
- [T2] 청년월세 선정 발표 — 축 잠금 — youth-rent-support-selection-announcement-2026-09-10(2026-09-10) 제목이 "선정 발표" 축을 이미 잡고 있다
- [T2] 청년월세 월세지원 사업 — 축 잠금 — youth-rent-support-exclusion-criteria-2026-09-20(2026-09-20) 제목이 "월세지원 사업" 축을 이미 잡고 있다
- [T2] 노란우산공제 중도해지 — 축 잠금 — yellow-umbrella-termination-other-income-tax-2026-09-09(2026-09-09) 제목이 "중도해지" 축을 이미 잡고 있다
- [T2] 노란우산공제 소득공제 한도 — 축 잠금 — yellow-umbrella-deduction-limit-2026-08-29(2026-08-29) 제목이 "소득공제 한도" 축을 이미 잡고 있다
- [T2] 노란우산공제 해지 세금 — 축 잠금 — yellow-umbrella-termination-other-income-tax-2026-09-09(2026-09-09) 제목이 "해지 세금" 축을 이미 잡고 있다
- [T2] 본인부담상한액 초과금 환급 — 축 잠금 — medical-copay-cap-refund-2026-08-31(2026-08-31) 제목이 "초과금 환급" 축을 이미 잡고 있다
- [T2] 2027 예산안 — mode update-only — 갱신 트랙 전용(지금은 1.77로 작고 하락 중(trend 0.56). 대응 글 0. 국회 심사(11월)·통과(12/2 법정)
- [T2] 장애인연금 — 기존 글 있음 — disability-pension-eligibility-2026-06-17(제목에 이 표현 포함). 새 글 아님
- [T2] 농식품바우처 — 기존 글 있음 — agri-food-voucher-youth-eligibility-2026-09-22(제목에 이 표현 포함). 새 글 아님
- [T2] 2026 근로장려금 대상 기준 — 기존 글 있음 — eitc-2026-eligibility-criteria(제목에 이 표현 포함). 새 글 아님
- [T2] 2027년 아이맞이지원금 — 기존 글 있음 — child-benefit-2027-overhaul-2026-09-03(제목에 이 표현 포함). 새 글 아님
- [T2] 조기재취업수당 조건 — 기존 글 있음 — early-reemployment-allowance-conditions-2026-07-31(제목에 이 표현 포함). 새 글 아님
- [T3] 중도퇴사 연말정산 — hold: peak ≥3 ✗(2.86 — 미달) + openSlots ≥2 + 자매 0 + 운영자 승인 + 자매 미러 확인(asiatop 사회초년생 퇴사 각도). 재측정에서 ≥3 나올 때만
- [T2] 2026 재난지원금 — scout 2026-09-25 verdictT2 closed: "2026 재난지원금" already r2, openSlots 0<2, offset·press 미측정(API) — 자사 이미 r2 — 신규 불필요
- [T2] 9월14일 민생지원금 — scout 2026-09-25 verdictT2 closed: "9월14일 민생지원금" already r2, openSlots 0<2, offset·press 미측정(API) — 자사 이미 r2 — 신규 불필요
- [T2] 조기취업수당 조건 — scout 2026-09-25 verdictT2 closed: "조기취업수당 조건" already r3, openSlots 1<2, offset·press 미측정(API) — 자사 이미 r3 — 신규 불필요
- [T2] 근로·자녀장려금 9월 신청 전 구분 3가지 — scout 2026-09-25 verdictT2 closed: "근로·자녀장려금 9월 신청 전 구분 3가지" openSlots 0<2, offset·press 미측정(API) — 재측정 후 재판정
- [T2] 차상위장애수당 — scout 2026-09-25 verdictT2 closed: "차상위장애수당" openSlots 1<2, offset·press 미측정(API) — 재측정 후 재판정
- [T2] 이번추석은삼일남아는데요지원금 — scout 2026-09-25 verdictT2 closed: "이번추석은삼일남아는데요지원금" openSlots 0<2, offset·press 미측정(API) — 재측정 후 재판정
- [T2] 청년월세지원금 — scout 2026-09-25 verdictT2 closed: "청년월세지원금" openSlots 0<2, offset·press 미측정(API) — 재측정 후 재판정
- [T2] 실업급여 구직급여 — scout 2026-09-25 verdictT2 closed: "실업급여 구직급여" openSlots 0<2, offset·press 미측정(API) — 재측정 후 재판정
- [T1] 4차 민생지원금 지역별 지급 현황 — scout 2026-09-25 verdictT1 closed: "4차 민생지원금 지역별 지급 현황" already r3, offset·press 미측정(API) / "4차 민생지원금 9월 신청 지역" already r1, openSlots 0<2, offset·press 미측정(API) / "4차 민생지원금 개시일" already r2, openSlots 1<2, offset·press 미측정(API) — 자사 이미 r1 — 신규 불필요
- [T1] 정읍시 민생지원금 — scout 2026-09-25 verdictT1 closed: "정읍시 민생지원금" already r2, openSlots 1<2, offset·press 미측정(API) — 자사 이미 r2 — 신규 불필요
- [T1] 부안군 민생안정지원금 못 받았으면 — scout 2026-09-25 verdictT1 closed: "부안군 민생안정지원금 못 받았으면" already r1, openSlots 0<2, offset·press 미측정(API) / "부안군 민생안정지원금 9월 16일 출장 지급 이후" already r1, openSlots 0<2, offset·press 미측정(API) — 자사 A글(buan-livelihood-stability-grant-2026-08-19)이 이미 r1 — 신규 대신 그 글 갱신(결정 #2, 갱신 후보에 올림)
- [T2] 검색량 미측정 20건(keyword-volume·레이더 측정 전 — 0이 아니라 "못 쟀다"): 실업급여 자발적 퇴사, 실업급여 면접 불참, 주휴수당 알바 계산기, 근로장려금 상반기, 중위소득 계산기, 중위소득 가구원수, 기초연금 부부 감액, 기초연금 인상액, 월세 세액공제 신청 대상, 월세 세액공제 국세환급금 통지서, 국가장학금 서류, 국가장학금 서류제출 안 하면, 국가장학금 소득구간, 국가장학금 지급일, 청년월세 2027 주거급여, 노란우산공제 가입 조건, 노란우산공제 폐업 공제금, 본인부담상한액 환급 신청, 본인부담상한액 2026 상한액 표, 본인부담상한액 사후환급

이전 큐에서 status가 남아 있는 항목(오늘 재생성되지 않음):
- [T2] 해고예고수당 — published 2026-09-23
- [T2] 사회보장급여 — published 2026-09-20
- [T2] 쳥년미래적금 — hold 2026-09-20
- [T2] 3차민생지원금 — hold 2026-09-18
- [T2] 건강생활실천지원금 신청 — published 2026-09-24
- [T1] 고양시 추석지원금 — published 2026-09-23
- [T3] 아동수당 9월 지급일 — hold 2026-09-24
- [T1] 안산 추석지원금 — published 2026-09-23
- [T1] 횡성군 민생지원금 — published 2026-09-23
- [T1] 4차 민생지원금 지역별 지급 현황 — hold 2026-09-15
- [T2] 출산휴가급여 — published 2026-09-17
- [T2] 시흥민생지원금 — hold 2026-09-13
- [T1] 영암군 민생지원금 사용처 잔액 사용기한 — published 2026-09-16
- [T2] 주휴수당 포함 시급 — hold 2026-09-14
- [T2] 에너지바우처 잔액조회 — published 2026-09-12
- [T2] 2026 근로장려금 대상 기준 — published 2026-09-13
- [T2] 월세 세액공제 월세환급금 — published 2026-09-14
- [T2] 기초연금 소득인정액 — published 2026-09-12
- [T1] 영암군 민생지원금 — published 2026-09-14
- [T2] 노란우산공제 대출 — published 2026-09-15
- [T2] 양육비 선지급 — published 2026-09-17
- [T1] 대구 추석지원금 — published 2026-09-15
- [T3] 추석 온누리상품권 환급 — published 2026-09-16
- [T2] 프리랜서 육아수당 — published 2026-09-17
- [T3] 추석 농축산물 할인 — published 2026-09-17
- [T3] 기초연금 9월 지급일 — published 2026-09-17
- [T1] 김해 민생회복지원금 사용처 — published 2026-09-16
- [T3] 추석 연휴 민생지원금 신청 — published 2026-09-17
- [T1] 서울 추석지원금 — hold 2026-09-23
- [T1] 양산시 민생회복지원금 — published 2026-09-23
- [T2] 추석 임금체불 대지급금 — hold 2026-09-24
- [T1] 영암 월출페이 사용처 — published 2026-09-17
- [T1] 부산 추석지원금 — published 2026-09-23
- [T2] 청주시4차민생지원금 — hold 2026-09-13

## 다음 물결 감시

- 나주 — 개시 09/14 D+11 · 신규 없음. D-1·D+1 재측정, 4위 이하면 B(계획 §5)
- 문경 — 개시 09/14 D+11 · 신규 없음. 9/16 B 필요 여부 판단(계획 §5) (판단일 2026-09-16)
- 김해 — 개시 09/17 D+8 · 김해시 공고 게시 후 B키 2개 확정 시만(결정 #5)
- 강릉 — 개시일 미정 · V글 보유. 신규 금지, bill.do 새 uid 감시(결정 #6) · https://gncl.go.kr:8080/assembly/bill.do
- 당진 — 개시일 미정 · V글 보유. 신규 금지, 가결 감시(결정 #6)
- 대구 — 개시일 미정 · 확인 불가 — 첫 주 제외(계획 §5)
- 경기 — 개시일 미정 · 확인 불가 — 첫 주 제외(계획 §5)
- 설 2027 지자체 지원금 — watch · 감시 시작 2026-11-01 · 가결 트리거 — 지자체별 조례·추경 가결 또는 공고 확인 시 즉시(개시 D-7 안). 날짜 캘린더 아님
- 연말정산 월세 세액공제 — writeBy 2026-11-05(D-41) · 피크 1월 76.21
- 연말정산 부양가족 — writeBy 2026-11-15(D-51) · 피크 1월 16.51
- 연말정산 의료비 — writeBy 2026-11-25(D-61) · 피크 1월 14.08
- 연말정산 연금저축 — writeBy 2026-12-05(D-71) · 피크 1월 7.49
- 연말정산 경정청구 — writeBy 2026-12-20(D-86) · 피크 5월 12.9
- 완주 신청·지급 마감 10/30 카운트다운 정정(계획 §7-2) — 2026-10-30(D-35) 갱신 예정 · wanju-livelihood-stability-grant-2026-08-12, wanju-grant-proxy-application-after-sep14
- 나주 계획 §7-2 기재 카운트다운 날짜(9/30 — 세부 내용 확인 불가) — 2026-09-30(D-5) 갱신 예정 · naju-livelihood-recovery-grant-2026-08-07, naju-livelihood-grant-rotation-days-2026-09-03
- 나주 신청 마감 10/16 카운트다운 정정(계획 §7-2) — 2026-10-16(D-21) 갱신 예정 · naju-livelihood-recovery-grant-2026-08-07, naju-livelihood-grant-rotation-days-2026-09-03
- 문경 신청 마감 10/23 — 2026-10-23(D-28) 갱신 예정 · mungyeong-high-oil-price-relief-2026-08-16, mungyeong-livelihood-grant-chuseok-payment-2026-08-27
- 영동 영동페이 신청 마감 10/2 — 2026-10-02(D-7) 갱신 예정 · local-livelihood-support-payment-2026-07-15, yeongdong-livelihood-stability-grant-2026-08-18
- 영암 신청 마감 10/30 — 2026-10-30(D-35) 갱신 예정 · yeongam-rural-basic-allowance-100k, yeongam-wolchulpay-balance-expiry-use
- 재측정 "2026 김해 민생지원금": r1 · 본청 0 · 뉴스7일 4·같은제목 1 · openSlots 0 · 눈 확인 전
- 재측정 "김해시 지원금": r3 · 본청 0 · 뉴스7일 23·같은제목 1 · openSlots 1 · 눈 확인 전
- 재측정 "통영 지원금 신청": r5 · 본청 0 · 뉴스7일 8·같은제목 1 · openSlots 0 · 눈 확인 전
- 재측정 "문경시 지원금": r2 · 본청 0 · 뉴스7일 17·같은제목 1 · openSlots 0 · 눈 확인 전
- 재측정 "김해 지원금": r3 · 본청 0 · 뉴스7일 33·같은제목 1 · openSlots 1 · 눈 확인 전

SERP 정찰 계획(--serp 시 일 35 = T1 15 / T2 5 / 새 키워드 10 / 재측정 5): T1 7건 · T2 2건 · 새 키워드 9건 · 재측정 22건 — 재측정: 2026 김해 민생지원금, 김해시 지원금, 통영 지원금 신청, 문경시 지원금, 김해 지원금, 통영 민생지원금 신청, 완주 지원금, 문경 지원금 …

0400 자동 발행은 그대로 1건 나갑니다. 위 후보 중 쓸 것을 지시해 주세요.
