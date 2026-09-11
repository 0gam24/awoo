---
description: 운영 대시보드 — 최신 데이터를 받아 다시 뽑고 오른쪽 브라우저 창에 띄운다 (공개 사이트와 무관, 로컬 전용)
---

# /dashboard — 운영 대시보드 열기

운영자가 "대시보드", "/dashboard", "운영 현황 보여줘"라고 하면 실행한다. 새 브라우저를 열지 않고 **이 앱의 오른쪽 브라우저 창**에 띄운다.

## 순서 (전부 실행, 질문하지 않는다)

1. **최신 데이터 받기.** 봇(순위 측정 09:40·파이프라인 09:55·레이더·0400)이 커밋한 파일을 가져온다. 로컬에 커밋 안 한 변경이 있으면 pull을 건너뛰고 그 사실만 보고한다.
   ```bash
   git pull --ff-only origin main
   ```
2. **다시 뽑기.**
   ```bash
   npm run ops:dashboard
   ```
   출력 마지막 줄(크기·섹션 수·기준일·생성 시각)을 확인한다. 기준일이 오늘(KST)이 아니면 실패로 본다.
3. **오른쪽 창에 띄우기.** `mcp__Claude_Browser__preview_start`를 `name: "ops-dashboard"`로 호출한다(이미 켜져 있으면 재사용된다). "Port 4322 is in use by python3.11.exe (PID N)"이 나오면 지난 세션이 남긴 우리 서버다 — `Get-CimInstance Win32_Process -Filter "ProcessId = N"`으로 명령줄이 `http.server 4322 -d docs/ops`인지 확인한 뒤 `taskkill //PID N //F`로 끝내고 다시 preview_start 한다(2026-09-11 실측). 그 다음 `tabs_context`로 탭 id를 확인하고 `navigate`로 `http://localhost:4322/dashboard.html?v=<생성시각>`을 연다. **쿼리 문자열을 매번 바꿔라** — python http.server는 캐시 헤더가 없어 같은 주소로 다시 열면 어제 파일이 그대로 보인다(실측: 제목이 전날 날짜로 남음).
4. **확인.** `read_page`나 `find`로 "오늘 할 일" 제목이 있는지 확인한다. 스크린샷은 필요할 때만.
5. **보고.** 채팅에는 대시보드의 "오늘 할 일" 줄들만 그대로 옮기고, 새 키워드·글감·순위는 "오른쪽 창 참고"로 끝낸다. 숫자를 다시 나열하지 않는다.
6. **클릭 지시 위젯.** `node scripts/ops-widget.mjs`의 출력(HTML 조각)을 그대로 `mcp__visualize__show_widget`(title `today_post_picks`)로 채팅에 띄운다(먼저 `mcp__visualize__read_me` modules `["interactive"]` 호출). 버튼 "발행 지시 ↗"를 누르면 `/post <쿼리> — 대시보드 지시…`가 채팅에 들어오고, `/post` 커맨드의 "대시보드 버튼 지시" 절차로 결재 없이 작성·검증·발행한다. "보류"는 큐 status hold.

## 금지

- 새 브라우저 창·외부 URL·아티팩트로 열지 않는다. 운영자 지시: "웹을 새로 열지 말고 오른쪽 클로드 코드 내부에 띄워서".
- `docs/ops/dashboard.html`은 gitignore 대상이다. 커밋하지 않는다.
- pull 외의 git 조작(commit·push·reset)은 하지 않는다.

## 참고

- 생성기 `scripts/ops-dashboard.mjs`, 서버 프리셋 `.claude/launch.json`의 `ops-dashboard`(python http.server 4322, docs/ops, 127.0.0.1).
- D-day·"오늘"은 생성 시각에 고정된다. 하루 지난 파일은 헤더가 경고한다 — 그러면 2번부터 다시.
- 섹션 설명과 함정 주석은 화면 안에 있다. 자세한 설계는 `docs/ops/KEYWORD-PLAN-2026-09-10.md`와 메모리 `ops-dashboard-local`.

## "실측:" 메시지 처리 (2026-09-11)
위젯의 "실측 ↗" 버튼은 `실측: "<쿼리>" — 검색 결과를 재고 큐를 갱신해 목록을 다시 보여줘` 를 보낸다. 그러면:
```bash
node scripts/keyword-pipeline.mjs --scout="<쿼리>"
```
(옵션이 아직 없으면 `node scripts/naver-rank-check.mjs --mode=scout --query="<쿼리>"`로 재고, 그 결과를 근거로 큐를 다시 만든다: `node scripts/keyword-pipeline.mjs --serp`.)
그다음 3~6단계를 다시 해서 대시보드·위젯을 갱신해 보여준다. 위젯 정렬은 **노출 가능성(exposure) 내림차순**이고, 점수가 없는 항목은 아래 "실측 대기"로 모인다.
