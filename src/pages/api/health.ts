import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = false;

interface KVNamespace {
  get: (key: string) => Promise<string | null>;
}
interface AnalyticsBinding {
  writeDataPoint?: (data: unknown) => void;
}
interface Env {
  ANALYTICS?: AnalyticsBinding;
  RATE_LIMIT_KV?: KVNamespace;
  DB?: { prepare?: (q: string) => unknown };
}

/**
 * 운영 healthcheck — 외부 모니터링이 polling하기 좋은 엔드포인트.
 *
 * 응답:
 *   - status: ok / degraded / unhealthy
 *   - 콘텐츠 카운트 (subsidies / personas / issues)
 *   - 바인딩 가용성 (ANALYTICS / DB / KV)
 *   - 빌드 시각 (배포 ID 대용)
 *
 * 캐시:
 *   - public, max-age=60 (분 단위 신선도) — 외부 모니터링에 충분
 *
 * 인증 X — 민감 정보 노출 없음 (카운트만).
 */
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as { runtime?: { env?: Env } }).runtime?.env ?? {};

  let subsidies = 0;
  let personas = 0;
  let issues = 0;
  let collectionsOk = true;
  try {
    const [s, p, i] = await Promise.all([
      getCollection('subsidies'),
      getCollection('personas'),
      getCollection('issues'),
    ]);
    subsidies = s.length;
    personas = p.length;
    issues = i.length;
  } catch {
    collectionsOk = false;
  }

  const bindings = {
    analytics: !!env.ANALYTICS?.writeDataPoint,
    rateLimitKV: !!env.RATE_LIMIT_KV,
    db: !!env.DB?.prepare,
  };

  // 상태 판정
  let status: 'ok' | 'degraded' | 'unhealthy' = 'ok';
  if (!collectionsOk) status = 'unhealthy';
  // ANALYTICS 누락은 degraded (vitals 수집만 영향)
  else if (!bindings.analytics) status = 'degraded';

  const body = {
    status,
    timestamp: new Date().toISOString(),
    content: {
      subsidies,
      personas,
      issues,
      collectionsOk,
    },
    bindings,
    // 빌드 식별 — Cloudflare Pages는 commit hash를 CF_PAGES_COMMIT_SHA에 자동 주입 (있으면)
    build: {
      // 정적 추론 — 빌드타임 commit은 wrangler가 주입하지 않음. timestamp만 노출.
      generatedAt: typeof process !== 'undefined' ? new Date().toISOString() : null,
    },
  };

  const httpStatus = status === 'unhealthy' ? 503 : 200;

  return new Response(JSON.stringify(body, null, 2), {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Health-Status': status,
    },
  });
};

export const HEAD: APIRoute = async ({ locals }) => {
  const env = (locals as { runtime?: { env?: Env } }).runtime?.env ?? {};
  let ok = true;
  try {
    await getCollection('subsidies');
  } catch {
    ok = false;
  }
  return new Response(null, {
    status: ok ? 200 : 503,
    headers: {
      'Cache-Control': 'public, max-age=60',
      'X-Health-Status': ok ? 'ok' : 'unhealthy',
    },
  });
};
