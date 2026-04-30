# 자동화 보안 영향 — general-purpose

## 발견
- **sync-subsidies / sync-issues**: API 키 마스킹·HTML 태그/엔티티/제어문자 sanitize·`javascript:` URI 무력화·길이 캡(200/500자) 모두 적용. `mapToSchema`는 화이트리스트 필드만 매핑 — 미상 필드는 자동 폐기. 양호.
- **generate-issue-posts**: 외부 입력은 sanitize 거친 제목/설명만 prompt에 들어가며, `JSON.stringify` 후 코드펜스 안에 격리. agent system prompt는 정적 파일 — 사용자 입력 직삽입 경로 없음. fact-check 70% 게이트로 환각·삽입 모두 차단.
- **check-apply-urls**: `applyUrl`은 자체 데이터 파일에서만 읽음 — 외부 입력 SSRF 표면 없음. 단 protocol/호스트 화이트리스트 부재.
- **public/_headers**: CSP에 `script-src 'unsafe-inline'`·`style-src 'unsafe-inline'` 잔존. HSTS·X-Frame·Permissions-Policy는 강함.
- **api 라우트**: contact/feedback/vitals 모두 zod 검증 + Origin 화이트리스트 + IP해시 rate-limit + Turnstile. escapeHtml로 이메일 본문 XSS 차단. 양호.
- **.gitignore**: `.env*` 패밀리 + `_fail-*.json`(prompt 단편 포함) + `_link-health.json` 모두 무시. 양호.

## 제안
1. **check-apply-urls 호스트 가드**: `new URL(url).protocol === 'https:'` + `.go.kr/.gov.kr/.or.kr` 등 정부 TLD 화이트리스트 추가 (큐레이션 변조 시 SSRF 회피).
2. **sync-* schema 거절**: `serviceList` 응답에 `data[]` 외 unexpected top-level 필드 들어오면 warn 로그(차단까지는 X — 보조금24 스키마 진화 허용).
3. **generate-issue-posts 입력 길이 캡**: `articlesForTopic` 배열을 프롬프트 직전에 N≤10·총 ≤30KB로 강제 (현재 8건 cap 있으나 description 길이 무제한). 재정 비용·prompt injection 표면 동시 축소.
4. **CSP nonce 마이그**: Astro 4+ `experimental.csp` 또는 `<script is:inline>` 제거 후 `'unsafe-inline'` 삭제 — PSI 영향 0.
5. **fact-check 실패 누적 알림**: `_fail-*.json` 누적 N건 이상 시 cycle-runner에서 GH Step Summary로 알림 (이미 인프라 있음, 게이트만 추가).

## 권장 P0
**check-apply-urls 호스트 화이트리스트** — 30분 작업, 외부 데이터 변조 시나리오의 단 하나 남은 SSRF 표면 차단. CSP nonce는 P1 (영향 큼·작업 큼).
