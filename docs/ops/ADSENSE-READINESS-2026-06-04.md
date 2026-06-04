# AdSense 승인 Readiness 감사 종합 리포트

- 사이트: awoo.or.kr (정부 지원금 안내, Astro 6 + Cloudflare, 한국어, YMYL)
- 감사일: 2026-06-04 (fresh build 산출물 실측 검증 완료)
- 종합 판정: 소폭 보완 후 신청
- 4관점 verdict: policy-pages risk, content-quality risk, tech-soft404 fail, policy-violation risk

## 1. 종합 판정 근거

콘텐츠 품질과 정책 페이지 실질성은 승인 수준에 도달했다. 그러나 두 갈래의 차단 요소가 fresh build(06-04)에서 코드와 산출물로 확인되어 현 상태로 곧장 신청하면 거절 또는 보류 위험이 있다.

1. 정책 문구와 실제 동작의 모순 (high, 4개 파일): AdSense 로더와 GA4가 전 페이지에 무조건 로드(BaseLayout.astro 87-99행)되는데 4개 정책 페이지가 광고·추적 쿠키 미사용을 단정. 심사관이 misrepresentation으로 판단할 위험.
2. 기술적 soft-404·orphan·dangling (fail): 머신슬러그 토픽 hub 11건 indexable 및 sitemap 등재, archived 7건 sitemap 등재, dangling 19건·orphan 23건(internal-link-audit 실측). 네이버 soft-404의 실체이자 scaled-content 인상 요인.

완화 요인: 실제 ins adsbygoogle 광고 유닛은 0건이라 현재 정책위반 광고가 렌더되지 않으며 차단 요소 대부분이 짧은 코드 자동수정으로 제거 가능. 따라서 fail이 아니라 소폭 보완 후 신청으로 판정한다.

## 2. 관점별 blocker

### 2.1 policy-pages risk
- high: ads-policy·editorial-policy가 광고 미게재 단정 vs 라이브 광고 코드. 근거 BaseLayout.astro 97-99 vs ads-policy.astro 19-23, editorial-policy.astro 79-82. 수정 content
- high: privacy·cookies가 광고 쿠키 동의 후에만 또는 미사용 vs GA4·AdSense 무조건 로드. 근거 privacy.astro 36-40, cookies.astro 20-21·43-46 vs BaseLayout.astro 87-99. 수정 content
- medium: Footer에 ads-policy 링크 부재로 orphan. 근거 Footer.astro 54-61. 수정 auto
- low: privacy 본문에 Google 제3자 광고 쿠키·옵트아웃 경로 누락. 근거 privacy.astro 24-40. 수정 content

운영주체 정보(스마트데이터샵·김준혁·406-06-34485·인천 계양구 주소·이메일)는 7개 페이지 모두 실질 내용으로 stub 아님.

### 2.2 content-quality risk
- medium: thin-noindex가 detail 템플릿에만 적용되고 리스트·sitemap filter 미복제로 noindex·sitemap 상충 가능. 수정 auto
- low: youth-future-savings 8건(06-03) thin 임계 근접과 동일 일자 대량발행. 수정 content
- low: 확인 필요 placeholder 4건 이상 글(uiseong-wildfire 6·damage-relief-ganghwa 4·welfare-payment-account-change 4). 수정 content

현재 발행 52건 전부 thin 필터 통과. fail json·detail 레거시는 색인 리스크 없음.

### 2.3 tech-soft404 fail
- high: 머신슬러그 토픽 hub 11건 indexable·sitemap 등재·orphan. 근거 dist 11건 전부 noindex 없음, sitemap-0.xml 11 loc 실측, term route 78행 paths 루프에 69행 한글 가드 누락으로 isThin이 태그매칭으로 무력화. 수정 auto
- high: 옛 포스트가 죽은 한국어 토픽 hub로 거는 dangling 링크. 근거 internal-link-audit dangling 19. 수정 auto
- medium: categories에서 persona로 거는 임계 불일치 dangling. 근거 categories route 58행 n 1이상 vs persona route 18행 MIN_RESULTS 2. 수정 auto
- medium: archived 7건 indexable·sitemap·orphan. 근거 sitemap-0.xml 7 loc 실측, audit orphan 23에 포함. 수정 auto
- low: issues/main meta-refresh 페이지와 _redirects 301 공존으로 Cloudflare soft-redirect 위험. 수정 operator

audit 실측: orphan 23, dangling 19.

### 2.4 policy-violation risk
- high: 정책 3종 광고·쿠키 미사용 vs 전 페이지 AdSense 로더 상주. 수정 content
- medium: ads-policy 3항 광고 제외 영역 약속을 코드가 강제 안 함(noAds 가드 부재). 근거 BaseLayout.astro 97-99, ins 유닛 0건. 수정 auto
- medium: 모호 단정 1-4건 옛 detail 글(noindex 임계 미달). 근거 damage-relief-ganghwa 4·farmer-fisher 3·minsaeng 3. 수정 content
- low: 청년미래적금 calculator fcs 0.7로 ClaimReview emit, 미확정 금리 추정액 구조화 노출. 수정 content
- low: 일부 detail sources에 자사 awoo.or.kr를 외부 출처로 등재. 근거 sports-reduction-200005-detail 117-128. 수정 content

## 3. Go·No-Go 결론

소폭 보완 후 신청. auto 수정(정책 문구 일치·머신슬러그·archived sitemap 제외·dangling 링크 가드·Footer 링크)을 적용한 뒤 npm run build 및 node scripts/internal-link-audit.mjs로 dangling 0·머신슬러그 orphan 0·sitemap loc 소멸을 확인하고 신청. content 보강은 승인 후 점진 가능하나 정책 문구 정정(high)은 신청 전 필수.

## 4. 우선순위 수정

### auto
- P0 term route 78행 paths 루프 한글 가드로 머신슬러그 hub 11건 제거
- P0 categories route 58행 필터 n 2 이상으로 persona dangling 5건 제거
- P0 issues slug route 토픽 pill 화이트리스트 가드로 죽은 hub 링크 정리
- P1 Footer.astro 법적 고지에 ads-policy 추가로 orphan 해소
- P1 astro.config.mjs sitemap filter에 archived 제외 및 archived noindex
- P1 BaseLayout.astro noAds 가드로 정책페이지·404·thin에서 로더 미주입

### operator
- 네이버·구글 콘솔에서 머신슬러그 11·archived 7·죽은 한국어 hub URL 색인 제거 요청
- 배포 후 issues/main 경로 301 실작동 확인
- AdSense 활성화일 확정 후 ads-policy 메타 반영
- EEA 대비 동의 배너 도입 여부 결정
- 검증 통과 후 심사 신청

### content
- ads-policy·editorial-policy 5항·privacy 3항·cookies 문구를 AdSense 게재 중·광고 쿠키 사용으로 정정하고 옵트아웃 링크 명시 (high, 신청 전 필수)
- youth-future-savings 3건 2000자 이상·fcs 0.8 이상 보강 및 일자 분산
- 확인 필요 4건 이상 글 placeholder 구체화 또는 CTA 치환
- 청년미래적금 fcs 0.65 하향 또는 ClaimReview 확정 사실 한정
- detail sources에서 자사 awoo.or.kr 제거 및 sourcePublisherCount 재계산

## 5. 양호 사항
- ads.txt 정상: google.com, pub-7830821732287404, DIRECT, f08c47fec0942fa0
- robots.txt: api만 Disallow, Mediapartners-Google·AdSense 크롤러 차단 없음, 검색·AI 봇 명시 허용
- 정책 7페이지(privacy·about·contact·terms·editorial-policy·ads-policy·cookies) 실질 내용
- 이슈 52건·지원금 112건·glossary·topics, 모든 이슈에 AI 보조·편집책임자 검수·Fact-check 고지
- 실 광고 유닛(ins adsbygoogle) 0건으로 현재 정책위반 광고 렌더 없음
