#!/usr/bin/env node
// llms-freshness.mjs — llms.txt / llms-full.txt가 실제 콘텐츠를 반영하는지 검증
//
// 목적: AI 크롤러(GPTBot·ClaudeBot 등) 인용에 결정적인 llms.txt가 stale 상태면
//       GEO 가시성 손실 → 정량 diff로 신선도 모니터링
//
// 검사:
//   1. dist/llms.txt 와 dist/llms-full.txt 존재
//   2. 각 파일이 참조하는 라우트 목록 추출 (/path/ 패턴)
//   3. 실제 dist/ 산출물 라우트 집합과 diff
//      - llms.txt에 있으나 산출물 없음 (dangling)
//      - 산출물에 있으나 llms.txt에 없음 (missing)
//   4. 본문 길이·section 수 등 기본 통계
//   5. 최근 추가된 issues/ 콘텐츠가 llms-full.txt에 반영됐는지 (지난 14일)
//
// 출력: stdout JSON, 산출물 없으면 1

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

const llmsPath = path.join(HTML_ROOT, 'llms.txt');
const llmsFullPath = path.join(HTML_ROOT, 'llms-full.txt');

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

const builtRoutes = new Set();
for (const f of walkHtml(HTML_ROOT)) {
  const r = htmlPathToRoute(f);
  if (r === '/404' || r.startsWith('/api/')) continue;
  builtRoutes.add(r);
}

function extractRoutesFromLlms(text) {
  const out = new Set();
  // markdown 링크 [..](https://awoo.or.kr/path/) 또는 [..](/path/)
  const re = /\]\((?:https?:\/\/awoo\.or\.kr)?(\/[^\s)]+)\)/g;
  for (const m of text.matchAll(re)) {
    const route = m[1].split('#')[0].split('?')[0];
    if (!route) continue;
    out.add(route);
  }
  // 단순 URL (https://awoo.or.kr/path/)
  const re2 = /https?:\/\/awoo\.or\.kr(\/[^\s)]*)/g;
  for (const m of text.matchAll(re2)) {
    const route = m[1].split('#')[0].split('?')[0];
    if (!route) continue;
    out.add(route);
  }
  return out;
}

const result = {
  generated_at: new Date().toISOString(),
  llms_txt: null,
  llms_full_txt: null,
};

for (const [key, p] of [['llms_txt', llmsPath], ['llms_full_txt', llmsFullPath]]) {
  if (!existsSync(p)) {
    result[key] = { exists: false };
    continue;
  }
  const text = readFileSync(p, 'utf8');
  const routes = extractRoutesFromLlms(text);
  const sectionCount = (text.match(/^##?\s/gm) || []).length;
  const lineCount = text.split('\n').length;

  const dangling = [...routes].filter((r) => !builtRoutes.has(r) && !r.startsWith('/api/'));
  const missing = [...builtRoutes].filter((r) => !routes.has(r));

  result[key] = {
    exists: true,
    bytes: Buffer.byteLength(text, 'utf8'),
    line_count: lineCount,
    section_count: sectionCount,
    referenced_routes: routes.size,
    dangling_count: dangling.length,
    dangling_sample: dangling.slice(0, 20),
    missing_from_llms_count: missing.length,
    missing_from_llms_sample: missing.slice(0, 20),
  };
}

// 최근 14일 issues 신선도
const issuesDir = path.join(ROOT, 'src/data/issues');
if (existsSync(issuesDir)) {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recent = [];
  for (const dateDir of readdirSync(issuesDir, { withFileTypes: true })) {
    if (!dateDir.isDirectory()) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir.name)) continue;
    const dateMs = new Date(dateDir.name).getTime();
    if (dateMs < cutoff) continue;
    for (const f of readdirSync(path.join(issuesDir, dateDir.name))) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      const slug = f.replace(/\.json$/, '');
      recent.push(`/issues/${dateDir.name}/${slug}/`);
    }
  }
  // llms-full.txt에 본문 일부라도 포함되는지 (느슨한 검사 — 슬러그 키워드 매칭)
  let textFull = '';
  if (existsSync(llmsFullPath)) textFull = readFileSync(llmsFullPath, 'utf8');
  const reflectedInFull = recent.filter((r) => textFull.includes(r));
  result.recent_issues_14d = {
    count: recent.length,
    reflected_in_llms_full: reflectedInFull.length,
    coverage_pct: recent.length ? Math.round((reflectedInFull.length / recent.length) * 100) : 100,
    missing_sample: recent.filter((r) => !textFull.includes(r)).slice(0, 10),
  };
}

console.log(JSON.stringify(result, null, 2));
process.exit(0);
