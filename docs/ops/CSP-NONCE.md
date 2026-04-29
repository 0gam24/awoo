# CSP nonce 도입 가이드 (T2-6)

> 현재 CSP는 `script-src 'self' 'unsafe-inline'` 구조 — Astro inline script + JSON-LD schema 호환을 위해 'unsafe-inline'을 허용 중.
> nonce 도입 시 'unsafe-inline' 제거 가능 → 임의 inline script 주입 공격 표면 0.

---

## 1. 현황

`public/_headers`:
```
Content-Security-Policy: ... script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ...
```

본 사이트의 inline script:
- BaseLayout.astro: 다크모드 깜빡임 방지 1줄
- Astro 자동 생성 inline (prefetch·hydration·sitelinks)
- JSON-LD `<script type="application/ld+json">` (구조화 데이터, 실행 X)
  - JSON-LD는 type이 application/ld+json이라 브라우저가 실행하지 않음 → CSP 우회 위험 X

---

## 2. nonce 도입의 어려움

### Astro 6 SSG 정적 HTML
- 빌드타임 nonce 생성 → HTML에 인라인 → 매 빌드마다 동일 nonce
- **단일 nonce는 큰 의미 없음** — 매 요청마다 변경되어야 보안 가치 있음

### 대안: hash 기반 CSP
- 빌드타임에 모든 inline script를 SHA-256 hash로 화이트리스트
- `script-src 'self' 'sha256-AAAAA...' 'sha256-BBBBB...'`
- Astro 자동 inline은 빌드마다 코드 동일 → hash도 안정적
- 다만 hash가 많아지면 헤더 크기 폭증

### Cloudflare Workers SSR 변환
- `output: 'static'` → `'hybrid'` 변환
- 모든 페이지에 미들웨어 — 매 요청마다 nonce 주입
- **PSI 100 SSG 이점 손실 위험** + Workers 비용 증가

---

## 3. 권장 접근 — 단계별

### Phase 1 (현재): 'unsafe-inline' 유지 + 다른 보안 가드 강화 ✓
- ✓ X-Frame-Options: SAMEORIGIN
- ✓ X-Content-Type-Options: nosniff
- ✓ Strict-Transport-Security
- ✓ object-src 'none'
- ✓ frame-ancestors 'self'
- ✓ form-action 'self'
- ✓ upgrade-insecure-requests

→ 'unsafe-inline'은 inline script가 외부에서 주입될 때만 위험. 본 사이트는 빌드 산출물만 inline → 위험 표면 매우 낮음.

### Phase 2 (선택): SHA-256 hash 화이트리스트
- 빌드 후 dist/**/*.html 파싱 → 모든 inline script 추출
- SHA-256 hash 계산 → public/_headers 자동 갱신
- 새 inline 추가될 때마다 hash 갱신 필요 → CI 자동화 권장

### Phase 3 (장기): nonce 진입 (SSR 전환 시)
- output: 'hybrid' + 미들웨어
- 매 요청마다 crypto.randomUUID() nonce → 모든 inline에 주입
- 비용: PSI 100 SSG 이점 일부 손실, Workers 요청수 증가

---

## 4. 결론

**Phase 1 유지 권장** — 현재 보안 가드가 견고하고 inline script 표면이 빌드 산출물 한정이라 nonce 비용이 효익보다 크다.

Phase 2 hash 자동화는 별도 1주일 작업 — 진입 시 우선순위 후보.

---

## 5. 참고

- https://content-security-policy.com/nonce/
- https://web.dev/articles/strict-csp
- Astro CSP 통합 ecosystem 솔루션:
  - astro-csp (커뮤니티)
  - 공식 통합 미존재 (2026-04 기준)
