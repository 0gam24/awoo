# Cycle #6 PLAN — 산출물 인덱스 (2026-04-30, 여섯 번째 사이클)

11개 에이전트 병렬 소환. Cycle #5 OBSERVE 인풋 10건 흡수.

| # | 파일 | 에이전트 | 권장 P0 |
|---|---|---|---|
| 1 | [explore-inline-glossary.md](explore-inline-glossary.md) | Explore | inline-glossary anchor 본격 (entity-graph 첫 활용, 빌드타임 변환) |
| 2 | [explore-incomecheck-vanilla.md](explore-incomecheck-vanilla.md) | Explore | IncomeChecker React → vanilla (3사이클 보류, 단독 PR) |
| 3 | [plan-architecture.md](plan-architecture.md) | Plan | 옵션 A entity-graph 첫 활용 묶음 |
| 4 | [general-tech-seo.md](general-tech-seo.md) | general-purpose | GovService.mainEntityOfPage + DefinedTerm.inDefinedTermSet |
| 5 | [general-content-seo.md](general-content-seo.md) | general-purpose | glossary dangling 8건 정정 + persona 카테고리 H2 + issues rail 정적 링크 |
| 6 | [general-geo.md](general-geo.md) | general-purpose | llms-full categories 섹션 확장 + issues NewsArticle.audience+mentions |
| 7 | [general-cwv.md](general-cwv.md) | general-purpose | /subsidies data-attr JSON 통합 + lighthouserc INP/FID error 승격 |
| 8 | [general-a11y-bp.md](general-a11y-bp.md) | general-purpose | /quick stepper aria-current + 폼 required·aria-describedby |
| 9 | [security-review.md](security-review.md) | general-purpose | /api/vitals IP 해시 rate limit (rate-limit 모듈 재사용) |
| 10 | [review-regression.md](review-regression.md) | general-purpose | entity-graph generated_at git 노이즈 제거 + applicationCategory 표준 enum + prefers-contrast 분기 |
| 11 | [claude-api.md](claude-api.md) | claude-code-guide | 재시도 metric + duration_ms 영속 로깅 |

## 다음 단계 → REVIEW
점수화 + 외부 의존 격리 + P0/P1/P2 분류 → `ops/reviews/2026-04-30-c6.md`
