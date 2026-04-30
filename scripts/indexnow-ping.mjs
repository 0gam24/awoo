#!/usr/bin/env node

/**
 * IndexNow 자동 ping — Bing·Yandex 등 IndexNow 호환 검색엔진 즉시 색인 요청
 *
 * 동작:
 *   1. dist/client/sitemap-*.xml 파싱 → 모든 URL 수집
 *   2. 직전 ping 결과 (.indexnow-state.json) 와 비교 → 신규/변경 URL 추출
 *   3. IndexNow API에 batch submit (한 번에 최대 10,000 URL)
 *   4. 상태 갱신
 *
 * 환경변수:
 *   INDEXNOW_KEY — 32자 16진수 키 (사용자 생성, public 파일과 동일)
 *
 * 사전 설정 (1회):
 *   1. 임의 32자 hex 키 생성 (사용자가 작성, 운영자 직접)
 *   2. public/<KEY>.txt 파일에 동일 키 평문 저장
 *   3. .env / GH secret에 INDEXNOW_KEY=<KEY>
 *   docs/ops/INDEXNOW.md 참조.
 *
 * Cloudflare 호환 — 빌드타임만 실행, 런타임 X.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_CLIENT = join(ROOT, 'dist', 'client');
const STATE_PATH = join(ROOT, '.indexnow-state.json');

const HOST = 'awoo.or.kr';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const MAX_URLS_PER_BATCH = 10000;

async function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    try {
      const text = await readFile(join(ROOT, file), 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
      }
    } catch {}
  }
  return env;
}

async function findSitemaps(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter((e) => /^sitemap.*\.xml$/.test(e)).map((e) => join(dir, e));
}

async function parseSitemap(filePath) {
  const xml = await readFile(filePath, 'utf-8');
  const urls = [];
  // <url><loc>...</loc>...
  const locRegex = /<loc>([^<]+)<\/loc>/g;
  for (let m = locRegex.exec(xml); m !== null; m = locRegex.exec(xml)) {
    urls.push(m[1].trim());
  }
  return urls;
}

async function readState() {
  if (!existsSync(STATE_PATH)) return { lastPing: null, knownUrls: [] };
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf-8'));
  } catch {
    return { lastPing: null, knownUrls: [] };
  }
}

async function writeState(state) {
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
}

async function pingIndexNow(key, urls) {
  if (urls.length === 0) return { ok: true, status: 200, count: 0 };
  const body = {
    host: HOST,
    key,
    keyLocation: `https://${HOST}/${key}.txt`,
    urlList: urls,
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  // IndexNow returns 200/202 success, 400 invalid, 403 forbidden, 422 unprocessable
  return { ok: res.ok, status: res.status, count: urls.length };
}

async function main() {
  const env = await loadEnv();
  const key = env.INDEXNOW_KEY;

  if (!key || !/^[a-fA-F0-9]{8,128}$/.test(key)) {
    console.error('❌ INDEXNOW_KEY 미설정 또는 형식 오류 (16진수 8~128자 필요)');
    console.error('   docs/ops/INDEXNOW.md 참조');
    process.exit(1);
  }

  // sitemap parse
  const sitemapFiles = await findSitemaps(DIST_CLIENT);
  if (sitemapFiles.length === 0) {
    console.error('❌ dist/client/sitemap*.xml 없음 — 빌드 먼저 실행 (`npm run build`)');
    process.exit(1);
  }

  // sitemap-index 는 다른 sitemap 들을 참조하므로 그것들의 loc도 수집
  const allUrls = new Set();
  for (const file of sitemapFiles) {
    const urls = await parseSitemap(file);
    for (const u of urls) {
      // sitemap-index에서 sitemap-N.xml 참조하는 경우는 따라가서 한 번 더 파싱
      if (u.endsWith('.xml') && u.includes(HOST)) {
        // 이미 위에서 처리된 파일 — 건너뜀
        continue;
      }
      allUrls.add(u);
    }
  }

  console.log(`[indexnow] sitemap에서 URL ${allUrls.size}건 추출`);

  if (allUrls.size === 0) {
    console.log('[indexnow] URL 없음 — 종료');
    return;
  }

  // 신규/변경 추출
  const state = await readState();
  const known = new Set(state.knownUrls ?? []);
  const newUrls = [...allUrls].filter((u) => !known.has(u));

  if (newUrls.length === 0) {
    console.log('[indexnow] 신규 URL 없음 — 마지막 ping 이후 변경 0건');
    return;
  }

  console.log(`[indexnow] 신규/변경 ${newUrls.length}건 ping 시작`);

  // batch submit
  const batches = [];
  for (let i = 0; i < newUrls.length; i += MAX_URLS_PER_BATCH) {
    batches.push(newUrls.slice(i, i + MAX_URLS_PER_BATCH));
  }

  const results = [];
  for (const [i, batch] of batches.entries()) {
    const result = await pingIndexNow(key, batch);
    results.push(result);
    console.log(
      `  · batch ${i + 1}/${batches.length}: ${result.count}건 → ${result.ok ? '✓' : '✗'} (status ${result.status})`,
    );
  }

  const okBatches = results.filter((r) => r.ok).length;
  console.log(`[indexnow] ${okBatches}/${batches.length} batch 성공`);

  // 성공한 URL만 known에 추가 (실패한 batch는 다음 회차에 재시도)
  if (okBatches === batches.length) {
    state.knownUrls = [...allUrls];
  }
  state.lastPing = new Date().toISOString();
  state.lastBatchUrls = newUrls.length;
  state.lastBatchOk = okBatches === batches.length;
  await writeState(state);

  // CI step summary
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      `## IndexNow ping — ${newUrls.length}건 색인 요청`,
      '',
      `- 호스트: \`${HOST}\``,
      `- batch: ${batches.length}`,
      `- 성공: ${okBatches}/${batches.length}`,
      `- 시각: ${state.lastPing}`,
    ];
    try {
      const { appendFile } = await import('node:fs/promises');
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
    } catch {}
  }
}

main().catch((e) => {
  console.error('💥', e?.message ?? e);
  process.exit(1);
});
