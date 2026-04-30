# 회귀 점검 — Cycle #6

## 회귀 위험 지점

1. **entity-graph.json git diff 노이즈 (高)** — 47KB(실측 ~94KB)·git tracked + `prebuild`마다 `generated_at: new Date().toISOString()` 갱신. 로컬 빌드만 해도 변경분 1줄 발생, 의미 없는 커밋 유발. CI는 `npm run build` 안 돌리면 정적이지만 사용자 머신은 매번 dirty.
2. **applicationCategory: 'GovernmentApplication' 비표준 (中)** — schema.org `ApplicationCategory` 표준 enum(Business/Multimedia/Game/Travel/...)에 `GovernmentApplication` 없음. Google rich-result는 자유 문자열도 받지만 SDTT/Schema Markup Validator에서 warning 가능성.
3. **HowTo step 4개 — 경계선 (低)** — Google 가이드라인 "최소 2 step" 충족이지만 carousel rich result는 4+ 권장. 충족 OK, 단 step.image 부재로 carousel 비활성 가능.
4. **Article datePublished/dateModified 동일 (低)** — `editorial-policy.astro` 둘 다 '2026-04-29' 하드코딩. 향후 정책 수정 시 dateModified 갱신 누락 위험.
5. **fetchWithRetry — 4xx 즉시 return (中)** — `if (![429,502,503,504].includes(status)) return res` → 401/403도 호출자에게 그대로 전달, callClaude의 `!res.ok` 분기에서 throw. 동작 OK지만 로그 불명확.
6. **prefers-contrast: more — 분기 충돌 (低)** — `:root:not([data-theme='light'])` 선택자가 light 미지정 + auto 케이스 모두 매치 → light prefers-contrast: more에서 dark 토큰 덮어쓰기 위험. light/dark 명시 분기 필요.

## 검증·보강 제안

- entity-graph.json **`generated_at` 제거 또는 git 제외** (`.gitignore`에 추가 + prebuild 산출만). 결정성 위해 source hash 기반 해시 필드로 대체 권장.
- applicationCategory를 **`'BusinessApplication'`** 또는 schema.org Enum URL(`https://schema.org/BusinessApplication`)로 교체, additionalType에 'GovernmentService' 부여.
- audit-rss feed 30/2 items + audit-skip-link 217 페이지 `npm run build && node scripts/audit-*.mjs` 1회 실측 — exit 0 회귀 가드 확정.
- Article schema datePublished를 frontmatter 상수화(`EDITORIAL_PUBLISHED_AT`) — dateModified만 갱신 패턴 강제.
- prefers-contrast: more에서 `[data-theme='dark']` 단독 + light 분기 명시 추가.

## 권장 P0

- **P0-A**: entity-graph.json `.gitignore` + `generated_at` 제거 (회귀 노이즈 차단, 5분).
- **P0-B**: applicationCategory 표준 enum 교체 + schema-validate에 ApplicationCategory enum 화이트리스트 가드 (15분).
- **P0-C**: prefers-contrast: more light/dark 분기 명시 (10분, 토큰 충돌 차단).
