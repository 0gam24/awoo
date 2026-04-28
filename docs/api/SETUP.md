# Phase A API — 외부 서비스 셋업 가이드

본 문서는 코드를 라이브에서 100% 동작시키기 위한 **사용자 작업** 단계입니다.
모든 코드는 `feat: phase A APIs` 커밋에 이미 들어 있어, 셋업 없이 deploy해도 빌드는 성공하고 엔드포인트는 응답합니다(데이터 저장·이메일 발송만 일시 비활성).

## 0. 사전 준비

- `wrangler` 로그인: `npx wrangler login` (브라우저로 Cloudflare 인증)
- 본 프로젝트 디렉토리에서 실행 (`/c/dev/awoo`)

---

## 1. Cloudflare D1 — 피드백·문의 저장

### 1-1. 데이터베이스 생성

```bash
npx wrangler d1 create awoo-db
```

출력 예시:
```
✅ Successfully created DB 'awoo-db' in region APAC
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "awoo-db"
database_id = "abc123-def456-..."
```

### 1-2. `wrangler.jsonc` 업데이트

`database_id` 값을 위 출력에서 복사해 [`wrangler.jsonc`](../../wrangler.jsonc)의 `REPLACE_AFTER_CREATE`를 교체:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "awoo-db",
    "database_id": "abc123-def456-..."   // ← 이 값
  }
]
```

### 1-3. 마이그레이션 적용

원격(production):
```bash
npx wrangler d1 execute awoo-db --remote --file=migrations/0001_initial.sql
```

로컬 개발용:
```bash
npx wrangler d1 execute awoo-db --local --file=migrations/0001_initial.sql
```

확인:
```bash
npx wrangler d1 execute awoo-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```
→ `feedback`, `contact` 두 테이블이 보여야 함.

### 1-4. 데이터 조회 (운영 시)

```bash
# 최근 피드백 10개
npx wrangler d1 execute awoo-db --remote --command="SELECT * FROM feedback ORDER BY created_at DESC LIMIT 10"

# 새 문의
npx wrangler d1 execute awoo-db --remote --command="SELECT * FROM contact WHERE status='new' ORDER BY created_at DESC"
```

---

## 2. Cloudflare Analytics Engine — Web Vitals 시계열

별도 명령 불필요. `wrangler.jsonc`의 `analytics_engine_datasets` 바인딩이 이미 코딩됨:

```jsonc
"analytics_engine_datasets": [
  {
    "binding": "ANALYTICS",
    "dataset": "awoo_vitals"
  }
]
```

배포 시 자동 생성됩니다.

### 데이터 조회 (운영 시)

대시보드 → **Workers** → **Analytics Engine** → **awoo_vitals** 또는 SQL API:

```sql
SELECT
  blob1 AS metric,
  blob2 AS path,
  blob3 AS device,
  AVG(double1) AS avg_value,
  quantileWeighted(0.75)(double1, _sample_interval) AS p75,
  count() AS samples
FROM awoo_vitals
WHERE timestamp > NOW() - INTERVAL '7' DAY
GROUP BY metric, path, device
ORDER BY samples DESC
```

LCP·INP·CLS의 75 percentile이 §4 임계 안에 있는지 주간 점검.

---

## 3. Resend — 문의 이메일 발송

### 3-1. 가입

1. https://resend.com → "Sign up" → kjh791213@gmail.com 으로 가입
2. 무료 티어: 3,000 emails/month, 100 emails/day

### 3-2. 도메인 인증

1. 대시보드 → **Domains** → **Add Domain** → `awoo.or.kr`
2. 표시되는 DNS 레코드를 Cloudflare DNS에 추가:
   - SPF (`TXT @ "v=spf1 include:_spf.resend.com ~all"`)
   - DKIM (`TXT resend._domainkey ...`)
   - MX (return-path 도메인 — 선택)
3. Cloudflare → DNS 탭 → 위 레코드 입력
4. Resend로 돌아와 **Verify** 클릭 → 5분 내 활성화

### 3-3. API 키 발급

1. Resend → **API Keys** → **Create API Key**
2. 이름: `awoo-prod`, 권한: `Sending access`
3. 복사한 키를 시크릿으로 등록:

```bash
npx wrangler secret put RESEND_API_KEY
# 프롬프트에 키 붙여넣기
```

### 3-4. 발송자 주소 변경 (선택)

도메인 인증 안 하면 임시로 `onboarding@resend.dev`로 발송 가능. 프로덕션에서는 인증된 `noreply@awoo.or.kr` 권장 — `src/pages/api/contact.ts`의 `from` 필드 자동 사용.

### 3-5. 어드민 이메일

```bash
npx wrangler secret put ADMIN_EMAIL
# kjh791213@gmail.com 입력
```

---

## 4. Cloudflare Turnstile — 봇 차단 (문의 폼)

### 4-1. 사이트 키 발급

1. 대시보드 → **Turnstile** → **Add site**
2. 사이트 이름: `awoo.or.kr`, 도메인: `awoo.or.kr`
3. **Widget Mode**: `Managed` 권장 (자동 도전)
4. 출력된 **Site Key** + **Secret Key** 복사

### 4-2. 사이트 키 (퍼블릭) → 코드에 직접

`src/pages/contact.astro`의 폼 부분에 widget 추가:

```html
<div class="cf-turnstile" data-sitekey="여기에_사이트키" data-theme="auto"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

> 본 가이드에서는 위젯이 아직 폼에 미배치 상태입니다. 사이트 키를 받으시면
> 사용자께서 코드에 추가하거나 알려주시면 다음 작업에서 추가합니다.

### 4-3. 시크릿 키 → 시크릿 등록

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

→ 코드는 자동으로 검증 활성화 (`TURNSTILE_SECRET_KEY` 존재 시 검증, 없으면 패스).

---

## 5. Cloudflare Email Routing — `contact@awoo.or.kr` 포워딩

(선택, Resend 발송과 별개)

1. 대시보드 → **Email** → **Email Routing** → **Get started**
2. Cloudflare가 자동으로 MX·TXT 레코드 추가 권유 → **Add records and enable**
3. **Routes** → **Create address**:
   - From: `contact@awoo.or.kr`
   - To: `kjh791213@gmail.com` (Cloudflare가 검증 메일 보냄, 클릭 후 활성)

→ 이제 `contact@awoo.or.kr`로 누가 보내든 Gmail로 도착.

---

## 6. 배포 후 검증

전체 셋업 완료 후 awoo.or.kr 사이트에서:

1. **Vitals**: 아무 페이지 방문 → 새 탭으로 https://awoo.or.kr 다시 방문 → Cloudflare Analytics Engine에 LCP/INP/CLS 이벤트가 들어오는지 1분 후 SQL로 확인
2. **Feedback**: `/about/` 또는 `/guide/` 페이지 하단 "이 페이지가 도움이 되셨나요?" 위젯에서 👍 클릭 → "의견 감사합니다" 표시 → D1에 행 추가 확인
3. **Contact**: `/contact/` 폼에 테스트 메시지 → 본인 Gmail에 메일 도착 + D1 `contact` 테이블에 행 추가 확인

---

## 7. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `wrangler d1 execute` 401 | `wrangler login` 다시 실행 |
| D1 테이블이 안 보임 | `--remote` 플래그 누락 (기본 `--local`) |
| Resend 401 Unauthorized | `wrangler secret put RESEND_API_KEY` 다시 실행, 배포까지 1~2분 대기 |
| Resend 422 invalid from | 도메인 인증 안 됨 → `onboarding@resend.dev` 임시 사용 또는 인증 완료 |
| Turnstile 검증 실패 | Site Key의 도메인 설정에 `awoo.or.kr` 누락. 또는 위젯 코드 미배치 |
| Email Routing 전송 실패 | MX 레코드 미적용. DNS 탭에서 Cloudflare가 자동 추가한 레코드 확인 |

---

## 8. 비용 추정 (월간, 1,000 일일 활성 사용자 가정)

| 서비스 | 사용량 | 무료 티어 | 초과 시 |
|---|---|---|---|
| D1 | 30k reads · 5k writes | 5M reads/day · 100k writes/day | $0 (한참 멀음) |
| Analytics Engine | 30k events | 100k events/day | $0 |
| Workers | 30k requests/day | 100k requests/day | $5/월 (paid plan) |
| Resend | ~50 emails/월 | 3,000/월 | $0 |
| Email Routing | 무관 | 무료 | $0 |
| Turnstile | ~5k 검증/월 | 무료 | $0 |

**예상 첫 1년 비용: $0** (트래픽 폭증 시 Workers Paid $5/월 정도)

---

생성: 2026-04-29
