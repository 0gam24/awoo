#!/usr/bin/env node

/**
 * IndexNow 자동 ping — 네이버 서치어드바이저 + IndexNow 공용 창구(Bing·Yandex 등)에 색인 요청
 *
 * 네이버 공식 가이드(docs/references/H-네이버-공식가이드/10-IndexNow/)를 따른다.
 *   - 네이버 엔드포인트: https://searchadvisor.naver.com/indexnow
 *   - 새로 생기거나 바뀐 페이지만 알린다 — 바뀌지 않은 URL을 다시 보내지 않는다.
 *   - 삭제된 페이지(사이트맵에서 빠진 URL)도 한 번 알린다.
 *   - 배포가 끝나 200을 주는 URL만 보낸다 → 호출 워크플로는 배포 뒤에 실행할 것.
 *
 * 동작:
 *   1. dist/client/sitemap-*.xml 파싱 → URL과 lastmod 수집
 *   2. 직전 상태(.indexnow-state.json, CI는 actions/cache로 이어받음)와 비교
 *      → 처음 보는 URL, lastmod가 바뀐 URL, 사이트맵에서 빠진 URL
 *   3. 엔드포인트마다 batch submit(최대 10,000건), 429·5xx는 최대 3회 재시도
 *   4. 모든 엔드포인트가 성공했을 때만 상태 갱신(실패하면 다음 회차에 다시)
 *
 * 옵션:
 *   --seed          보내지 않고 현재 사이트맵을 상태로만 기록(상태가 사라졌을 때 전체 재전송 방지)
 *   --urls=a,b,...  지정 URL만 보낸다(삭제·410 주소 수동 알림용, 상태는 건드리지 않음)
 *   --dry-run       보낼 목록만 출력
 *
 * 환경변수: INDEXNOW_KEY — 공개 키 파일 public/<KEY>.txt와 같은 값. docs/ops/INDEXNOW.md 참조.
 */

import { existsSync } from 'node:fs';
import { appendFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_CLIENT = join(ROOT, 'dist', 'client');
const STATE_PATH = join(ROOT, '.indexnow-state.json');

const HOST = 'awoo.or.kr';
const ENDPOINTS = ['https://searchadvisor.naver.com/indexnow', 'https://api.indexnow.org/IndexNow'];
const MAX_URLS_PER_BATCH = 10000;
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000];

const args = process.argv.slice(2);
const SEED = args.includes('--seed');
const DRY_RUN = args.includes('--dry-run');
const URLS_ARG = args.find((a) => a.startsWith('--urls='))?.slice('--urls='.length);

async function loadEnv() {
  // CI 시크릿(process.env)이 로컬 .env 파일보다 우선
  const env = {};
  for (const file of ['.env', '.env.local']) {
    try {
      const text = await readFile(join(ROOT, file), 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
      }
    } catch {}
  }
  return { ...env, ...process.env };
}

async function findSitemaps(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter((e) => /^sitemap.*\.xml$/.test(e)).map((e) => join(dir, e));
}

/** <url> 블록마다 loc·lastmod. sitemap-index의 <sitemap> 항목(.xml)은 건너뛴다. */
async function parseSitemap(filePath) {
  const xml = await readFile(filePath, 'utf-8');
  const out = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    if (!loc || loc.endsWith('.xml')) continue;
    const lastmod = m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? '';
    out.push([loc, lastmod]);
  }
  return out;
}

async function readState() {
  if (!existsSync(STATE_PATH)) return null;
  try {
    const s = JSON.parse(await readFile(STATE_PATH, 'utf-8'));
    // 예전 형식(knownUrls 배열) → { url: lastmod } 로 옮긴다(lastmod는 모름 = 빈 값)
    if (!s.urls && Array.isArray(s.knownUrls))
      s.urls = Object.fromEntries(s.knownUrls.map((u) => [u, '']));
    return s;
  } catch {
    return null;
  }
}

async function writeState(state) {
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 한 엔드포인트에 한 batch. 429·5xx·네트워크 오류는 재시도. 200·202가 성공. */
async function submit(endpoint, key, urls) {
  const body = JSON.stringify({
    host: HOST,
    key,
    keyLocation: `https://${HOST}/${key}.txt`,
    urlList: urls,
  });
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    let text = '';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      status = res.status;
      text = (await res.text()).slice(0, 300);
    } catch (e) {
      text = String(e?.message ?? e);
    }
    if (status === 200 || status === 202) return { ok: true, status };
    // 400 잘못된 형식 · 403 키 불일치 · 422 호스트·URL 불일치 — 재시도해도 같다
    const retryable = status === 0 || status === 429 || status >= 500;
    if (!retryable || attempt >= RETRY_DELAYS_MS.length) return { ok: false, status, text };
    console.log(
      `  · ${endpoint} status ${status} — ${RETRY_DELAYS_MS[attempt] / 1000}초 뒤 재시도`,
    );
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

async function main() {
  const env = await loadEnv();
  const key = env.INDEXNOW_KEY;
  if (!key || !/^[a-fA-F0-9-]{8,128}$/.test(key)) {
    console.error('❌ INDEXNOW_KEY 미설정 또는 형식 오류 (16진수·하이픈 8~128자)');
    process.exit(1);
  }

  let toSend;
  let current = null;
  let state = null;

  if (URLS_ARG) {
    toSend = URLS_ARG.split(',')
      .map((u) => u.trim())
      .filter(Boolean);
  } else {
    const sitemapFiles = await findSitemaps(DIST_CLIENT);
    if (sitemapFiles.length === 0) {
      console.error('❌ dist/client/sitemap*.xml 없음 — 빌드 먼저 실행 (`npm run build`)');
      process.exit(1);
    }
    current = {};
    // 같은 URL이 여러 사이트맵에 있으면 lastmod가 있는 쪽을 쓴다(뉴스 사이트맵에는 lastmod가 없다)
    for (const file of sitemapFiles)
      for (const [u, lm] of await parseSitemap(file)) if (!current[u]) current[u] = lm;
    console.log(`[indexnow] sitemap에서 URL ${Object.keys(current).length}건 추출`);

    state = await readState();
    if (SEED || !state?.urls) {
      if (!SEED)
        console.log(
          '[indexnow] 이전 상태 없음 — 전체 재전송 대신 현재 사이트맵을 기준으로 기록만 한다',
        );
      if (!DRY_RUN) await writeState({ lastPing: state?.lastPing ?? null, urls: current });
      return;
    }
    const prev = state.urls;
    const added = Object.keys(current).filter((u) => !(u in prev));
    const changed = Object.keys(current).filter(
      (u) => u in prev && prev[u] && current[u] && prev[u] !== current[u],
    );
    const removed = Object.keys(prev).filter((u) => !(u in current));
    console.log(
      `[indexnow] 신규 ${added.length} · 변경 ${changed.length} · 삭제 ${removed.length}`,
    );
    toSend = [...added, ...changed, ...removed];
  }

  if (toSend.length === 0) {
    console.log('[indexnow] 보낼 URL 없음');
    return;
  }
  if (DRY_RUN) {
    console.log(toSend.join('\n'));
    return;
  }

  const results = [];
  for (const endpoint of ENDPOINTS) {
    for (let i = 0; i < toSend.length; i += MAX_URLS_PER_BATCH) {
      const batch = toSend.slice(i, i + MAX_URLS_PER_BATCH);
      const r = await submit(endpoint, key, batch);
      results.push({ endpoint, count: batch.length, ...r });
      console.log(
        `  · ${endpoint} ${batch.length}건 → ${r.ok ? '✓' : '✗'} (status ${r.status})${r.ok ? '' : ` ${r.text}`}`,
      );
      if (!r.ok) console.log(`::warning title=IndexNow::${endpoint} status ${r.status}`);
    }
  }
  const allOk = results.every((r) => r.ok);

  // 사이트맵 기준 실행이고 모든 엔드포인트가 성공했을 때만 상태를 넘긴다(실패분은 다음 회차에 다시)
  if (current && allOk) await writeState({ lastPing: new Date().toISOString(), urls: current });

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      `## IndexNow — ${toSend.length}건 색인 요청`,
      '',
      ...results.map(
        (r) => `- ${r.endpoint}: ${r.count}건 · status ${r.status} ${r.ok ? '✓' : '✗'}`,
      ),
    ];
    try {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
    } catch {}
  }
  if (!allOk) process.exitCode = 1;
}

main().catch((e) => {
  console.error('💥', e?.message ?? e);
  process.exit(1);
});
