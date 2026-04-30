#!/usr/bin/env node
// audit-headings.mjs — dist/ HTML heading 계층 검증
//
// 목적: WCAG / Lighthouse SEO heading-order 회귀 자동 차단
//   - 페이지당 h1 = 1
//   - h2→h3→h4 순서 (level skip 금지: h1→h3 X, h2→h4 X)
//
// 호출: postbuild 또는 cycle OBSERVE phase
//
// 출력: stdout 요약, 위반 시 exit 0 (warn) — 빌드 차단 아님 (점진 도입)
// 빌드 fail 정책으로 전환하려면 process.exit(violations > 0 ? 1 : 0)

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HTML_ROOT = existsSync(path.join(DIST, 'client')) ? path.join(DIST, 'client') : DIST;

if (!existsSync(HTML_ROOT)) {
  console.error('[audit-headings] dist/ 미발견 — npm run build 먼저');
  process.exit(0); // CI 단독 실행이 아닐 때는 silent
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

function extractHeadings(html) {
  const out = [];
  const re = /<h([1-6])\b[^>]*>/gi;
  for (const m of html.matchAll(re)) {
    out.push(Number(m[1]));
  }
  return out;
}

const violations = [];
let pagesChecked = 0;
let pagesWithMultipleH1 = 0;
let pagesWithLevelSkip = 0;

for (const file of walkHtml(HTML_ROOT)) {
  const route = htmlPathToRoute(file);
  if (route === '/404' || route.startsWith('/api/')) continue;

  const html = readFileSync(file, 'utf8');
  const headings = extractHeadings(html);
  if (headings.length === 0) continue;
  pagesChecked++;

  // h1 = 1 검증
  const h1Count = headings.filter((h) => h === 1).length;
  if (h1Count !== 1) {
    pagesWithMultipleH1++;
    violations.push({ route, issue: 'h1_count', actual: h1Count });
  }

  // level skip 검증 (h1 → h3 등)
  let prevSeen = 0;
  for (const h of headings) {
    if (prevSeen > 0 && h > prevSeen + 1) {
      pagesWithLevelSkip++;
      violations.push({ route, issue: 'level_skip', from: prevSeen, to: h });
      break; // 페이지당 1번만 카운트
    }
    if (h <= prevSeen) {
      // 같거나 낮은 레벨로 돌아감 — OK
    }
    if (h > prevSeen) prevSeen = h;
  }
}

const summary = {
  generated_at: new Date().toISOString(),
  pages_checked: pagesChecked,
  pages_with_multiple_h1: pagesWithMultipleH1,
  pages_with_level_skip: pagesWithLevelSkip,
  violations_count: violations.length,
  violations_sample: violations.slice(0, 20),
};

console.log(JSON.stringify(summary, null, 2));
// Cycle #5 P0-6: strict 전환 — Cycle #4 데이터로 위반 0 확인됨
process.exit(violations.length > 0 ? 1 : 0);
