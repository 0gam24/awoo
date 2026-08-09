#!/usr/bin/env node

/**
 * 예약 발행 — _scheduled 대기 글을 기일에 본 폴더로 이동 (2026-08-09 운영자 지시)
 *
 * 구조:
 *   src/data/issues/_scheduled/{YYYY-MM-DD}/{slug}.json  →  src/data/issues/{YYYY-MM-DD}/{slug}.json
 *
 * _scheduled/ 하위는 라우트·sitemap·OG·lint 등 모든 소비처의 날짜 정규식에 걸리지 않아
 * 커밋돼 있어도 사이트에 노출되지 않는다. 이 스크립트가 옮기는 순간부터 발행이다.
 *
 * 기일 판정(KST):
 *   - 발행일 <= 오늘: 항상 이동 (밀린 글 소급 발행)
 *   - 발행일 == 내일: KST 17시 이후에만 이동 — 사이트 관행(전날 저녁에 다음 날짜 글 발행)
 *     을 따르되, 낮에 수동 실행해도 내일자가 미리 노출되지 않게 막는다.
 *   - 그 외 미래: 대기
 *
 * 호출: 매일 18:15 KST cron(.github/workflows/publish-scheduled.yml) + 수동 npm run publish:scheduled
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rmdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ISSUES_DIR = join(ROOT, 'src/data/issues');
const SCHEDULED_DIR = join(ISSUES_DIR, '_scheduled');

// KST 현재 시각
const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
const kstToday = kstNow.toISOString().slice(0, 10);
const kstHour = kstNow.getUTCHours();
const kstTomorrow = new Date(kstNow.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function isDue(date) {
  if (date <= kstToday) return true;
  if (date === kstTomorrow && kstHour >= 17) return true;
  return false;
}

if (!existsSync(SCHEDULED_DIR)) {
  console.log('[publish-scheduled] _scheduled 디렉토리 없음 — 대기 글 0건');
  process.exit(0);
}

let moved = 0;
let waiting = 0;
for (const dirent of await readdir(SCHEDULED_DIR, { withFileTypes: true })) {
  if (!dirent.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(dirent.name)) continue;
  const date = dirent.name;
  const srcDay = join(SCHEDULED_DIR, date);
  const files = (await readdir(srcDay)).filter((f) => f.endsWith('.json'));

  if (!isDue(date)) {
    waiting += files.length;
    console.log(`[publish-scheduled] 대기: ${date} ${files.length}건 (기일 전)`);
    continue;
  }

  const destDay = join(ISSUES_DIR, date);
  await mkdir(destDay, { recursive: true });
  for (const f of files) {
    const srcPath = join(srcDay, f);
    // 이동 전 무결성: JSON 파싱 + date 필드-폴더 일치 (4중 일치의 앞 2중)
    const data = JSON.parse(await readFile(srcPath, 'utf8'));
    if (data.date !== date) {
      console.error(
        `[publish-scheduled] SKIP ${date}/${f} — date 필드(${data.date})와 폴더 불일치`,
      );
      continue;
    }
    const destPath = join(destDay, f);
    if (existsSync(destPath)) {
      console.error(`[publish-scheduled] SKIP ${date}/${f} — 본 폴더에 동명 파일 존재`);
      continue;
    }
    await rename(srcPath, destPath);
    moved += 1;
    console.log(`[publish-scheduled] 발행: ${date}/${f}`);
  }
  // 비워진 날짜 폴더 정리 (실패해도 무해)
  try {
    await rmdir(srcDay);
  } catch {}
}

console.log(
  `[publish-scheduled] 완료 — 발행 ${moved}건 / 대기 ${waiting}건 (KST ${kstToday} ${String(kstHour).padStart(2, '0')}시)`,
);
