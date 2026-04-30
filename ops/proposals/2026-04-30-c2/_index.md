# Cycle #2 PLAN — 산출물 인덱스 (2026-04-30, 두 번째 사이클)

11개 에이전트 병렬 소환 결과. Cycle #1 OBSERVE 인풋 주입 후 도출.

| # | 파일 | 에이전트 | 권장 P0 (한 줄) |
|---|---|---|---|
| 1 | [explore-orphans.md](explore-orphans.md) | Explore | Footer 카테고리 링크 (고립 7건 즉시 해소) |
| 2 | [explore-trending-hub.md](explore-trending-hub.md) | Explore | 토픽 페이지 하단 "다른 토픽 보기" nav 8개 |
| 3 | [plan-architecture.md](plan-architecture.md) | Plan | entity-graph 정적 인덱서 (옵션 C, 라우트 0 / Cycle #1 보류 4건 중 3건 해소) |
| 4 | [general-tech-seo.md](general-tech-seo.md) | general-purpose | sitemap filter `/issues/main/` + GovService.isBasedOn (119건 일괄) |
| 5 | [general-content-seo.md](general-content-seo.md) | general-purpose | subsidy FAQ + rejectionReasons + FAQPage schema (topic 매칭) |
| 6 | [general-geo.md](general-geo.md) | general-purpose | glossary [id] BlufBox + topics/[term] BlufBox + llms-full subsidies 본문 확장 |
| 7 | [general-cwv.md](general-cwv.md) | general-purpose | vitals requestIdleCallback 디퍼 + 무한 keyframe contain (모바일 Perf 96→100) |
| 8 | [general-a11y-bp.md](general-a11y-bp.md) | general-purpose | HotkeyNav focus trap (WCAG 2.4.3·2.4.11) |
| 9 | [security-review.md](security-review.md) | general-purpose | check-apply-urls 호스트 화이트리스트 + generate-issue-posts 입력 30KB 캡 |
| 10 | [review-regression.md](review-regression.md) | general-purpose | sitemap matrix 테스트 + issues/main 410 + JSON-LD @id 중복 가드 |
| 11 | [claude-api.md](claude-api.md) | claude-code-guide | Claude API system prompt cache_control: ephemeral |
| (보너스) | [audit-tools.md](audit-tools.md) | general-purpose | keyword-coverage CATEGORIES `label` → `name` 1줄 hotfix |

## 다음 단계 → REVIEW
점수화 + 외부 의존 격리 + P0/P1/P2 분류 → `ops/reviews/2026-04-30-c2.md`
