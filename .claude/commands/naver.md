---
description: 네이버 최상단 노출 전용 파이프라인 — 물결 감지·SERP 실측(scout)으로 진입 가능한 자리를 트랙별(T1 지역/T2 롱테일)로 골라 운영자에게 보고하고, 운영자 지시가 있을 때 발행한다. 자기잠식은 지자체×패밀리 레지스트리로 막는다
---

# /naver — 네이버 최상단 파이프라인

목표는 하나다. **네이버 통합검색 상단에 awoo 포스팅을 올린다.** 구글은 부차적이다.

인자: `$ARGUMENTS` (키워드 지정 시 그 키워드로, 없으면 레이더에서 후보 발굴)

## 전제 — 이미 확인된 사실 (다시 조사하지 마라)

2026-09-08 1차 출처·SERP 실측 결과다.

- awoo는 **이미 네이버 웹문서 5위에 올라 있다** (`실업급여 조기재취업수당 조건`, 모든 네이버 블로그보다 위). 네이버가 awoo에 **AI 출처 정보**까지 붙였다 → 도메인 신뢰는 이미 확보돼 있다.
- 색인은 문제없다. 신규 글이 **발행 당일 색인**된다. 병목은 색인이 아니라 **랭킹**이다.
- 상위에 오른 외부 문서들은 awoo보다 본문이 짧고 표도 구조화 데이터도 적었다. **이긴 유일한 공통점은 제목이 검색 쿼리 그 자체**라는 것.
- SERP 133항목 중 네이버 자사 UGC 55% / go.kr 20% / 외부 웹 8%. **외부가 들어간 자리를 고르는 것이 승부다.**
- 상세 근거는 `docs/ops/NAVER-TOP-EXPOSURE.md`. **판정 규칙의 원본은 `docs/ops/KEYWORD-PLAN-2026-09-10.md`(계획 v3)** — 이 문서와 어긋나면 계획이 이긴다.
- **2026-09-10 실유입 교정**: 애널리틱스 9/2~9/8 상위 160 검색어 유입의 81%가 지자체 민생지원금(지역 61% + 롤업 20%). 데이터랩 헤드값과 실유입 상관 0.14 — **검색량은 게이트가 아니라 정렬 지표**. 발행 트리거는 "공고·가결로 방금 열린 SERP".
- **운영자 결정(2026-09-10)**: ① 기존 글은 틀린 정보·바뀐 날짜만 고친다(`updates[]`·`dateModified`·표 행·사실 정정. 제목·slug·구조·전면 재작성 금지) ② 0400 자동 발행은 매일 1건 그대로 ③ **후보는 보고하고, 발행은 운영자 지시로만.** 인자 없이 실행하면 4단계 보고에서 멈춘다. 인자로 쿼리(와 트랙·패밀리)를 지정한 실행이 운영자 지시다.

## 실행 순서

### 1. 자산 점검 (cluster-auditor spawn)
클러스터 밀도·의도 중복·허브 공백을 받는다. **비지역 클러스터**의 과포화에는 신규를 넣지 않는다. **지역 글은 과포화 판정 대상이 아니다**(2026-09-09 판정 철회 — 25개 지자체 = 25개 SERP). 지역 후보는 레지스트리로 거른다:

```bash
node scripts/build-cluster-intents.mjs --check "<지역>" <A|B|V> --facts=<초안 post.json>   # PASS | VETO | FIX
# 초안이 없으면 --who=".." --amount=".." --deadline=".." — coreFacts를 안 넘기면 FIX 검사가 생략되고
# reason에 "미제공"이 찍힌다. 그 PASS를 FIX 아님으로 읽지 말고 초안을 넘겨 재실행.
```

VETO(같은 지자체×패밀리 있음. **A가 있는 지자체에 V를 넣는 것도 VETO** — 실행 확인 `--check "부안" V`)는 신규 금지, FIX(coreFacts who·amount·deadline 2/3 동일 — 초안을 넘겼을 때만 판정됨)는 기존 글 갱신으로. 보유 글 3건 이상인 허브를 채우는 후보에 가점.

### 2. 후보 발굴 (emerging-keyword-hunter spawn)
입력에 다음을 넣는다: `src/data/analytics/*.json`(실유입 검색어 — 신규 지역명·4위 이하 지역 쿼리·접미형), 레이더 `born`(`node scripts/keyword-radar.mjs --dry-run`의 `born`·`signals.volume`), 가결 표(조례·추경 가결 WebSearch·강릉 bill.do·계획 §5 표), 언론 롤업 표(지자체 표 diff). 후보마다 **트랙**(T1 지역 / T2 롱테일 / T3 선점)과 **패밀리**(A/B/V, 롤업은 어휘 축)를 붙인다.

- **T1(지역)**: 가결·공고된 지자체 × 패밀리. `born`이거나 공고가 있으면 검색량 문턱 없이 후보. 군은 접미형("X군 민생지원금"), 시는 최다 변형을 타깃 쿼리로.
- **T2(롱테일)**: `src/data/keyword-radar.json`의 **`niche[]`가 1순위 소스다.** 기회도 30↑ × 신생/성장/급상승을 이미 만족한 후보가 **기회도(`opportunity`) 내림차순**으로 정렬돼 있다.
- **`blogTotal`이 작을수록 좋다.** 1,000 미만이면 사실상 빈 자리다. 점수(score)도 `gap`도 판정에 쓰지 마라 — 둘 다 질문 수가 지배해서 **남들이 다 쓴 포화 키워드를 상위로 올린다**(2026-09-09 실측: gap 상위 10 중 6개가 블로그 3만건 이상).
- `stage`가 `new`(7일 내 최초 관측) 또는 `rising`(추세 1.4배↑)인 것을 우선한다. 단 `age: 0`은 "이번 회차 최초 관측"이라 확정이 아니다.
- `signals.momentum` 1.5 이상이면 급상승 — 원인을 WebSearch로 확인하고 확정 발표·마감이면 최우선.
- `demo.peak`로 연령 쏠림을 보고 절차 서술을 맞춘다(senior면 방문·대리·종이서류를 앞에, young이면 앱·온라인을 앞에).
- 인자로 키워드가 지정됐으면 이 단계는 건너뛴다.

성적 측정까지 포함한 하루 루프는 `/naver-daily`를 써라.

### 3. SERP 실측 (naver-serp-scout spawn) — 이 단계를 건너뛰지 마라
후보를 넘겨 **네이버에 실제로 검색**하게 한다. 예산은 하루 T1 15 / T2 5 / 재측정 5. 이력에 쓰지 않는 정찰 모드:

```bash
node scripts/naver-rank-check.mjs --mode=scout --query="후보 쿼리"
# → {rank, webDocCount, aboveIsWholeBlock, openSlots, mainGovAbove, pressAbove, sisterAbove,
#    webDocOffset, verdictT1, verdictT2, above:[{host,kind,title,stale?}]}
```

트랙별 판정:
- **T1 지역** — 검색량 문턱 없음. 공고·가결 존재 + `verdictT1: "open"`(본청 go.kr ≤1 · 언론 ≤3 · 자사 미노출 또는 4위 이하 — 자사가 이미 3위 이내면 closed). 접미형 1 + 변형 1, 두 쿼리를 잰다.
- **T2 롱테일** — `keyword-volume` `recentRelative`(= 레이더 `signals.volume.recent7`) ≥ 1.5 하나만 문턱 + `verdictT2: "open"`(openSlots ≥2; 자매는 `sisterAbove`로 보고만, verdict를 닫지 않는다). 블로그·카페·지식iN이 1페이지를 채워 openSlots 0인 쿼리는 구조적으로 못 이긴다.
- `webDocOffset ≥ 30%` 신규 금지, 15~30% 경고. `rank: null`은 `aboveIsWholeBlock`으로 구분하고 발행을 막지 않는다.
- 옛 규칙 폐기: "webDocCount 3 이하는 UGC 질의라 못 이긴다"는 틀렸다(web3 1위 78, web5 1위 1,746). "외부 웹 0건이면 버린다"는 T2의 openSlots로 흡수됐고, T1은 본청·언론 카운트로 본다.

awoo가 이미 노출 중인 쿼리가 나오면 **신규 금지 · 갱신 트랙**으로 옮긴다. 4위 이하로 떨어진 지역 쿼리는 패밀리B 트리거. `above[]`에 같은 제목 언론 3건 이상은 "개시일 언론 신디케이션" 원인 코드로 따로 적는다.

### 4. 운영자 보고 — 인자 없는 실행은 여기서 멈춘다 (운영자 결정 ③)
후보 표(**트랙 · 패밀리 · 타깃 쿼리 · 근거(--check·verdict·본청/언론·webDocOffset) · 예상 유입/주 · 조건**)와 갱신 후보(글 경로·고칠 사실·날짜)를 보고한다. **발행은 운영자가 확인해 지시할 때까지 하지 않는다.** 0400 자동 발행은 별도로 매일 1건 그대로다(운영자 결정 ②).

## 운영자 지시 후 — 발행 단계

### 5. 작성 (post-writer spawn)
- **제목은 타깃 쿼리를 그대로 맨 앞에** 둔다. 연도·의문형을 앞세우지 마라. 키워드 2회 이상 반복은 네이버 명시 불이익이니 1회만.
- **`targetQuery` 필드를 반드시 넣는다.** 이게 있어야 다음날 `npm run rank:check`가 자동으로 순위를 잰다. 빠뜨리면 그 글의 성적을 영영 알 수 없다.
- **`contentVersion: 2`를 반드시 넣는다.** 독자 가독성 v2 게이트(`docs/ops/READER-UX-V2.md`). 출처는 괄호가 아니라 문장 속 명사 링크. 기존 글에는 추가 금지.
- 나머지는 `docs/ops/GOOGLE-NAVER-DUAL-STANDARD.md` 준수(구조 프로파일 로테이션·정보 이득 ≥2).
- serp-scout가 준 "그 자리를 차지한 문서의 특징"을 이기는 각도로 쓴다.
- 지역 글은 **패밀리 템플릿**(A/B/V)으로 coreFacts `who`·`amount`·`deadline`을 채운다. 군은 "X군 민생지원금" 정확일치 선두, 시는 변형 축(10만원 신청·날짜·2026·추석·도 접두)을 제목·본문에 전부. 사용자 언어 선두 + 공식명 병기. 품질 하한: 공고 고유 사실 2개 · 1,500자 · 공고 출처 링크 · 14자 shingle ≤15%.

### 6. 검증 (병렬 spawn)
- **naver-content-shaper** — 네이버 공식 조건(제목·구조·출처·고유성·최신성)
- **fact-checker** — 수치·날짜·인용 귀속. 지역 글은 go.kr 공고 원문 대조, V형은 공고 부재 직접 확인
- **google-quality-auditor** — 구조 지문·정보 이득
- 그다음 `npm run lint:content && npm run build`

### 7. 거부권 (publish-gatekeeper spawn)
**여기서 VETO면 점수와 무관하게 발행하지 않는다.** FIX면 신규 대신 기존 글 갱신(운영자 결정 ① 범위). 대체 조치는 패밀리B 신규 | 허브 표 행 | 기존 글 사실·날짜 갱신 셋 중 하나. 물결 창 안(개시 D-7~D+8)이면 속도 항목 면제.

### 8. 최종 확인 → 발행
운영자에게 [제목 / URL / 타깃 쿼리 / 트랙·패밀리 / SERP 판정 근거(webDocOffset 포함) / 검증 결과] 보고 후 확인받아 발행. 그다음:
```bash
npm run sync:history && npm run indexnow:ping && npm run update:today
node scripts/build-cluster-intents.mjs --append <발행한 post.json 경로>
```

### 9. 순위 확인 등록
발행 다음날부터 `npm run rank:check`가 `targetQuery`를 자동으로 잡아 잰다(지역 글은 접미형·변형 각 1개). 즉시 확인은:
```bash
node scripts/naver-rank-check.mjs --mode=scout --query="타깃 쿼리"   # 이력에 쓰지 않음
```
사후 측정은 7·14·30일 + 개시일 D-1·D+1. 4위 이하 = 패밀리B 트리거.

### 10. 색인 요청 (네이버는 수동)
- 네이버 서치어드바이저 수집 요청: https://searchadvisor.naver.com/console/site/request/crawl
- **RSS는 이미 본문 전문으로 나간다**(`/feed-issues.xml`). 서치어드바이저 "요청 > RSS 제출"에 등록돼 있는지 운영자에게 확인.
- GSC: https://search.google.com/search-console/inspect?resource_id=sc-domain:awoo.or.kr

## 금지

- 네이버 어뷰징 일절 금지 — 매크로·계정 대량 운영·링크 구매·클릭 조작. 네이버가 스팸으로 명문화했고 걸리면 도메인이 통째로 빠진다. 목적을 이루는 게 아니라 파괴한다.
- 기존 글 수정은 **운영자 결정(2026-09-10) 범위 안에서만** — 틀린 정보와 바뀐 날짜는 고친다(사실 정정·`updates[]`·`dateModified`·표 행). 제목·slug·구조·전면 재작성은 금지(노출 유지).
- 본문 변경 없이 `dateModified`만 올리기 금지 (구글 공식 금지 항목).
- 파이프라인이 스스로 발행하지 않는다. 인자 없는 실행은 4단계 보고에서 멈추고, 발행은 운영자 지시 뒤다. 0400 자동 발행(`.github/workflows/auto-publish-0400.yml`)은 건드리지 않는다.
- C-Rank·D.I.A.를 근거로 판단하지 마라 — 네이버 블로그 랭킹 로직이고 외부 웹문서 적용 근거가 공식 문서에 없다.

## 보고

인자 없는 실행(4단계에서 멈춤):

```
| # | 트랙 | 패밀리 | 타깃 쿼리 | 근거 | 예상 유입/주 | 조건 |
|---|---|---|---|---|---|---|
| 1 | T1 | V | 울진군 민생안정지원금 30만원 부결 | 경북일보 9/8 · --check PASS · verdictT1 open · 본청 0·언론 2 · webDocOffset 8% | 40~120 | — |
🔁 갱신 후보: {글 경로} — {고칠 사실·날짜}
⏸ 발행 대기 — 운영자 지시를 기다린다.
```

운영자 지시 후 발행:

```
✅ 발행: {URL}  트랙 {T1|T2} · 패밀리 {A|B|V}
🎯 타깃 쿼리: {쿼리} — verdict{T1|T2} open · 본청 {N} · 언론 {N} · openSlots {N} · webDocOffset {N}% · 제목 쿼리 선두 배치
📊 recent7 {N} · born {yes/no} · momentum {N} · 연령 {peak}
🛡 gatekeeper PASS · shaper PASS · 팩트체크 {점수} · shingle {N}%
📌 레지스트리 --append 완료
🔗 네이버 수집 요청 / GSC 링크
```
