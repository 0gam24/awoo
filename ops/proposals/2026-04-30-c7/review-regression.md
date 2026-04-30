# 회귀 점검 — Cycle #7

## 회귀 위험 지점

1. **inline-glossary 정규식 (P0-1)** — `<` `>` 인덱스 비교로 태그 속성 안 회피하나, **escape 안 된 입력**이 들어오면 부등식이 깨짐 (예: 텍스트에 `>` 단독 등장). 또 `escapeRegex`만 적용하고 **단어 경계(\b)** 미사용 → 한글에는 OK지만 영문 synonyms("EITC" 같은) 부분일치 취약.
2. **issues rail 정적 fallback (P0-5)** — `/subsidies/?q={term}` 링크는 만들었으나 `subsidies/index.astro` (1~80행)에 **q 파라미터 처리 코드 없음**. 클릭하면 `?q=청년월세` 가 그냥 무시되어 전체 목록만 보임 → **링크 약속 위반**.
3. **glossary dangling 정정 8건 (P0-2)** — 카테고리 일치만 본 치환. 의미 검증 1건 의심: `unemployment-benefit → training-card` (실업급여와 국민내일배움카드는 인접하지만 1:1 맥락 아님), `young-farmer-settlement: rural-experience 제거` 후 1개만 남아 related rail 빈약.
4. **prefers-contrast: more 분기 (P0-8)** — `:root[data-theme='light']` + `@media (prefers-color-scheme: light) :root:not([data-theme='dark'])` 가 라이트 사용자 명시 시 **이중 매치** → 동일 값이라 시각적 무해하나 cascade 중복.
5. **persona top 3 H2 (P0-5)** — `hubCategories.slice(0,3).length > 0` 가드 OK. `HUB_MIN` 미달 페르소나는 H2 자체가 사라져 BLUF 아래 점프 — 디자인 의도 확인 필요.
6. **GovService @id 119건 (P0-3)** — Rich Result Test 실측 미수행. `@id` URL 충돌(중복 발급) 리스크는 빌드시점 dedupe 누락 시 발생.
7. **NewsArticle .data 이중 접근 (P0-4 후속 fix)** — 즉시 수정됐으나 동일 패턴의 **다른 prerender 라우트**(예: `/issues/[slug]`, RSS)에 재발 잠복 가능.

## 검증·보강 제안

- **q 파라미터**: `index.astro` 클라이언트 JS에 `URLSearchParams` 읽어 검색 input에 prefill + 카드 필터 1줄 추가. 또는 fallback 링크를 `/subsidies/#q-{term}` 앵커로 교체 후 동일 처리.
- **inline-glossary**: 영문 token에만 `(?<![A-Za-z])token(?![A-Za-z])` 단어 경계 적용. `>` 단독 텍스트 input은 호출부에서 escape 강제(주석 명시).
- **glossary 의미 검증**: `unemployment-benefit` related에 `social-insurance` 복원 검토, `young-farmer-settlement` 에 `rural-experience` 대신 `smb-policy-loan` 등 자금 축으로 보강.
- **GovService schema**: 1회만 schema-validate.mjs 로 `@id` 중복 카운트 추가.
- **prefers-contrast**: 중복 매치 단순화 — `:root[data-theme='light'], :root:not([data-theme])` 한 selector 로 통합.
- **NewsArticle 패턴 회귀**: `entry.data.data` 같은 이중 접근 grep 1회 자동화 (audit 스크립트 1줄 추가).

## 권장 P0

- **P0-A** issues rail q 파라미터 처리 추가 — 빈 검색 링크 119건 클릭 손실 차단 (가장 확실한 UX 회귀).
- **P0-B** entry.data.data 패턴 grep audit 추가 — Cycle #6 P0-4 같은 prerender 즉시 fix 재발 차단.
- **P0-C** glossary related 의미 검증 1회 — UX 적합도 8건 사후 점검 (P0-A/B 보다 후순위).
