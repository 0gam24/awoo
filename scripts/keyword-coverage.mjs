#!/usr/bin/env node
// keyword-coverage.mjs — personas/situations/categories의 키워드가
// 본문·메타에 충분히 박혀 있는지 정량 검사 (SEO/GEO 키워드 밀도)
//
// 목적: 페르소나·상황·카테고리 hub 페이지가 해당 핵심 키워드를
//       title·meta description·h1·h2·본문에 충분히 노출하는지 확인
//
// 절차:
//   1. src/data/{personas,situations}.json + site-data의 CATEGORIES 로드
//   2. dist/ HTML에서 각 hub 페이지(/personas/[id]/, /situations/[id]/, /categories/[id]/) 찾기
//   3. 각 페이지에서 title/meta description/h1/h2/본문 텍스트 추출
//   4. 해당 엔티티의 label·sub·키워드가 위 슬롯에 몇 번 등장하는지 카운트
//   5. 점수: title 3 + meta 2 + h1 2 + h2 1 + body 0.1
//   6. 임계값 미달 항목 리스트
//
// 출력: stdout JSON, 빌드 미완료 시 1

import { existsSync, readFileSync } from 'node:fs';
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

function readJson(p) {
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

const personas = readJson(path.join(ROOT, 'src/data/personas.json')) || [];
const situations = readJson(path.join(ROOT, 'src/data/situations.json')) || [];

// site-data.ts에서 CATEGORIES 추출 (정규식)
const categories = [];
const siteDataPath = path.join(ROOT, 'src/data/site-data.ts');
if (existsSync(siteDataPath)) {
  const td = readFileSync(siteDataPath, 'utf8');
  // CATEGORIES 또는 CATEGORIES: Category[] = 형식 모두 매칭
  // greedy match — 항목 내부의 commonEligibility[] 배열 ]에 의한 조기 종료 방지.
  // 단 다음 export 까지로 한정 (안전 가드)
  const m = td.match(/CATEGORIES(?:\s*:\s*[A-Za-z_][\w<>[\]\s,]*)?\s*=\s*\[([\s\S]*?)\n\];?/);
  if (m) {
    const blockText = m[1];
    const itemRe = /\{([^{}]*)\}/g;
    for (const im of blockText.matchAll(itemRe)) {
      const inner = im[1];
      const idM = inner.match(/id\s*:\s*['"]([^'"]+)['"]/);
      // site-data.ts CATEGORIES는 `name` 필드 사용 (label X)
      const nameM = inner.match(/name\s*:\s*['"]([^'"]+)['"]/);
      if (idM) categories.push({ id: idM[1], label: nameM ? nameM[1] : idM[1] });
    }
  }
}

function loadHtml(routePath) {
  // routePath: /personas/young/  →  HTML_ROOT/personas/young/index.html
  const clean = routePath.replace(/^\//, '').replace(/\/$/, '');
  const candidates = [
    path.join(HTML_ROOT, clean, 'index.html'),
    path.join(HTML_ROOT, `${clean}.html`),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return readFileSync(c, 'utf8');
  }
  return null;
}

function extractSlots(html) {
  if (!html) return null;
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaM = html.match(/<meta[^>]*name=("|')description\1[^>]*content=("|')([\s\S]*?)\2/i)
    || html.match(/<meta[^>]*content=("|')([\s\S]*?)\1[^>]*name=("|')description\3/i);
  const h1All = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]));
  const h2All = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1]));
  // body: <body>~</body> 사이 텍스트, script/style 제거
  const bodyM = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyText = bodyM ? stripTags(bodyM[1]) : '';

  return {
    title: titleM ? stripTags(titleM[1]) : '',
    meta: metaM ? stripTags(metaM[2] || metaM[3] || '') : '',
    h1: h1All.join(' \n '),
    h2: h2All.join(' \n '),
    body: bodyText,
  };
}

function stripTags(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countOccurrences(haystack, needle) {
  if (!needle || !haystack) return 0;
  let count = 0;
  let i = haystack.indexOf(needle, 0);
  while (i !== -1) {
    count++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}

function scoreEntity(slots, keywords) {
  let score = 0;
  const detail = {};
  for (const kw of keywords) {
    const t = countOccurrences(slots.title, kw);
    const m = countOccurrences(slots.meta, kw);
    const h1 = countOccurrences(slots.h1, kw);
    const h2 = countOccurrences(slots.h2, kw);
    const body = countOccurrences(slots.body, kw);
    const s = t * 3 + m * 2 + h1 * 2 + h2 * 1 + body * 0.1;
    score += s;
    detail[kw] = { title: t, meta: m, h1, h2, body, score: Number(s.toFixed(1)) };
  }
  return { score: Number(score.toFixed(1)), detail };
}

const results = {
  personas: [],
  situations: [],
  categories: [],
};

const THRESHOLD = 8; // 권장 최소 점수 (대략 title 1 + meta 1 + h1 1 + 본문 약간)

for (const p of personas) {
  const route = `/personas/${p.id}/`;
  const html = loadHtml(route);
  const slots = extractSlots(html);
  if (!slots) {
    results.personas.push({ id: p.id, route, missing_html: true });
    continue;
  }
  const keywords = [p.label, p.sub].filter(Boolean);
  const { score, detail } = scoreEntity(slots, keywords);
  results.personas.push({
    id: p.id,
    route,
    label: p.label,
    keywords,
    score,
    below_threshold: score < THRESHOLD,
    detail,
  });
}

for (const s of situations) {
  const route = `/situations/${s.id}/`;
  const html = loadHtml(route);
  const slots = extractSlots(html);
  if (!slots) {
    results.situations.push({ id: s.id, route, missing_html: true });
    continue;
  }
  const keywords = [s.label, s.sub, s.title].filter(Boolean);
  const { score, detail } = scoreEntity(slots, keywords);
  results.situations.push({
    id: s.id,
    route,
    label: s.label || s.title,
    keywords,
    score,
    below_threshold: score < THRESHOLD,
    detail,
  });
}

for (const c of categories) {
  const route = `/categories/${encodeURIComponent(c.id)}/`;
  const html = loadHtml(route);
  const slots = extractSlots(html);
  if (!slots) {
    results.categories.push({ id: c.id, route, missing_html: true });
    continue;
  }
  const keywords = [c.label, c.id].filter(Boolean);
  const { score, detail } = scoreEntity(slots, keywords);
  results.categories.push({
    id: c.id,
    route,
    label: c.label,
    keywords,
    score,
    below_threshold: score < THRESHOLD,
    detail,
  });
}

const summary = {
  generated_at: new Date().toISOString(),
  threshold: THRESHOLD,
  personas: {
    total: results.personas.length,
    below_threshold: results.personas.filter((r) => r.below_threshold).length,
    avg_score: avg(results.personas.map((r) => r.score).filter((x) => typeof x === 'number')),
  },
  situations: {
    total: results.situations.length,
    below_threshold: results.situations.filter((r) => r.below_threshold).length,
    avg_score: avg(results.situations.map((r) => r.score).filter((x) => typeof x === 'number')),
  },
  categories: {
    total: results.categories.length,
    below_threshold: results.categories.filter((r) => r.below_threshold).length,
    avg_score: avg(results.categories.map((r) => r.score).filter((x) => typeof x === 'number')),
  },
  details: results,
};

function avg(arr) {
  if (!arr.length) return 0;
  return Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
}

console.log(JSON.stringify(summary, null, 2));
process.exit(0);
