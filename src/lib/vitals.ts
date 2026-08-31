/**
 * Web Vitals 실측 — 사용자 액션 후 sendBeacon으로 비동기 전송
 * 첫 페이지 로드 LCP/INP/CLS에 영향 없음 (PSI Lab 점수 무관)
 *
 * 사용법: BaseLayout 또는 페이지에서
 *   <script>import('@/lib/vitals').then(m => m.initVitals())</script>
 */

import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

const ENDPOINT = '/api/vitals';

// 로컬 호스트에서는 비콘을 쏘지 않는다.
// Lighthouse CI는 dist/client를 정적 서버로 띄우므로 /api/vitals(Worker 라우트)가 없고,
// 404가 콘솔 에러로 남아 best-practices의 errors-in-console 감사를 0점으로 만든다.
// 측정 자체(web-vitals 로딩·콜백)는 그대로 돌려 실제 런타임 비용은 계속 잰다.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const canSend = (): boolean => !LOCAL_HOSTS.has(location.hostname);

const send = (metric: Metric): void => {
  if (!canSend()) return;

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
