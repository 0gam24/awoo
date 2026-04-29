/**
 * Cloudflare Analytics Engine 에러 이벤트 로그.
 *
 * 정체성:
 *   - PII 미저장 — IP hash 16char prefix, 메시지는 카테고리만 저장
 *   - error message는 cardinality 폭발 회피 위해 first 100char만
 *
 * 사용:
 *   logError(env, { route: 'contact', kind: 'turnstile_failed', detail: '...' });
 */

interface AnalyticsBinding {
  writeDataPoint?: (data: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }) => void;
}

export interface ErrorEvent {
  /** 라우트 명 (contact·feedback·vitals·sync 등) */
  route: string;
  /** 에러 카테고리 (cardinality 낮게 유지) */
  kind: string;
  /** 옵션 — 첫 100자만 저장 */
  detail?: string;
  /** HTTP status code */
  status?: number;
  /** ip hash 16char prefix (옵션) */
  ipHash?: string;
}

const MAX_DETAIL_CHARS = 100;

export function logError(env: { ANALYTICS?: AnalyticsBinding } | undefined, evt: ErrorEvent): void {
  // 콘솔 출력 (Cloudflare Workers 로그)
  console.error(`[err] ${evt.route} ${evt.kind}${evt.status ? ` ${evt.status}` : ''}${evt.detail ? `: ${evt.detail.slice(0, 200)}` : ''}`);

  // Analytics Engine 기록 (있을 때만)
  const ae = env?.ANALYTICS;
  if (!ae?.writeDataPoint) return;

  try {
    ae.writeDataPoint({
      blobs: [
        evt.route,
        evt.kind,
        (evt.detail ?? '').slice(0, MAX_DETAIL_CHARS),
        evt.ipHash ?? '',
      ],
      doubles: [evt.status ?? 0],
      // indexes는 검색·sampling 친화 — 라우트 단위로 그루핑
      indexes: [evt.route],
    });
  } catch {
    // Analytics Engine 실패 무시 (관측 자체가 SPOF 되면 안 됨)
  }
}
