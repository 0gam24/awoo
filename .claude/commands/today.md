---
description: 오늘 포스팅 데일리 루틴 — 사용자가 "오늘 포스팅"이라고 말하면 발동. /traffic 점검 → 키워드 발굴 → /post 또는 /sprint 발행까지 3개 커맨드를 한 흐름으로 모두 실행한다.
argument-hint: "(선택) 키워드 또는 N건 — 비우면 scout 추천"
---

# /today — "오늘 포스팅" 원커맨드

트리거: `/today` 또는 사용자가 **"오늘 포스팅"**(유사 표현: "오늘 글", "오늘 발행")이라고 말할 때.
역할: /traffic → keyword-scout → /post 또는 /sprint 를 **순서대로 전부 실행**하는 오케스트레이터. 각 단계의 상세 절차는 해당 커맨드 파일이 단일 진실 소스다 — 여기서 중복 정의하지 않는다.

## 실행 순서 (멈추지 말고 끝까지)

### PHASE 0 — 동기화
```bash
git fetch origin && git rebase origin/main
```

### PHASE 1 — 점검 (/traffic 실행)
Skill 도구로 `traffic` 호출, args: `"갱신·색인 점검 우선 — 내일 추천(scout)은 생략, PHASE 2가 수행"`
핵심 산출: ① 최근 발행 색인 여부 표본 ② **freshness 갱신 후보** (확정 발표가 난 "발표 대기" 글 — 있으면 오늘 가장 빠른 트래픽).

### PHASE 2 — 발굴 (keyword-scout spawn)
`$ARGUMENTS`에 키워드가 있으면 생략. 없으면 **keyword-scout** 에이전트 spawn → 오늘 후보 5~8개 스코어 표.

### PHASE 3 — 운영자 결정 (하루 1회 질문)
AskUserQuestion 1회로 통합 결정:
- **"추천 1건 발행"** (scout 1순위 → /post 흐름) — 기본 추천
- **"스프린트 3건"** (상위 3개 → /sprint 흐름)
- **"갱신만"** (PHASE 1 갱신 후보만 처리)
- 직접 키워드 입력(Other)
갱신 후보가 있으면 어떤 선택이든 **갱신을 함께 처리**할지 같은 질문에 포함.

### PHASE 4 — 발행 (/post 또는 /sprint 실행)
- 1건 → Skill 도구로 `post` 호출, args: 확정 키워드(+hint). PHASE 0·scout는 이미 끝났으므로 중복 수행 생략을 args에 명시.
- 2건 이상 → Skill 도구로 `sprint` 호출, args: 확정 키워드 쉼표 목록.
- 갱신 건 → 해당 JSON 수치 교체 + dateModified 갱신 + fact-checker 검증 → GATE-D 결재에 포함.
- 각 커맨드의 GATE-C/GATE-D·검증·발행·후처리(indexnow·update:today·색인 링크)는 그대로 따른다.

### PHASE 5 — 마무리 리포트
```
✅ 오늘 포스팅 완료 — 신규 {N}건 발행 / 갱신 {M}건
📊 {글별: 제목 — 팩트체크 — URL}
🔗 색인 요청 링크 (GSC·Naver, 전건)
📅 내일 1순위 후보: {scout 차순위 키워드 — 근거}
```

## 규칙
- 운영자 입력은 **PHASE 3 결정 1회 + GATE-D 발행 결재 1회**, 총 2회를 넘기지 않는다 (게이트 위반 경고 시 예외).
- 어떤 PHASE도 건너뛰어 보고로 끝내지 않는다 — PHASE 4 발행 결재까지 반드시 도달.
- 발행 0건으로 끝나는 경우는 운영자가 명시적으로 "취소"했을 때뿐.
