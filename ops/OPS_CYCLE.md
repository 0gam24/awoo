---
phase: PLAN
cycle_no: 1
last_completed: null
last_completed_at: null
next_command: /cycle
trigger: manual ("사이클" 입력 시)
goal: SEO/GEO 트래픽 성장 (외부 의존·유료 항목은 backlog-external.md로 격리)
---

# 운영 사이클 — 단일 진실 소스

본 파일은 **현재 phase**와 **다음 명령**의 단일 진실 소스다. 사용자가 "사이클" 또는 `/cycle`을 입력하면 Claude가 본 파일을 읽고 다음 phase를 실행한 뒤 갱신한다.

## Phase 정의

| Phase | 의미 | 산출물 |
|---|---|---|
| **PLAN** | 모든 에이전트 소환 → 고급화 제안 도출 | `ops/proposals/{date}/{agent}.md` |
| **REVIEW** | 제안 합성, 외부의존/유료 격리, P0/P1/P2 분류 | `ops/reviews/{date}.md` |
| **EXECUTE** | 승인 P0 구현 (브랜치 생성, 검증 게이트, 푸시 X) | `ops/execute-log/{date}.md` + 커밋 |
| **OPERATE** | 기존 cron + 신규 운영 스크립트 가동 | `ops/observations/{date}.md` (1부) |
| **OBSERVE** | 내부 지표 수집·회귀 점검 → 다음 PLAN 인풋 | `ops/observations/{date}.md` (2부) |

## Phase 진행 순서

```
PLAN → REVIEW → EXECUTE → OPERATE → OBSERVE → (PLAN 재진입, cycle_no +1)
```

## 진실 소스 갱신 규칙

매 phase 종료 시 Claude는:

1. 본 파일 frontmatter의 `phase`를 다음 단계로 갱신
2. `last_completed`, `last_completed_at` 채움
3. `cycle_no`는 OBSERVE → PLAN 전이 시점에만 +1
4. `next_command`는 항상 `/cycle` (단일 진입점)

## 사이클 이력

| Cycle | PLAN | REVIEW | EXECUTE | OPERATE | OBSERVE |
|---|---|---|---|---|---|

## 안전장치

- **EXECUTE phase는 항상 새 브랜치** `cycle/{cycle_no}-{date}` — main 직접 커밋 금지
- **푸시는 사용자가 "푸쉬" 명시 시에만** (메모리 룰: feedback_git_workflow)
- **REVIEW phase는 외부의존 키워드 필터** 통과 후에만 EXECUTE 진입 (`backlog-external.md` 키워드 사전)
- 모든 phase 결과는 `ops/` 안에 git-tracked 파일로 남김 → diff로 검토 가능
