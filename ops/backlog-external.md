# 외부 의존·유료 백로그 (사이클 동결)

본 파일에 적재된 항목은 **사용자가 직접** 외부 키 등록·결제·계약·계정 생성 등을 수행해야 진행 가능하다. 사이클은 절대 본 항목을 EXECUTE에 포함시키지 않는다.

## REVIEW phase 자동 격리 키워드

REVIEW 에이전트는 PLAN 산출물을 읽을 때 다음 키워드를 정규식으로 매칭하여 발견 시 즉시 본 파일로 이동한다:

```
# 결제/구독
구독|결제|유료|paid|subscription|billing|premium|pro plan|크레딧|credit balance

# 외부 키 등록
api key|API 키|client_id|client_secret|access token|service account|oauth
google search console|google analytics|GA4|GSC|gsc api
naver search advisor api|naver developers|kakao developers
resend|sendgrid|mailgun|postmark|aws ses
sentry|datadog|new relic|logpush|loki

# 외부 서비스 가입
\b가입\b|\b신청\b(?!.*신청처)|\b등록\b(?!.*콘텐츠)|sign ?up|register account
domain registrar|name server 변경

# 계약/법무
계약|법무|약관 변경|개인정보처리방침 외부 검토

# 인프라 변경 (운영자 손)
cloudflare 대시보드|cloudflare access|d1 database 생성|kv namespace 생성|r2 bucket 생성
turnstile site key|turnstile secret
github secrets|github environment
```

## 현재 백로그 (사용자 직접 처리 항목)

### A. 트래픽 지표 외부 연동 (필요 시 우선순위 높음)
- [ ] **Google Search Console 등록 + sitemap 제출** — 사용자: GSC 콘솔 로그인 → 도메인 속성 추가 → `/sitemap-index.xml` 제출
- [ ] **GSC URL Inspection API 키** — 사이클 OBSERVE phase에서 인덱싱 상태 자동 체크 가능해짐. OAuth 클라이언트 생성 필요
- [ ] **Naver Search Advisor 등록** — `naver8b46010c5dd54b5f920a0c5b3f13d212.html` 인증 파일은 존재함, 콘솔 등록 마무리 필요
- [ ] **Bing Webmaster Tools 등록** — IndexNow 키는 있으나 사이트 등록 별도

### B. 분석 (선택)
- [ ] **Cloudflare Web Analytics** — 쿠키리스, 무료. 대시보드에서 토큰 발급 후 BaseLayout에 삽입 필요
- [ ] **GA4** (선택, 동의 후 Partytown) — 비용 0이나 설정·정책 부담 있음

### C. 사용자 폼·메일 운영
- [ ] **Resend API 본격 운영** — 키 보유 중이나 발송량에 따라 비용 발생 → 발송 도메인 검증 후 enable
- [ ] **Cloudflare Turnstile** — 무료 티어. 대시보드 사이트 키·시크릿 발급
- [ ] **Cloudflare Email Routing** — `contact@awoo.or.kr` → `kjh791213@gmail.com`

### D. 로깅·에러 (보류)
- [ ] **Sentry** — 무료 티어 가능하나 가입+SDK 추가 필요
- [ ] **Cloudflare Logpush** — 유료 (Workers Paid plan)

### E. 인프라 활성화
- [ ] **D1 database 생성 + 마이그레이션** — `wrangler.jsonc` 주석 해제 + 사용자가 D1 인스턴스 생성
- [ ] **Cloudflare Access** — 어드민 페이지 보호 (50명 무료)

### F. 외부 데이터 소스 추가
- [ ] **복지로 RSS / 통계청 중위소득 API** — 신규 외부 키 발급
- [ ] **추가 정부 부처 API** — 사용자 결정 필요

## 처리된 항목 (참고)
- ✅ 공공데이터포털 인증키 (`DATA_GO_KR_KEY`) — 보조금24 sync 가동 중
- ✅ Cloudflare Workers + Static Assets 배포
- ✅ 도메인 awoo.or.kr 연결
- ✅ Cloudflare AI Bot 차단 OFF (GEO 가시성)

## 사이클이 본 백로그를 다루는 방식

1. **PLAN 에이전트**도 본 파일을 읽어 외부 의존 항목은 처음부터 제안하지 않도록 가이드 받음
2. **REVIEW**가 발견하면 자동으로 본 파일에 추가 (중복 제거)
3. 사용자가 본 파일의 항목을 처리한 뒤 "✅" 마킹하고 "사이클" 트리거 → PLAN이 새 가능 영역 반영
