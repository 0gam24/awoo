#!/usr/bin/env node
/**
 * 구글에 내밀 쪽수를 줄이기 위한 글 분류 (2026-11-11).
 *
 * 구글이 하루 25쪽쯤만 읽는데 700쪽 넘게 내밀고 있어, 지금 쓸모가 없는 글을 색인에서 뺀다.
 * 글 파일은 건드리지 않는다 — 결과는 src/data/noindex-paths.json(색인 제외 주소 목록)과
 * docs/ops/INDEX-PRUNE.md(사람이 읽는 목록) 두 파일뿐이라, 목록에서 지우면 바로 되돌아온다.
 *
 * 실행: node scripts/index-prune-classify.mjs [--write]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { issueUrlPath } from '../src/lib/issue-url.mjs';

const ROOT = 'src/data/issues';
const TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.parse(TODAY) - n * 86400000).toISOString().slice(0, 10);
const WRITE = process.argv.includes('--write');

// 확정 수치 없이 나간 초기 글의 자리 채움 문구
const PLACEHOLDER = /공식 공고 기준|금액 미공개|별도 공지 기준/;
// 그 주에만 의미가 있는 주간 모음 — reportType 값은 믿을 수 없어 제목으로 가린다
const WEEKLY_TITLE =
  /이번 주|[첫둘셋넷] ?째 주|다섯째 주|신규 등록 지원금 d+건|지원금 d+선|마감 D-d/;

// 기한 날짜가 적혀 있어도 내용은 해마다 쓰이는 글 — 사람이 보고 남기기로 한 것
const KEEP = [
  'eitc-property-requirement-jeonse',
  'eitc-payment-amount-reduction',
  'eitc-2026-eligibility-criteria',
  'coupang-weekly-holiday-pay-5day-condition',
  'youth-future-savings-consent-verification',
  'oil-linked-subsidy-how-to-apply',
];

function datesIn(text, year) {
  const out = [];
  for (const m of text.matchAll(/(20\d\d)[-.년]\s*(\d{1,2})[-.월]\s*(\d{1,2})/g))
    out.push(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
  if (!out.length)
    for (const m of text.matchAll(/(\d{1,2})월\s*(\d{1,2})일/g))
      out.push(`${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`);
  return out.sort();
}

const posts = [];
for (const d of readdirSync(ROOT)) {
  if (!/^\d{4}-\d\d-\d\d$/.test(d)) continue;
  for (const f of readdirSync(join(ROOT, d))) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    const p = JSON.parse(readFileSync(join(ROOT, d, f), 'utf8'));
    const slug = f.replace(/\.json$/, '');
    const lastUpdate = [p.dateModified?.slice(0, 10), ...(p.updates ?? []).map((u) => u.date)]
      .filter(Boolean)
      .sort()
      .pop();
    posts.push({ d, slug, p, url: issueUrlPath(d, slug), lastUpdate: lastUpdate ?? d });
  }
}

// 같은 지역·같은 묶음 글이 여럿이면 최근 손본 글을 대표 후보로 본다.
// 묶음 자료가 거칠어(전국·기타는 주제가 섞인다) 자동으로 빼지 않고 사람이 볼 후보로만 남긴다.
const intents = JSON.parse(readFileSync('docs/ops/cluster-intents.json', 'utf8')).entries;
const groups = new Map();
for (const e of intents) {
  if (e.rollup || e.cluster === 'other') continue;
  for (const r of (e.region ?? []).filter((r) => r !== '전국')) {
    const k = `${r}|${e.family}|${e.cluster}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e.slug);
  }
}
const bySlug = new Map(posts.map((x) => [x.slug, x]));
const dupOf = new Map();
for (const [k, slugs] of groups) {
  const xs = slugs.map((s) => bySlug.get(s)).filter(Boolean);
  if (xs.length < 2) continue;
  xs.sort((a, b) => (a.lastUpdate < b.lastUpdate ? 1 : -1));
  for (const x of xs.slice(1)) if (!dupOf.has(x.slug)) dupOf.set(x.slug, { rep: xs[0], key: k });
}

const out = { drop: [], merge: [], fix: [], keep: [] };
for (const x of posts) {
  const { p, d } = x;
  const cf = p.coreFacts ?? {};
  const dl = cf.deadline ?? '';
  const dts = datesIn(dl, d.slice(0, 4));
  const maintained = x.lastUpdate >= daysAgo(45);
  let reason = null;
  if (PLACEHOLDER.test(`${cf.amount ?? ''} ${dl}`) && d < '2026-08-28' && !maintained)
    reason = '확정 금액·기한 없이 나간 초기 글';
  else if (WEEKLY_TITLE.test(p.title) && d < daysAgo(30)) reason = '지난 주간 모음';
  else if (
    dts.length &&
    dts[dts.length - 1] < daysAgo(14) &&
    // 발행일보다 앞선 날짜는 기한이 아니라 시작·기준일이다
    dts[dts.length - 1] >= d &&
    !maintained &&
    /마감|까지|종료|소멸|기한|납부|지급일|입금|선착순/.test(dl) &&
    !/매년|상시|연중|매월|시행|개편|인상|부터 적용|2027/.test(dl)
  )
    reason = `기한 지남(${dts[dts.length - 1]})`;
  if (reason && KEEP.some((k) => x.slug.startsWith(k))) reason = null;
  if (reason) out.drop.push({ ...x, reason });
  else if (dupOf.has(x.slug))
    out.merge.push({ ...x, reason: `같은 주제 대표 글: ${dupOf.get(x.slug).rep.url}` });
  else if (d < '2026-08-28') out.fix.push({ ...x, reason: '옛 틀 — 구조 손질 대상' });
  else out.keep.push({ ...x, reason: '' });
}

const n = (k) => out[k].length;
console.log(
  `글 ${posts.length}편 → 뺄 글 ${n('drop')} · 합칠 글 ${n('merge')} · 고쳐 남길 글 ${n('fix')} · 그대로 남길 글 ${n('keep')}`,
);
const why = {};
for (const x of out.drop) {
  const k = x.reason.replace(/\(.*\)/, '');
  why[k] = (why[k] ?? 0) + 1;
}
console.log(why);

if (WRITE) {
  const paths = out.drop.map((x) => x.url).sort();
  writeFileSync(
    'src/data/noindex-paths.json',
    `${JSON.stringify({ _comment: '구글 색인에서 뺄 주소. scripts/index-prune-classify.mjs --write 로 생성. 되살리려면 주소를 지운다. 손으로 넣은 주소는 manual에.', generatedAt: TODAY, manual: [], paths }, null, 2)}\n`,
  );
  const row = (x) =>
    `| ${x.d} | [${x.p.title.replace(/\|/g, '/')}](https://awoo.or.kr${x.url}) | ${x.reason} |`;
  const sec = (title, k) =>
    `## ${title} (${n(k)}편)\n\n| 발행일 | 글 | 이유 |\n|---|---|---|\n${out[k].map(row).join('\n')}\n`;
  writeFileSync(
    'docs/ops/INDEX-PRUNE.md',
    `# 구글 색인 정리 목록 (${TODAY})\n\n글 ${posts.length}편 → 뺄 글 ${n('drop')} · 합칠 글 ${n('merge')} · 고쳐 남길 글 ${n('fix')} · 그대로 남길 글 ${n('keep')}\n\n뺄 글은 색인 제외(noindex) 표시만 붙고 주소·본문은 그대로다. 합칠 글은 후보일 뿐 아직 아무 조치도 하지 않았다. 되살리려면 src/data/noindex-paths.json에서 주소를 지운다.\n\n${sec('뺄 글', 'drop')}\n${sec('합칠 글 후보 — 사람이 보고 정한다', 'merge')}\n${sec('고쳐 남길 글', 'fix')}\n${sec('그대로 남길 글', 'keep')}`,
  );
  console.log('written');
} else {
  for (const k of ['drop', 'merge']) {
    console.log(`\n--- ${k} 표본`);
    for (const x of out[k].filter((_, i) => i % Math.ceil(n(k) / 14) === 0))
      console.log(` ${x.d} ${x.p.title.slice(0, 44)} :: ${x.reason.slice(0, 50)}`);
  }
}
