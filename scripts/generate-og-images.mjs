#!/usr/bin/env node

/**
 * 페이지별 OG 이미지 + PNG 앱 아이콘 빌드타임 생성 (SEO 감사 2026-08-09 O1/W7)
 *
 * 산출물 (public/ 하위 — .gitignore, 빌드마다 생성):
 *   - public/og/issues/{fileSlug}.png     — 이슈 포스트 1200×630 카드 (og:image·카카오/네이버 공유 미리보기)
 *   - public/og/issues/{fileSlug}.webp    — 본문 상단 대표 썸네일 "정보 카드"(lib/thumb-card.mjs): 제목 대신 주제 아이콘 + 지역·제도·금액·대상·상태 토큰
 *   - public/og/subsidies/{id}.png        — 지원금 상세 1200×630 카드
 *   - public/apple-touch-icon.png (180)   — iOS는 SVG 미지원
 *   - public/icon-192.png / icon-512.png  — PWA manifest용
 *
 * 캐시: public/og/_manifest.json 에 입력 해시 저장 — 제목·카테고리 불변이면 스킵.
 * 폰트: assets/fonts/Pretendard-{Bold,Regular}.otf (커밋됨 — CI 네트워크 의존 제거).
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import sharp from 'sharp';

import { buildThumbCard, thumbHash } from './lib/thumb-card.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OG_DIR = join(ROOT, 'public', 'og');
const MANIFEST_PATH = join(OG_DIR, '_manifest.json');

/** 디자인 바꾸면 올려서 전체 재생성 */
const TEMPLATE_VERSION = 'v1';

/** 본문 썸네일 WebP — 단색 평면 벡터 카드라 무손실이 lossy보다 작고(≈20KB) 글자 번짐도 없다 */
const WEBP_OPTS = { lossless: true };

const BRAND = '#0071e3';
const BRAND_DARK = '#003875';
const INK = '#111827';
const MUTED = '#6b7280';

const fontBold = await readFile(join(ROOT, 'assets/fonts/Pretendard-Bold.otf'));
const fontRegular = await readFile(join(ROOT, 'assets/fonts/Pretendard-Regular.otf'));

const SATORI_OPTS = {
  width: 1200,
  height: 630,
  fonts: [
    { name: 'Pretendard', data: fontBold, weight: 700, style: 'normal' },
    { name: 'Pretendard', data: fontRegular, weight: 400, style: 'normal' },
  ],
};

function h(type, style, ...children) {
  const kids = children.filter((c) => c !== null && c !== undefined);
  // satori 규칙: 자식 2개 이상이면 display 명시 필수, 자식 0개면 children 자체를 생략
  const finalStyle = kids.length > 1 && !style.display ? { display: 'flex', ...style } : style;
  const props = { style: finalStyle };
  if (kids.length === 1) props.children = kids[0];
  else if (kids.length > 1) props.children = kids;
  return { type, props };
}

/** 제목 길이에 따라 폰트 크기 조정 — satori가 줄바꿈은 자동 처리 */
function titleSize(title) {
  if (title.length <= 20) return 72;
  if (title.length <= 32) return 62;
  return 52;
}

function card({ title, badge, metaLeft, metaRight }) {
  return h(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      padding: '64px 72px',
      fontFamily: 'Pretendard',
      position: 'relative',
    },
    // 상단: 브랜드
    h(
      'div',
      { display: 'flex', alignItems: 'center', gap: 18 },
      h(
        'div',
        {
          width: 56,
          height: 56,
          borderRadius: 14,
          backgroundColor: BRAND,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          fontWeight: 700,
        },
        '지',
      ),
      h('div', { fontSize: 34, fontWeight: 700, color: INK }, '지원금가이드'),
    ),
    // 중앙: 배지 + 제목
    h(
      'div',
      { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', gap: 28 },
      badge
        ? h(
            'div',
            {
              display: 'flex',
              alignSelf: 'flex-start',
              backgroundColor: '#eef6ff',
              color: BRAND_DARK,
              fontSize: 30,
              fontWeight: 700,
              padding: '10px 26px',
              borderRadius: 999,
            },
            badge,
          )
        : null,
      h(
        'div',
        {
          fontSize: titleSize(title),
          fontWeight: 700,
          color: INK,
          lineHeight: 1.28,
          letterSpacing: '-0.02em',
          maxHeight: 340,
          overflow: 'hidden',
        },
        title,
      ),
    ),
    // 하단: 메타 + 액센트 바
    h(
      'div',
      { display: 'flex', justifyContent: 'space-between', fontSize: 28, color: MUTED },
      h('div', {}, metaLeft ?? ''),
      h('div', {}, metaRight ?? ''),
    ),
    h('div', {
      position: 'absolute',
      left: 0,
      bottom: 0,
      width: '100%',
      height: 16,
      backgroundColor: BRAND,
    }),
  );
}

async function renderPng(node) {
  const svg = await satori(node, SATORI_OPTS);
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

// ─────────────────────────────────────────────────────────────
// 대상 수집
// ─────────────────────────────────────────────────────────────
const jobs = []; // { out, hash, make: () => Promise<Buffer> }

function hashOf(parts) {
  return createHash('sha1')
    .update([TEMPLATE_VERSION, ...parts].join('|'))
    .digest('hex');
}

// 이슈 포스트 — 파일 slug(고유) 기준
const issuesDir = join(ROOT, 'src/data/issues');
for (const dirent of await readdir(issuesDir, { withFileTypes: true })) {
  if (!dirent.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(dirent.name)) continue;
  const dayPath = join(issuesDir, dirent.name);
  for (const f of await readdir(dayPath)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    try {
      const post = JSON.parse(await readFile(join(dayPath, f), 'utf8'));
      const slug = f.replace(/\.json$/, '');
      const title = post.title ?? slug;
      const category = post.category ?? '';
      const ogNode = card({
        title,
        badge: category ? `${category} 이슈` : '오늘의 이슈',
        metaLeft: dirent.name.replaceAll('-', '.'),
        metaRight: 'awoo.or.kr',
      });
      jobs.push({
        out: join(OG_DIR, 'issues', `${slug}.png`),
        hash: hashOf([title, category, dirent.name]),
        make: () => renderPng(ogNode),
      });
      // 본문 상단 정보 카드(WebP) — 입력 필드가 더 많아 해시를 따로 둔다
      jobs.push({
        out: join(OG_DIR, 'issues', `${slug}.webp`),
        hash: hashOf([thumbHash(post, dirent.name)]),
        make: async () =>
          sharp(await renderPng(buildThumbCard(post, dirent.name)))
            .webp(WEBP_OPTS)
            .toBuffer(),
      });
    } catch {}
  }
}

// 지원금 상세 — _gov24 + _curated (라우트 생성 대상과 동일)
for (const d of ['src/data/subsidies/_gov24', 'src/data/subsidies/_curated']) {
  const dir = join(ROOT, d);
  if (!existsSync(dir)) continue;
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    try {
      const s = JSON.parse(await readFile(join(dir, f), 'utf8'));
      if (!s.id || !s.title) continue;
      const node = card({
        title: s.title,
        badge: s.category ?? '정부 지원금',
        metaLeft: s.agency ?? '',
        metaRight: 'awoo.or.kr',
      });
      jobs.push({
        out: join(OG_DIR, 'subsidies', `${s.id}.png`),
        hash: hashOf([s.title, s.category ?? '', s.agency ?? '']),
        make: () => renderPng(node),
      });
    } catch {}
  }
}

// ─────────────────────────────────────────────────────────────
// 생성 (매니페스트 해시 캐시)
// ─────────────────────────────────────────────────────────────
await mkdir(join(OG_DIR, 'issues'), { recursive: true });
await mkdir(join(OG_DIR, 'subsidies'), { recursive: true });

let manifest = {};
try {
  manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
} catch {}

let made = 0;
let madeThumb = 0;
let skipped = 0;
for (const job of jobs) {
  const key = job.out.slice(OG_DIR.length + 1).replaceAll('\\', '/');
  if (manifest[key] === job.hash && existsSync(job.out)) {
    skipped += 1;
    continue;
  }
  await writeFile(job.out, await job.make());
  manifest[key] = job.hash;
  if (job.out.endsWith('.webp')) madeThumb += 1;
  else made += 1;
  if ((made + madeThumb) % 50 === 0) console.log(`[og] ${made + madeThumb}장 생성...`);
}
await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

// ─────────────────────────────────────────────────────────────
// PNG 앱 아이콘 — favicon.svg 래스터화 (iOS/PWA)
// ─────────────────────────────────────────────────────────────
const faviconSvg = await readFile(join(ROOT, 'public/favicon.svg'), 'utf8');
for (const [file, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  const out = join(ROOT, 'public', file);
  if (existsSync(out)) continue;
  const png = new Resvg(faviconSvg, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false, fontBuffers: [fontBold] },
  })
    .render()
    .asPng();
  await writeFile(out, png);
  console.log(`[og] 아이콘 생성: ${file} (${size}px)`);
}

console.log(
  `[og] 완료 — OG ${made}장 / 썸네일 ${madeThumb}장 생성 / ${skipped}장 캐시 / 총 ${jobs.length}건`,
);
