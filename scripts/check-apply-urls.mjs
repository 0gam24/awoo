#!/usr/bin/env node
/**
 * applyUrl 외부 링크 헬스 체크 (샘플링)
 *
 * 매주 5% 무작위 샘플 HEAD 요청 → 4xx/5xx 감지
 * - 일부 정부 사이트는 HEAD 미지원 → 405면 GET 재시도
 * - 한 번에 너무 많은 요청 보내지 않도록 동시성 제한
 * - 보고서: src/data/subsidies/_link-health.json (gitignored 권장)
 *
 * 사용:
 *   npm run check:apply-urls          # 5% 샘플
 *   npm run check:apply-urls -- --all # 전체 (수동 점검)
 *
 * Idempotent. 실패 항목은 다음 회차에 재시도 누적 카운트 증가.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SUBSIDIES_DIR = join(ROOT, 'src', 'data', 'subsidies');
const REPORT_PATH = join(SUBSIDIES_DIR, '_link-health.json');

const SAMPLE_RATE = 0.05; // 5%
const ALL = process.argv.includes('--all');
const TIMEOUT_MS = 8000;
const CONCURRENCY = 4;

// ─────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  return readdir(dir, { withFileTypes: true }).then(async (entries) => {
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('_archived')) continue;
        await walk(full, out);
      } else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.startsWith('_')) {
        out.push(full);
      }
    }
    return out;
  });
}

async function checkUrl(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'awoo-link-health-check/1.0 (+https://awoo.or.kr)',
        Accept: 'text/html,*/*',
      },
    });
    // 일부 서버는 HEAD를 거부 (405) → GET으로 재시도
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'awoo-link-health-check/1.0 (+https://awoo.or.kr)',
          Accept: 'text/html,*/*',
        },
      });
    }
    return { ok: res.status >= 200 && res.status < 400, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e?.message?.slice(0, 80) ?? 'unknown' };
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, fn, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─────────────────────────────────────────────────────────────
async function main() {
  const files = await walk(SUBSIDIES_DIR);
  const records = [];
  let skippedHost = 0;
  // SSRF 가드 — https + 정부·공공 TLD만 허용 (Cycle #3 P0-7)
  const allowedHostRe = /\.(go|gov|or)\.kr$/;
  for (const file of files) {
    try {
      const data = JSON.parse(await readFile(file, 'utf-8'));
      if (!data.applyUrl) continue;
      let parsed;
      try {
        parsed = new URL(data.applyUrl);
      } catch {
        continue;
      }
      if (parsed.protocol !== 'https:') {
        skippedHost++;
        continue;
      }
      if (!allowedHostRe.test(parsed.host)) {
        skippedHost++;
        console.warn(`[check-apply-urls] 호스트 화이트리스트 미통과: ${data.id} → ${parsed.host}`);
        continue;
      }
      records.push({ id: data.id, applyUrl: data.applyUrl });
    } catch {}
  }
  if (skippedHost > 0) {
    console.warn(`[check-apply-urls] 호스트 가드로 ${skippedHost}건 스킵 (정부 TLD 외 또는 http)`);
  }

  let prev = { lastRun: null, items: {} };
  if (existsSync(REPORT_PATH)) {
    try {
      prev = JSON.parse(await readFile(REPORT_PATH, 'utf-8'));
    } catch {}
  }

  // 샘플 선택 — 직전 회차에서 실패한 항목 우선 + 5% 새 무작위
  const failingPrev = Object.entries(prev.items ?? {})
    .filter(([, v]) => !v.ok)
    .map(([id]) => id);
  const failingPrevSet = new Set(failingPrev);
  const newSample = records
    .filter((r) => !failingPrevSet.has(r.id))
    .filter(() => Math.random() < SAMPLE_RATE)
    .map((r) => r.id);
  const sampleIds = ALL
    ? records.map((r) => r.id)
    : [...new Set([...failingPrev, ...newSample])];

  const sample = records.filter((r) => sampleIds.includes(r.id));

  console.log(`[link-health] 전체 ${records.length}건 중 ${sample.length}건 점검 (직전 실패 ${failingPrev.length}건 + 신규 샘플)`);

  const checked = await pool(
    sample,
    async (r) => {
      const result = await checkUrl(r.applyUrl);
      const prevEntry = prev.items?.[r.id];
      const failStreak = result.ok ? 0 : (prevEntry?.failStreak ?? 0) + 1;
      return {
        id: r.id,
        applyUrl: r.applyUrl,
        ok: result.ok,
        status: result.status,
        error: result.error,
        failStreak,
        checkedAt: new Date().toISOString(),
      };
    },
    CONCURRENCY,
  );

  const items = { ...(prev.items ?? {}) };
  for (const c of checked) {
    items[c.id] = c;
  }

  const failed = checked.filter((c) => !c.ok);
  const passed = checked.length - failed.length;

  await writeFile(
    REPORT_PATH,
    JSON.stringify(
      {
        lastRun: new Date().toISOString(),
        sampleSize: sample.length,
        passed,
        failed: failed.length,
        items,
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );

  console.log(`[link-health] 통과 ${passed} / 실패 ${failed.length}`);

  if (failed.length > 0) {
    console.log('');
    console.log('[link-health] 실패 항목:');
    for (const f of failed.slice(0, 20)) {
      console.log(`  ✗ ${f.id} (status: ${f.status || 'fetch-error'}, streak: ${f.failStreak}) — ${f.error ?? ''}`);
    }
    if (failed.length > 20) console.log(`  ... 외 ${failed.length - 20}건`);

    // CI 환경에서 step summary
    if (process.env.GITHUB_STEP_SUMMARY) {
      const lines = [
        `## ⚠️ applyUrl 헬스 체크 — ${failed.length}건 실패`,
        '',
        `- 점검: ${sample.length}건 / 통과: ${passed}`,
        '',
        '| ID | status | streak |',
        '|---|---|---|',
        ...failed.slice(0, 30).map((f) => `| \`${f.id}\` | ${f.status || 'err'} | ${f.failStreak} |`),
      ];
      try {
        const { appendFile } = await import('node:fs/promises');
        await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
      } catch {}
    }

    // 3회 연속 실패 항목은 별도 마킹 (운영자 수동 판단 신호)
    const persistentFails = checked.filter((c) => !c.ok && c.failStreak >= 3);
    if (persistentFails.length > 0) {
      console.log('');
      console.log(`[link-health] ⚠️ 3회 연속 실패 ${persistentFails.length}건 — 수동 검수 필요`);
    }
  }
}

main().catch((e) => {
  console.error('💥', e?.message ?? e);
  process.exit(1);
});
