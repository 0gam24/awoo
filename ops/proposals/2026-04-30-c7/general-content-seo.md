# Content SEO — Cycle #7

## 발견
- `subsidies/[id].astro` eligibility/benefits는 `<span>{e}</span>` 평문 렌더 — Cycle #6 P0-1 inline-glossary가 topics에만 적용되어, 정작 가장 트래픽이 많은 detail 페이지 본문 평문이 용어집·내부링크 신호를 못 받음.
- 동 파일 `related`는 같은 `category` 3건만 노출, alsoSeen은 다른 카테고리 페르소나 교집합 — 같은 카테고리 4건 이상일 때 "더 보기" 출구가 없어 카테고리 허브로의 PageRank 흐름 누락.
- `situations/[id].astro`는 BlufBox 통계로만 카테고리 분포를 노출 — top 카테고리 H2 섹션이 없어 long-tail 키워드 (`{상황} {카테고리}`) 미장착.
- `glossary/[id].astro` related[]는 카드 nav로 노출되나 본문 끝 H2 "다음 용어" 명시 섹션이 없어 GEO 인용 시 "관련 용어" 신호가 약함.

## 제안
1. **subsidies/[id] eligibility/benefits inline-glossary 적용** — `renderInlineMarkdown` + glossary 후처리 경유, `<span set:html={...}>`로 교체. topics와 동일한 단어 사전 재사용 (Cycle #6 자산).
2. **subsidy 본문 footer "비슷한 {category} 더 보기" 정적 링크** — alsoSeen 섹션 이후 `<p class="more-link"><a href="/categories/{category}/">비슷한 {category} 지원금 모두 보기 →</a></p>` 1줄. 카테고리 허브 internal link 강화.
3. **/situations/[id] top 3 카테고리 H2** — `byCategory` 집계 후 상위 3건을 "{상황}에서 자주 찾는 {카테고리} 지원금" H2 + 카드 3개. persona top H2와 동일 마크업 재사용.
4. **glossary "다음 용어" H2 명시 섹션** — related[] 카드를 본문 끝 `<h2>이 용어 다음으로 자주 찾는 용어</h2>` 블록으로 wrapping. 기존 explore 카드 이동 X, 단순 H2 + 안내 카피 추가.

## 권장 P0
**제안 1 (subsidies/[id] inline-glossary 본문 적용)** — 트래픽 1순위 페이지의 최대 본문 영역(eligibility/benefits)이 글로서리 인덱스에 미진입 상태. Cycle #6에서 만든 후처리 함수 재사용만으로 detail 페이지 전체 내부링크 밀도가 즉시 상승, GEO 인용 신호 + 글로서리 페이지 PV 동시 부양. 위험 0 (단방향 추가, schema 영향 없음).
