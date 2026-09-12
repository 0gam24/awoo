---
description: 수동 포스팅 1건 발행 — 에이전트 팀(전략→작성→팩트체크→품질게이트)으로 MANUAL-POSTING 8단계 실행
argument-hint: 키워드 [angle=...] [persona=...] [urgency=high|normal]
---

# /post — 단일 포스트 발행 파이프라인

입력: `$ARGUMENTS` (키워드 + 선택 hint). 키워드가 없으면 **keyword-scout** 에이전트를 먼저 spawn해 후보 표를 보여주고 운영자 확정을 받는다.

## 대시보드 버튼 지시 (2026-09-11)
인자에 **"대시보드 지시"** 가 들어 있으면 운영자가 채팅 위젯의 "발행 지시" 버튼을 누른 것이다.
- 키워드로 `docs/ops/pipeline-queue.json` items에서 같은 `query`(공백 무시)를 찾아 그 항목의 `track·family·region·evidence·condition·variant·exposure`를 브리프로 쓴다. **`exposure.reasons`(어떤 빈틈을 노리는지: 자리 열림·위에 관공서 없음 등)를 post-writer 브리프 맨 앞에 넣어라** — 그 자리를 차지하는 것이 글의 목표다(1~3단계 전략 spawn은 생략, 큐가 이미 판정했다). 조건(공고 URL 확보 등)은 fact-checker 필수 확인 항목으로 넘긴다.
- 버튼 클릭이 곧 결재다. **6단계 GATE-D 질문을 생략**하고, 검증(팩트체크·shaper·품질·gatekeeper) 통과 시 발행한다. VETO·팩트 실패면 발행하지 않고 사유만 보고한다.
- **발행 시기·수량은 내가 조절한다(운영자 지시 2026-09-12: "내가 발행을 지시해도 넌 내 사이트의 네이버 신뢰도를 생각해서 발행 시기 발행 수를 조절해").** 버튼 클릭은 "이 글감을 쓰라"는 승인이지 "지금 당장 올리라"가 아니다. 발행 직전 그날 나간 건수를 세어라:
  - **전국 주제(T2·T3) 하루 1건.** 초과분은 작성·검증까지 마친 뒤 커밋하지 말고 초안으로 두고 "왜 오늘 안 내는지 · 언제 내는지"를 보고한다.
  - **지역 물결 글(T1)은 창(개시 D-7~D+8) 안이면 상한 없음.** 0400 자동 1건은 별도 트랙이라 세지 않는다.
  - 같은 날 발행분끼리 14자 shingle ≤15%, 제목 형태가 연속 3건 이상 같으면 하나를 미룬다.
  - 운영자가 "오늘 다 내"라고 다시 지시하면 따르되 위험을 한 문장으로 남긴다.
- 발행 후 큐 항목 `status`를 `published`·`statusAt`(오늘)·`publishedSlug`로 갱신하고 `node scripts/build-cluster-intents.mjs --append <파일>`로 잠금 장부에 편입한다.
- "보류:" 로 시작하는 메시지는 큐 항목 status를 `hold`로 바꾸고 끝낸다(이유를 묻지 않는다).

표준: `docs/ops/MANUAL-POSTING.md` (단일 진실 소스). 본 커맨드는 그 8단계를 에이전트 팀으로 실행한다.

## 실행 순서

### 0. 동기화 (필수 선행)
```bash
git fetch origin && git rebase origin/main
```
06KST 자동 cron이 main을 먼저 push하므로 rebase 없이 진행 금지 (메모리 룰).

### 1~3. 전략 (longtail-strategist spawn 1회)
- 키워드를 **longtail-strategist** 에이전트에 전달 → GATE-A 중복 / GATE-B 매칭 / 6축 롱테일 / 단발 vs 클러스터 판단을 한 번에 받는다
- GATE-A 중복 70%↑ 또는 GATE-B 0건이면 운영자 승인 질문 (AskUserQuestion)
- **GATE-C**: 롱테일 후보 표를 보여주고 angle 1개 확정 (urgency=high면 시기·마감축 + deadline-imminent-weekly 우선 추천)
- 클러스터 판정 시: spoke 수를 운영자에게 확인 → 이후 단계는 /sprint와 동일하게 병렬 처리

### 4. 작성 (post-writer spawn)
확정된 [키워드·angle·reportType·매칭 지원금 ID·오늘 KST 날짜·trendingTerm 여부]를 **post-writer**에 전달. 클러스터면 spoke 수만큼 **단일 메시지에서 병렬 spawn** (글당 점유 의도 1개씩 배정).

### 5. 검증 (병렬)
- **fact-checker** — 작성된 파일별 spawn (병렬)
- **google-quality-auditor** — 전체 파일 일괄 1회 spawn (병렬, 2026-08-28+ 필수 — 구조 지문·정보 이득·패딩 검사, `docs/ops/GOOGLE-NAVER-DUAL-STANDARD.md`)
- **quality-gate** — 전체 파일 일괄 1회 spawn
- FIX 판정 → 메인 루프가 직접 정정 후 재검증 (최대 2회). BLOCK → 운영자 보고 후 중단
- 마지막에 메인 루프가 직접: `npm run lint:content && npm run build` (실패 시 수정 재시도 2회)

### 6. GATE-D 발행 결재
운영자에게 [제목 / URL 예정 경로 / 팩트체크 판정 / 미확정 처리 항목] 요약 후 **"발행 / 수정 / 취소"** 질문. "발행" 전에는 절대 commit하지 않는다.

### 7. 발행
```bash
npm run sync:history
git add src/data/issues/ src/data/issues/_history.json today.md
git commit -m "feat(issues): {M/D} 수동 포스팅 — {제목 요지}"
git fetch origin && git rebase origin/main && git push
```

### 8. 후처리
```bash
npm run indexnow:ping
npm run update:today
git add today.md && git commit -m "chore(today): {M/D} 발행 반영 — today.md 갱신" && git push
```
운영자 1클릭 안내 출력:
- GSC 색인 요청: `https://search.google.com/search-console/inspect?resource_id=sc-domain:awoo.or.kr&url={발행 URL}`
- Naver Search Advisor 신규 URL 등록: `https://searchadvisor.naver.com/console/site/request/crawl`
- (Chrome MCP 연결 시) 운영자가 원하면 위 2건 색인 요청을 브라우저로 대행

## 보고 형식
```
✅ 발행 완료: {URL}
📊 팩트체크 {판정} · lint {err 0/warn N} · 매칭 지원금 {N}건
🔗 색인 요청 링크 2건 (위)
```
