// @ts-check

import { readdirSync, readFileSync } from 'node:fs';
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
const slugToLastmod = new Map();
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

// Cycle #11 P2-8: 영구 포스트 publishedAt → lastmod (sitemap freshness)
// 트렌딩 토픽 hub의 lastSeen → lastmod 보강 (auto-curation 신호)
const issuePostLastmod = new Map(); // /issues/{date}/{slug}/ → ISO
const topicHubLastmod = new Map(); // {term} → ISO (lastSeen)
try {
  const issuesDir = join(__dirname, 'src/data/issues');
  const dateDirs = readdirSync(issuesDir, { withFileTypes: true });
  for (const dirent of dateDirs) {
    if (!dirent.isDirectory()) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dirent.name)) continue;
    const dayPath = join(issuesDir, dirent.name);
    for (const f of readdirSync(dayPath)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      try {
        const post = JSON.parse(readFileSync(join(dayPath, f), 'utf8'));
        const slug = f.replace(/\.json$/, '');
        const iso = post.publishedAt || `${dirent.name}T00:00:00.000Z`;
        issuePostLastmod.set(`/issues/${dirent.name}/${slug}/`, iso);
      } catch {}
    }
  }
  // History — 토픽 hub freshness
  const history = JSON.parse(
    readFileSync(join(__dirname, 'src/data/issues/_history.json'), 'utf8'),
  );
  for (const [term, entry] of Object.entries(history.byTerm ?? {})) {
    if (entry?.lastSeen && /^\d{4}-\d{2}-\d{2}$/.test(entry.lastSeen)) {
      topicHubLastmod.set(term, `${entry.lastSeen}T00:00:00.000Z`);
    }
  }
} catch {
  // graceful fallback
}

// https://astro.build/config
// 출력: 순수 정적 (PSI 100 우선). API 추가 시 @astrojs/cloudflare 어댑터 + 페이지별 prerender 사용.
export default defineConfig({
  site: 'https://awoo.or.kr',
  output: 'static',
  trailingSlash: 'always',

  // 전체 내부 링크 hover 시 prefetch — 클릭 시 즉시 로드 (perceived perf).
  // 'hover' 전략은 사용자가 의도적으로 호버한 링크만 미리 가져와 대역폭 낭비 X.
  prefetch: {
    prefetchAll: true,
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
      // /issues/main/은 meta refresh redirect 라우트 — 인덱싱 노이즈 차단 (Cycle #2 P0-6)
      // /preferences/ 는 Cycle #7에서 사용자 진입점 제거 + noindex — sitemap에서도 제외 (Cycle #12 P1-5)
      filter: (page) =>
        !page.endsWith('/issues/main/') &&
        !page.endsWith('/demo/') &&
        !page.endsWith('/preferences/'),
      i18n: {
        defaultLocale: 'ko',
        locales: { ko: 'ko-KR' },
      },
      serialize(item) {
        // 1) subsidies 상세 — _gov24 manifest의 regDate를 lastmod로 주입
        const subsidyMatch = item.url.match(/\/subsidies\/([^/]+)\/?$/);
        if (subsidyMatch && slugToLastmod.has(subsidyMatch[1])) {
          item.lastmod = slugToLastmod.get(subsidyMatch[1]);
        }

        // Cycle #11 P2-8: 영구 포스트 publishedAt → lastmod (freshness 신호)
        const postPath = item.url.replace(/^https?:\/\/[^/]+/, '');
        if (issuePostLastmod.has(postPath)) {
          item.lastmod = issuePostLastmod.get(postPath);
        }

        // Cycle #11 P2-8: 토픽 hub lastSeen → lastmod
        const topicMatch = postPath.match(/^\/issues\/topics\/([^/]+)\/$/);
        if (topicMatch?.[1]) {
          const term = decodeURIComponent(topicMatch[1]);
          if (topicHubLastmod.has(term)) {
            item.lastmod = topicHubLastmod.get(term);
          }
        }

        // 2) 페이지 타입별 priority/changefreq 차등화
        //    홈·issues·subsidies·trending hub = 신선도·중요도 모두 높음 → daily/0.9
        //    개별 issues 포스트 / subsidy 상세 / persona·situation·category·topic hub = weekly/0.8
        //    glossary·about·contact·terms·privacy 등 evergreen = monthly/0.5
        const url = item.url;
        const path = url.replace(/^https?:\/\/[^/]+/, '');

        // daily / 0.9 — 자주 갱신되는 hub 인덱스
        if (
          path === '/' ||
          path === '/issues/' ||
          path === '/subsidies/' ||
          path === '/subsidies/new/' ||
          /^\/issues\/topics\/[^/]+\/$/.test(path) ||
          path === '/personas/' ||
          path === '/situations/' ||
          path === '/categories/' ||
          path === '/topics/'
        ) {
          item.changefreq = /** @type {any} */ ('daily');
          item.priority = 0.9;
          return item;
        }

        // weekly / 0.8 — 개별 콘텐츠
        if (
          /^\/issues\/\d{4}-\d{2}-\d{2}\/[^/]+\/$/.test(path) ||
          /^\/subsidies\/[^/]+\/$/.test(path) ||
          /^\/personas\/[^/]+\/$/.test(path) ||
          /^\/situations\/[^/]+\/$/.test(path) ||
          /^\/categories\/[^/]+\/$/.test(path) ||
          /^\/topics\/[^/]+\/$/.test(path) ||
          /^\/subsidies\/category\/[^/]+\/persona\/[^/]+\/$/.test(path)
        ) {
          item.changefreq = /** @type {any} */ ('weekly');
          item.priority = 0.8;
          return item;
        }

        // monthly / 0.5 — evergreen 정보 페이지
        if (
          path === '/about/' ||
          path === '/contact/' ||
          path === '/guide/' ||
          path === '/quick/' ||
          path === '/glossary/' ||
          path === '/preferences/' ||
          path === '/editorial-policy/' ||
          path === '/cookies/' ||
          path === '/privacy/' ||
          path === '/terms/' ||
          /^\/glossary\/[^/]+\/$/.test(path)
        ) {
          item.changefreq = /** @type {any} */ ('monthly');
          item.priority = 0.5;
          return item;
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
