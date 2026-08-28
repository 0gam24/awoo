---
description: 오늘 포스팅 데일리 루틴 — 사용자가 "오늘 포스팅"이라고 말하면 발동. /traffic 점검 → 키워드 발굴 → /post 또는 /sprint 발행까지 3개 커맨드를 한 흐름으로 모두 실행한다.
argument-hint: "(선택) 키워드 또는 N건 — 비우면 scout 추천"
---

# /today — "오늘 포스팅" 원커맨드

트리거: `/today` 또는 사용자가 **"오늘 포스팅"**(유사 표현: "오늘 글", "오늘 발행")이라고 말할 때.
역할: /traffic → keyword-scout → /post 또는 /sprint 를 **순서대로 전부 실행**하는 오케스트레이터. 각 단계의 상세 절차는 해당 커맨드 파일이 단일 진실 소스다 — 여기서 중복 정의하지 않는다.

## 실행 순서 (멈추지 말고 끝까지)

### PHASE 0 — 동기화 + 오늘 날짜(KST) 확정
```bash
git fetch origin && git rebase origin/main
TODAY_KST=$(node -e "console.log(new Date(Date.now()+9*3600*1000).toISOString().slice(0,10))")   # 예: 2026-07-11 — 반드시 이 값을 오늘로 쓴다
echo "오늘(KST) = $TODAY_KST"
```
⚠️ **오늘 날짜는 반드시 위 node 한 줄(UTC+9 산출)로 확정한다.** 클라우드(UTC 03:00 KST 실행) 기준으로 `date`는 **전날**을 주고, **Windows Git Bash에서는 `TZ=Asia/Seoul date`가 tzdata 부재로 UTC로 조용히 폴백해 역시 전날을 준다**(2026-08-28 실측: TZ 지정 시 08-27 GMT 반환, 실제 KST는 08-28). 두 환경 모두에서 맞는 것은 UTC+9 산출뿐이다. 대화 컨텍스트 날짜를 그대로 쓰는 것도 금지 — 발행물이 하루 밀리면 디렉토리·URL·제목 규칙 cutoff가 전부 어긋난다. 모든 발행물의 **디렉토리명·slug의 `-YYYY-MM-DD` 접미사·`date` 필드·`publishedAt`(KST 기준)** 을 위 `$TODAY_KST`로 통일하고, post-writer에 발행일 전달 시에도 이 값을 넘긴다.

### PHASE 1 — 점검 (/traffic 실행)
Skill 도구로 `traffic` 호출, args: `"갱신·색인 점검 우선 — 내일 추천(scout)은 생략, PHASE 2가 수행"`
핵심 산출: ① 최근 발행 색인 여부 표본 ② **freshness 갱신 후보** (확정 발표가 난 "발표 대기" 글 — 있으면 오늘 가장 빠른 트래픽).
갱신 후보 1차 소스: `src/data/keyword-radar.json`의 **updateCandidates** (레이더가 하루 4회 미확정 글×수요 신호를 자동 감지해둠) — 비어 있을 때만 grep("발표 대기|미확정|검토중")으로 보조 탐색. 플래그는 "확정 발표 가능성"일 뿐이므로 반드시 WebSearch로 실제 확정 여부 확인 후 갱신 트랙에 올린다.

### PHASE 2 — 발굴 (keyword-scout spawn)
`$ARGUMENTS`에 키워드가 있으면 생략. 없으면 **keyword-scout** 에이전트 spawn → 오늘 후보 5~8개 스코어 표.

### PHASE 3 — 자동 범위 결정 (2026-06-12 운영자 지시: 질문 없이 에이전트가 결정)
AskUserQuestion **금지** — 다음 규칙으로 범위를 자동 확정:
- **갱신 후보**(확정 발표 난 "발표 대기" 글)가 있으면 **전부 포함** (가장 빠른 트래픽)
- **신규는 scout 1순위 1건 기본.** 시기성 오버라이드(마감 D-14·지급일 ±3일·확정 발표 24h) 후보가 더 있으면 최대 3건까지 확대
- **구글 신뢰 회복기 규칙(2026-08-28~, GOOGLE-NAVER-DUAL-STANDARD §5)**: 신규 상한 3건 유지·갱신 우선. **지역명 치환 동시 발행 금지**(동일 템플릿 지역 변형 연발 대신 비교 허브 1건+날짜 분산). 1키워드 1페이지(분할 발행 금지)
- **awoo 0400 자동 발행 반영(2026-08-29~)**: 클라우드 루틴이 매일 KST 04시에 신규 1건을 이미 발행했을 수 있다 — PHASE 0의 git pull로 받은 오늘 날짜 디렉토리를 확인해 ① 그 1건을 **오늘 신규 상한(1~3건)에 포함**하고 ② GATE-A 중복·점유 토큰 대조 대상에 넣어라 (자동 글과 같은 키워드·구조 프로파일 회피)
- hub 회수·trendingTerm 정비 등 발행 0건짜리 구조 작업은 발견 즉시 포함
- GATE-A 중복 70%↑면 강행하지 않고 longtail-strategist가 제시한 빈 각도로 자동 전환, 빈 각도가 없으면 그 키워드는 제외
- GATE-B 매칭 0건이면 그 키워드 제외 (외부 소스 단독 발행은 자율 모드에서 금지)

### PHASE 4 — 발행 (자동 결재)
- post-writer(병렬) → fact-checker(병렬) + **google-quality-auditor(일괄, 2026-08-28+ 필수)** + quality-gate(일괄) → lint:content + build.
- **GATE-D 자동 결재 규칙**: fact-checker PASS(또는 FIX 정정 후 재검증 PASS) + quality-gate PASS + lint err 0 + build 성공 = **즉시 발행** (commit·push·indexnow·update:today까지 무중단).
- fact-checker **BLOCK** = 그 글만 자동 제외하고 나머지 발행. 전건 BLOCK이면 발행 0건으로 종료하고 사유 보고.
- 갱신 건: 수치 교체 + lastSeen/dateModified 갱신 + fact-checker 검증 — 동일 자동 결재.
- 절대 한도: factCheckScore < 0.6 발행 금지 · 하루 신규 8건 초과 금지 · 날짜 4중 일치.

### PHASE 5 — 마무리 리포트
배포 완료(push + deploy green) 후 반드시 아래 형식으로 출력한다. **신규·갱신 전건의 클릭 가능한 전체 URL을 빠짐없이 나열한다** (운영자 상시 지시 2026-07-07 — 요약/생략 금지).
```
✅ 오늘 포스팅 완료 — 신규 {N}건 발행 / 갱신 {M}건

📰 신규 {N}건 (제목 — 클릭 링크):
- {제목} — https://awoo.or.kr/issues/{date}/{slug}/
  ...(신규 전건)

🔄 갱신 {M}건 (제목 — 클릭 링크):
- {제목} — https://awoo.or.kr/issues/{date}/{slug}/
  ...(갱신 전건)

🔗 색인 요청 링크 (GSC·Naver, 전건)
📅 내일 1순위 후보: {scout 차순위 키워드 — 근거}
```

## 규칙 (완전 자율 모드 — 2026-06-12 운영자 지시)
- **운영자 입력 0회.** "오늘 포스팅" 입력 후 발행 완료 리포트까지 질문 없이 완주한다.
- 어떤 PHASE도 건너뛰어 보고로 끝내지 않는다 — 발행(push + 후처리)까지 반드시 도달.
- 발행 0건 종료는 전 후보가 BLOCK/중복/매칭 0건으로 탈락했을 때뿐 — 사유를 리포트에 명시.
- 롤백 안전장치: 발행 후 운영자가 "취소"라고 하면 `git revert` + IndexNow 재핑 (MANUAL-POSTING §9).
- 마무리 리포트에 GSC·Naver 색인 요청 링크를 항상 출력 (운영자 유일한 수동 작업).
- **배포 후 신규·갱신 전건의 전체 URL을 항상 클릭 링크로 나열한다** (2026-07-07 운영자 상시 지시 — "항상 오늘 포스팅 배포되면 전체 링크 표시"). 건수가 많아도 요약·생략하지 않는다.
