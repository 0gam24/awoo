import type { APIRoute } from 'astro';
import { vitalsSchema } from '@/lib/api/validation';

export const prerender = false;

const ALLOWED_ORIGINS = ['https://awoo.or.kr', 'https://www.awoo.or.kr'];

/**
 * Web Vitals beacon — `navigator.sendBeacon('/api/vitals', JSON.stringify(...))`로 호출.
 * 사용자 액션 후 비동기 발송이라 PSI Lab 점수에 영향 없음.
 *
 * 저장: Cloudflare Analytics Engine 바인딩(`ANALYTICS`) 있으면 writeDataPoint,
 * 없으면 그냥 200 OK 반환 (개발 환경).
 */
export const POST: APIRoute = async ({ request, locals }) => {
  // CSRF 1차 방어 — 동일 출처만 허용 (브라우저 sendBeacon은 origin 헤더 자동 포함)
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = vitalsSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(null, { status: 400 });
  }

  const v = parsed.data;
  const env = (
    locals as { runtime?: { env?: { ANALYTICS?: { writeDataPoint: (p: unknown) => void } } } }
  ).runtime?.env;

  // Analytics Engine 바인딩 있으면 기록
  env?.ANALYTICS?.writeDataPoint({
    blobs: [
      v.name,
      v.path,
      v.device ?? 'unknown',
      v.connection ?? 'unknown',
      v.rating ?? 'unknown',
    ],
    doubles: [v.value],
    indexes: [v.name],
  });

  // 204 No Content — beacon에 적합 (응답 본문 불필요)
  return new Response(null, { status: 204 });
};

/**
 * GET 거절 (POST only)
 */
export const GET: APIRoute = () => new Response(null, { status: 405 });
