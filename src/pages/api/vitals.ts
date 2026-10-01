import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { getClientIp, hashIp } from '@/lib/api/utils';
import { vitalsSchema } from '@/lib/api/validation';

export const prerender = false;

const ALLOWED_ORIGINS = ['https://awoo.or.kr', 'https://www.awoo.or.kr'];

// Cycle #6 P0-7: vitals rate limit — IP 해시당 분당 60건 (정상 페이지뷰 여유)
// 동일 출처 봇·탭 폭주 시 ANALYTICS writeDataPoint 비용 차단
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SEC = 60;

/**
 * Web Vitals beacon — `navigator.sendBeacon('/api/vitals', JSON.stringify(...))`로 호출.
 * 사용자 액션 후 비동기 발송이라 PSI Lab 점수에 영향 없음.
 *
 * 저장: Cloudflare Analytics Engine 바인딩(`ANALYTICS`) 있으면 writeDataPoint,
 * 없으면 그냥 204 반환 (개발 환경).
 *
 * 분석용 비콘이라 실패는 조용히 버린다 — 한도 초과·기록 실패도 204.
 * 비콘이 4xx/5xx를 받으면 방문자 브라우저 콘솔에 빨간 줄이 남는다.
 */
export const POST: APIRoute = async ({ request }) => {
  // CSRF 1차 방어 — 동일 출처만 허용 (브라우저 sendBeacon은 origin 헤더 자동 포함)
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  // Cycle #6 P0-7: IP 해시 rate limit (분당 60건, 메모리 백엔드)
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip);
  const rl = await Promise.resolve(
    checkRateLimit(`vitals:${ipHash}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SEC),
  );
  // 통신사 NAT처럼 한 IP를 여럿이 나눠 쓰면 정상 방문자도 한도에 걸린다 — 거절 대신 버린다.
  if (!rl.allowed) {
    return new Response(null, { status: 204 });
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

  // Analytics Engine 바인딩 있으면 기록 (실패해도 응답은 204 — 관측이 장애가 되면 안 됨)
  try {
    env.ANALYTICS?.writeDataPoint({
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
  } catch {
    // 기록 실패 무시
  }

  // 204 No Content — beacon에 적합 (응답 본문 불필요)
  return new Response(null, { status: 204 });
};

/**
 * GET 거절 (POST only)
 */
export const GET: APIRoute = () => new Response(null, { status: 405 });
