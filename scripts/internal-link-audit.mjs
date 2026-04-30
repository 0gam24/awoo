#!/usr/bin/env node
// internal-link-audit.mjs — 빌드 산출물의 내부 링크 그래프 감사
//
// 목적: SEO 트래픽 누수 지점(고립 페이지·딥페이지·과도한 dangling 링크)을 정량화
//
// 절차:
//   1. dist/client/**/*.html 모두 읽음
//   2. 각 페이지의 <a href="/..."> 내부 링크 추출
//   3. 그래프 구성: route → outgoing[]
//   4. 지표 계산:
//      - 고립 페이지 (incoming = 0, 단 홈/sitemap 제외)
//      - 딥 페이지 (홈에서 BFS 깊이 ≥ 4)
//      - dangling 링크 (참조됐지만 해당 라우트 산출물 없음)
//      - 평균 진입 깊이
//      - 가장 많이 참조되는 페이지 Top 10 (PageRank-lite)
//
// 출력: stdout JSON, 정상 종료 0, 빌드 미완료 시 1

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Astro Cloudflare 어댑터는 dist/ 직하 또는 dist/client/ 어느 쪽에 둘 수 있음
const HTML_ROOT = existsSync(path.join(DIST, 'client')) ? path.join(DIST, 'client') : DIST;

if (!existsSync(HTML_ROOT)) {
  console.error('dist/ 미발견. 먼저 npm run build 실행 필요.');
  process.exit(1);
}

function* walkHtml(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) yield full;
  }
}

function htmlPathToRoute(htmlPath) {
  const rel = path.relative(HTML_ROOT, htmlPath).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'/index.html'.length)}/`;
  if (rel === '404.html') return '/404';
  return `/${rel.replace(/\.html$/, '')}/`;
}

function extractLinks(html) {
  const out = new Set();
  const re = /<a\s+[^>]*href=("|')([^"']+)\1/gi;
  for (const m of html.matchAll(re)) {
    const href = m[2];
    if (!href) continue;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (/^https?:\/\//.test(href)) continue;
    let clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    if (!clean.startsWith('/')) continue;
    // URL 인코딩 정규화 — `/categories/주거/` vs `/categories/%EC%A3%BC%EA%B1%B0/` 동일 취급
    try {
      clean = decodeURIComponent(clean);
    } catch {
      // 잘못된 % 시퀀스는 원본 유지
    }
    out.add(clean);
  }
  return [...out];
}

const routes = new Set();
const outgoing = new Map(); // route -> Set<route>
const incoming = new Map(); // route -> Set<route>

for (const file of walkHtml(HTML_ROOT)) {
  const route = htmlPathToRoute(file);
  routes.add(route);
}

for (const file of walkHtml(HTML_ROOT)) {
  const route = htmlPathToRoute(file);
  const html = readFileSync(file, 'utf8');
  const links = extractLinks(html);
  outgoing.set(route, new Set(links));
  for (const target of links) {
    if (!incoming.has(target)) incoming.set(target, new Set());
    incoming.get(target).add(route);
  }
}

// 고립: 페이지 산출물은 있는데 incoming 0
const orphans = [];
for (const route of routes) {
  if (route === '/' || route === '/404') continue;
  if (route.startsWith('/api/')) continue; // API 라우트
  const inc = incoming.get(route);
  if (!inc || inc.size === 0) orphans.push(route);
}

// dangling: 참조됐지만 라우트 산출물 없음
const dangling = [];
for (const target of incoming.keys()) {
  if (target.startsWith('/api/')) continue;
  if (target.startsWith('/_')) continue;
  if (
    target.endsWith('.xml') ||
    target.endsWith('.txt') ||
    target.endsWith('.png') ||
    target.endsWith('.svg') ||
    target.endsWith('.ico') ||
    target.endsWith('.webmanifest') ||
    target.endsWith('.woff2') ||
    target.endsWith('.json')
  )
    continue;
  if (!routes.has(target))
    dangling.push({ target, referrers: [...incoming.get(target)].slice(0, 3) });
}

// BFS 깊이 (홈 기준)
const depth = new Map();
depth.set('/', 0);
const queue = ['/'];
while (queue.length) {
  const cur = queue.shift();
  const d = depth.get(cur);
  for (const next of outgoing.get(cur) || []) {
    if (!routes.has(next)) continue;
    if (depth.has(next)) continue;
    depth.set(next, d + 1);
    queue.push(next);
  }
}

const unreachable = [];
for (const route of routes) {
  if (!depth.has(route) && route !== '/404' && !route.startsWith('/api/')) {
    unreachable.push(route);
  }
}

const depths = [...depth.values()];
const avgDepth = depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;
const maxDepth = depths.length ? Math.max(...depths) : 0;
const deepPages = [...depth.entries()]
  .filter(([, d]) => d >= 4)
  .map(([r, d]) => ({ route: r, depth: d }));

// 인기 페이지 (incoming count 기준 Top 20)
const popularity = [...incoming.entries()]
  .filter(([r]) => routes.has(r))
  .map(([r, set]) => ({ route: r, incoming: set.size }))
  .sort((a, b) => b.incoming - a.incoming)
  .slice(0, 20);

const result = {
  generated_at: new Date().toISOString(),
  total_routes: routes.size,
  total_links: [...outgoing.values()].reduce((a, s) => a + s.size, 0),
  avg_depth: Number(avgDepth.toFixed(2)),
  max_depth: maxDepth,
  orphan_count: orphans.length,
  orphans: orphans.slice(0, 30),
  unreachable_count: unreachable.length,
  unreachable: unreachable.slice(0, 30),
  deep_page_count: deepPages.length,
  deep_pages_sample: deepPages.slice(0, 20),
  dangling_count: dangling.length,
  dangling_sample: dangling.slice(0, 20),
  popularity_top20: popularity,
};

console.log(JSON.stringify(result, null, 2));
process.exit(0);
