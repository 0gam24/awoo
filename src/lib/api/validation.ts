import { z } from 'zod';

/**
 * Web Vitals beacon — sendBeacon() 페이로드
 */
export const vitalsSchema = z.object({
  name: z.enum(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']),
  value: z.number().min(0).max(60_000),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  id: z.string().min(1).max(80),
  path: z.string().max(255),
  device: z.enum(['mobile', 'desktop']).optional(),
  connection: z.string().max(20).optional(),
});

export type VitalsPayload = z.infer<typeof vitalsSchema>;

/**
 * Feedback — "이 페이지 도움됐나요?"
 */
export const feedbackSchema = z.object({
  page_path: z.string().min(1).max(500),
  helpful: z.boolean(),
  comment: z.string().max(2000).optional(),
  // honeypot — 봇이 이 필드를 채우면 거부
  // biome-ignore lint/style/useNamingConvention: form field name
  _hp: z.string().max(0).optional(),
});

export type FeedbackPayload = z.infer<typeof feedbackSchema>;

/**
 * Contact — 문의 폼
 */
export const contactSchema = z.object({
  name: z.string().min(1).max(60),
  email: z.string().email().max(120),
  subject: z.string().min(2).max(120),
  message: z.string().min(10).max(4000),
  // Turnstile token (선택 — 환경변수에 secret 있을 때만 검증)
  // biome-ignore lint/style/useNamingConvention: Cloudflare Turnstile 표준 필드명
  'cf-turnstile-response': z.string().min(1).max(2048).optional(),
  // honeypot
  // biome-ignore lint/style/useNamingConvention: form field name
  _hp: z.string().max(0).optional(),
});

export type ContactPayload = z.infer<typeof contactSchema>;
