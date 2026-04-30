#!/usr/bin/env node
// check-bundle-size.mjs — 빌드 산출물 크기 가드
//
// 목적: 인라인 CSS·JS 회귀를 빌드 시점에 차단 (PSI 4×100 안전망)
// 호출: npm run build 후 자동 실행 (postbuild hook)
//
// 임계값:
//   - 홈 (/index.html) gzip 50KB
//   - 일반 페이지 평균 gzip 70KB
//   - 단일 페이지 max gzip 100KB
//
// 위반 시 process.exit(1) → CI 빌드 fail. 임계값 변경은 본 파일 + lighthouserc.json 동기.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HTML_ROOT = existsSync(path.join(DIST, 'client')) ? path.join(DIST, 'client') : DIST;

const THRESHOLDS = {
  home_gzip_max: 50 * 1024,       // 50KB
  page_gzip_max: 100 * 1024,      // 단일 페이지 100KB
  page_gzip_avg_max: 70 * 1024,   // 평균 70KB
};

if (!existsSync(HTML_ROOT)) {
  console.error('[bundle-size] dist/ 미발견. npm run build 먼저 실행 필요.');
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
  return `/${rel.replace(/\.html$/, '')}/`;
}

const violations = [];
const sizes = [];
let homeSize = null;

for (const file of walkHtml(HTML_ROOT)) {
  const route = htmlPathToRoute(file);
  if (route.startsWith('/api/') || route === '/404') continue;

  const raw = readFileSync(file);
  const gzipBytes = gzipSync(raw, { level: 6 }).length;
  sizes.push({ route, raw: raw.length, gzip: gzipBytes });

  if (route === '/') {
    homeSize = gzipBytes;
    if (gzipBytes > THRESHOLDS.home_gzip_max) {
      violations.push({
        route,
        type: 'home_gzip_exceeded',
        actual_kb: (gzipBytes / 1024).toFixed(1),
        limit_kb: (THRESHOLDS.home_gzip_max / 1024).toFixed(1),
      });
    }
  }

  if (gzipBytes > THRESHOLDS.page_gzip_max) {
    violations.push({
      route,
      type: 'page_gzip_exceeded',
      actual_kb: (gzipBytes / 1024).toFixed(1),
      limit_kb: (THRESHOLDS.page_gzip_max / 1024).toFixed(1),
    });
  }
}

const avg = sizes.reduce((s, p) => s + p.gzip, 0) / Math.max(sizes.length, 1);
if (avg > THRESHOLDS.page_gzip_avg_max) {
  violations.push({
    route: '<all>',
    type: 'avg_gzip_exceeded',
    actual_kb: (avg / 1024).toFixed(1),
    limit_kb: (THRESHOLDS.page_gzip_avg_max / 1024).toFixed(1),
  });
}

const top10 = [...sizes].sort((a, b) => b.gzip - a.gzip).slice(0, 10);

console.log('[bundle-size] HTML gzip size 검사');
console.log(`  총 페이지: ${sizes.length}`);
console.log(`  홈: ${homeSize !== null ? (homeSize / 1024).toFixed(1) : '?'} KB (한도 ${(THRESHOLDS.home_gzip_max / 1024).toFixed(0)} KB)`);
console.log(`  평균: ${(avg / 1024).toFixed(1)} KB (한도 ${(THRESHOLDS.page_gzip_avg_max / 1024).toFixed(0)} KB)`);
console.log('  상위 10:');
for (const p of top10) {
  console.log(`    ${(p.gzip / 1024).toFixed(1).padStart(6)} KB  ${p.route}`);
}

if (violations.length > 0) {
  console.error(`\n[bundle-size] ❌ 위반 ${violations.length}건`);
  for (const v of violations) {
    console.error(`  ${v.type}: ${v.route} — ${v.actual_kb} KB > ${v.limit_kb} KB`);
  }
  process.exit(1);
}

console.log('\n[bundle-size] ✅ 통과');
process.exit(0);
