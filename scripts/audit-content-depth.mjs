#!/usr/bin/env node
// audit-content-depth.mjs — 페이지별 wordCount 측정 + 부족 페이지 검출 (Cycle #39 P0-3)
//
// 외부 평가 결과 (AdSense): thin content 거부 사유 #1.
// 페이지 타입별 권장 임계 미달 시 보강 우선순위 출력.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist/client');

if (!existsSync(DIST)) {
  console.error('[audit-content-depth] dist/client 없음 — npm run build 먼저');
  process.exit(1);
}

// 페이지 타입별 임계 (한국어 글자 수)
const THRESHOLDS = [
  { pattern: /^\/issues\/\d{4}-\d{2}-\d{2}\/[^/]+\/$/, type: 'issue-post', min: 1500 },
  { pattern: /^\/guides\/[^/]+\/$/, type: 'guide', min: 2000 },
  { pattern: /^\/subsidies\/[^/]+\/$/, type: 'subsidy', min: 600 },
  { pattern: /^\/personas\/[^/]+\/$/, type: 'persona', min: 1200 },
  { pattern: /^\/situations\/[^/]+\/$/, type: 'situation', min: 800 },
  { pattern: /^\/topics\/[^/]+\/$/, type: 'topic', min: 1500 },
  { pattern: /^\/issues\/topics\/[^/]+\/$/, type: 'topic-hub', min: 800 },
  { pattern: /^\/glossary\/[^/]+\/$/, type: 'glossary', min: 200 },
  { pattern: /^\/categories\/[^/]+\/$/, type: 'category', min: 400 },
];

// 제외 (UI 페이지·noindex)
const EXCLUDE_PATTERNS = [
  /^\/$/,
  /^\/quick\/$/,
  /^\/issues\/$/,
  /^\/issues\/all\//,
  /^\/subsidies\/$/,
  /^\/personas\/$/,
  /^\/situations\/$/,
  /^\/categories\/$/,
  /^\/topics\/$/,
  /^\/glossary\/$/,
  /^\/guides\/$/,
  /^\/about\/$/,
  /^\/contact\/$/,
  /^\/privacy\/$/,
  /^\/terms\/$/,
  /^\/cookies\/$/,
  /^\/editorial-policy\/$/,
  /^\/ads-policy\/$/,
  /^\/editor\//,
  /^\/preferences\//,
  /^\/demo\//,
  /^\/issues\/main\//,
  /^\/404\//,
  /^\/naver/,
  /^\/subsidies\/new\/$/,
  /^\/subsidies\/category\//,
  /^\/subsidies\/archived\//,
];

function walkHtml(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkHtml(full));
    } else if (entry.isFile() && entry.name === 'index.html') {
      out.push(full);
    }
  }
  return out;
}

function extractBodyText(html) {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  let inner = mainMatch?.[1] ?? articleMatch?.[1] ?? html;
  inner = inner.replace(/<script[\s\S]*?<\/script>/gi, '');
  inner = inner.replace(/<style[\s\S]*?<\/style>/gi, '');
  inner = inner.replace(/<[^>]+>/g, ' ');
  inner = inner.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  return inner.replace(/\s+/g, ' ').trim();
}

const files = walkHtml(DIST);
const records = [];
const violations = [];

for (const f of files) {
  const route = `/${path
    .relative(DIST, f)
    .replace(/\\/g, '/')
    .replace(/index\.html$/, '')}`;
  if (EXCLUDE_PATTERNS.some((re) => re.test(route))) continue;

  const matched = THRESHOLDS.find((t) => t.pattern.test(route));
  if (!matched) continue;

  const html = readFileSync(f, 'utf8');
  // noindex 제외
  if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;

  const text = extractBodyText(html);
  const charCount = text.length;

  records.push({ route, type: matched.type, char_count: charCount, threshold: matched.min });

  if (charCount < matched.min) {
    violations.push({
      route,
      type: matched.type,
      char_count: charCount,
      threshold: matched.min,
      shortage: matched.min - charCount,
    });
  }
}

// 타입별 통계
const byType = {};
for (const r of records) {
  if (!byType[r.type]) byType[r.type] = { count: 0, sum: 0, below: 0 };
  byType[r.type].count++;
  byType[r.type].sum += r.char_count;
  if (r.char_count < r.threshold) byType[r.type].below++;
}
const typeSummary = Object.entries(byType).map(([type, stats]) => ({
  type,
  pages: stats.count,
  avg_chars: Math.round(stats.sum / stats.count),
  below_threshold: stats.below,
}));

violations.sort((a, b) => b.shortage - a.shortage);

const report = {
  generated_at: new Date().toISOString(),
  pages_checked: records.length,
  by_type: typeSummary,
  violations_count: violations.length,
  violations_top20: violations.slice(0, 20),
};

console.log(JSON.stringify(report, null, 2));

if (violations.length > 0) {
  console.warn(`\n[audit-content-depth] ${violations.length}개 페이지 본문 부족 (warning)`);
  console.warn(`  타입별 부족 페이지:`);
  for (const t of typeSummary.filter((x) => x.below_threshold > 0)) {
    console.warn(`    ${t.type}: ${t.below_threshold}/${t.pages}건 (평균 ${t.avg_chars}자)`);
  }
}
process.exit(0);
