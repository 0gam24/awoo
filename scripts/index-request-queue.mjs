// 구글 색인 요청 대기 목록 (로컬 전용, docs/ops/index-request-queue.json).
// 고쳐 쓴 글(reworkedAt 있음) 가운데 아직 요청하지 않은 주소를 차례대로 내준다.
//   node scripts/index-request-queue.mjs            → 남은 수와 다음 10쪽
//   node scripts/index-request-queue.mjs --done <주소> [결과]  → 요청 끝난 주소 기록
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { issueUrl } from '../src/lib/issue-url.mjs';

const FILE = 'docs/ops/index-request-queue.json';
const ROOT = 'src/data/issues';
const state = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { done: [] };
const doneSet = new Set(state.done.map((d) => d.url));

const args = process.argv.slice(2);
if (args[0] === '--done') {
  const url = args[1];
  if (!doneSet.has(url)) {
    state.done.push({ url, date: new Date().toISOString().slice(0, 10), result: args[2] ?? 'ok' });
    writeFileSync(FILE, `${JSON.stringify(state, null, 2)}\n`);
  }
  console.log(`기록: ${url}`);
  process.exit(0);
}

const noindex = JSON.parse(readFileSync('src/data/noindex-paths.json', 'utf8'));
const blocked = new Set([...noindex.paths, ...noindex.rework, ...noindex.manual]);
const posts = [];
for (const d of readdirSync(ROOT)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
  for (const f of readdirSync(join(ROOT, d))) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(readFileSync(join(ROOT, d, f), 'utf8'));
    if (!j.reworkedAt) continue;
    const url = issueUrl(j.date, j.slug);
    if (blocked.has(new URL(url).pathname)) continue;
    posts.push({ url, date: j.date, title: j.title });
  }
}
posts.sort((a, b) => (a.date < b.date ? 1 : -1));
const left = posts.filter((p) => !doneSet.has(p.url));
console.log(
  `고친 글 ${posts.length}편 · 요청 끝 ${posts.length - left.length} · 남음 ${left.length}`,
);
for (const p of left.slice(0, 10)) console.log(p.url);
