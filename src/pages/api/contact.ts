import type { APIRoute } from 'astro';
import { logError } from '@/lib/api/error-log';
import { checkRateLimit, rateLimitHeaders } from '@/lib/api/rate-limit';
import {
  errorJson,
  getClientIp,
  hashIp,
  isAllowedOrigin,
  json,
  verifyTurnstile,
} from '@/lib/api/utils';
import { contactSchema } from '@/lib/api/validation';

export const prerender = false;

const ALLOWED_ORIGINS = ['https://awoo.or.kr', 'https://www.awoo.or.kr'];

// Rate limit — IP 해시당 시간당 3건 (스팸·DoS 차단; 정상 사용자는 영향 없음)
const RATE_LIMIT_MAX = 3;
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
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  ADMIN_EMAIL?: string;
}

/**
 * 문의 폼 — D1에 저장 + Resend로 어드민 이메일 발송.
 *
 * 환경변수 (없으면 graceful degrade):
 * - RESEND_API_KEY: Resend 발송 키
 * - TURNSTILE_SECRET_KEY: Cloudflare Turnstile 봇 차단
 * - ADMIN_EMAIL: 알림 수신처 (기본 smartdatashop@gmail.com — 운영 주체 이메일)
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

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(400, 'invalid_payload', parsed.error.message);
  }

  const c = parsed.data;
  const env = (locals as { runtime?: { env?: Env } }).runtime?.env ?? {};
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip);

  // Rate limit — IP 기반 시간당 3건 (양식 검증 통과 후 체크 — 잘못된 payload는 카운트 X)
  // KV 바인딩 있으면 글로벌, 없으면 per-isolate
  const rl = await checkRateLimit(`contact:${ipHash}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SEC, {
    kv: env.RATE_LIMIT_KV,
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

  // Turnstile 검증 — 시크릿 있을 때만
  if (env.TURNSTILE_SECRET_KEY) {
    const token = c['cf-turnstile-response'];
    if (!token) return errorJson(400, 'turnstile_required');
    const ok = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
    if (!ok) return errorJson(403, 'turnstile_failed');
  }

  // D1 저장
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO contact (name, email, subject, message, status, ip_hash, created_at)
         VALUES (?, ?, ?, ?, 'new', ?, datetime('now'))`,
      )
        .bind(c.name, c.email, c.subject, c.message, ipHash)
        .run();
    } catch (e) {
      logError(env, {
        route: 'contact',
        kind: 'db_insert_failed',
        detail: e instanceof Error ? e.message : String(e),
        ipHash,
      });
      // DB 실패해도 이메일은 시도 — 사용자 메시지 손실 회피
    }
  }

  // Resend 발송
  if (env.RESEND_API_KEY) {
    const adminEmail = env.ADMIN_EMAIL ?? 'smartdatashop@gmail.com';
    const subject = `[지원금가이드] ${c.subject}`;
    const html = `
      <h2>새 문의가 도착했습니다</h2>
      <p><strong>이름</strong>: ${escapeHtml(c.name)}</p>
      <p><strong>이메일</strong>: ${escapeHtml(c.email)}</p>
      <p><strong>제목</strong>: ${escapeHtml(c.subject)}</p>
      <hr />
      <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(c.message)}</pre>
      <hr />
      <p style="font-size:11px;color:#888">IP hash: ${ipHash} · UA: ${escapeHtml(request.headers.get('user-agent')?.slice(0, 200) ?? '')}</p>
    `;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'awoo.or.kr <noreply@awoo.or.kr>',
          to: [adminEmail],
          reply_to: c.email,
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        logError(env, {
          route: 'contact',
          kind: 'resend_failed',
          status: res.status,
          detail: text.slice(0, 100),
          ipHash,
        });
        return errorJson(502, 'email_send_failed');
      }
    } catch (e) {
      logError(env, {
        route: 'contact',
        kind: 'resend_network_error',
        detail: e instanceof Error ? e.message : String(e),
        ipHash,
      });
      return errorJson(502, 'email_network_error');
    }
  } else {
    console.log('[contact] (no RESEND_API_KEY) ', { ...c, ipHash });
  }

  return json({ ok: true }, { status: 200 });
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const GET: APIRoute = () => errorJson(405, 'method_not_allowed');
