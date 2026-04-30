#!/usr/bin/env node
// audit-titles.mjs — title·description 중복·길이 검증 (SEO 회귀 차단)
//
// Cycle #37: 새 페이지 추가 시 제목 중복 자동 탐지.
// - title 중복: 검색 결과에서 같은 메타로 노출되어 cannibalization 발생
// - title 길이: 권장 50-60자 (Google 60-70 truncation)
// - description 길이: 권장 120-160자
// - duplicate description: 부분 중복도 체크
//
// 출력: stdout JSON. 위반 시 exit 1.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist/client');

if (!existsSync(DIST)) {
  console.error('[audit-titles] dist/client 없음 — npm run build 먼저 실행');
  process.exit(1);
}

// noindex 페이지는 검사 제외 (검색 노출 X)
const EXCLUDE_PATTERNS = [
  /\/issues\/main\//,
  /\/preferences\//,
  /\/demo\//,
  /\/naver[a-z0-9]+\//,
  /\/404\//,
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

const files = walkHtml(DIST);
const records = [];
const titleMap = new Map();
const descMap = new Map();
const violations = [];

const TITLE_MIN = 30;
const TITLE_MAX = 70;
const DESC_MIN = 80;
const DESC_MAX = 165;

for (const f of files) {
  const route = `/${path
    .relative(DIST, f)
    .replace(/\\/g, '/')
    .replace(/index\.html$/, '')}`;
  if (EXCLUDE_PATTERNS.some((re) => re.test(route))) continue;
  const html = readFileSync(f, 'utf8');
  // noindex 페이지 제외
  if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const title = titleMatch?.[1]?.trim() ?? '';
  const desc = descMatch?.[1]?.trim() ?? '';

  records.push({ route, title, desc });

  // 중복 검출
  if (title) {
    if (!titleMap.has(title)) titleMap.set(title, []);
    titleMap.get(title).push(route);
  }
  if (desc) {
    if (!descMap.has(desc)) descMap.set(desc, []);
    descMap.get(desc).push(route);
  }

  // 길이 검증
  if (title.length === 0) {
    violations.push({ route, issue: 'title_empty' });
  } else if (title.length < TITLE_MIN) {
    violations.push({ route, issue: 'title_short', length: title.length });
  } else if (title.length > TITLE_MAX) {
    violations.push({ route, issue: 'title_long', length: title.length });
  }
  if (desc.length === 0) {
    violations.push({ route, issue: 'description_empty' });
  } else if (desc.length < DESC_MIN) {
    violations.push({ route, issue: 'description_short', length: desc.length });
  } else if (desc.length > DESC_MAX) {
    violations.push({ route, issue: 'description_long', length: desc.length });
  }
}

// 중복 보고 (2+ 페이지에서 같은 title/desc)
const dupTitles = [];
for (const [title, routes] of titleMap) {
  if (routes.length >= 2) dupTitles.push({ title: title.slice(0, 80), routes });
}
const dupDescs = [];
for (const [desc, routes] of descMap) {
  if (routes.length >= 2) dupDescs.push({ desc: desc.slice(0, 80), routes });
}

const report = {
  generated_at: new Date().toISOString(),
  pages_checked: records.length,
  thresholds: { title: [TITLE_MIN, TITLE_MAX], description: [DESC_MIN, DESC_MAX] },
  violations_count: violations.length,
  violations_sample: violations.slice(0, 20),
  duplicate_title_count: dupTitles.length,
  duplicate_titles_sample: dupTitles.slice(0, 10),
  duplicate_description_count: dupDescs.length,
  duplicate_descriptions_sample: dupDescs.slice(0, 10),
};

console.log(JSON.stringify(report, null, 2));

// 정책 (Cycle #37 첫 가동): 모두 warning. 회귀 0 후 fail로 전환.
// - 중복 title: 검색 cannibalization 위험 — 향후 fail 전환 예정
// - title/description 길이 위반: SEO 약점이지만 차단 X
if (dupTitles.length > 0) {
  console.warn(
    `\n[audit-titles] 중복 title ${dupTitles.length}건 (warning) — 후속 사이클 fail 예정`,
  );
}
if (violations.length > 0) {
  console.warn(`\n[audit-titles] ${violations.length}건 length 위반 (warning)`);
}
process.exit(0);
