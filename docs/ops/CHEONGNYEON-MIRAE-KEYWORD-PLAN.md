# 청년미래적금 키워드 전체 선점 마스터 플랜 (hub-spoke)

> 목적: "청년미래적금" 8개 클러스터 ~80개 키워드를 단일 글이 아닌 **다수 포스트(hub-spoke)** 로 분산 선점한다.
> 작성일: 2026-06-02 · 운영자: 김준혁 · 단일 진실 소스: 본 문서 + docs/ops/MANUAL-POSTING.md
> YMYL(금융) 등급 — 사실검증 게이트 필수.

---

## 0. 결론 요약 (TL;DR)

- **글 수: 허브 1(자동) + 큐레이션 지원금 1 + spoke 8 = 발행 포스트 8건** (트래픽 데이터 보고 S9~S11로 점진 확장).
- **창끝 = S4(청년도약계좌 비교·갈아타기)**. 전환의도·고유자산(savings-account DB)·저경쟁이 동시에 겹치는 최고 ROI 진입점. 1순위 발행.
- **사실검증 게이트 결론: 제도는 정부 확정(발행 가능). 단 금리·은행별 우대금리·정확한 모집 개시일·갈아타기 최종규칙은 미확정 → "발표 대기/예상" 프레이밍 + 확정 시 dateModified 갱신.**
- **★기술적 필수 선행작업(코드 검증 완료): trendingTerm만 달아도 hub는 생성되지 않는다.** `src/pages/issues/topics/[term].astro` getStaticPaths(L77-78)는 `_history.json`의 `byTerm` 키만 순회하고, `scripts/sync-history.mjs`(L10·75)는 byTerm에 없는 term을 새로 만들지 않는다. 현재 byTerm 16개에 '청년미래적금'·'청년도약계좌' **둘 다 없음**. → byTerm['청년미래적금'] 시드 엔트리 1회 수동 주입이 hub 활성화의 전제조건.

---

## 1. 사실검증 게이트 (YMYL)

5개 관점 + 코드 교차검증 결과를 확정/미확정으로 이원화한다. **확정값만 coreFacts·table 확정셀에 단정**, 미확정은 본문에서 '예상/발표대기/검토중'으로만 서술하고 수치를 지어내지 않는다.

### 확정 (단정 발행 가능, 다출처 합치 + 정부 1차)
- 대상: 만 19~34세(병역 최대 6년 연령 제외)
- 만기 3년, 월 최대 50만원 자유적립식
- 정부기여금: 일반형 6% · 우대형 12%
- 이자소득 비과세
- 소득기준: 일반형 = 개인 총급여 6,000만원↓(소상공인 매출 3억↓) + 가구 중위소득 200%↓ / 우대형 = 개인 3,600만원↓(매출 1억↓) + 중위 150%↓, 중기 신규취업자 가점
- 2026년 6월 최초 모집, 이후 연 2회(6·12월) 정기모집
- 비대면 앱 신청(서류 전산 자동연계, 무서류), 운영 = 서민금융진흥원
- 청년도약계좌와 **중복가입 불가**(정설)

### 미확정 (수치 단정 금지 · '발표 대기/예상/검토중' 프레이밍 필수)
- **기본/최고 금리** — FSC '추후 확정'. 블로그 추정치(5%/6%/7~8%/최대 19.4%)는 출처 인용으로만, coreFacts 미기입.
- **만기 예상수령액/실수령액/수익률** — 금리 미확정 → 확정 불가. '연 X% 가정 시' 가정칼럼으로만.
- **은행별 우대금리** — 출시 후 공시. 참여기관 목록·구조만, 수치는 확정 시 갱신.
- **정확한 신청 개시·마감일** — 출처별 상충(6/15~6/23 vs 6/22~7/3). 발행 전 fsc.go.kr 보도자료 원문으로 1회 교차검증. 미확정이면 '6월 중'으로.
- **청년도약계좌→청년미래적금 갈아타기 최종규칙·특별중도해지 요건** — 정부 검토/허용 방향이나 세부 미공표. '검토중·공식 약관 확인'.

### 안전 발행 규칙
- sources ≥ 3, 정부 1차 출처(fsc.go.kr / korea.kr 정책브리핑 / kinfa.or.kr) ≥ 1을 **모든 글에 포함**(isBasedOn 자동 emit, GEO 신뢰).
- 미확정 항목 비중 높은 글(S3·S5·S7)은 factCheckScore 보수적(0.65~0.7)·sourceConfidence=medium·disclaimer 노출. 단 0.6 미만은 자동 noindex이므로 확정값 비중을 충분히 확보.
- 금리/은행/모집일 확정 발표 시 S3·S5·S2·pillar의 수치·dateModified 일괄 갱신 → freshness 재획득 + factCheckScore 상향.

---

## 2. 기술 인프라 선행작업 (P0 — hub가 생기려면 반드시)

1. **`_history.json` byTerm 시드 주입.** byTerm['청년미래적금'] = { firstSeen, lastSeen, totalCount(≥1), daysActive, dailyCounts(최소 1일) } 를 1회 수동 추가. 이후 sync-history가 spoke들의 freshness.trendingTerm에서 postSlug/postDate를 자동 매핑 → /issues/topics/청년미래적금/ 생성.
   - (선택) '청년도약계좌'도 동일 시드 시 비교 hub 추가 확보.
   - ⚠️ sync-issues(뉴스 카운트 파이프라인)가 수동 시드 엔트리를 덮어쓰거나 totalCount=0으로 만들지 1회 확인. 덮어쓰면 hub 소멸.
2. **큐레이션 지원금 1건 신설: `src/data/subsidies/_curated/youth-future-savings.json`** (id=youth-future-savings, title='청년미래적금', category=자산, agency=서민금융진흥원, tags에 '청년미래적금' 포함, eligibility/benefits=확정값만, 금리는 비움/'추후 확정', targetPersonas=['office-rookie','self-employed']).
   - 이유: topics/[term].astro의 analyzeSubsidy(L116-126)는 term이 지원금 title/tags/summary에 포함돼야 매칭. 현재 DB에 '청년미래적금' 문자열 0건 → hub가 isThin(L171) noindex. 이 레코드가 thin 차단 + spoke들의 relatedSubsidies/내부링크 타깃 + /subsidies/{id}/ 추가 색인자산을 동시에 해결.
3. **savings-account(청년도약계좌)** 는 비교/갈아타기 spoke의 relatedSubsidies 앵커로 즉시 재사용(이미 DB 존재).

---

## 3. 포스트맵 (허브 1 + spoke 8)

모든 spoke: `freshness.trendingTerm='청년미래적금'`. 대표글(S4)에 `freshness.trendingPrimary=true`. reportType은 정식 enum 5종만(lint err 회피). slug=`youth-future-savings-{type}-YYYY-MM-DD`.

| # | 글(타깃 검색의도) | 클러스터 | reportType | 비고 |
|---|---|---|---|---|
| HUB | /issues/topics/청년미래적금/ (자동 pillar, ItemList/CollectionPage) | 8 흡수(디시/후기/추천) | — (데이터 인프라) | byTerm 시드 + 큐레이션 지원금 선행 |
| S1 | 자격·조건 진단(조건/가입조건/자격/나이/만34세/소득기준/중위200/뜻) | 1 | new-subsidies-detail | table=일반형/우대형 소득·중위·기여율 |
| S2 | 신청방법·신청기간(신청/출시일/6월/모집/서류/앱/서민금융진흥원) | 2 | deadline-imminent-weekly | HowTo N단계, 모집일 미확정 시 '6월 중' |
| S3 | 예상수령액·기여금 계산(계산기/예상수령액/수익률/금리/50만/기여금) | 3 | new-subsidies-detail | 기여금=확정 / 이자=가정칼럼, calculatorhost CTA |
| **S4** | **vs 청년도약계좌·갈아타기·중복(★창끝)** | **4** | **new-subsidies-weekly** | **trendingPrimary, 비교table, savings-account 링크** |
| S5 | 은행별 금리·우대금리(은행/KB·신한·카카오·토스/최고금리) | 5 | issue-followup | 금리 '발표 대기' 프레이밍, 확정 시 갱신 |
| S6 | 일반형·우대형 차이 + 대상별(소상공인/프리랜서/취준생/군인/신혼) | 6 | new-subsidies-detail | relatedPersonas, 페르소나 없는 대상은 H2/FAQ 흡수 |
| S7 | 중도해지·환수·단점(특별중도해지/기여금환수/단점/주의사항) | 7 | issue-followup | 환수규정 미확정='약관 확인', S4와 cross-link |
| S8 | 총정리·후기·FAQ(총정리/후기/디시/추천) | 8 | weekly-essentials | 텍스트 pillar, 전 spoke 역링크, '구조 총정리' 프레이밍 |

확장 여유분(트래픽 보고): S2를 절차/시기성 2분할 · S5를 인뱅/시중은행 2분할 · S4의 청년희망적금 비교 별도 spoke. 모두 trendingTerm 유지.

### 카니발라이제이션 차단
- 글당 검색의도 1개 고정: '신청'→S2만, '계산'→S3만, '갈아타기'→S4만 title/H2/tags에 배치.
- 같은 키워드가 두 글 title에 동시 등장 금지. '조건'은 pillar 개괄 vs S1 심층으로 경계.
- 모든 spoke H2 ≥1개에 '청년미래적금' 토큰, 본문 첫 등장 시 [청년도약계좌](/subsidies/savings-account/) 등 문맥 내부링크 ≥1.

---

## 4. 발행 순서 / cadence

전환 즉시성 순으로 5일에 8건, 하루 1~2건. hub의 '관련 분석 N건'을 누적시켜 pillar 두께 축적.

- **D0(준비)**: byTerm 시드 + youth-future-savings.json 신설 + build로 hub indexable 확인.
- **Day1**: S4(비교·갈아타기, trendingPrimary) + S1(자격). ← 전환·핵심검색량 동시.
- **Day2**: S2(신청·6월 모집, urgency=high).
- **Day3**: S3(계산, calculatorhost 연계) + S6(유형/대상별).
- **Day4**: S5(은행별 금리).
- **Day5**: S7(해지·단점) + S8(총정리·FAQ).
- 매 발행 후: `npm run sync:history` → `npm run lint:content`(err 0) → `npm run indexnow:ping` → Naver Search Advisor 신규 URL 등록(MANUAL-POSTING §8).

**6월 윈도우 시기성**: 갈아타기 허용이 6월 최초 가입기간 한정 → S2·S4는 6월 초 즉시 발행, 모집 종료 후 dateModified 갱신으로 '다음 회차' evergreen 전환. 정기모집(6·12월)마다 deadline spoke 추가로 hub에 회차 누적.

---

## 5. 내부링크 · 계산기 · hub 구조

- **4축 내부링크 강제**: spoke↔pillar(자동 hub) ↔ 지원금DB(savings-account, youth-future-savings) ↔ 용어사전(glossary: youth-leap-account/youth-savings/median-income/income-percentile). 각 spoke 본문에 glossary 문맥링크 ≥1, relatedSubsidies에 savings-account(+youth-future-savings).
- **spoke 상호 순환링크**: 자격(S1)→신청(S2)→계산(S3)→비교(S4)→은행(S5)→유형(S6)→해지(S7)→총정리(S8)→hub. 양방향으로 spoke 단독 thin 방지.
- **계산기(calculatorhost)**: S3·S4 본문·CTA(potentialAction)에 외부 계산기 딥링크. 자체 위젯 대신 외부 CTA(effort 최저·미확정 금리 오류 리스크 회피). 본문 table은 '월납입(10/30/50만)×기여금율(6/12%)→3년 기여금 확정값'(예 50만×36×6%=108만 / 12%=216만)으로 계산식 노출, 이자는 가정칼럼 분리. **발행 전 calculatorhost 청년미래적금 로직(3년·기여금6/12%) 반영 여부·딥링크 URL 안정성 확인**(미확정 시 정적 table로 대체).
- **hub 자동집계**: 동일 trendingTerm spoke 전체를 desc로 ItemList/CollectionPage emit → pillar 권위 흡수. cluster8(디시/후기/추천)은 hub 메타 + 각 spoke FAQ가 흡수.

---

## 6. 선점 전술 (신규 도메인 약점 우회)

- **단일키워드 1위가 아니라 다면 노출**: 8 spoke가 네이버 스마트블록·구글 AI Overviews·PAA에 다출처로 깔리는 게 ~80키워드 '전부 선점'의 현실 경로. table/faq/HowTo 3종 보유가 진입 조건.
- **AEO**: H2를 People-Also-Ask형 질문('만 34세 넘으면 가입 안 되나요?'). tldr[0] 첫 문장에 확정 수치+출처괄호. faq 5~7개 답변 첫 문장 단독완결+수치('네,/예,' 금지).
- **GEO**: 정부 1차 출처 isBasedOn 고정, ClaimReview로 '갈아타기 가능한가?'·'중복가입 가능?' 검증 emit → AI답변 인용 경로.
- **차별화 4종**: (1)정부 1차 출처 isBasedOn (2)신청 정확일자 선점(경쟁 블로그는 '6월'만 표기) (3)hub-spoke 구조적 내부링크 밀도 (4)savings-account DB 연계 '비교→판단플로우→계산기' 닫힌 루프(경쟁 블로그 불가).
- **확정 발표 D-day 선점**: 금리·은행 확정 즉시 S3·S5 수치교체+dateModified+indexnow → '확정 직후 검색 급증' 구간 선점.

---

## 7. 리스크

- YMYL 금리/수령액 미확정 단정 → 사실오류 + factCheckScore<0.6 자동 noindex. 확정값만 단정, 이자/수령액은 가정+출처.
- hub 미생성: byTerm 시드 누락 시 getStaticPaths가 path 미생성 → spoke 고아. 시드 + sync:history 선행 필수.
- sync-issues 덮어쓰기: 수동 시드를 뉴스 파이프라인이 덮을 수 있음 → 시드 후 sync-issues 1회 보존 확인.
- thin/noindex: youth-future-savings 레코드 신설 전·spoke 발행 전 hub thin. 인프라 선행으로 회피.
- 카니발라이제이션: 글당 1의도·title 키워드 1세트 원칙 위반 시 spoke 상호 잠식. GATE-A 유사도 70% 점검.
- 페르소나 갭: 학생·취준생·무직·군인·프리랜서는 6종 페르소나(office-rookie 등)에 없음 → relatedPersonas 직접 타깃 불가, 본문 H2/FAQ 흡수(단독 순위 약함).
- calculatorhost 외부 의존: 딥링크 URL·청년미래적금 로직 미확인 시 dead link. 발행 전 확인 또는 정적 table 대체.
- 정책 변동·신선도 부패: 시행 직전 수치 변경·6월 갈아타기 종료 후 만료정보 고착. 회차별 dateModified 갱신 루틴을 MANUAL-POSTING 런북에 등록.
- 경쟁 포화: govgrant/grantinfo 등 어필리에이트 선점. 정부출처+정확일자+구조적 링크+스키마로 우회.
