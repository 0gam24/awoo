# Content SEO — Cycle #6

## 발견
- glossary `related[]` dangling 8건 확정 (entity-graph stats 30 entries 기준): `homeless→youth-housing`, `youth-housing-criteria→youth-housing`, `youth-leap-account→asset-formation`, `newlywed-special-supply→newlywed-housing-loan`, `basic-pension→senior-care`, `unemployment-benefit→social-insurance`, `smb-policy-loan→credit-recovery`, `young-farmer-settlement→rural-experience`. 현재 `[id].astro`는 dangling을 silent filter — UX 손실은 작지만 entity-graph crawl signal·내부링크 누수 8개.
- `/personas/[id].astro`는 `hubCategories`(≥2건 정렬) 이미 보유. 카드 grid는 출력 중이나 본문 H2 형태로의 카테고리 anchor는 없음 → AI 답변엔진 인용 가능한 "X 분야 N건" 헤딩이 비어 있음.
- `/situations/[id].astro` 동일 패턴 가능성 — top 3 카테고리 H2 미출력.
- `/issues/index.astro` rail 트렌딩은 이미 `topicHref` 활성화 — 단 topic page가 없는 term은 dead text. 정적 fallback `/subsidies/?q={term}` 링크화 필요.
- glossary `[id].astro`의 `relatedItems` 렌더는 이미 존재 — Cycle #5 P1 "다음 용어" nav는 사실상 구현됨. 본 축에서는 dangling 정정으로 노출 정상화만 필요.

## 제안
1. **[Data] glossary dangling 8건 정정** — `src/data/glossary.json` related[] 8개 reference를 의미 인접 기존 ID로 치환 (`youth-housing→youth-housing-criteria`, `asset-formation→youth-savings`, `newlywed-housing-loan→newlywed-special-supply`(자기참조 회피로 다른 항목), `senior-care→basic-pension`(역시 회피 — `low-income-support`로), `social-insurance→eitc`, `credit-recovery→startup-package`, `rural-experience→return-farming`). 매핑은 EXECUTE 단계에서 카테고리 일치도로 최종 결정.
2. **[Page] `/personas/[id]` 카테고리 H2** — `hubCategories` top 3을 본문 H2로 추가: `<h2>{p.label}이 자주 받는 {category} 지원금 {count}건</h2>` + 1줄 lead. 기존 hub-grid 카드 위 또는 `display` 헤딩 직전 삽입. Reader 가치: 분야별 빠른 jump.
3. **[Page] `/situations/[id]` 동일 패턴** — situation의 `byCategory` 집계(없으면 신설) top 3 H2.
4. **[Page] subsidy 본문 footer 카테고리 횡단 링크** — `<a href="/subsidies/?category={category}">비슷한 {category} 지원금 더 보기</a>` 1줄. 정적, JS X.
5. **[Page] issues/index 트렌딩 hint 정적 링크화** — `topicHref`가 null인 term을 `/subsidies/?q={term}` 링크로 fallback (현재 inert text → tappable). 본 변경은 rail 외 hero-sm은 이미 fallback 적용됨, rail만 미적용.

## 권장 P0
- **P0-1** 제안 1 (dangling 8건 정정) — entity-graph 신호 누수 직결, JSON 1파일 수정, 위험 0.
- **P0-2** 제안 2 (`/personas/[id]` top 3 카테고리 H2) — 페르소나 6건 × 분야 H2 ≈ 18 추가 헤딩, AI 인용·내부 anchor 양쪽 수확.
- **P0-3** 제안 5 (rail 트렌딩 hint 정적 링크) — 1파일·5줄 변경, dead text 즉시 살림.
- 제안 3·4는 P1: situation byCategory 신설 비용·subsidy 카드 footer 카피 검증 필요.
