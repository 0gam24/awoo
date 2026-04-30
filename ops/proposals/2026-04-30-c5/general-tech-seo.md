# Technical SEO — Cycle #5

## 발견
- `src/pages/guide.astro`: `steps[]` 4단계 (n·t·d) + `channels[]` 6개 공식 채널(정부24·복지로·고용24·마이홈·K-스타트업·서민금융진흥원) + FAQPage schema 이미 존재. HowTo schema는 미적용.
- `src/pages/quick/index.astro`: `STEP_LABELS` 4단계 인터랙티브 진단, `subsidies.length`건 매칭, 결과는 클라이언트 100% 계산(서버 전송 X). schema 자체가 부재.
- `src/lib/schema.ts`: Organization·WebSite·Breadcrumb·CollectionPage 빌더 보유, HowTo·WebApplication 빌더 미존재. `@id` 앵커 패턴 일관 적용 중.
- 기존 FAQPage는 별도 `<script type="application/ld+json">` 분리 방식 — `@graph` 합본보다 페이지별 단순성 유지.

## 제안
1. **`buildHowTo()` 빌더 추가** + /guide 적용 — `name`, `totalTime: PT5M`, `step[]` (HowToStep with `position`·`name`·`text`·`url: #step-N`), `tool[]` 6채널 (HowToTool with `name`·`requiredQuantity` 생략, 외부 URL은 `sameAs`).
2. **`buildWebApplication()` 빌더 추가** + /quick 적용 — `applicationCategory: 'GovernmentApplication'`, `operatingSystem: 'Web'`, `browserRequirements: 'JavaScript'`, `featureList: ['페르소나 매칭','소득 구간 자동 계산','URL 해시 결과 공유','개인정보 저장 0']`, `offers: { '@type':'Offer', price: 0, priceCurrency: 'KRW' }`, `isAccessibleForFree: true`.
3. **glossary index DefinedTermSet `@id` 강화** — 현재 inDefinedTermSet 참조 대상 set 자체에 `@id: ${SITE_URL}/glossary/#termset` 부여하여 Knowledge Graph 연결 안정성 확보.
4. **subsidies/[id] `mainEntityOfPage`** — GovService schema에 `mainEntityOfPage: { '@type':'WebPage', '@id': canonical }` 추가 — Google rich result에서 page-entity 매핑 명시화.

## 권장 P0
- **P0-1 /guide HowTo schema** (영향: 대형 — guide는 entry 페이지·검색어 "지원금 신청 방법" 직접 매칭, HowTo rich result 노출 가능)
- **P0-2 /quick WebApplication schema** (영향: 중대 — 사이트 차별점인 인터랙티브 도구를 검색엔진/AI에 명시적 entity로 선언)
- P1-1 subsidies/[id] mainEntityOfPage (안정성 보강 — 즉시 노출 효과보다 중장기 신뢰도)
- P1-2 glossary DefinedTermSet @id (entity 그래프 보강)
