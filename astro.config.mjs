// @ts-check

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 빌드타임에 _gov24/_manifest.json 읽어 slug → regDate(ISO) 맵 구축
// sitemap의 lastmod에 활용 (SEO/GEO 신선도 신호)
let slugToLastmod = new Map();
try {
  const manifest = JSON.parse(
    readFileSync(join(__dirname, 'src/data/subsidies/_gov24/_manifest.json'), 'utf8'),
  );
  for (const entry of Object.values(manifest.items ?? {})) {
    const r = entry.regDate;
    if (typeof r === 'string' && r.length >= 8) {
      const iso = `${r.slice(0, 4)}-${r.slice(4, 6)}-${r.slice(6, 8)}T00:00:00.000Z`;
      slugToLastmod.set(entry.slug, iso);
    }
  }
} catch {
  // manifest 없으면 lastmod 미주입 (정적 fallback)
}

// https://astro.build/config
// 출력: 순수 정적 (PSI 100 우선). API 추가 시 @astrojs/cloudflare 어댑터 + 페이지별 prerender 사용.
export default defineConfig({
  site: 'https://awoo.or.kr',
  output: 'static',
  trailingSlash: 'always',

  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },

  build: {
    inlineStylesheets: 'always',
  },

  integrations: [
    react(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      i18n: {
        defaultLocale: 'ko',
        locales: { ko: 'ko-KR' },
      },
      serialize(item) {
        const m = item.url.match(/\/subsidies\/([^/]+)\/?$/);
        if (m && slugToLastmod.has(m[1])) {
          item.lastmod = slugToLastmod.get(m[1]);
        }
        return item;
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    build: {
      cssCodeSplit: true,
    },
  },

  adapter: cloudflare(),
});
