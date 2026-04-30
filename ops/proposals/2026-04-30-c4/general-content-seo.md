# Content SEO — Cycle #4

## 발견
- `subsidies-meta.ts` 에 `getRegDateISO` · `getLastVerifiedISO` · `getLastVerifiedKR` 가 이미 노출되어 있어 ISO·KR 양쪽 출력 가능 — 추가 데이터 가공 불필요.
- `subsidies/[id].astro` ~190 라인 `verified-info` 블록은 텍스트 `마지막 동기화: YYYY.MM.DD` 만 노출 — `<time datetime>` 시맨틱 없음. 봇이 freshness 판정 어려움.
- `issues/[date]/[slug].astro` `PostData` 에 `publishedAt` 만 있고 `dateModified` 미정의 — NewsArticle JSON-LD 와 본문 양쪽에서 freshness 신호 누락.
- `subsidies/[id]` 본문 상단에 카테고리·페르소나 H2 가 없고 summary 만 노출 — long-tail "{persona} {category} 지원금" 쿼리 매칭 약함.
- issues 본문 freshness 박스에 `trendingTerm` 은 있으나 검색 진입점 링크 없음 — 독자가 같은 키워드로 더 둘러볼 동선 없음.

## 제안
1. `subsidies/[id]`: `verified-info` 의 KR 날짜를 `<time datetime={lastVerifiedISO}>` 로 감싸고, GovernmentService JSON-LD 에 `dateModified` 추가.
2. `issues/[date]/[slug]`: PostData 에 `modifiedAt?` 옵셔널 필드 추가, NewsArticle JSON-LD `dateModified` 출력 + 본문 메타 라인 `<time datetime>`. 미지정 시 `publishedAt` fallback.
3. `subsidies/[id]` 본문 첫 H2 자동 생성: `{matchedPersonas[0]?.label ?? '많은 분'}이 자주 받는 {s.category} 지원금` — summary 위 한 줄 헤딩, 본문 키워드 밀도 +.
4. issues freshness 박스에 `<a href="/subsidies/?q={trendingTerm}">"{trendingTerm}"으로 더 둘러보기</a>` 정적 링크 — 독자 다음 행동 제시.
5. `guide.astro` · 주요 hub 푸터에 `<time datetime={BUILD_ISO}>최근 업데이트 YYYY.MM.DD</time>` 노출 — site-wide freshness.

## 권장 P0
- **#1 + #2** 동시 (시맨틱 + JSON-LD freshness): E-E-A-T 신호가 가장 강하고 변경 면적 작음. 데이터 헬퍼 이미 존재.
- **#3** 카테고리 자동 H2: 1줄 추가로 long-tail 매칭 향상, 카피는 독자 중심("자주 받는") 유지.
- #4·#5 는 P1 — UX 보강이지만 ranking 직접 효과는 #1~#3 보다 약함.
