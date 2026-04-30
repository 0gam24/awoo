# Cycle #5 PLAN — 산출물 인덱스 (2026-04-30, 다섯 번째 사이클)

11개 에이전트 병렬 소환. Cycle #4 OBSERVE 인풋 10건 흡수.

| # | 파일 | 에이전트 | 권장 P0 |
|---|---|---|---|
| 1 | [explore-entity-graph.md](explore-entity-graph.md) | Explore | build-entity-graph.mjs + entity-graph.json + schema-validate dangling @id 가드 |
| 2 | [explore-incomecheck-vanilla.md](explore-incomecheck-vanilla.md) | Explore | IncomeChecker React → vanilla + react·@astrojs/react 의존성 제거 |
| 3 | [plan-architecture.md](plan-architecture.md) | Plan | 옵션 A 4사이클 보류 묶음 청산 (entity-graph + inline-glossary + IncomeChecker vanilla) |
| 4 | [general-tech-seo.md](general-tech-seo.md) | general-purpose | /guide HowTo schema + /quick WebApplication schema |
| 5 | [general-content-seo.md](general-content-seo.md) | general-purpose | inline-glossary anchor (단독 진행) + issues 트렌딩 hint + persona/situation 카테고리 H2 |
| 6 | [general-geo.md](general-geo.md) | general-purpose | llms.txt 카테고리·상황·용어집 인덱스 + /about AboutPage + /editorial-policy Article schema |
| 7 | [general-cwv.md](general-cwv.md) | general-purpose | /subsidies/ 카드 data-attr JSON 통합 (-18KB) + lighthouserc INP error 승격 |
| 8 | [general-a11y-bp.md](general-a11y-bp.md) | general-purpose | audit-skip-link.mjs + prefers-contrast: more + heading audit strict 전환 |
| 9 | [security-review.md](security-review.md) | general-purpose | Claude API 재시도 backoff + _fail 7일 누적 알림 + .gitignore 보강 |
| 10 | [review-regression.md](review-regression.md) | general-purpose | feed-issues.xml RSS lint audit + JSDoc 명시 |
| 11 | [claude-api.md](claude-api.md) | claude-code-guide | 정적 컨텍스트 추가 cache 블록 (+500 토큰 캐시) |

## 다음 단계 → REVIEW
점수화 + 외부 의존 격리 + P0/P1/P2 분류 → `ops/reviews/2026-04-30-c5.md`
