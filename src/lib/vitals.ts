/**
 * Web Vitals 실측 — 사용자 액션 후 sendBeacon으로 비동기 전송
 * 첫 페이지 로드 LCP/INP/CLS에 영향 없음 (PSI Lab 점수 무관)
 *
 * 사용법: BaseLayout 또는 페이지에서
 *   <script>import('@/lib/vitals').then(m => m.initVitals())</script>
 */

import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

const ENDPOINT = '/api/vitals';

const send = (metric: Metric): void => {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    path: location.pathname,
    device: matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop',
    connection: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
      ?.effectiveType,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, body);
  } else {
    fetch(ENDPOINT, { body, method: 'POST', keepalive: true }).catch(() => {
      // beacon 실패 무시 — 분석용
    });
  }
};

export const initVitals = (): void => {
  onCLS(send);
  onINP(send);
  onLCP(send);
  onFCP(send);
  onTTFB(send);
};
