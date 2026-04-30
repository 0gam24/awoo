import type { APIRoute } from 'astro';
import { logError } from '@/lib/api/error-log';
import { checkRateLimit, rateLimitHeaders } from '@/lib/api/rate-limit';
import { errorJson, getClientIp, hashIp, isAllowedOrigin, json } from '@/lib/api/utils';
import { feedbackSchema } from '@/lib/api/validation';

export const prerender = false;

const ALLOWED_ORIGINS = ['https://awoo.or.kr', 'https://www.awoo.or.kr'];

// Rate limit — IP 해시당 시간당 10건 (페이지당 1회 + 정정 여유)
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SEC = 60 * 60;

interface D1Database {
  prepare: (query: string) => {
    bind: (...args: unknown[]) => {
      run: () => Promise<unknown>;
    };
  };
}

interface KVNamespace {
  get: (key: string, options?: { type?: 'json' | 'text' }) => Promise<unknown>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
}

interface AnalyticsBinding {
  writeDataPoint?: (data: { blobs?: string[]; doubles?: number[]; indexes?: string[] }) => void;
}

interface Env {
  DB?: D1Database;
  RATE_LIMIT_KV?: KVNamespace;
  ANALYTICS?: AnalyticsBinding;
}

/**
 * "이 페이지 도움됐나요?" Y/N + 옵션 코멘트
 *
 * 저장: D1 `DB` 바인딩 있으면 INSERT, 없으면 console.log (개발 환경).
 * 봇 차단: honeypot `_hp` 필드 + Origin 검증.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isAllowedOrigin(request, ALLOWED_ORIGINS)) {
    return errorJson(403, 'origin_not_allowed');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'invalid_json');
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(400, 'invalid_payload', parsed.error.message);
  }

  const f = parsed.data;
  const ipHash = await hashIp(getClientIp(request));
  const ua = request.headers.get('user-agent')?.slice(0, 200) ?? null;
  const env = (locals as { runtime?: { env?: Env } }).runtime?.env;

  // Rate limit — IP 해시당 시간당 10건. KV 바인딩 있으면 글로벌.
  const rl = await checkRateLimit(`feedback:${ipHash}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SEC, {
    kv: env?.RATE_LIMIT_KV,
  });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        error: { code: 'rate_limited', detail: `${rl.retryAfterSeconds}초 후 재시도` },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          ...rateLimitHeaders(rl, RATE_LIMIT_MAX),
        },
      },
    );
  }

  if (env?.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO feedback (page_path, helpful, comment, user_agent, ip_hash, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      )
        .bind(f.page_path, f.helpful ? 1 : 0, f.comment ?? null, ua, ipHash)
        .run();
    } catch (e) {
      logError(env, {
        route: 'feedback',
        kind: 'db_insert_failed',
        detail: e instanceof Error ? e.message : String(e),
        ipHash,
      });
      return errorJson(500, 'storage_failed');
    }
  } else {
    console.log('[feedback] (no DB binding) ', { ...f, ipHash, ua });
  }

  return json({ ok: true }, { status: 200 });
};

export const GET: APIRoute = () => errorJson(405, 'method_not_allowed');
