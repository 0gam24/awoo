#!/usr/bin/env node
// audit-skip-link.mjs — dist/ HTML skip-link 회귀 검증 (Cycle #5 P0-6)
//
// 검증 항목:
//   - <body> 첫 자식 영역에 <a href="#main" class~="skip-link"> 존재
//   - <main id="main"> 또는 element with id="main" 존재
//
// 출력: stdout JSON, 위반 시 exit 1 (strict from day 1 — Cycle #4 마크업 일관성 확인됨)

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HTML_ROOT = existsSync(path.join(DIST, 'client')) ? path.join(DIST, 'client') : DIST;

if (!existsSync(HTML_ROOT)) {
  console.error('[audit-skip-link] dist/ 미발견');
  process.exit(0);
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
let pagesChecked = 0;

for (const file of walkHtml(HTML_ROOT)) {
  const route = htmlPathToRoute(file);
  if (route === '/404' || route.startsWith('/api/')) continue;

  const html = readFileSync(file, 'utf8');
  pagesChecked++;

  // <body>...</body> 첫 자식 검증
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    violations.push({ route, issue: 'no_body' });
    continue;
  }
  const bodyContent = bodyMatch[1].trim();

  // skip-link 검증 (첫 200자 안에 있어야)
  const head200 = bodyContent.slice(0, 500);
  const skipLinkMatch = head200.match(/<a\s+href=("|')#main\1[^>]*class=("|')[^"']*skip-link/i)
    || head200.match(/<a\s+[^>]*class=("|')[^"']*skip-link[^"']*\1[^>]*href=("|')#main\2/i);
  if (!skipLinkMatch) {
    violations.push({ route, issue: 'skip_link_missing' });
    continue;
  }

  // #main target 존재 검증
  if (!/<(main|[a-z]+)[^>]*\sid=("|')main\2/i.test(html) && !/id=("|')main\1/.test(html)) {
    violations.push({ route, issue: 'main_target_missing' });
  }
}

const summary = {
  generated_at: new Date().toISOString(),
  pages_checked: pagesChecked,
  violations_count: violations.length,
  violations_sample: violations.slice(0, 20),
};

console.log(JSON.stringify(summary, null, 2));
// strict from day 1 — Cycle #4 데이터로 위반 0 확인됨
process.exit(violations.length > 0 ? 1 : 0);
