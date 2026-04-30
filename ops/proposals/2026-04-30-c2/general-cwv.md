# CWV / 성능 — Cycle #2

## 발견
- 홈 섹션 순서: `UrgencyHook → NewsHero → QuickCheckCTA …`. LCP 후보는 `NewsHero .news-headline`(h1, clamp 44px). LCP 직전 페인트는 `UrgencyHook .uh-word` 9개 + `.uh-pulse` 무한 글로우 — 시작 0.25s + i*0.07s, 마지막 단어가 ~0.88s에 끝나고 1.4s부터 무한 `text-shadow` 펄스.
- `BaseLayout.astro:122-125`의 `import('@/lib/vitals').then(initVitals)`이 `</body>` 직전이지만 idle 디퍼 없음 → 모바일 저성능 CPU에서 web-vitals 초기화 비용이 INP/TBT 측정창 안에 들어감.
- 홈에 무한 keyframe 3개: `uh-pulse-glow`(text-shadow), `tr-pulse`(transform+opacity), `trend-rank1-pulse`(box-shadow). `prefers-reduced-motion` 분기는 있으나 `contain`/`will-change` 없음 → 페인트 영역이 부모 컨테이너까지 무효화.
- `BaseLayout.astro:63-65` 주석: 폰트 preload 의도적 회피, `Pretendard Adjusted` size-adjust 100.6%로 CLS 0 유지 중. `news-headline`은 system fallback으로 LCP 페인트 후 swap.
- Lighthouse assert: TBT 200ms, INP 150ms(warn), LCP 2500ms — Cycle #1 실측 LCP 2.0s/TBT 150ms이므로 4점 손실은 LCP(~0.4s 단축 시 100) 또는 Speed Index 쪽.

## 제안
1. **vitals idle 디퍼** (회귀 0): `BaseLayout` script를 `requestIdleCallback(() => import(...), {timeout: 3000})` + fallback `setTimeout(_, 2500)`. TBT 측정창에서 web-vitals init 제거.
2. **NewsHero 무한 애니 컨테인**: `.dot-tr`, `.news-trend-item.hot .rank`에 `contain: layout style paint` + `will-change: transform`(rank만). 페인트 무효화 영역을 점/뱃지 박스로 한정 → INP 안정.
3. **UrgencyHook 펄스 컨테인**: `.uh-pulse`에 `contain: layout style` 추가, `text-shadow` 펄스를 `transform: scale(1)` 유지 박스(span wrapper) 안으로 격리. LCP 직전 메인 스레드 페인트 부담 ↓.
4. **size-adjust 정확도 재측정**: `Pretendard Adjusted` 100.6%가 `news-headline` clamp(28-44px)에서 실제 1.18 line-height와 일치하는지 dev-tool로 metric overlap 확인. 0.5% 오차도 LCP 후 미세 reflow 유발.
5. **inlineStylesheets 'always' 유지** (Cycle #1 보류 결론 재확인): 홈 gzip 23.2KB(한도 50KB)로 마진 충분, 외부 CSS 분리 시 추가 RTT 비용 > 인라인 절감. C2에선 시도 X.

## 권장 P0
**P0-1: vitals `requestIdleCallback` 디퍼** — `BaseLayout.astro:122-125` 한 줄 변경, TBT 측정창에서 web-vitals 초기화 제거. 회귀 위험 1, 점수 영향 2~3점(TBT 150→<100ms로 Perf 96→98+). 빌드 size guard·CLS 영향 0.
**P0-2: NewsHero·UrgencyHook 무한 keyframe `contain: layout style`** — CSS 3줄 추가. LCP 직전·직후 페인트 영역 축소로 모바일 INP 변동성 감소. 회귀 위험 1.
P0-1+P0-2 합산으로 모바일 Perf 100 가능성 우선 확인 후, 미달 시 P1으로 size-adjust 재검증 진행.
