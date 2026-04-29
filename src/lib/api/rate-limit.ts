/**
 * 레이트 리밋 — 듀얼 백엔드 (KV 우선, in-memory 폴백).
 *
 * 우선순위:
 *   1. KV 바인딩 제공 → 글로벌 분산 카운트 (정확하지만 ~10ms 지연)
 *   2. KV 미제공 → per-isolate 메모리 (지연 0, 단일 colo 한정)
 *
 * 마이그레이션 경로:
 *   - 현재: in-memory only (KV 미바인딩)
 *   - KV 활성화 시 wrangler.jsonc에 RATE_LIMIT_KV 바인딩 추가만 하면 자동 전환
 *
 * 설계:
 *   - 고정 윈도우 카운터 (resetAt 시점에 재시작)
 *   - 메모리 백엔드: 윈도우 만료 시 lazy GC (MAX_KEYS=10,000)
 *   - KV 백엔드: TTL=windowSeconds로 키 자동 만료
 *   - 키 형식: `${endpoint}:${ipHash}` — 엔드포인트별 독립 한도
 */

interface Bucket {
  count: number;
  resetAt: number;
}

// ─────────────────────────────────────────────────────────────
// In-memory 백엔드 (per-isolate)
// ─────────────────────────────────────────────────────────────
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function gc(): void {
  if (buckets.size < MAX_KEYS) return;
  const sorted = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  const removeCount = Math.floor(buckets.size / 2);
  for (let i = 0; i < removeCount; i++) {
    buckets.delete(sorted[i]![0]);
  }
}

function checkMemory(key: string, max: number, windowSeconds: number): RateLimitResult {
  gc();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
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

// ─────────────────────────────────────────────────────────────
// KV 백엔드 (글로벌 분산)
// ─────────────────────────────────────────────────────────────
export interface KVNamespaceLike {
  get: (key: string, options?: { type?: 'json' | 'text' }) => Promise<unknown>;
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>;
}

async function checkKV(
  kv: KVNamespaceLike,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  // KV는 read-modify-write race가 가능하지만 spam 방어 수준에서는 허용 가능.
  // 정확도 99% 충분 — 정확도 100% 필요 시 Durable Objects 사용.
  const raw = (await kv.get(key, { type: 'json' })) as Bucket | null;

  if (!raw || raw.resetAt <= now) {
    const newBucket: Bucket = { count: 1, resetAt: now + windowSeconds * 1000 };
    await kv.put(key, JSON.stringify(newBucket), { expirationTtl: windowSeconds });
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (raw.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((raw.resetAt - now) / 1000),
    };
  }

  raw.count++;
  await kv.put(key, JSON.stringify(raw), {
    expirationTtl: Math.max(1, Math.ceil((raw.resetAt - now) / 1000)),
  });
  return {
    allowed: true,
    remaining: max - raw.count,
    retryAfterSeconds: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** KV namespace (optional). 없으면 in-memory 사용. */
  kv?: KVNamespaceLike;
}

/**
 * 카운터 증가 후 결과 반환. allowed=false면 한도 초과.
 *
 * @param key      고유 식별자 (보통 `endpoint:ipHash`)
 * @param max      윈도우 내 허용 횟수
 * @param windowSeconds  윈도우 길이 (초)
 * @param opts     KV 바인딩 (선택). 제공 시 글로벌 분산 카운트.
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  opts?: RateLimitOptions,
): RateLimitResult | Promise<RateLimitResult> {
  if (opts?.kv) {
    return checkKV(opts.kv, key, max, windowSeconds);
  }
  return checkMemory(key, max, windowSeconds);
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
