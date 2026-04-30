# Cycle #3 PLAN — 산출물 인덱스 (2026-04-30, 세 번째 사이클)

11개 에이전트 병렬 소환. Cycle #2 OBSERVE 인풋 9건 주입 후 도출.

| # | 파일 | 에이전트 | 권장 P0 |
|---|---|---|---|
| 1 | [explore-regression.md](explore-regression.md) | Explore | duplicate_@id 5건 해소 (about/index orgSchema 제거 + BaseLayout Prop) + audit URL decode |
| 2 | [explore-entity-graph.md](explore-entity-graph.md) | Explore | entity-graph build script + reader 뼈대 (1단계) |
| 3 | [plan-architecture.md](plan-architecture.md) | Plan | 옵션 A entity-graph (Cycle #2 이월) |
| 4 | [general-tech-seo.md](general-tech-seo.md) | general-purpose | NewsArticle.publisher → `#organization` @id 참조 |
| 5 | [general-content-seo.md](general-content-seo.md) | general-purpose | topics.json 카테고리 공통 FAQ 5×3 + commonEligibility fallback + `<time datetime>` |
| 6 | [general-geo.md](general-geo.md) | general-purpose | subsidies/[id] BLUF 박스 + topics/[term] BlufBox |
| 7 | [general-cwv.md](general-cwv.md) | general-purpose | IncomeChecker React → vanilla + @astrojs/react 제거 (홈 -186KB) |
| 8 | [general-a11y-bp.md](general-a11y-bp.md) | general-purpose | focusTrap.ts + HotkeyNav 적용 (WCAG 2.4.3·2.4.11) |
| 9 | [security-review.md](security-review.md) | general-purpose | check-apply-urls 호스트 화이트리스트 + generate-issue-posts 입력 30KB 캡 |
| 10 | [review-regression.md](review-regression.md) | general-purpose | 6 hub `collectionSchema && ...` 가드 + null literal 검출 |
| 11 | [claude-api.md](claude-api.md) | claude-code-guide | system prompt cache_control: ephemeral |

## 다음 단계 → REVIEW
점수화 + 외부 의존 격리 + P0/P1/P2 분류 → `ops/reviews/2026-04-30-c3.md`
