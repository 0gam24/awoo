/**
 * Worker 진입점 — Astro 어댑터 handler 앞에서 네이버 웹마스터 가이드(HTTP 규약·색인 효율성)에 맞게
 * 상태 코드를 바로잡는다. 나머지 요청(정적 파일에 없는 주소·/api/*·빌드 시 프리렌더)은 그대로 Astro로.
 *   - 옛 도메인 워드프레스 주소(경로·첫 화면 쿼리) → 410 (src/lib/legacy-gone.ts)
 *   - /404 · /404.html 직접 요청 → 404 (예전엔 200으로 "없음" 페이지가 나갔다)
 *   - 잘못된 퍼센트 인코딩 주소 → 404 (예전엔 Worker 예외로 500)
 * "/"와 "/404*"는 정적 파일이 Worker보다 먼저 응답하므로 wrangler.jsonc assets.run_worker_first에 넣었다.
 */
import { handle } from '@astrojs/cloudflare/handler';
import { legacyGoneResponse } from './lib/legacy-gone';

type HandleArgs = Parameters<typeof handle>;

async function notFound(env: HandleArgs[1], url: URL): Promise<Response> {
  const page = await env.ASSETS.fetch(new URL('/404', url.origin));
  return new Response(page.body, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
  });
}

export default {
  async fetch(request: HandleArgs[0], env: HandleArgs[1], ctx: HandleArgs[2]) {
    const url = new URL(request.url);

    const gone = legacyGoneResponse(url);
    if (gone) return gone;

    try {
      decodeURIComponent(url.pathname);
    } catch {
      return notFound(env, url);
    }

    if (url.pathname === '/404' || url.pathname === '/404/' || url.pathname === '/404.html') {
      return notFound(env, url);
    }

    // run_worker_first로 들어온 첫 화면 요청은 정적 파일을 그대로 돌려준다
    if (url.pathname === '/') return env.ASSETS.fetch(request);

    return handle(request, env, ctx);
  },
};
