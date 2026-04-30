# Cycle #1 PLAN — 산출물 인덱스 (2026-04-30)

11개 에이전트 병렬 소환 결과. 각 에이전트 독립 작성 후 본 인덱스로 합성 시드.

| # | 파일 | 에이전트 | 권장 P0 (한 줄) |
|---|---|---|---|
| 1 | [explore-ia.md](explore-ia.md) | Explore | 트렌딩 토픽 hub 승격 + /quick/ 결과 hub 강화 |
| 2 | [explore-seo.md](explore-seo.md) | Explore | 모든 hub에 BreadcrumbList + BaseLayout Org/WebSite schema 사이트와이드 |
| 3 | [plan-architecture.md](plan-architecture.md) | Plan | entity-graph (glossary↔topic↔subsidy 정적 인덱서, 라우트 0 추가) |
| 4 | [general-tech-seo.md](general-tech-seo.md) | general-purpose | Org+WebSite JSON-LD 사이트와이드 + sitemap priority/changefreq 차등화 |
| 5 | [general-content-seo.md](general-content-seo.md) | general-purpose | subsidy FAQ+rejectionReasons H2/FAQPage + glossary 자동 인라인 + persona/situation H1·H2 키워드 |
| 6 | [general-geo.md](general-geo.md) | general-purpose | 모든 hub hero 직하 BLUF 박스 + llms-full.txt에 issues 본문 sections·tldr·faq 합본 |
| 7 | [general-cwv.md](general-cwv.md) | general-purpose | inlineStylesheets 'auto' + 번들 size guard postbuild |
| 8 | [general-a11y-bp.md](general-a11y-bp.md) | general-purpose | HotkeyNav modal focus trap + CSP report-only 자가관측 |
| 9 | [security-review.md](security-review.md) | general-purpose | check-apply-urls 호스트 화이트리스트 (정부 TLD) |
| 10 | [review-regression.md](review-regression.md) | general-purpose | issues/index `.cat-*` 토큰 중복 제거 + BreadcrumbList 단일화 |
| 11 | [claude-api.md](claude-api.md) | claude-code-guide | Claude API prompt caching 도입 (system + 정적 맥락 cache_control, 토큰 35% 절감) |

## 다음 단계 → REVIEW
- 각 P0를 점수화 (트래픽 효과 × 구현 용이도 ÷ 회귀 위험)
- 외부 의존 키워드 정규식 매칭 → 격리
- 합산 후 본 사이클 EXECUTE 대상 선별 → `ops/reviews/2026-04-30.md`
