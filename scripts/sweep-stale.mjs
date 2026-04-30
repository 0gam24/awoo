#!/usr/bin/env node

/**
 * 마감 지난 지원금 자동 정리
 *
 * - _gov24/{slug}.json 의 deadline·period·status 를 휴리스틱으로 파싱
 * - 마감 후 GRACE_DAYS(기본 30일) 경과한 항목을 _archived/{slug}.json 으로 이동
 * - manifest item 에 archivedAt 필드 추가
 * - 빌드는 _archived/ 를 collection에서 제외 (content.config.ts pattern 으로 이미 처리)
 *
 * 사용:
 *   npm run sweep:stale          # 검사만 (dry-run)
 *   npm run sweep:stale -- --apply   # 실제 이동
 *
 * Idempotent — 여러 번 실행해도 안전.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GOV24_DIR = join(ROOT, 'src', 'data', 'subsidies', '_gov24');
const ARCHIVED_DIR = join(ROOT, 'src', 'data', 'subsidies', '_archived');
const MANIFEST_PATH = join(GOV24_DIR, '_manifest.json');

const GRACE_DAYS = 30;
const APPLY = process.argv.includes('--apply');

// ─────────────────────────────────────────────────────────────
// deadline 파싱 — 자유 형식 ("~12.31", "D-15일", "2026-12-31", "상시")
// ─────────────────────────────────────────────────────────────
function parseDeadline(raw, fallbackPeriod = '') {
  const text = String(raw || '').trim();
  if (!text) return parseDeadline(fallbackPeriod);

  // 상시·연중·수시
  if (/상시|연중|수시/.test(text)) return null;

  // YYYY-MM-DD 또는 YYYY.MM.DD
  let m = text.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();

  // YYYYMMDD
  m = text.match(/(\d{4})(\d{2})(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();

  // ~MM.DD 또는 MM.DD까지 → 올해 기준
  m = text.match(/(\d{1,2})[./](\d{1,2})/);
  if (m) {
    const now = new Date();
    return new Date(now.getFullYear(), +m[1] - 1, +m[2]).getTime();
  }

  // D-N일
  m = text.match(/D[-−]\s*(\d+)/);
  if (m) {
    return Date.now() + parseInt(m[1], 10) * 24 * 3600 * 1000;
  }

  return null; // 파싱 불가
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(GOV24_DIR)) {
    console.log('[sweep] _gov24/ 디렉토리 없음 — 스킵');
    return;
  }

  let manifest = { lastSync: null, items: {} };
  if (existsSync(MANIFEST_PATH)) {
    try {
      manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf-8'));
    } catch (e) {
      console.error(`[sweep] manifest 읽기 실패: ${e.message}`);
      process.exit(1);
    }
  }

  const files = (await readdir(GOV24_DIR)).filter((f) => f.endsWith('.json') && !f.startsWith('_'));

  const cutoffMs = Date.now() - GRACE_DAYS * 24 * 3600 * 1000;
  const toArchive = [];
  let unparseable = 0;
  let active = 0;

  for (const file of files) {
    const fp = join(GOV24_DIR, file);
    let data;
    try {
      data = JSON.parse(await readFile(fp, 'utf-8'));
    } catch {
      continue;
    }
    if (data.status === '신청 가능' || data.status === '곧 마감') {
      active++;
      continue;
    }
    // status === '마감'
    const dl = parseDeadline(data.deadline, data.period);
    if (dl === null) {
      unparseable++;
      continue;
    }
    if (dl <= cutoffMs) {
      toArchive.push({
        slug: data.id,
        file: fp,
        deadline: new Date(dl).toISOString().slice(0, 10),
      });
    }
  }

  console.log(
    `[sweep] 검사: ${files.length}건 / 활성: ${active} / 파싱불가: ${unparseable} / 아카이브 대상: ${toArchive.length}`,
  );

  if (toArchive.length === 0) {
    console.log('[sweep] 아카이브할 항목 없음');
    return;
  }

  if (!APPLY) {
    console.log('[sweep] DRY-RUN — --apply 추가 시 실제 이동');
    for (const item of toArchive.slice(0, 20)) {
      console.log(`  - ${item.slug} (마감: ${item.deadline})`);
    }
    if (toArchive.length > 20) console.log(`  ... 외 ${toArchive.length - 20}건`);
    return;
  }

  // 실제 이동
  await mkdir(ARCHIVED_DIR, { recursive: true });
  let moved = 0;
  const archivedAt = new Date().toISOString();

  for (const item of toArchive) {
    const dest = join(ARCHIVED_DIR, `${item.slug}.json`);
    try {
      await rename(item.file, dest);
      // manifest 항목은 보존 + archivedAt 추가
      const items = manifest.items ?? {};
      // srcId → manifest entry 역매핑
      for (const [srcId, entry] of Object.entries(items)) {
        if (entry.slug === item.slug) {
          items[srcId] = { ...entry, archivedAt };
          break;
        }
      }
      moved++;
    } catch (e) {
      console.warn(`  ⚠️ ${item.slug} 이동 실패: ${e.message}`);
    }
  }

  // manifest 갱신 (atomic)
  manifest.lastSweep = archivedAt;
  const tmpPath = `${MANIFEST_PATH}.next`;
  await writeFile(tmpPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  await rename(tmpPath, MANIFEST_PATH);

  console.log(`[sweep] ${moved}건 → _archived/ 이동 완료`);
}

main().catch((e) => {
  console.error('💥', e?.message ?? e);
  process.exit(1);
});
