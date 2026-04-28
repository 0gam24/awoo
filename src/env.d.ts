/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
      cf?: IncomingRequestCfProperties;
      ctx: ExecutionContext;
    };
  }
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
