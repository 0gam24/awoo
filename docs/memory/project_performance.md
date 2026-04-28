---
name: Performance bar — PageSpeed 100
description: PageSpeed Insights 4개 카테고리 100/100 (모바일·데스크탑) 절대 게이트
type: project
originSessionId: 6e3a0917-3f3b-4e4a-b07e-5a89395fc854
---
사용자가 https://developers.google.com/speed/docs/insights/v5/about 기준 **PageSpeed Insights 100점 만점**을 명시. AGENTS.md §17의 "90+"보다 강한 절대 목표.

**4개 카테고리 모두 100/100 (모바일+데스크탑):**
- Performance 100 — Lab 기준. LCP·CLS·TBT·FCP·SI 만점 필요
- Accessibility 100 — 색 대비 WCAG AA, 모든 이미지 alt, 적절한 ARIA, form label
- Best Practices 100 — HTTPS, 보안 취약점 0, console error 0, 이미지 aspect-ratio
- SEO 100 — meta, viewport, crawlable, canonical, structured data 통과

**Lab 100 + Field "Good" 둘 다 — 둘은 다른 측정.** PSI Lab 100이어도 CrUX Field LCP/INP/CLS가 §4 임계값(2.5s/150ms/0.1) 안 들어오면 GSC에서 "needs improvement". 둘 다 통과 필수.

**100점을 위한 강제 결정사항:**
1. **Astro 5 + Islands 거의 mandatory** — Next.js RSC도 hydration 비용 때문에 100 어려움
2. **클라이언트 JS 최소화** — Island는 IncomeChecker / BrowseFilter / FAQ Accordion / TopBar 메뉴 토글만. 나머지 전부 정적 HTML
3. **TBT 0에 근접** — 페이지당 실행 JS 50KB gzipped 미만 목표 (§17 100KB보다 빡빡)
4. **인라인 Critical CSS** — `<head>`에 first-paint CSS 직접 삽입, 나머지 CSS는 비동기 로드
5. **Pretendard Variable 셀프호스팅 + 한글 서브셋 + size-adjust** — FOUT/CLS 0
6. **이미지 거의 SVG로** — 프로토타입이 SVG 아이콘만 쓰니 자연스러움. 사진 사용 시 AVIF + width/height + LCP는 preload + fetchpriority="high"
7. **3rd-party 스크립트 0 또는 Partytown 격리** — GA4도 동의 후 Partytown. **Cloudflare Web Analytics**(서버사이드, 쿠키리스)를 1차 분석으로
8. **CLS 절대 0** — 모든 이미지/임베드/배너 차원 예약, 폰트 fallback 메트릭 매칭
9. **Cloudflare 엣지 캐싱 + Brotli + HTTP/3 + Early Hints** — TTFB < 100ms

**색 대비 — 프로토타입 토큰 일부 수정 필수 (라이트모드):**
- `--gray-3 #86868b` on `#ffffff` = 3.7:1 → AA 본문 4.5:1 미달, **본문 사용 금지**
- 안전: `--gray-2 #6e6e73` on white = 5.0:1 ✓
- 본문 secondary는 #6e6e73 또는 더 진하게로 통일
- 다크모드는 대비 OK

**100점 위해 포기/타협 사항:**
- 무거운 진입 애니메이션 (UrgencyHook의 단어 페이드인은 CSS만으로 — JS 안 씀)
- 다중 weight 폰트 파일 (Variable 1개로)
- 동의 전 GA4 로드 (Cloudflare Web Analytics가 첫 페이지뷰 담당)
- 자동재생 비디오·캐러셀

**Why:** PSI 100은 Lab 시뮬레이션 한계까지 짜낸 점수라 작은 회귀 하나로 99로 떨어짐. 매 phase 끝에 Lighthouse CI 100 게이트를 두고, 떨어지면 머지 차단해야 유지 가능. 한 번 깨지면 복구가 새로 만드는 것보다 더 비쌈.

**How to apply:**
- 모든 PR Lighthouse CI 4×100 게이트 (떨어지면 차단)
- 새 의존성 추가 시 번들 영향 측정 후 승인
- Island 추가 신중 — "정말 인터랙션이 필요한가?" 자문
- 디자인 토큰 추가 시 색 대비 자동 검증 (Tailwind plugin 또는 build script)
- 각 phase 종료 보고에 PSI 점수 4종 + 번들 크기 명시 (§22-2)
