# Google Search Console 등록 가이드

> 본 문서는 awoo.or.kr 의 운영자가 Search Console에 사이트를 등록하고 sitemap·RSS를 제출하는 절차를 정리한다.
> 1회성 작업이지만 도메인 변경·재등록 시 다시 사용한다.

---

## 1. 사전 준비

- Google 계정 (운영자: kjh791213@gmail.com)
- Cloudflare 도메인 관리 권한 (DNS TXT 추가용)
- awoo.or.kr 라이브 + HTTPS 정상 동작 확인

---

## 2. 도메인 속성 (Domain Property) 등록

도메인 속성은 모든 하위도메인·프로토콜을 한 번에 커버 (권장).

### 2-1. Search Console에서 속성 추가

1. https://search.google.com/search-console 접속 (Google 로그인)
2. 좌측 상단 → **속성 추가** → **도메인** 선택
3. `awoo.or.kr` 입력 → **계속**
4. Google이 표시하는 TXT 레코드 값 복사
   - 예: `google-site-verification=ABC123...`

### 2-2. Cloudflare DNS에 TXT 레코드 추가

1. https://dash.cloudflare.com → `awoo.or.kr` 선택
2. **DNS → 레코드** 탭
3. **레코드 추가**:
   - 유형: `TXT`
   - 이름: `@` (또는 `awoo.or.kr`)
   - 콘텐츠: 위에서 복사한 `google-site-verification=...` 전체
   - TTL: `Auto`
   - 프록시: 회색 구름 (DNS only)
4. **저장**

### 2-3. Search Console에서 인증

1. Cloudflare에서 TXT 레코드 추가 후 1~10분 대기 (DNS 전파)
2. Search Console → **확인** 클릭
3. 성공 시 도메인 속성 활성화

> 실패하면 `dig TXT awoo.or.kr` 또는 https://dnschecker.org 에서 TXT 레코드 노출 확인 후 재시도.

---

## 3. Sitemap 제출

본 사이트는 빌드 타임에 `sitemap-index.xml`을 자동 생성 (`@astrojs/sitemap`).

1. Search Console → 좌측 메뉴 → **Sitemaps**
2. **새 사이트맵 추가** 입력란에 `sitemap-index.xml` 입력 (전체 URL 아님)
3. **제출**
4. 24시간 내 status가 **성공** 으로 표시되면 완료

> 새 페이지(예: `/issues/topics/...`)는 다음 빌드 후 자동으로 sitemap에 포함됨.

---

## 4. RSS 피드 색인 요청 (선택)

Search Console은 RSS를 직접 색인하지 않지만, Google News·Discover 노출에 도움.

- `/feed.xml` — 신규 정부 지원금 (주간 갱신)
- `/feed-issues.xml` — 오늘의 이슈 포스트 (일간 갱신)

색인 신호: BaseLayout.astro에 `<link rel="alternate" type="application/rss+xml">` 이미 포함됨 — 별도 작업 불필요.

---

## 5. URL 검사 + 색인 요청 (선택)

특정 페이지를 즉시 색인 큐에 추가:

1. Search Console 상단 검색창에 URL 입력 (예: `https://awoo.or.kr/issues/2026-04-29/damage-relief-ganghwa-2026/`)
2. **Enter** → URL 분석 결과 확인
3. **색인 요청** 클릭

> 1일 약 10~12개 URL까지 가능. 새 이슈 포스트나 트렌딩 토픽 페이지에 사용.

---

## 6. 모니터링 체크리스트 (월 1회)

- **실적 (Performance)**: 노출/클릭/CTR/평균 게재순위 확인
  - 검색어: "지원금", "청년 월세", "보조금" 등이 상위에 있는지
  - 페이지: `/issues/topics/...` 롱테일 진입이 늘고 있는지
- **색인 생성 (Indexing)**: 색인된 URL 수가 빌드 페이지 수와 비슷한지
  - 차이가 크면 sitemap 제출·robots.txt 점검
- **경험 (Core Web Vitals)**: Field 데이터 LCP·INP·CLS 모두 "양호" 비율
  - "개선 필요" 페이지가 있으면 PSI 재측정
- **수동 조치 / 보안 문제**: 0건 유지 (있으면 즉시 처리)

---

## 7. 배제 패턴 (체크포인트)

다음 페이지는 색인 X (의도된 동작):

- `/subsidies/archived/[slug]` — 마감된 지원금 (noindex)
- `/issues/main` — 레거시 redirect (noindex)
- `/demo` — 컴포넌트 데모 (noindex)

이들이 "색인됨" 으로 보고되면 noindex 헤더가 누락된 것 — 코드 점검 필요.

---

## 8. 문제 해결

| 증상 | 원인·해결 |
|---|---|
| TXT 레코드 인증 실패 | Cloudflare 프록시 켜져있음 → 회색 구름 (DNS only)로 변경 |
| sitemap 0 URL 발견 | sitemap-index.xml 직접 접속 → XML 파싱 정상이면 24시간 대기 |
| Core Web Vitals "개선 필요" | PSI 재측정 → CrUX Field 28일 평균은 시간 필요. 코드 변경 직후 며칠은 정상 |
| AI 봇 차단 의심 | Cloudflare → Security → Bots → AI Audit Off (본 프로젝트는 GEO 우선) |

---

## 9. 운영 자동화 검토

수동 작업이지만 자동화 가능한 부분:

- **빌드 시 sitemap 변경 감지 → IndexNow 자동 ping** (Bing/Naver 대상)
  - `IndexNow` 프로토콜로 새 URL을 batch 제출 가능
  - 현재 미구현 — 운영 단계에서 검토

- **Slack 알림: 색인 오류 90% 이상 감지**
  - Search Console API → Workers cron → Slack incoming webhook
  - 현재 미구현 — 5회 이상 색인 오류 보고 시 검토
