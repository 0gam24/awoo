# Web Vitals 측정·분석 Runbook

운영 단일 진실 소스 — LCP/CLS/INP 회귀 측정·해석.

## 1. Lab 측정 (Lighthouse CI)

빌드 후 로컬에서 실행. 7개 핫스팟 페이지 대상.

```bash
npm run build
npm run lhci  # → .lighthouseci/ JSON 산출 + temporary-public-storage 업로드 URL
```

**대상 페이지** (`lighthouserc.json` URL 배열):
- `/` (홈 — NewsHero LCP 후보)
- `/about/`
- `/quick/` (5분 진단 — 30KB inline JSON, LCP 모니터링 핵심)
- `/issues/`
- `/issues/all/` (페이지네이션 첫 페이지)
- `/subsidies/`
- `/personas/`

**임계값** (lighthouserc.json `assert`):
| 메트릭 | 임계값 | 정책 |
|---|---|---|
| Performance | 1.0 (100점) | error |
| LCP | ≤ 2500ms | error |
| CLS | ≤ 0.1 | error |
| TBT | ≤ 200ms | error |
| INP | ≤ 150ms | warn |
| TTI | ≤ 3000ms | warn |

회귀 시 다음 사이클 P0로 등록.

## 2. Field 측정 (Cloudflare Analytics Engine)

프로덕션 사용자 실측치 — `navigator.sendBeacon('/api/vitals')`로 자동 수집 ([src/pages/api/vitals.ts](../../src/pages/api/vitals.ts)).

### 데이터 스키마

```
ANALYTICS dataset (writeDataPoint):
  blobs: [name, path, device, connection, rating]
  doubles: [value]
  indexes: [name]
```

- `name`: `LCP` / `CLS` / `INP` / `FID` / `FCP` / `TTFB`
- `path`: URL pathname
- `device`: `mobile` / `desktop` / `tablet`
- `connection`: `4g` / `3g` 등
- `rating`: `good` / `needs-improvement` / `poor` (web-vitals 기본 분류)
- `value`: 메트릭 raw 값 (ms 또는 score)

### 쿼리 예시 (Cloudflare SQL API)

> 실행 시 사용자 작업: Cloudflare Dashboard → Workers & Pages → Analytics Engine → SQL Editor

**핵심 페이지별 7일 LCP p75**:
```sql
SELECT
  blob2 AS path,
  quantile(0.75)(double1) AS lcp_p75,
  count() AS samples
FROM awoo_vitals
WHERE blob1 = 'LCP'
  AND timestamp > NOW() - INTERVAL '7' DAY
  AND blob2 IN ('/', '/quick/', '/issues/', '/subsidies/')
GROUP BY blob2
ORDER BY lcp_p75 DESC
```

**디바이스별 INP 분포**:
```sql
SELECT
  blob3 AS device,
  blob5 AS rating,
  count() AS n
FROM awoo_vitals
WHERE blob1 = 'INP'
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY blob3, blob5
ORDER BY blob3, blob5
```

**poor rating 페이지 Top 10**:
```sql
SELECT
  blob2 AS path,
  blob1 AS metric,
  count() AS poor_count
FROM awoo_vitals
WHERE blob5 = 'poor'
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY blob2, blob1
ORDER BY poor_count DESC
LIMIT 10
```

## 3. 해석 가이드

### LCP (Largest Contentful Paint)
- p75 ≤ 2500ms: ✅ Good
- p75 ≤ 4000ms: ⚠ Needs improvement
- p75 > 4000ms: ❌ Poor

핫스팟: 홈 hero `news-headline` `clamp(28px, 3.6vw, 44px)` 텍스트, `/quick` `news-headline` 텍스트.

### CLS (Cumulative Layout Shift)
- p75 ≤ 0.1: ✅ Good
- p75 ≤ 0.25: ⚠ Needs improvement
- p75 > 0.25: ❌ Poor

회귀 의심: 동적 카드 인서트 (recent-posts row, /quick filter chip 클릭). Cycle #10 P1-4·P2-11에서 min-height 예약함.

### INP (Interaction to Next Paint)
- p75 ≤ 200ms: ✅ Good
- p75 ≤ 500ms: ⚠ Needs improvement
- p75 > 500ms: ❌ Poor

회귀 의심: `/quick` 폼 제출 시 `runMatch()` (compactSubsidies 순회 ~150건). 저속 디바이스 영향 점검.

## 4. 운영 주기

- **매 사이클**: lhci 1회 실행, 회귀 시 P0 등록
- **주간**: Cloudflare SQL 쿼리 (위 3개) 실행, ops/observations/{date}.md에 기록
- **회귀 알람**: lhci `error` 임계 초과 시 빌드 실패 → CI 차단 (현재 활성화 안 됨, 별도 사이클로 검토)

## 5. 알려진 측정 제약

- lhci `staticDistDir` 모드는 service worker 시뮬레이션 X — 정적 HTML만 평가
- Cloudflare Analytics는 ratelimit 분당 60건/IP (`vitals.ts` Cycle #6 P0-7)
- `/quick` LCP는 폰트 swap에 의존 — Pretendard subset preload 의도적 회피 (size-adjust fallback 사용)
