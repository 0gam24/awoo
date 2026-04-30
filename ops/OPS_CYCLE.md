---
phase: PLAN
cycle_no: 12
last_completed: EXECUTE
last_completed_at: "2026-04-30 23:30:00"
next_command: /cycle
trigger: manual+autonomous
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

| Cycle | 일자 | PLAN | REVIEW | EXECUTE | OPERATE | OBSERVE |
|---|---|---|---|---|---|---|
| #1 | 2026-04-30 | 11 에이전트 / 11 proposals | P0 8건 / 외부격리 0건 | 8 P0 모두 구현 (브랜치 cycle/1-2026-04-30) | audit 4종 — schema 810블록·llms-full 169KB·keyword threshold 통과 | 회귀 0건 / 다음 PLAN 인풋 5건 |
| #2 | 2026-04-30 | 11+1 에이전트 / 12 proposals | P0 8건 / 외부격리 0건 | 8 P0 + 타입 fix (브랜치 cycle/2-2026-04-30) | audit 4종 — 내부 링크 +31% / FAQPage 5→80 / categories 0→8 | 회귀 0건 / 다음 PLAN 인풋 9건 |
| #3 | 2026-04-30 | 11 에이전트 / 11 proposals | P0 8건 / 외부격리 0건 | 8 P0 (브랜치 cycle/3-2026-04-30) | duplicate_@id 5→0 / FAQPage 80→124 / 고립 audit 31→4 / categories score 0→13 | 회귀 0건 / 다음 PLAN 인풋 11건 |
| #4 | 2026-04-30 | 11 에이전트 / 11 proposals | P0 8건 / 외부격리 0건 | 8 P0 (브랜치 cycle/4-2026-04-30) | audit 5종 (heading 신규 218 페이지 위반 0) / GovService dateModified 119 / BreadcrumbList @id 210 / 홈 23.1→22.6KB | 회귀 0건 / 다음 PLAN 인풋 10건 |
| #5 | 2026-04-30 | 11 에이전트 / 11 proposals | P0 8건 / 외부격리 0건 | 6 P0 (P0-2·5 Cycle #6 이월, 브랜치 cycle/5-2026-04-30) | audit 7종 (skip-link·rss 신규) / entity-graph 169 entity / HowTo·WebApp·AboutPage·Article 신규 4 schema | 회귀 0건 / 다음 PLAN 인풋 10건 |
| #6 | 2026-04-30 | 11 에이전트 / 11 proposals | P0 8건 / 외부격리 0건 | 7 P0 (P0-6 Cycle #7 이월, 브랜치 cycle/6-2026-04-30) | inline-glossary 첫 가동·dangling 8→0·NewsArticle audience+mentions·persona H2 18건·llms-full categories 확장 | 회귀 1건 (.data 이중 접근) 즉시 수정 / 다음 PLAN 인풋 10건 |
| #7 | 2026-04-30 | 사용자 즉시 요청 5건 + 트렌딩 동작 고급화 | P0 9건 (사용자 명시 5 + 트렌딩 4) | 9 P0 (브랜치 cycle/7-2026-04-30): Footer/이메일/FeedbackWidget 카운트/POSTS_PER_DAY=1/dead text/3-tier 사이드바/매체수 정렬/원문 보도 섹션/7일 dedup | audit suite 0 violations | 회귀 0건 |
| #8 | 2026-04-30 | 5 에이전트 진단 후속 | P0 8건 | 8 P0 (브랜치 cycle/8-2026-04-30): /quick UI 고급화·contact ADMIN_EMAIL fix·CollectionPage·TS 67→26·document.title 동적·mediaCount 헤드라인 | audit·biome 통과 | 회귀 0건 |
| #9 | 2026-04-30 | 영구 포스트 관리 정책 + 1:1 매핑 | P0 5건 | 5 Step (브랜치 cycle/9-2026-04-30): NewsHero 영구 포스트 row·/issues/all/·archive 진입점·sync-issues.yml 자동화·thinness 완화 totalCount≥1·matchedSubsidiesByTerm | audit 218 페이지 통과 | 회귀 0건 |
| #9b | 2026-04-30 | biome lint 정리 (CI 빨간불 해소) | 자동 fix 162파일 + 수동 8건 | (cycle/9-biome-fix-2026-04-30) focusTrap·feed-issues·sync-issues·indexnow·lint-content·inline-markdown | biome 0 errors | — |
| #10 | 2026-04-30 | 5 에이전트 프론트엔드 점검 | P0 14건 | 14 P0-P2 (브랜치 cycle/10-2026-04-30): sync-issues secrets fix·NewsHero 다크모드·.tint-* 토큰화·/quick CLS 예약·:focus-visible·step focus·form aria·정책 description·gap 16·aria-pressed·recent-posts CLS·schema cap | 218 페이지·biome 0 | 회귀 0건 |
| #11 | 2026-04-30 | SEO/GEO + 코드 위생 | P0 8건 | 8 P0-P2 (브랜치 cycle/11-2026-04-30): NewsArticle wordCount·보너스 포스팅 정책·TS 27→0·/issues/all 페이지네이션·매칭 점수 배지·sitemap lastmod | TS 0 / biome 0 / sitemap 영구 포스트 lastmod 정상 | 회귀 0건 |
| #12 | 2026-04-30 | 회귀 정리 + 자동화 강화 | P0 6건 | 6 P0-P2 (브랜치 cycle/12-2026-04-30): astro.config TS·PAGE_SIZE·entity-graph biome ignore·lhci 7페이지 확장·web-vitals runbook·sync-issues IndexNow ping·/preferences·entity 양방향 검증 | TS 0 / biome 0 | 회귀 0건 |

## 안전장치

- **EXECUTE phase는 항상 새 브랜치** `cycle/{cycle_no}-{date}` — main 직접 커밋 금지
- **푸시는 사용자가 "푸쉬" 명시 시에만** (메모리 룰: feedback_git_workflow)
- **REVIEW phase는 외부의존 키워드 필터** 통과 후에만 EXECUTE 진입 (`backlog-external.md` 키워드 사전)
- 모든 phase 결과는 `ops/` 안에 git-tracked 파일로 남김 → diff로 검토 가능
