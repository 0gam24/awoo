# 키워드 후보 보고 — 2026-10-10 (KST)

생성 2026-10-09 23:10Z · scripts/keyword-pipeline.mjs
SERP 실측: scout 21/35건(T1 15·T2 5·재측정 5)
입력: cluster-intents 98건 · naver-ranks 58쿼리 · 레이더 candidates 45건(지역 후보 소스: radar.candidates) · volume-scale 계수 13 · big-keywords 12 · landgrab 23 · 글 345건
후보: T1 1 · T2 5 · T3 1 · 갱신 14 · 제외 105

## 오늘 후보

자리 잡을 수 있는 글감(노출 가능성 45↑) 먼저, 그 안에서 노출 가능성 × 주제 수익 배수 순(지원금·소상공인 2배, 공휴일·주휴수당·혼인·청년 적금 0.4배 — 애드센스 주제별 실측). 노출 가능성 = 자리 열림·빈자리·위에 관공서 없음·블록 위치 눈 확인 + 실유입·신생·개시 임박. 미측정은 아래 실측 대기. 창 안 발행 상한 없음, 1지자체 1패밀리 1건. 순위는 웹문서 검색 API 기준(2026-09-15~) — 통합검색 화면 순위와 다르고, 언론 수는 잴 수 없어 뉴스 벽은 경고로만 적는다.

| # | 노출 가능성 | 트랙 | 쿼리 | 왜 | 예상 유입/주 | 조건 |
|---|---|---|---|---|---|---|
| 1 | 중간 65 · 돈 되는 주제 | T2 | 4차 민생쿠폰 신청 | 자리 열림 · 자사 8위 — 다른 의도로 재진입 | 현재 81/주 | [보류] — |
| 2 | 중간 60 · 돈 되는 주제 | T2 | 년겨울에너지바우처 | 자리 열림 · 위에 관공서 없음 | 0~0 | 검색 결과 실측 필요 |
| 3 | 중간 55 · 돈 되는 주제 | T1 A | 창원 지원금 (창원) | 자리 열림 · 위에 관공서 없음 · 공고 URL 필요 | 현재 60/주(자사 미노출·미측정분 회수) | 공고 go.kr URL 확보 + 접미형·변형 SERP 실측 |
| 4 | 높음 75 · 광고 수익 적음 | T2 | 알바 주휴수당 계산기 | 자리 열림 · 빈자리 10 · 위에 관공서 없음 | 현재 81/주 | [보류] 검색 결과 실측 필요 |
| 5 | 높음 70 · 광고 수익 적음 | T2 | 실업급여 상실신고 | 자리 열림 · 빈자리 4 · 위에 관공서 없음 | 59~137 | [보류] 자매 주의: 지원금 축은 awoo 고유. '실업급여 계산기' 각도는 calculatorhost.com, 사회초년생 첫 실직 각도는 asia |
| 6 | 중간 65 · 광고 수익 적음 | T2 | 질병수술퇴사때실업급여 | 자리 열림 · 빈자리 7 · 위에 관공서 없음 | 0~0 | 검색 결과 실측 필요 |

### 실측 대기 1건
검색 결과를 아직 안 봤다. 수요(실유입·검색량) 큰 순. `--serp` 회차나 `--scout="쿼리"`로 잰다.

| # | 쿼리 | 수요 | 트랙 |
|---|---|---|---|
| 1 | 난방비 지원 | 검색량 미측정 | T3 |

## 갱신 후보

결정 #2: 틀린 정보·바뀐 날짜만 고친다(사실 정정·updates[]·dateModified·표 행). 제목·slug·구조·전면 재작성 금지.

| # | 글 | 날짜 | 고칠 것 | 근거 |
|---|---|---|---|---|
| 1 | 청년도약적금 가입되나요? 2026 새로 들 수 있는 건 청년미래적금 (src/data/issues/2026-10-06/youth-leap-savings-name-confusion-2026-10-06.json) | 2026-10-10 D-day | 오늘 마감·지급일 — 당일 표기 | coreFacts.deadline "2차 신청 2026-10-07~10-16, 개설 11-27까지" · 날짜 2026-10-10 D-day (+ 2026-10-07 D+3) · dateModified 2026-10-06T10:10:17+09:00 |
| 2 | 산청 반값여행 정산 조건 4가지, 숙박비는 카드로 내도 되나요? (src/data/issues/2026-09-30/sancheong-half-price-travel-settlement-checklist-2026-09-30.json) | 2026-10-11 D-1 | 1일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "10월 여행 신청 10월 11일, 정산은 여행 후 10일" · 날짜 2026-10-11 D-1 · dateModified 2026-09-30T04:29:41.000Z |
| 3 | 안동 반값여행, 1차 5시간 마감 이유와 2차 준비 (src/data/issues/2026-10-01/andong-half-price-travel-round2-payment-rules-2026-10-01.json) | 2026-10-12 D-2 | 2일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "2차 신청 10.12 오전10시, 여행 10.15~11.30" · 날짜 2026-10-12 D-2 · dateModified 2026-09-30T19:47:52.000Z |
| 4 | 반값여행 지역별 신청 일정, 다음 접수일과 선착순 마감 시각 (src/data/issues/2026-10-01/half-price-travel-regions-schedule-2026-10-01.json) | 2026-10-12 D-2 | 2일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "다음 창구 10월 12일 10시 안동 2차" · 날짜 2026-10-12 D-2 · dateModified 2026-10-06T01:50:34.000Z |
| 5 | HUG 든든전세주택 신청 자격, 소득·자산 무관 무주택 8년 거주 (src/data/issues/2026-07-27/hug-deundeun-jeonse-eligibility-2026-07-27.json) | 2026-10-12 D-2 | 2일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "제12차 2026.9.30~10.12 17시 온라인 접수 / 당첨자 발표 2026.12.30 / 제11차 당첨자 발표는 10.30" · 날짜 2026-10-12 D-2 · dateModified 2026-10-06T04:57:21.000Z |
| 6 | 장흥 반값여행 인정 관광지와 가맹점 722곳 찾는 법 (src/data/issues/2026-09-30/jangheung-half-price-travel-attractions-chak-2026-09-30.json) | 2026-10-12 D-2 | 2일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "2차 여행 10월 12일~11월 2일, 이틀 전 신청" · 날짜 2026-10-12 D-2 · dateModified 2026-09-30T04:59:26.000Z |
| 7 | 청년미래적금 신청기간, 2차 모집 10월 7~16일 확정 (src/data/issues/2026-06-03/youth-future-savings-apply-2026-06-03.json) | 2026-10-12 D-2 | 2일 뒤 마감·지급일 — 카운트다운·마감 안내 정정 | coreFacts.deadline "2차 신청 2026.10.7~10.16(10.7~8 출생연도 홀짝제 · 10.12~16 자유) · 가입심사 10.19~11.13 · 계좌 개설 " · 날짜 2026-10-12 D-2 (+ 2026-10-08 D+2) · dateModified 2026-10-07T00:46:49.000Z |
| 8 | 하동군 민생지원금 30만원 신청 10월 2일까지 (src/data/issues/2026-08-19/hadong-livelihood-grant-2026-08-19.json) | 2026-10-09 D+1 | 마감·지급일 1일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "신청 2026.08.24~10.02 마감(연장 공고 없음) / 이의신청 2026.08.24~10.09(연휴 뒤 창구 10.6~10.8)" · 날짜 2026-10-09 D+1 (+ 2026-10-08 D+2, 2026-10-06 D+4) · dateModified 2026-10-03T23:06:06.000Z |
| 9 | 추석 지원금 50만원 받는 지역, 의령·함평 대상 확인 (src/data/issues/2026-08-27/chuseok-grant-50man-uiryeong-hampyeong-2026-08-27.json) | 2026-10-08 D+2 | 마감·지급일 2일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "의령 2026.8.10~9.11 마감 / 함평 2026.9.7~10.8 18시 마감(첫 주 출생연도 끝자리 5부제)" · 날짜 2026-10-08 D+2 · dateModified 2026-10-07T00:46:49.000Z |
| 10 | 함평군 민생회복지원금 미신청 마감 10월 8일, 잔액 소멸 12월 31일 (src/data/issues/2026-09-28/hampyeong-livelihood-grant-unclaimed-oct8-deadline-2026-09-28.json) | 2026-10-08 D+2 | 마감·지급일 2일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "2026-10-08 신청 마감, 2026-12-31 사용기한" · 날짜 2026-10-08 D+2 · dateModified 2026-10-07T00:46:49.000Z |
| 11 | 함평 민생회복지원금 50만원, 9월 7일 신청 시작 (src/data/issues/2026-08-16/hampyeong-livelihood-recovery-grant-2026-08-16.json) | 2026-10-08 D+2 | 마감·지급일 2일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "신청·지급 2026.09.07~10.08 평일 9~18시(첫 주 출생연도 5부제), 10.08 18시 마감 / 사용기한 2026.12.31" · 날짜 2026-10-08 D+2 · dateModified 2026-10-07T00:46:49.000Z |
| 12 | 희망리턴패키지 신청 자격과 점포철거비 최대 600만원 계산법 (src/data/issues/2026-10-08/hope-return-package-closure-support-2026-10-08.json) | 2026-10-08 D+2 | 마감·지급일 2일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "예산 소진 시까지, 10월 8일 조기 마감 공지 못 찾음" · 날짜 2026-10-08 D+2 · dateModified 2026-10-08T09:02:26+09:00 |
| 13 | 4차 민생지원금 지급 여부, 지금 신청받는 건 지자체 지원금이다 (src/data/issues/2026-08-09/minsaeng-4th-round-payment-status-2026-08-09.json) | 2026-10-08 D+2 | 마감·지급일 2일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "고유가 피해지원금 사용기한 2026.08.31 24시 종료(잔액 소멸·환수) / 지자체 추석 지원금은 지역별 공고(통영 8.31~10.30, 고" · 날짜 2026-10-08 D+2 · dateModified 2026-09-18 |
| 14 | 청년고용연계자금 자격과 금리, 최대 7천만원 대리대출 받는 순서 (src/data/issues/2026-10-08/youth-employment-linked-fund-2026-10-08.json) | 2026-10-06 D+4 | 마감·지급일 4일 지남 — 종료 표기·다음 절차로 정정 | coreFacts.deadline "4분기 접수 10월 6일 개시, 예산 소진 시 마감" · 날짜 2026-10-06 D+4 · dateModified 2026-10-08T17:11:16+09:00 |

## 제외(사유)

- [T1] 완주군 민생안정지원금 위임장 대리신청 — cluster-intents VETO: 완주 × B 이미 존재: wanju-grant-proxy-application-after-sep14(2026-09-10). coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
- [T1] 부안군 민생안정지원금 못 받았으면 — cluster-intents VETO: 부안 × B 이미 존재: buan-grant-prepaid-card-nov30-usage-2026-09-29(2026-09-29). 잠금 제외 1건(롤업·비민생) · coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)
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
- [T2] 주휴수당 쿠팡 — 축 잠금 — coupang-weekly-holiday-pay-5day-condition-2026-09-09(2026-09-09) 제목이 "쿠팡" 축을 이미 잡고 있다
- [T2] 주휴수당 알바 조건 — 축 잠금 — weekly-holiday-pay-calculation-2026-08-10(2026-08-10) 제목이 "알바 조건" 축을 이미 잡고 있다
- [T2] 주휴수당 주 15시간 — 축 잠금 — weekly-holiday-pay-calculation-2026-08-10(2026-08-10) 제목이 "주 15시간" 축을 이미 잡고 있다
- [T2] 근로장려금 반기 — 축 잠금 — eitc-semiannual-vs-regular-payment-date-2026-07-01(2026-07-01) 제목이 "반기" 축을 이미 잡고 있다
- [T2] 근로장려금 지급일 — 축 잠금 — eitc-semiannual-vs-regular-payment-date-2026-07-01(2026-07-01) 제목이 "지급일" 축을 이미 잡고 있다
- [T2] 근로장려금 자녀장려금 — 축 잠금 — child-tax-credit-payment-2026-07-15(2026-07-15) 제목이 "자녀장려금" 축을 이미 잡고 있다
- [T2] 근로장려금 대상 기준 — 축 잠금 — eitc-2026-eligibility-criteria(2026-09-13) 제목이 "대상 기준" 축을 이미 잡고 있다
- [T2] 근로장려금 계산기 — recent7 0.31 < 1.5(radar)
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
- [T2] 노란우산공제 폐업 공제금 — 축 잠금 — small-biz-closure-money-checklist-2026-10-08(2026-10-08) 제목이 "폐업 공제금" 축을 이미 잡고 있다
- [T2] 본인부담상한액 초과금 환급 — 축 잠금 — medical-copay-cap-refund-2026-08-31(2026-08-31) 제목이 "초과금 환급" 축을 이미 잡고 있다
- [T2] 2027 예산안 — mode update-only — 갱신 트랙 전용(지금은 1.77로 작고 하락 중(trend 0.56). 대응 글 0. 국회 심사(11월)·통과(12/2 법정)
- [T2] 조기재취업수당 — 기존 글 있음 — early-reemployment-allowance-2026-06-16(제목에 이 표현 포함). 새 글 아님
- [T2] 청년미래적금 — 기존 글 있음 — youth-future-savings-apply-2026-06-03(제목에 이 표현 포함). 새 글 아님
- [T2] 에너지바우처 — 기존 글 있음 — energy-voucher-summer-2026-06-08(제목에 이 표현 포함). 새 글 아님
- [T2] 2026 근로장려금 대상 기준 — 기존 글 있음 — eitc-2026-eligibility-criteria(제목에 이 표현 포함). 새 글 아님
- [T2] 2027년 아이맞이지원금 — 기존 글 있음 — child-benefit-2027-overhaul-2026-09-03(제목에 이 표현 포함). 새 글 아님
- [T2] 조기재취업수당 조건 — 기존 글 있음 — early-reemployment-allowance-conditions-2026-07-31(제목에 이 표현 포함). 새 글 아님
- [T3] 중도퇴사 연말정산 — hold: peak ≥3 ✗(2.86 — 미달) + openSlots ≥2 + 자매 0 + 운영자 승인 + 자매 미러 확인(asiatop 사회초년생 퇴사 각도). 재측정에서 ≥3 나올 때만
- [T2] 2026 재난지원금 — scout 2026-10-10 verdictT2 closed: "2026 재난지원금" already r1, openSlots 0<2, offset·press 미측정(API) — 자사 이미 r1 — 신규 불필요
- [T2] 9월14일 민생지원금 — scout 2026-10-10 verdictT2 closed: "9월14일 민생지원금" already r2, openSlots 0<2, offset·press 미측정(API) — 자사 이미 r2 — 신규 불필요
- [T2] 조기취업수당 조건 — scout 2026-10-10 verdictT2 closed: "조기취업수당 조건" already r3, openSlots 1<2, offset·press 미측정(API) — 자사 이미 r3 — 신규 불필요
- [T2] 2026 주휴수당 포함 시급 — scout 2026-10-10 verdictT2 closed: "2026 주휴수당 포함 시급" already r1, openSlots 0<2, offset·press 미측정(API) — 자사 이미 r1 — 신규 불필요
- [T2] 근로·자녀장려금 9월 신청 전 구분 3가지 — scout 2026-10-10 verdictT2 closed: "근로·자녀장려금 9월 신청 전 구분 3가지" already r3, openSlots 0<2, offset·press 미측정(API) — 자사 이미 r3 — 신규 불필요
- [T2] 주휴수당 포함 시급 — scout 2026-10-10 verdictT2 closed: "주휴수당 포함 시급" already r1, openSlots 0<2, offset·press 미측정(API) — 자사 이미 r1 — 신규 불필요
- [T2] 실업급여 구직급여 — scout 2026-10-10 verdictT2 closed: "실업급여 구직급여" openSlots 1<2, offset·press 미측정(API) — 재측정 후 재판정
- [T1] 4차 민생지원금 지역별 지급 현황 — scout 2026-10-10 verdictT1 closed: "4차 민생지원금 지역별 지급 현황" already r2, openSlots 1<2, offset·press 미측정(API) / "4차 민생지원금 9월 신청 지역" already r1, openSlots 0<2, offset·press 미측정(API) / "4차 민생지원금 개시일" already r2, openSlots 1<2, offset·press 미측정(API) — 자사 이미 r1 — 신규 불필요
- [T1] 정읍시 민생지원금 — scout 2026-10-10 verdictT1 closed: "정읍시 민생지원금" already r2, openSlots 1<2, offset·press 미측정(API) — 자사 이미 r2 — 신규 불필요
- [T3] 10월 대체공휴일 휴일근무 수당 — 운영자 반려(2026-09-29T04:54:48.865Z)
- [T3] 독감 무료 예방접종 65세 연령별 날짜 — 운영자 반려(2026-09-29T04:54:48.865Z)
- [T3] 부가세 예정고지 세부(안내면·가산세) — 발행됨(2026-09-25)
- [T3] 기초연금 10월 지급일 — 운영자 반려(2026-09-29T04:54:48.865Z)
- [T3] 청년미래적금 2차 신청 개시(10/7~16) — 운영자 반려(2026-09-29T04:54:48.865Z)
- [T3] 청년도약계좌 10월 가입 신청기간 — 발행됨(2026-09-28T00:27:29.648Z)
- [T3] 국가건강검진 2026 대상자(짝수년) 연내 마감 — 운영자 반려(2026-09-29T04:54:48.865Z)
- [T2] 검색량 미측정 19건(keyword-volume·레이더 측정 전 — 0이 아니라 "못 쟀다"): 실업급여 자발적 퇴사, 실업급여 면접 불참, 주휴수당 알바 계산기, 근로장려금 상반기, 중위소득 계산기, 중위소득 가구원수, 기초연금 부부 감액, 기초연금 인상액, 월세 세액공제 신청 대상, 월세 세액공제 국세환급금 통지서, 국가장학금 서류, 국가장학금 서류제출 안 하면, 국가장학금 소득구간, 국가장학금 지급일, 청년월세 2027 주거급여, 노란우산공제 가입 조건, 본인부담상한액 환급 신청, 본인부담상한액 2026 상한액 표, 본인부담상한액 사후환급

이전 큐에서 status가 남아 있는 항목(오늘 재생성되지 않음):
- [갱신] 기후동행카드 충전 7월 31일 마감, 서울 9월 종료 K패스 전환 — published 2026-10-01T04:20:36.065Z
- [갱신] 에너지바우처 2026 다자녀 2자녀 확대 대상·금액 — published 2026-10-01T04:20:36.065Z
- [갱신] 에너지바우처 하절기 언제까지·잔액 동절기 이월 총정리 — published 2026-10-01T04:20:36.065Z
- [갱신] 여름 냉방지원금 뭐가 있나, 수급가구 중복 수급 정리 — published 2026-10-01T04:20:36.065Z
- [갱신] 에너지바우처 4인 70만원, 가구원수별 금액과 소득기준 — published 2026-10-01T04:20:36.065Z
- [갱신] 임산부 에너지바우처 대상 조건과 소득기준, 지원금액 — published 2026-10-01T04:20:36.065Z
- [갱신] 나주시 민생지원금 사용처, 20만원 선불카드와 착 상품권 쓰는 곳 다르다 — published 2026-10-01T04:20:36.065Z
- [갱신] 2026 여름 에너지바우처 냉방 신청, 대상·금액·사용기간 — published 2026-10-01T04:20:36.065Z
- [T1] 속초시 민생지원금 사용처 — published 2026-10-07
- [T1] 의령군 민생지원금 사용처 — published 2026-10-07
- [T2] 노령연금 — published 2026-10-06
- [갱신] 2026 국군의날 임시공휴일, 10월 1일 목요일 쉬나요? — published 2026-10-01T04:20:36.065Z
- [갱신] 태안 반값여행 2차 신청 준비물, 착 앱·신분증·유형 선택 — published 2026-10-01T04:20:36.065Z
- [갱신] 영천 반값여행 최대 10만원 청년 14만원 환급받기 — published 2026-10-01T04:20:36.065Z
- [갱신] 에너지바우처 잔액 조회, 안 보일 때 확인할 3가지와 사용기간 — published 2026-10-01T04:20:36.065Z
- [T2] 2026 주휴수당 포함 시급 — hold 2026-09-16
- [T1] 나주시 민생지원금 사용처 — published 2026-09-30T01:11:32.748Z
- [갱신] 나주 민생회복지원금 5부제, 내 출생연도 신청일은 9월 며칠인가 — published 2026-09-30T01:11:32.748Z
- [갱신] 나주 민생회복지원금 20만원, 9월 14일 신청 시작 — published 2026-09-30T01:11:32.748Z
- [T2] 정부지원감면 — rejected 2026-09-29T04:54:48.865Z
- [T1] 문경시 민생지원금 사용처 — published 2026-09-28
- [T1] 부안군 민생지원금 사용처 — published 2026-09-29
- [T1] 고흥군 민생지원금 사용처 — published 2026-09-28
- [T1] 고창군 민생지원금 사용처 — published 2026-09-29
- [T1] 통영시 민생지원금 사용처 — published 2026-09-28
- [T1] 장흥군 민생지원금 사용처 — published 2026-09-29
- [T1] 하동군 민생지원금 사용처 — published 2026-09-29
- [T1] 영동군 민생지원금 사용처 — published 2026-09-29
- [T1] 4차 민생지원금 지역별 지급 현황 — hold 2026-09-15
- [T2] 긴급생계지원금 — hold 2026-09-27
- [T2] 한부모수당 — hold 2026-09-27
- [T2] 청년도약계좌vs청년미래적금 — hold 2026-09-25
- [T2] 해고예고수당 — published 2026-09-23
- [T2] 사회보장급여 — published 2026-09-20
- [T2] 쳥년미래적금 — hold 2026-09-20
- [T2] 3차민생지원금 — hold 2026-09-18
- [T2] 건강생활실천지원금 신청 — published 2026-09-24
- [T1] 고양시 추석지원금 — published 2026-09-23
- [T1] 산청 민생안정지원금 사용기한 — hold 2026-10-01T04:00:00.886Z
- [T3] 아동수당 9월 지급일 — hold 2026-09-24
- [T1] 안산 추석지원금 — published 2026-09-23
- [T1] 횡성군 민생지원금 — published 2026-09-23
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
- [national] 희망저축계좌2 10월 모집 — published 2026-09-27T12:20:09.253Z
- [national] 경기도 청년기본소득 3분기 지급일 — published 2026-09-27T12:20:09.253Z
- [national] 보금자리론 신혼부부 소득요건 — published 2026-09-27T12:20:09.253Z
- [published] 코로나 백신 65세 이상 무료 접종 언제부터 — published 2026-09-28T00:27:29.648Z
- [published] 함평 민생회복지원금 미신청 — published 2026-09-28T00:27:29.648Z
- [proposed] 사회보장급여 확인조사 소명 — published 2026-09-28T01:58:10.720Z
- [T2] 거창 반값여행 — hold 2026-10-01T04:43:18.255Z
- [T2] 영암 반값여행 — hold 2026-10-01T04:43:18.255Z
- [T2] 태안 반값여행 — published 2026-09-30T04:55:11.033Z
- [T2] 밀양 반값여행 — published 2026-09-30T02:05:43.770Z
- [T2] 영천 반값여행 — published 2026-09-30T00:17:36.763Z
- [T2] 장흥 반값여행 — published 2026-09-30T04:59:21.395Z
- [T2] 산청 반값여행 — published 2026-09-30T04:55:11.033Z
- [T2] 횡성 반값여행 — published 2026-09-30T04:55:11.033Z
- [T2] 완도 반값여행 — published 2026-09-30T04:55:11.033Z
- [T2] 함양 반값여행 — published 2026-09-30T04:55:11.033Z
- [T2] 화천 반값여행 — hold 2026-10-01T04:43:18.255Z
- [T2] 영광 반값여행 — hold 2026-10-01T04:43:18.255Z
- [T2] 안동 반값여행 — published 2026-10-01T04:00:00.886Z
- [T2] 고성 반값여행 — published 2026-10-02
- [T2] 서천 반값여행 — published 2026-10-01T04:43:18.255Z
- [T2] 반값여행 10월 신청 — published 2026-10-01T04:43:18.255Z
- [T2] 모두의카드 환급 10월부터 — published 2026-09-30T01:17:45.866Z
- [T2] 부모급여 10월 지급일 — published 2026-10-01T04:43:18.255Z
- [T2] 부산 소상공인 에너지바우처 — published 2026-10-02
- [T2] 숙박 페스타 쿠폰 — published 2026-10-03
- [T2] 청년도약적금 — published 2026-10-06
- [T2] 출산휴가지원금 — published 2026-10-06
- [T2] 희망리턴패키지 — published 2026-10-08
- [T2] 폐업지원금 — published 2026-10-08
- [T2] 문화누리카드 사용처 — published 2026-10-08
- [T2] 문화누리카드 잔액 — hold 2026-10-08
- [T2] 문화누리카드 신청 — hold 2026-10-08
- [T2] 문화누리카드 가맹점 — hold 2026-10-08
- [T2] 문화누리카드 금액 — hold 2026-10-08
- [T2] 농어촌 기본소득 — hold 2026-10-08
- [T2] 청년고용연계자금 — published 2026-10-08
- [T2] 소상공인 정책자금 대리대출 — hold 2026-10-08

## 다음 물결 감시

- 나주 — 개시 09/14 D+26 · 신규 없음. D-1·D+1 재측정, 4위 이하면 B(계획 §5)
- 문경 — 개시 09/14 D+26 · 신규 없음. 9/16 B 필요 여부 판단(계획 §5) (판단일 2026-09-16)
- 김해 — 개시 09/17 D+23 · 김해시 공고 게시 후 B키 2개 확정 시만(결정 #5)
- 강릉 — 개시일 미정 · V글 보유. 신규 금지, bill.do 새 uid 감시(결정 #6) · https://gncl.go.kr:8080/assembly/bill.do
- 당진 — 개시일 미정 · V글 보유. 신규 금지, 가결 감시(결정 #6)
- 대구 — 개시일 미정 · 확인 불가 — 첫 주 제외(계획 §5)
- 경기 — 개시일 미정 · 확인 불가 — 첫 주 제외(계획 §5)
- 설 2027 지자체 지원금 — watch · 감시 시작 2026-11-01 · 가결 트리거 — 지자체별 조례·추경 가결 또는 공고 확인 시 즉시(개시 D-7 안). 날짜 캘린더 아님
- 연말정산 월세 세액공제 — 새벽 자동 발행 2026-10-19 배정
- 연말정산 부양가족 — writeBy 2026-11-15(D-36) · 피크 1월 16.51
- 연말정산 의료비 — 새벽 자동 발행 2026-10-21 배정
- 연말정산 연금저축 — writeBy 2026-12-05(D-56) · 피크 1월 7.49
- 연말정산 경정청구 — writeBy 2026-12-20(D-71) · 피크 5월 12.9
- 연말정산 미리보기 — 새벽 자동 발행 2026-10-07 배정
- 연말정산 기간 — 새벽 자동 발행 2026-10-09 배정
- 연말정산 환급금 조회 — 새벽 자동 발행 2026-10-11 배정
- 연말정산 환급일 — 새벽 자동 발행 2026-10-13 배정
- 연말정산 서류 — 새벽 자동 발행 2026-10-15 배정
- 육아휴직 연말정산 — 새벽 자동 발행 2026-10-17 배정
- 실업급여 연말정산 — 새벽 자동 발행 2026-10-23 배정
- 완주 신청·지급 마감 10/30 카운트다운 정정(계획 §7-2) — 2026-10-30(D-20) 갱신 예정 · wanju-livelihood-stability-grant-2026-08-12, wanju-grant-proxy-application-after-sep14
- 나주 신청 마감 10/16 카운트다운 정정(계획 §7-2) — 2026-10-16(D-6) 갱신 예정 · naju-livelihood-recovery-grant-2026-08-07, naju-livelihood-grant-rotation-days-2026-09-03, naju-grant-prepaid-card-vs-chak-usage-places-2026-09-30
- 문경 신청 마감 10/23 — 2026-10-23(D-13) 갱신 예정 · mungyeong-high-oil-price-relief-2026-08-16, mungyeong-livelihood-grant-chuseok-payment-2026-08-27, mungyeong-grant-prepaid-card-usage-places-2026-09-28
- 영암 신청 마감 10/30 — 2026-10-30(D-20) 갱신 예정 · yeongam-rural-basic-allowance-100k, yeongam-wolchulpay-balance-expiry-use
- 재측정 "2026 김해 민생지원금": r1 · 본청 0 · 뉴스7일 1·같은제목 1 · openSlots 0 · 눈 확인 전
- 재측정 "김해시 지원금": r2 · 본청 0 · 뉴스7일 29·같은제목 2 · openSlots 0 · 눈 확인 전
- 재측정 "통영 지원금 신청": r5 · 본청 0 · 뉴스7일 9·같은제목 1 · openSlots 0 · 눈 확인 전
- 재측정 "문경시 지원금": r1 · 본청 0 · 뉴스7일 25·같은제목 2 · openSlots 0 · 눈 확인 전
- 재측정 "김해 지원금": r2 · 본청 0 · 뉴스7일 56·같은제목 2 · openSlots 0 · 눈 확인 전

SERP 정찰 계획(--serp 시 일 35 = T1 15 / T2 5 / 새 키워드 10 / 재측정 5): T1 5건 · T2 3건 · 새 키워드 8건 · 재측정 22건 — 재측정: 2026 김해 민생지원금, 김해시 지원금, 통영 지원금 신청, 문경시 지원금, 김해 지원금, 통영 민생지원금 신청, 완주 지원금, 문경 지원금 …

0400 자동 발행은 그대로 1건 나갑니다. 위 후보 중 쓸 것을 지시해 주세요.
