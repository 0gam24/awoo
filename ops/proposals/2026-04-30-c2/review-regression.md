# 회귀 점검 — Cycle #2

## 회귀 위험 지점

1. **BlufBox 4 hub 시각 회귀**: `personas/[id]`·`situations/[id]`·`categories/[id]`·`topics/[id]` 모두 `<aside class="bluf">`를 hero 직하 `<section class="band">`에 삽입. CSS는 컴포넌트 scoped `<style>`로 격리(`var(--surface)`/`var(--border)`/`var(--accent)` 사용) — 다크 토큰 미정의시 fallback 없음. 작은 화면(≤480px) 미디어쿼리만 있어 481~640 사이 padding/grid 응답 누락 가능.
2. **Org+WebSite JSON-LD 페이지당 ~600B**: 218~219 페이지 일괄 주입. 홈 23.2KB / 평균 12.2KB로 size-guard(50/70/100KB) 통과 확인. 단 동일 `@id` 두 번 출력시 Google가 중복 경고(현재 BaseLayout 단일 주입이지만 Layout 중첩 페이지 회귀 시 위험).
3. **sitemap 차등화 매칭 누락**: `astro.config.mjs` serialize 분기 검토 결과 `/issues/topics/[term]/`은 daily/0.9, persona×category 4축 cross-ref `/subsidies/category/[c]/persona/[p]/`는 weekly/0.8 매칭 확인. **누락 후보**: `/subsidies/archived/[slug]/`(noindex라 의도적 default 0.7 가능), `/subsidies/main/` 류, `/issues/main/`(schema-validate 경고 1건과 동일 페이지) — default 0.7 / weekly 폴백 됨.
4. **issues/index `.cat-*` 토큰 제거**: scoped style 주석이 `global.css 일괄 정의` 명시(line 331). global.css에 `.cat-주거`~`.cat-농업` 7종 + `--cat-color` 변수 fallback `var(--accent)`/`var(--border-2)` 정의 — 다크모드에서 카테고리 미매칭 카드는 accent border, OK. 단 `.tint-*` 토큰도 동일 변수 공유 → 신규 카드 컴포넌트가 `.cat-`/`.tint-` 양쪽 클래스를 동시에 받으면 마지막 정의 승리(현재 동일 값이라 무해, 향후 분기시 위험).
5. **issues/topics/[term] BreadcrumbList 단일화 후**: schema-validate가 BreadcrumbList 210건 보고 — issues/topics/[term] 단일 출력 확인. 단 audit 스크립트가 `<script type="application/ld+json">` 블록 단위로 카운트하므로, 같은 페이지에 BreadcrumbList가 2회 들어가면 카운트 +2. 현재 210 = 거의 모든 hub·상세이므로 정상.
6. **persona/situation H1 단일성**: persona/[id]는 H1 1개(`hero-title`) + H2 3개(어려움·자격·매칭). situation/[id]는 H1 1개(`title`) + H2 2개(매칭·다른 라이프이벤트). **새 H2 2개 추가**가 H1을 침범한 흔적 없음.
7. **llms-full.txt 169KB**: server build 13.25s 정상. 다만 `import.meta.glob`이 빌드 메모리에 issues 본문을 모두 로드 → 향후 issues 누적 100건+시 빌드 타임 선형 증가 가능. 현재 2건이라 무시.

## 검증·보강 제안

- **Lighthouse·Pagespeed 다크/라이트 양쪽** Bluf 4 hub 시각 회귀(컬러 콘트라스트 4.5:1) 자동화 — `axe-core` postbuild 추가.
- **sitemap matrix 테스트**: serialize 분기 7종(daily/weekly/monthly/4축/default)에 대해 fixture URL 입력 → 기대 priority/changefreq 단언 (`scripts/sitemap-matrix.test.mjs` 신규).
- **JSON-LD `@id` 중복 가드**: schema-validate에 페이지별 `@id` 집계 추가(중복 시 warn).
- **issues/main 410 또는 redirect**: schema-validate 경고 1건의 출처 — Cycle #2에서 410 헤더 또는 `/issues/`로 308 처리.
- **BlufBox 481~640px 미디어쿼리 보강**: 현재 480 cutoff, 태블릿 portrait에서 stat grid 2열로 좁아짐.

## 권장 P0

1. **sitemap matrix 단위 테스트** — 회귀 자동 차단 (5점, 1h)
2. **issues/main 410 처리** — schema-validate 경고 0건화 (4점, 30min)
3. **JSON-LD `@id` 중복 가드** schema-validate에 추가 — 향후 Layout 중첩 회귀 차단 (3점, 30min)
