/**
 * SHA-256으로 IP를 해시 (개보법: 원본 IP 저장 금지).
 * 일별 솔트 권장이지만 단순화를 위해 고정 솔트 + IP만 사용.
 */
export const hashIp = async (ip: string): Promise<string> => {
  const data = new TextEncoder().encode(`awoo:${ip}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16); // 16자 prefix만 (충돌 가능성 무시 가능, 추적 불가능 강화)
};

/**
 * Cloudflare Workers에서 클라이언트 IP 추출
 */
export const getClientIp = (request: Request): string =>
  request.headers.get('cf-connecting-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  '0.0.0.0';

/**
 * Origin 헤더로 CSRF 1차 방어. 동일 출처(same-origin)만 허용.
 */
export const isAllowedOrigin = (request: Request, allowed: string[]): boolean => {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return allowed.includes(origin);
};

/**
 * 표준 JSON 응답
 */
export const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  });

/**
 * 에러 응답 표준화
 */
export const errorJson = (status: number, code: string, detail?: string): Response =>
  json({ error: { code, detail } }, { status });

/**
 * Cloudflare Turnstile 검증
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export const verifyTurnstile = async (
  token: string,
  secret: string,
  ip?: string,
): Promise<boolean> => {
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  if (ip) form.set('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
};
