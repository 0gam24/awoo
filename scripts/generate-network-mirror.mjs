#!/usr/bin/env node
/**
 * generate-network-mirror.mjs — smartdata Network Index용 자매 인벤토리 export.
 *
 * 메인 사이트(smartdatashop.kr Network HQ)가 awoo의 발행물 list를 sync하기 위한
 * 정적 메타 인덱스. `npm run build` 의 `prebuild` hook으로 자동 생성.
 *
 * 출력: public/network-mirror.json (totalPosts = 활성 지원금 + 영구 이슈)
 *
 * 정책:
 *   - 본문/eligibility/benefits 등 콘텐츠 본문 복제 X — 메타·요약·URL만
 *   - AdSense ID·환경변수 노출 X — awoo는 비영리
 *   - summary 200자 절단 (메인 카드 노출용)
 *   - 마감 항목(_archived/) 제외 — 활성만 노출
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DOMAIN = 'https://awoo.or.kr';

// 실제 repo의 6 페르소나 (src/data/personas.json) — NETWORK 표준 페르소나(student/unemployed-career-shift)와 차이.
// awoo는 자체 페르소나 6종 운영: office-rookie / self-employed / newlywed-family / senior / low-income / farmer.
const PERSONAS = [
  'office-rookie',
  'self-employed',
  'newlywed-family',
  'senior',
  'low-income',
  'farmer',
];

// awoo가 메인 Network Index에서 차지하는 contour 표식
const CATEGORIES = ['policy', 'gov-support', 'eligibility-helper'];

function truncate(str, max = 200) {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.warn(`[network-mirror] JSON parse 실패 skip: ${path} (${err.message})`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// 1. 활성 지원금 — _gov24 + _curated (마감 _archived 제외)
// ─────────────────────────────────────────────────────────

function collectSubsidies() {
  const out = [];
  const dirs = [
    join(REPO_ROOT, 'src/data/subsidies/_gov24'),
    join(REPO_ROOT, 'src/data/subsidies/_curated'),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      if (name.startsWith('_')) continue; // _manifest.json 등 메타 제외
      const data = readJson(join(dir, name));
      if (!data?.id) continue;
      out.push({
        url: `${DOMAIN}/subsidies/${data.id}/`,
        title: data.title ?? null,
        category: data.category ?? null,
        persona: Array.isArray(data.targetPersonas) ? data.targetPersonas : [],
        type: 'subsidy',
        publishedAt: null, // 지원금 데이터에는 발행일 개념 없음 (manifest의 regDate는 SEO lastmod 전용)
        summary: truncate(data.summary),
        deadline: data.deadline ?? null,
        agency: data.agency ?? null,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────
// 2. 영구 이슈 포스트 — src/data/issues/{date}/{slug}.json
// ─────────────────────────────────────────────────────────

function collectIssues() {
  const out = [];
  const root = join(REPO_ROOT, 'src/data/issues');
  if (!existsSync(root)) return out;
  for (const dateDir of readdirSync(root)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir)) continue;
    const dayPath = join(root, dateDir);
    for (const name of readdirSync(dayPath)) {
      if (!name.endsWith('.json')) continue;
      if (name.startsWith('_')) continue; // _fail-*, _cache-* 제외
      const data = readJson(join(dayPath, name));
      if (!data?.slug) continue;
      const slug = data.slug;
      out.push({
        url: `${DOMAIN}/issues/${dateDir}/${slug}/`,
        title: data.title ?? null,
        category: data.category ?? null,
        persona: Array.isArray(data.relatedPersonas) ? data.relatedPersonas : [],
        type: 'issue',
        publishedAt: data.publishedAt ?? null,
        summary: truncate(data.metaDescription ?? data.tldr?.[0]),
        deadline: data.coreFacts?.deadline ?? null,
        agency: null,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────────────────

const subsidies = collectSubsidies();
const issues = collectIssues();
const posts = [...subsidies, ...issues];

const mirror = {
  site: 'awoo',
  siteName: 'awoo (정부 지원금)',
  domain: DOMAIN,
  lastUpdated: new Date().toISOString(),
  totalPosts: posts.length,
  isCommercial: false, // awoo는 비영리 — AdSense 미통합
  categories: CATEGORIES,
  personas: PERSONAS,
  counts: {
    subsidy: subsidies.length,
    issue: issues.length,
  },
  posts,
};

const outDir = join(REPO_ROOT, 'public');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'network-mirror.json');
writeFileSync(outPath, `${JSON.stringify(mirror, null, 2)}\n`, 'utf8');

console.log(
  `[network-mirror] public/network-mirror.json 생성 완료 — 총 ${posts.length}편 (지원금 ${subsidies.length} + 이슈 ${issues.length})`,
);
