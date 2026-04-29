/**
 * 단순 레이트 리밋 — Cloudflare Workers per-isolate 메모리.
 *
 * 한계:
 *   - 단일 isolate 단위 (글로벌 분산 X). 한 isolate 안에서만 카운트.
 *   - 같은 IP가 다른 colo로 분산되면 우회 가능.
 *   - 그러나 실제 spam·brute force 대부분은 한 isolate에 집중되므로
 *     "0층 방어" 로 충분. 프로덕션 강화는 KV 바인딩 추가 후 키 저장으로 교체.
 *
 * 설계:
 *   - 고정 윈도우 카운터 (resetAt 시점에 재시작)
 *   - 메모리 폭증 방지: 윈도우 만료 시 lazy 정리
 *   - 키: `${endpoint}:${ipHash}` — 엔드포인트별 독립 한도
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000; // isolate 메모리 보호 — 초과 시 가장 오래된 키 정리

function gc(now: number): void {
  if (buckets.size < MAX_KEYS) return;
  // resetAt 오래된 것부터 절반 제거
  const sorted = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  const removeCount = Math.floor(buckets.size / 2);
  for (let i = 0; i < removeCount; i++) {
    buckets.delete(sorted[i]![0]);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * 카운터 증가 후 결과 반환. allowed=false면 한도 초과.
 *
 * @param key      고유 식별자 (보통 `endpoint:ipHash`)
 * @param max      윈도우 내 허용 횟수
 * @param windowSeconds  윈도우 길이 (초)
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  gc(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    // 새 윈도우 시작
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count++;
  return {
    allowed: true,
    remaining: max - bucket.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Rate limit 응답 헤더 생성 (Retry-After + X-RateLimit-* 표준)
 */
export function rateLimitHeaders(result: RateLimitResult, max: number): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(max),
    'X-RateLimit-Remaining': String(result.remaining),
  };
  if (!result.allowed) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return headers;
}
