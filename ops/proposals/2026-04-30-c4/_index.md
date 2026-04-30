# Cycle #4 PLAN — 산출물 인덱스 (2026-04-30, 네 번째 사이클)

11개 에이전트 병렬 소환. Cycle #3 OBSERVE 인풋 11건 주입.

| # | 파일 | 에이전트 | 권장 P0 |
|---|---|---|---|
| 1 | [explore-entity-graph.md](explore-entity-graph.md) | Explore | build-entity-graph.mjs + schema-validate dangling @id 가드 |
| 2 | [explore-incomecheck-vanilla.md](explore-incomecheck-vanilla.md) | Explore | IncomeChecker React → vanilla + @astrojs/react 제거 (-186KB) |
| 3 | [plan-architecture.md](plan-architecture.md) | Plan | 옵션 A entity-graph 권장 |
| 4 | [general-tech-seo.md](general-tech-seo.md) | general-purpose | buildBreadcrumb @id opt-in + RSS dc:creator/atom:updated |
| 5 | [general-content-seo.md](general-content-seo.md) | general-purpose | `<time datetime>` + GovService.dateModified + 카테고리 자동 H2 |
| 6 | [general-geo.md](general-geo.md) | general-purpose | /quick + /guide BlufBox + llms-full subsidies coreFacts |
| 7 | [general-cwv.md](general-cwv.md) | general-purpose | /quick compactSubsidies `summary` 필드 제거 (-16KB) |
| 8 | [general-a11y-bp.md](general-a11y-bp.md) | general-purpose | focusTrap.ts + HotkeyNav 적용 + audit-headings.mjs postbuild 게이트 |
| 9 | [security-review.md](security-review.md) | general-purpose | _history.json factCheckFails + cycle-runner OBSERVE 7일 합계 알림 |
| 10 | [review-regression.md](review-regression.md) | general-purpose | category enum + BLUF null 가드 + hostname 정규화 + Claude cache log |
| 11 | [claude-api.md](claude-api.md) | claude-code-guide | `_cache-{date}.json` 영속 로깅 |

## 다음 단계 → REVIEW
점수화 + 외부 의존 격리 + P0/P1/P2 분류 → `ops/reviews/2026-04-30-c4.md`
