---
description: 네이버 최상단 노출 전용 파이프라인 — SERP 실측으로 진입 가능한 자리만 골라 발행하고, 기존 자산의 자기잠식을 막는다
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
- 상세 근거는 `docs/ops/NAVER-TOP-EXPOSURE.md`.

## 실행 순서

### 1. 자산 점검 (cluster-auditor spawn)
클러스터 밀도·의도 중복·허브 공백을 받는다. **과포화 클러스터에는 신규를 넣지 않는다.** 보유 글 3건 이상인 허브를 채우는 후보에 가점.

### 2. 후보 발굴 (emerging-keyword-hunter spawn)
- `src/data/keyword-radar.json`의 **`niche[]`가 1순위 소스다.** 기회도 30↑ × 신생/성장/급상승을 이미 만족한 후보가 **기회도(`opportunity`) 내림차순**으로 정렬돼 있다.
- **`blogTotal`이 작을수록 좋다.** 1,000 미만이면 사실상 빈 자리다. 점수(score)도 `gap`도 판정에 쓰지 마라 — 둘 다 질문 수가 지배해서 **남들이 다 쓴 포화 키워드를 상위로 올린다**(2026-09-09 실측: gap 상위 10 중 6개가 블로그 3만건 이상).
- `stage`가 `new`(7일 내 최초 관측) 또는 `rising`(추세 1.4배↑)인 것을 우선한다. 단 `age: 0`은 "이번 회차 최초 관측"이라 확정이 아니다.
- `signals.momentum` 1.5 이상이면 급상승 — 원인을 WebSearch로 확인하고 확정 발표·마감이면 최우선.
- `demo.peak`로 연령 쏠림을 보고 절차 서술을 맞춘다(senior면 방문·대리·종이서류를 앞에, young이면 앱·온라인을 앞에).
- 인자로 키워드가 지정됐으면 이 단계는 건너뛴다.

성적 측정까지 포함한 하루 루프는 `/naver-daily`를 써라.

### 3. SERP 실측 (naver-serp-scout spawn) — 이 단계를 건너뛰지 마라
후보 5~8개를 넘겨 **네이버에 실제로 검색**하게 한다. 외부 웹사이트가 1건도 없는 쿼리는 그 자리에서 버린다. 블로그·카페·지식iN이 1페이지를 채운 쿼리는 구조적으로 못 이긴다.

awoo가 이미 노출 중인 쿼리가 나오면 **신규 금지 · 갱신 트랙**으로 옮긴다.

### 4. 작성 (post-writer spawn)
- **제목은 타깃 쿼리를 그대로 맨 앞에** 둔다. 연도·의문형을 앞세우지 마라. 키워드 2회 이상 반복은 네이버 명시 불이익이니 1회만.
- **`targetQuery` 필드를 반드시 넣는다.** 이게 있어야 다음날 `npm run rank:check`가 자동으로 순위를 잰다. 빠뜨리면 그 글의 성적을 영영 알 수 없다.
- **`contentVersion: 2`를 반드시 넣는다.** 독자 가독성 v2 게이트(`docs/ops/READER-UX-V2.md`). 출처는 괄호가 아니라 문장 속 명사 링크. 기존 글에는 추가 금지.
- 나머지는 `docs/ops/GOOGLE-NAVER-DUAL-STANDARD.md` 준수(구조 프로파일 로테이션·정보 이득 ≥2).
- serp-scout가 준 "그 자리를 차지한 문서의 특징"을 이기는 각도로 쓴다.

### 5. 검증 (병렬 spawn)
- **naver-content-shaper** — 네이버 공식 조건(제목·구조·출처·고유성·최신성)
- **fact-checker** — 수치·날짜·인용 귀속
- **google-quality-auditor** — 구조 지문·정보 이득
- 그다음 `npm run lint:content && npm run build`

### 6. 거부권 (publish-gatekeeper spawn)
**여기서 VETO면 점수와 무관하게 발행하지 않는다.** 대체 조치를 대신 실행한다.

### 7. 발행 결재 → 발행
운영자에게 [제목 / URL / 타깃 쿼리 / SERP 판정 근거 / 검증 결과] 보고 후 승인받아 발행. 그다음:
```bash
npm run sync:history && npm run indexnow:ping && npm run update:today
```

### 8. 순위 확인 등록
발행 다음날부터 `npm run rank:check`가 `targetQuery`를 자동으로 잡아 잰다. 즉시 확인은:
```bash
node scripts/naver-rank-check.mjs --query="타깃 쿼리"
```

### 9. 색인 요청 (네이버는 수동)
- 네이버 서치어드바이저 수집 요청: https://searchadvisor.naver.com/console/site/request/crawl
- **RSS는 이미 본문 전문으로 나간다**(`/feed-issues.xml`). 서치어드바이저 "요청 > RSS 제출"에 등록돼 있는지 운영자에게 확인.
- GSC: https://search.google.com/search-console/inspect?resource_id=sc-domain:awoo.or.kr

## 금지

- 네이버 어뷰징 일절 금지 — 매크로·계정 대량 운영·링크 구매·클릭 조작. 네이버가 스팸으로 명문화했고 걸리면 도메인이 통째로 빠진다. 목적을 이루는 게 아니라 파괴한다.
- 기존 글 본문 개정 금지 (운영자 지시). 갱신은 `updates[]`·사실 정정·`dateModified`까지.
- 본문 변경 없이 `dateModified`만 올리기 금지 (구글 공식 금지 항목).
- C-Rank·D.I.A.를 근거로 판단하지 마라 — 네이버 블로그 랭킹 로직이고 외부 웹문서 적용 근거가 공식 문서에 없다.

## 보고

```
✅ 발행: {URL}
🎯 타깃 쿼리: {쿼리} — SERP 외부 웹 {N}건 확인, 제목 쿼리 선두 배치
📊 gap {N} · momentum {N} · 연령 {peak}
🛡 gatekeeper PASS · shaper PASS · 팩트체크 {점수}
🔗 네이버 수집 요청 / GSC 링크
```
