/// <reference path="../.astro/types.d.ts" />

// Astro.locals 타입은 @astrojs/cloudflare가 준다 (cfContext만). locals.runtime은 Astro 6에서 제거됐고,
// locals.runtime.env는 읽는 순간 throw한다 — 2026-10-02 /api/* 전부 500이던 원인.

/**
 * Worker 바인딩·시크릿을 읽는 유일한 길: `import { env } from 'cloudflare:workers'`.
 * `wrangler types`로 worker-configuration.d.ts를 만들면 거기에도 같은 선언이 생기니 이 블록을 지울 것.
 */
declare module 'cloudflare:workers' {
  export const env: Env;
}

/**
 * Cloudflare Worker 바인딩 타입 — wrangler.jsonc와 매칭
 */
interface Env {
  /** D1 — 피드백·문의 저장 (Phase A) */
  DB?: D1Database;

  /** Analytics Engine — Web Vitals 시계열 (Phase A) */
  ANALYTICS?: AnalyticsEngineDataset;

  /** Resend API 키 (시크릿) */
  RESEND_API_KEY?: string;

  /** Cloudflare Turnstile 시크릿 (시크릿) */
  TURNSTILE_SECRET_KEY?: string;

  /** 어드민 알림 수신 이메일 */
  ADMIN_EMAIL?: string;
}
