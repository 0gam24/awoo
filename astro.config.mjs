// @ts-check

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
// 출력: 순수 정적 (PSI 100 우선). API 추가 시 @astrojs/cloudflare 어댑터 + 페이지별 prerender 사용.
export default defineConfig({
  site: 'https://awoo.or.kr',
  output: 'static',
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  build: {
    inlineStylesheets: 'auto',
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      cssCodeSplit: true,
    },
  },
});
