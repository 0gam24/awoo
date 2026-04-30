# CWV — Cycle #7

## 발견
- `lighthouserc.json` 어설션: LCP 2500/CLS 0.1/TBT 200 = error, INP 150/maxFID 150/TTI 3000/SI 2500 = warn (#5·#6 데이터로 INP 초과 0건 확인됨).
- `/subsidies/index.astro`: sort UI 3종(인기·금액·마감)이 `data-amount`/`data-deadline-rank`/`data-popularity-rank` 직접 참조 → 클라 정렬 비용 O(n log n), n≈100. INP 측정창에 들어갈 가능성 있음.
- `BaseLayout.astro`: `<link rel="prefetch">` 호출 없음(Astro 6 기본 prefetch 옵션 미사용). 홈 prefetch 페이지 수 = 0 추정.
- Pretendard preload 의도적 회피 주석 명시(line 65~67) — Adjusted fallback metric으로 CLS 0 확보.
- IncomeChecker는 `.tsx` + `.astro` 공존 → vanilla 전환 시 client island JS 제거 가능.

## 제안
1. **lighthouserc INP/FID warn → error 승격**: #4·#5·#6 누적 데이터로 안전 확인. `interaction-to-next-paint` 150ms·`max-potential-fid` 150ms를 error로 올려 회귀 차단.
2. **/subsidies sort 정렬 캐시화**: 첫 클릭 시 정렬 결과 Map 캐시 → 재정렬 시 DOM reorder만 수행(INP 안전 마진 확보 후 #1 승격 동시 적용 가능).
3. **prefetch hover audit 스크립트**: dist HTML grep으로 `<link rel="prefetch">` count + Astro `prefetch` 설정 확인, 의도된 0건임을 ops에 기록.
4. **preload as=font 재검토 → 회피 유지 결정 문서화**: BaseLayout 주석을 ops/decisions로 승격(다른 cycle에서 재논의 차단).
5. **size guard 임계 하향은 #8 보류**: IncomeChecker vanilla 전환 후 홈 50KB→40KB 강화 검토.

## 권장 P0
- **P0-1 (필수)**: lighthouserc INP·FID error 승격 (lighthouserc.json 2줄 수정, CI 회귀 차단력 +).
- **P0-2 (필수)**: prefetch audit 스크립트 추가 — 홈 prefetch 0건 의도임을 lock.
- P1: /subsidies sort 캐시화(#1 승격 후 회귀 시 즉시 적용).
