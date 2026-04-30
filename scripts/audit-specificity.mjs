#!/usr/bin/env node
// audit-specificity.mjs — broad/vague claim 검출 (Cycle #39 P0-2)
//
// 외부 평가 결과 (AdSense): "확인 필요" 같은 broad claims가 사이트 평균 품질을 끌어내림.
// 검색·AI 인용에서도 specificity 부족은 thin content 신호.
//
// 검출 대상:
//   - "확인 필요", "공식 공고 참조", "문의 요망", "추후 공지", "변경 가능성", "사이트 안내"
//   - "X에 따라 다릅니다", "확인하세요", "문의하세요"
//
// 임계: vague phrase ≥ 3건 OR 본문 글자 대비 비율 ≥ 1% → warning
// 검사 대상: 영구 포스트 + 가이드 + 일부 hub 페이지 (raw _gov24 subsidy는 제외 — 외부 데이터)

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist/client');

if (!existsSync(DIST)) {
  console.error('[audit-specificity] dist/client 없음 — npm run build 먼저');
  process.exit(1);
}

// 검사 대상 — 사이트가 직접 작성한 콘텐츠
const INCLUDE_PATTERNS = [
  /^\/issues\/\d{4}-\d{2}-\d{2}\/[^/]+\/$/, // 영구 포스트
  /^\/guides\/[^/]+\/$/, // flagship 가이드
  /^\/topics\/[^/]+\/$/, // 주제별
  /^\/issues\/topics\/[^/]+\/$/, // 트렌딩 토픽 hub
];

// vague phrases — 정확성 낮음 신호
const VAGUE_PATTERNS = [
  { re: /확인\s*[해](?:야|주세요)/g, label: '확인 필요' },
  { re: /공식\s*(?:공고|사이트)\s*(?:참조|확인)/g, label: '공식 공고 참조' },
  { re: /문의\s*(?:요망|주세요|바랍니다)/g, label: '문의 요망' },
  { re: /추후\s*(?:공지|안내)/g, label: '추후 공지' },
  { re: /변경\s*가능성/g, label: '변경 가능성' },
  { re: /사이트\s*안내/g, label: '사이트 안내' },
  { re: /따라\s*다릅니다/g, label: '따라 다릅니다' },
  { re: /자세한\s*내용은/g, label: '자세한 내용은' },
];

const VAGUE_COUNT_THRESHOLD = 3;
const VAGUE_RATIO_THRESHOLD = 0.01; // 1%

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
  // <main>...</main> 또는 <article>...</article> 우선
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  let inner = mainMatch?.[1] ?? articleMatch?.[1] ?? html;
  // script/style 제거
  inner = inner.replace(/<script[\s\S]*?<\/script>/gi, '');
  inner = inner.replace(/<style[\s\S]*?<\/style>/gi, '');
  // 모든 태그 제거
  inner = inner.replace(/<[^>]+>/g, ' ');
  // 엔티티 디코드 (간단)
  inner = inner.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  return inner.replace(/\s+/g, ' ').trim();
}

const files = walkHtml(DIST);
const violations = [];
let pagesChecked = 0;
let totalVagueHits = 0;

for (const f of files) {
  const route = `/${path
    .relative(DIST, f)
    .replace(/\\/g, '/')
    .replace(/index\.html$/, '')}`;
  if (!INCLUDE_PATTERNS.some((re) => re.test(route))) continue;
  pagesChecked++;
  const html = readFileSync(f, 'utf8');
  const text = extractBodyText(html);
  const charCount = text.length;
  if (charCount === 0) continue;

  const hits = [];
  for (const { re, label } of VAGUE_PATTERNS) {
    const m = text.match(re) || [];
    if (m.length > 0) hits.push({ phrase: label, count: m.length });
  }
  const totalVague = hits.reduce((s, h) => s + h.count, 0);
  totalVagueHits += totalVague;
  const ratio = totalVague / charCount;

  if (totalVague >= VAGUE_COUNT_THRESHOLD || ratio >= VAGUE_RATIO_THRESHOLD) {
    violations.push({
      route,
      char_count: charCount,
      vague_count: totalVague,
      vague_ratio: Number(ratio.toFixed(4)),
      hits,
    });
  }
}

violations.sort((a, b) => b.vague_count - a.vague_count);

const report = {
  generated_at: new Date().toISOString(),
  pages_checked: pagesChecked,
  total_vague_hits: totalVagueHits,
  thresholds: { count: VAGUE_COUNT_THRESHOLD, ratio: VAGUE_RATIO_THRESHOLD },
  violations_count: violations.length,
  violations_sample: violations.slice(0, 15),
};

console.log(JSON.stringify(report, null, 2));

if (violations.length > 0) {
  console.warn(`\n[audit-specificity] ${violations.length}개 페이지 specificity 약함 (warning)`);
}
process.exit(0);
