// @ts-check

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import { issueUrlPath } from './src/lib/issue-url.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 빌드타임에 _gov24/_manifest.json 읽어 slug → modDate(ISO) 맵 구축
// sitemap의 lastmod에 활용 (SEO/GEO 신선도 신호)
// modDate(정부 수정일) 우선, 없으면 regDate(등록일) fallback — regDate만 쓰면
// 2026년에 갱신된 문서가 2020-12 등록일로 표기돼 "6년 미변경" 신호가 나간다.
const slugToLastmod = new Map();
try {
  const manifest = JSON.parse(
    readFileSync(join(__dirname, 'src/data/subsidies/_gov24/_manifest.json'), 'utf8'),
  );
  for (const entry of Object.values(manifest.items ?? {})) {
    const r = entry.modDate ?? entry.regDate;
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
// SEO 감사: 토픽 hub 84개 중 75개가 "언급 1회" 보일러플레이트 → 사이트 품질 평가 리스크.
// 언급 3회 미만 토픽은 noindex(topics/[term].astro isThin와 동일 기준) + sitemap 제외.
const thinTopicTerms = new Set(); // 언급 3회 미만 term
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
        // lastmod = 발행일과 updates 정정 이력 중 가장 최신 (freshness 신호 정확화)
        let iso = post.publishedAt || `${dirent.name}T00:00:00.000Z`;
        for (const u of post.updates ?? []) {
          if (u?.date && `${u.date}T00:00:00.000Z` > iso) iso = `${u.date}T00:00:00.000Z`;
        }
        // 무날짜 URL(2026-07-10 이후 발행분)과 날짜 경로(그 이전) 모두 실제 URL 기준으로 매핑
        issuePostLastmod.set(issueUrlPath(dirent.name, slug), iso);
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
    if ((entry?.totalCount ?? 0) < 3) thinTopicTerms.add(term);
  }
} catch {
  // graceful fallback
}

// Cross-ref 허브(카테고리×페르소나) 중 noindex(thin, 매칭 <5건) 페이지 — sitemap 제외 세트.
// 라우트는 MIN_RESULTS=2로 생성돼 내부 네비게이션은 유지하되, noindex 페이지가 sitemap에
// 실리는 GSC 충돌만 차단한다. 임계값은 persona/[persona].astro의 NOINDEX_THRESHOLD=5와 동기.
const thinCrossRefPaths = new Set();
try {
  const pairCounts = new Map(); // `${category}|${personaId}` → n
  for (const d of ['src/data/subsidies/_gov24', 'src/data/subsidies/_curated']) {
    for (const f of readdirSync(join(__dirname, d))) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      try {
        const s = JSON.parse(readFileSync(join(__dirname, d, f), 'utf8'));
        for (const pid of s.targetPersonas ?? []) {
          const k = `${s.category}|${pid}`;
          pairCounts.set(k, (pairCounts.get(k) ?? 0) + 1);
        }
      } catch {}
    }
  }
  for (const [k, n] of pairCounts) {
    if (n >= 2 && n < 5) {
      const [category, pid] = k.split('|');
      thinCrossRefPaths.add(`/subsidies/category/${encodeURIComponent(category)}/persona/${pid}/`);
    }
  }
} catch {
  // graceful fallback — 세트가 비면 제외 없이 기존 동작
}

// 언급 3회 미만 토픽 hub 판정 — sitemap filter용 (noindex와 동기)
/** @param {string} page */
const isThinTopicPage = (page) => {
  const m = new URL(page).pathname.match(/^\/issues\/topics\/([^/]+)\/$/);
  return m?.[1] ? thinTopicTerms.has(decodeURIComponent(m[1])) : false;
};

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
        !page.endsWith('/preferences/') &&
        // 마감 sweep 된 지원금 안내(noindex) — 색인·orphan 차단
        !page.includes('/subsidies/archived/') &&
        // noindex 페이지는 sitemap에서도 제외 (GSC "noindex URL in sitemap" 충돌 차단)
        !/\/issues\/all\/\d+\/$/.test(new URL(page).pathname) &&
        !thinCrossRefPaths.has(new URL(page).pathname) &&
        // 언급 3회 미만 토픽 hub(noindex) — sitemap 제외 (GSC noindex-in-sitemap 충돌 차단)
        !isThinTopicPage(page),
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
        // 이슈 포스트는 issuePostLastmod 키(실제 URL: 날짜 경로·무날짜 모두)로 판별 —
        // 정규식만 쓰면 무날짜 URL(2026-07-10+)이 기본 0.7로 새는 버그가 있었다.
        if (
          issuePostLastmod.has(path) ||
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
