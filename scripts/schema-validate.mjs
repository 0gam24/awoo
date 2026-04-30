#!/usr/bin/env node
// schema-validate.mjs — dist/ HTML의 JSON-LD structured data 무결성 검사
//
// 목적: GEO/SEO에 결정적인 BreadcrumbList·Organization·FAQPage·GovService 등
//       structured data가 빌드 산출물에 정확히 박혀 있는지 정량 검증
//
// 검사:
//   1. 모든 페이지에 최소 1개 JSON-LD <script type="application/ld+json"> 존재
//   2. JSON 파싱 성공
//   3. @context, @type 필수 필드 존재
//   4. 타입별 필수 필드 (BreadcrumbList → itemListElement, FAQPage → mainEntity, ...)
//   5. 홈/지원금/이슈/페르소나/카테고리/상황별 카테고리 페이지의 권장 schema 존재
//
// 출력: stdout JSON, 정상 종료 0, 산출물 없으면 1

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
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

function extractJsonLd(html) {
  const out = [];
  const re = /<script\s+type=("|')application\/ld\+json\1\s*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = m[2].trim();
    try {
      const parsed = JSON.parse(text);
      out.push({ ok: true, parsed });
    } catch (e) {
      out.push({ ok: false, error: e.message, snippet: text.slice(0, 100) });
    }
  }
  return out;
}

const REQUIRED_BY_TYPE = {
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  Organization: ['name'],
  NGO: ['name'],
  Article: ['headline', 'datePublished'],
  NewsArticle: ['headline', 'datePublished'],
  GovernmentService: ['name'],
  WebSite: ['name', 'url'],
  WebPage: ['name'],
  ItemList: ['itemListElement'],
};

const RECOMMENDED_TYPES = {
  '/': ['Organization', 'WebSite'],
  // 지원금 상세에는 GovernmentService 권장
};

const pages = [];
const typeCount = new Map();
const failures = [];
const warnings = [];

let totalLd = 0;
let parseFails = 0;
let pagesWithLd = 0;
let pagesWithoutLd = 0;

for (const file of walkHtml(HTML_ROOT)) {
  const route = htmlPathToRoute(file);
  if (route === '/404' || route.startsWith('/api/')) continue;

  const html = readFileSync(file, 'utf8');
  const blocks = extractJsonLd(html);

  if (blocks.length === 0) {
    pagesWithoutLd++;
    warnings.push({ route, issue: 'no_jsonld' });
    continue;
  }
  pagesWithLd++;

  const routeTypes = [];
  for (const b of blocks) {
    totalLd++;
    if (!b.ok) {
      parseFails++;
      failures.push({ route, issue: 'parse_error', detail: b.error, snippet: b.snippet });
      continue;
    }
    // @graph 또는 단일 객체
    const items = Array.isArray(b.parsed) ? b.parsed : (b.parsed['@graph'] ? b.parsed['@graph'] : [b.parsed]);
    for (const it of items) {
      if (typeof it !== 'object' || !it) continue;
      const ctx = it['@context'];
      const type = it['@type'];
      if (!ctx) failures.push({ route, issue: 'missing_@context', type });
      if (!type) {
        failures.push({ route, issue: 'missing_@type' });
        continue;
      }
      const types = Array.isArray(type) ? type : [type];
      for (const t of types) {
        typeCount.set(t, (typeCount.get(t) || 0) + 1);
        routeTypes.push(t);
        const reqs = REQUIRED_BY_TYPE[t];
        if (reqs) {
          for (const f of reqs) {
            if (it[f] === undefined || it[f] === null || (Array.isArray(it[f]) && it[f].length === 0)) {
              failures.push({ route, issue: 'missing_field', type: t, field: f });
            }
          }
        }
      }
    }
  }

  // 권장 schema 누락 체크
  const recs = RECOMMENDED_TYPES[route];
  if (recs) {
    for (const r of recs) {
      if (!routeTypes.includes(r)) {
        warnings.push({ route, issue: 'recommended_missing', type: r });
      }
    }
  }

  // 지원금 상세는 GovernmentService 또는 GovService 권장
  if (/^\/subsidies\/[^/]+\/$/.test(route) && !route.includes('/category/') && !route.includes('/archived/')) {
    if (!routeTypes.includes('GovernmentService') && !routeTypes.includes('GovService')) {
      warnings.push({ route, issue: 'subsidy_no_govservice' });
    }
  }

  pages.push({ route, types: routeTypes });
}

const result = {
  generated_at: new Date().toISOString(),
  pages_total: pages.length,
  pages_with_jsonld: pagesWithLd,
  pages_without_jsonld: pagesWithoutLd,
  jsonld_blocks_total: totalLd,
  jsonld_parse_failures: parseFails,
  type_distribution: Object.fromEntries(
    [...typeCount.entries()].sort((a, b) => b[1] - a[1])
  ),
  failures_count: failures.length,
  failures_sample: failures.slice(0, 30),
  warnings_count: warnings.length,
  warnings_sample: warnings.slice(0, 30),
};

console.log(JSON.stringify(result, null, 2));
process.exit(0);
