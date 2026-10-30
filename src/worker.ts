/**
 * Worker 진입점 — Astro 어댑터 handler 앞에서 옛 도메인 주소만 410으로 끊는다.
 * 나머지 요청(정적 파일에 없는 주소·/api/*·빌드 시 프리렌더)은 그대로 Astro로 넘긴다.
 * 배경: src/lib/legacy-gone.ts
 */
import { handle } from '@astrojs/cloudflare/handler';
import { legacyGoneResponse } from './lib/legacy-gone';

type HandleArgs = Parameters<typeof handle>;

export default {
  async fetch(request: HandleArgs[0], env: HandleArgs[1], ctx: HandleArgs[2]) {
    return legacyGoneResponse(new URL(request.url)) ?? handle(request, env, ctx);
  },
};
