#!/usr/bin/env node
/**
 * 빌드 산출물에서 noindex 페이지를 찾아 sitemap에서 제거한다.
 *
 * 왜: sitemap에 noindex URL이 실리면 GSC가 "noindex인데 사이트맵에 있음" 충돌로 보고,
 * 네이버도 저품질 페이지 대량 색인 요청으로 읽는다. astro sitemap의 filter는 설정 시점에
 * 라우트별 noindex 여부를 알 수 없으므로(런타임 계산), 빌드 후 실측으로 걷어내는 편이 정확하다.
 *
 * 실행: postbuild 체인 (astro build 다음)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist', 'client');
const SITE = 'https://awoo.or.kr';

const NOINDEX_RE = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i;

/** dist를 훑어 noindex인 페이지의 사이트 경로 집합을 만든다 */
function collectNoindexPaths(dir, acc = new Set()) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectNoindexPaths(full, acc);
      continue;
    }
    if (entry !== 'index.html') continue;
    let html;
    try {
      html = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    if (!NOINDEX_RE.test(html)) continue;
    const rel = relative(DIST, dirname(full)).split(/[\\/]/).filter(Boolean);
    acc.add(`/${rel.map((s) => encodeURI(s)).join('/')}${rel.length ? '/' : ''}`);
  }
  return acc;
}

function main() {
  let noindexPaths;
  try {
    noindexPaths = collectNoindexPaths(DIST);
  } catch (e) {
    console.log(`[sitemap-prune] dist 스캔 실패 — 건너뜀 (${e.message})`);
    return;
  }
  if (noindexPaths.size === 0) {
    console.log('[sitemap-prune] noindex 페이지 없음');
    return;
  }

  let pruned = 0;
  let files = 0;
  for (const f of readdirSync(DIST)) {
    if (!/^sitemap-\d+\.xml$/.test(f)) continue;
    const p = join(DIST, f);
    const xml = readFileSync(p, 'utf8');
    const kept = [];
    let removed = 0;
    for (const m of xml.matchAll(/<url>[\s\S]*?<\/url>/g)) {
      const block = m[0];
      const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? '';
      let path = '';
      try {
        path = new URL(loc).pathname;
      } catch {}
      // 사이트맵은 URL 인코딩된 경로, 수집 집합도 encodeURI 기준 — 양쪽 디코드해 비교
      const norm = (s) => {
        try {
          return decodeURI(s);
        } catch {
          return s;
        }
      };
      const hit = [...noindexPaths].some((np) => norm(np) === norm(path));
      if (hit) removed += 1;
      else kept.push(block);
    }
    if (removed === 0) continue;
    const head = xml.slice(0, xml.indexOf('<url>'));
    const tail = xml.slice(xml.lastIndexOf('</url>') + '</url>'.length);
    writeFileSync(p, head + kept.join('\n') + tail, 'utf8');
    pruned += removed;
    files += 1;
  }
  console.log(
    `[sitemap-prune] noindex ${noindexPaths.size}개 감지 → sitemap ${files}개 파일에서 ${pruned}건 제거 (${SITE})`,
  );
}

main();
