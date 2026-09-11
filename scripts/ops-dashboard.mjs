#!/usr/bin/env node
/**
 * ops-dashboard — 운영자 로컬 전용 대시보드 생성기.
 *
 * 목적은 하나다. 포스팅이 네이버 최상단에 올라 트래픽을 모으고 애드센스 수익을 최대화한다.
 * 이 스크립트는 리포 안의 운영 데이터를 읽어 `docs/ops/dashboard.html` 한 파일로 요약한다.
 * 공개 사이트와 무관하며(생성물은 .gitignore), 외부 리소스 0 · 인라인 CSS/JS만 · file:// 로 열린다.
 *
 * 화면 원칙(2026-09-11 개편): 한 열 · 필요한 것만 · 사람 말로. 원시 필드명은 화면에 쓰지 않는다.
 *   ① 오늘 할 일 → ② 새 키워드(신생·틈새) → ③ 오늘 쓸 글감 → ④ 순위 → ⑤ 트래픽
 *   → ⑥ 갱신 필요 글 → ⑦ 다가오는 일정 → (접힘) 자동화·API·잠금 장부·읽는 법
 *
 * 사용:
 *   node scripts/ops-dashboard.mjs                # docs/ops/dashboard.html 생성
 *   node scripts/ops-dashboard.mjs --today=2026-09-10   # 날짜 고정(재현용)
 *   npm run ops:dashboard
 *
 * 입력(전부 읽기만 · 비밀 파일은 절대 읽지 않는다):
 *   docs/ops/pipeline-queue.json · src/data/naver-ranks.json · docs/ops/rank-targets.json
 *   docs/ops/volume-scale.json · src/data/analytics/naver-analytics-search-*.json
 *   docs/ops/cluster-intents.json · src/data/keyword-radar.json(niche·candidates·apiUsage만)
 *   docs/ops/0400-queue.json · docs/ops/landgrab-calendar.json · src/data/issues/**（제목·메타만）
 *   src/data/today-issue.json(동기화 시각만) · .github/workflows/*.yml(cron 줄만)
 *
 * 원칙: 없는 파일·빈 필드에 죽지 않는다(섹션마다 '데이터 없음'). 파일에 없는 숫자는 만들지 않는다.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'ops', 'dashboard.html');
const SITE = 'https://awoo.or.kr';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// ───────────────────────── 시간 유틸(KST) ─────────────────────────
function kstParts(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}`,
    time: `${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`,
    ms: d.getTime(),
  };
}
function kst(input) {
  const p = kstParts(input);
  return p ? `${p.date} ${p.time}` : '없음';
}
function kstShort(input) {
  const p = kstParts(input);
  return p ? `${p.date.slice(5)} ${p.time}` : '없음';
}
function kstDate(input) {
  const p = kstParts(input);
  return p ? p.date : null;
}
function dayDiff(fromYmd, toYmd) {
  if (!fromYmd || !toYmd) return null;
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}
function addDays(ymd, n) {
  const t = Date.parse(`${ymd}T00:00:00Z`) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
function dday(today, ymd) {
  const n = dayDiff(today, ymd);
  if (n === null) return '';
  if (n === 0) return 'D-day';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

const argToday = process.argv.find((a) => a.startsWith('--today='))?.slice(8);
const NOW = new Date();
const TODAY = argToday && /^\d{4}-\d{2}-\d{2}$/.test(argToday) ? argToday : kstDate(NOW);
const YESTERDAY = addDays(TODAY, -1);

function agoText(ms) {
  if (!ms) return '없음';
  const h = (NOW.getTime() - ms) / 3600000;
  if (h < 0) return '방금';
  if (h < 1) return `${Math.round(h * 60)}분 전`;
  if (h < 48) return `${Math.round(h)}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

// ───────────────────────── 파일 유틸(읽기 전용) ─────────────────────────
function rel(p) {
  return p.replaceAll('\\', '/').replace(`${ROOT.replaceAll('\\', '/')}/`, '');
}
function mtimeOf(abs) {
  try {
    return statSync(abs).mtime;
  } catch {
    return null;
  }
}
function readJson(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs))
    return { ok: false, path: relPath, data: null, mtime: null, error: '파일 없음' };
  try {
    const data = JSON.parse(readFileSync(abs, 'utf8'));
    return { ok: true, path: relPath, data, mtime: mtimeOf(abs), error: null };
  } catch (e) {
    return {
      ok: false,
      path: relPath,
      data: null,
      mtime: mtimeOf(abs),
      error: `JSON 파싱 실패: ${e.message}`,
    };
  }
}
function fileHref(relPath) {
  return pathToFileURL(join(ROOT, relPath)).href;
}
function postUrl(slug) {
  if (!slug) return null;
  return `${SITE}/issues/${slug.replace(/-\d{4}-\d{2}-\d{2}$/, '')}/`;
}
function shortSlug(slug) {
  return String(slug ?? '').replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

// ───────────────────────── HTML 유틸 ─────────────────────────
function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function num(v, digits = 0) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '없음';
  return Number(v).toLocaleString('ko-KR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}
function pct(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '없음';
  return `${Number(v).toFixed(digits)}%`;
}
function cut(s, n) {
  const t = String(s ?? '').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}
function extLink(href, label) {
  return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}
function localLink(relPath, label) {
  return `<a href="${esc(fileHref(relPath))}" class="local">${esc(label ?? relPath)}</a>`;
}
function naverLink(query) {
  return `<a class="nv" href="https://search.naver.com/search.naver?query=${encodeURIComponent(query)}" target="_blank" rel="noopener" title="네이버에서 열기">검색</a>`;
}
function badge(kind, text, title) {
  return `<span class="b b-${kind}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
}
function rankBadge(rank, wholeBlock) {
  if (rank === null || rank === undefined) {
    return badge(
      'none',
      `미노출 · ${wholeBlock ? '블록 만석' : '블록 밖'}`,
      '자사 글이 웹문서 블록에 없음',
    );
  }
  if (rank <= 3) return badge('good', `${rank}위`);
  if (rank <= 10) return badge('warn', `${rank}위`);
  return badge('none', `${rank}위`);
}
function rankText(rank, wholeBlock) {
  if (rank === null || rank === undefined) return `미노출(${wholeBlock ? '블록 만석' : '블록 밖'})`;
  return `${rank}위`;
}
/** 데이터 파일의 기계 문구를 사람 말로. 규칙 치환만 하고 뜻은 바꾸지 않는다. */
const HUMAN = [
  [/verdictT1 (open|closed)/g, (_m, s) => `지역 자리 ${s === 'open' ? '열림' : '닫힘'}`],
  [/verdictT2 (open|closed)/g, (_m, s) => `롱테일 자리 ${s === 'open' ? '열림' : '닫힘'}`],
  [/verdictT1/g, '지역 자리'],
  [/verdictT2/g, '롱테일 자리'],
  [/openSlots (\d+)<(\d+)/g, '빈자리 $1개(기준 $2)'],
  [/openSlots ≥(\d+)/g, '빈자리 $1개 이상'],
  [/openSlots (\d+)/g, '빈자리 $1개'],
  [/openSlots/g, '빈자리'],
  [/rank null/g, '미노출'],
  [/already r(\d+)/g, '이미 $1위'],
  [/(^|[\s"(])r(\d+)(?=[\s,.·)"]|$)/g, '$1$2위'],
  [/offset-warn ([\d.]+%)/g, '웹문서 비중 $1 주의'],
  [/offset ([\d.]+%)/g, '웹문서 비중 $1'],
  [/webDocOffset/g, '웹문서 비중'],
  [/mainGovAbove/g, '위 본청'],
  [/pressAbove/g, '위 언론'],
  [/inbound7d?/g, '실유입/주'],
  [/fromAnalytics/g, '실유입 발견'],
  [/\bborn\b/g, '신생'],
  [/knownPair/g, '알려진 쌍'],
  [/coreFacts\.deadline/g, '기한 사실'],
  [/coreFactsKeys?/g, '핵심 사실'],
  [/coreFacts/g, '핵심 사실'],
  [/cluster-intents VETO/g, '잠금 장부 거부'],
  [/\bVETO\b/g, '거부'],
  [/recent7/g, '최근 7일 검색지수'],
  [/rel30/g, '30일 상대검색량'],
  [/datalab/g, '데이터랩'],
  [/mode update-only/g, '갱신 전용'],
  [/\bhold\b/g, '보류'],
  [/\btrend\b/g, '추세'],
  [/\bpeak\b/g, '피크'],
  [/\bproposed\b/g, '지시 대기'],
  [/\bstatus\b/g, '상태'],
  [/writeBy/g, '작성 기한'],
  [/watchFrom/g, '감시 시작'],
  [/targetQuery/g, '타깃 쿼리'],
  [/updates\[\]/g, '갱신 기록'],
  [/big-keywords/g, '대형 키워드 목록'],
  [/naver-ranks/g, '순위 기록'],
  [/keyword-volume/g, '검색량 측정'],
  [/\bnull\b/g, '없음'],
];
function humanize(text) {
  let t = String(text ?? '');
  for (const [re, rep] of HUMAN) t = t.replace(re, rep);
  return t;
}
function srcItem(relPath, when) {
  return `<li>${localLink(relPath)} <span>${esc(when ?? '없음')}</span></li>`;
}
function card(id, title, sources, body, opts = {}) {
  const src = sources.length
    ? `<details class="src"><summary>출처</summary><ul>${sources.join('')}</ul></details>`
    : '';
  const sub = opts.sub ? `<p class="sub">${opts.sub}</p>` : '';
  return `<section class="card" id="${id}"><div class="card-h"><h2>${esc(title)}</h2>${src}</div>${sub}${body}</section>`;
}
function empty(text = '데이터 없음') {
  return `<p class="empty">${esc(text)}</p>`;
}
function kv(label, valueHtml) {
  return `<span class="kv"><i>${esc(label)}</i>${valueHtml}</span>`;
}

// ───────────────────────── 데이터 적재 ─────────────────────────
const pq = readJson('docs/ops/pipeline-queue.json');
const ranks = readJson('src/data/naver-ranks.json');
const targets = readJson('docs/ops/rank-targets.json');
const vs = readJson('docs/ops/volume-scale.json');
const ci = readJson('docs/ops/cluster-intents.json');
const radar = readJson('src/data/keyword-radar.json');
const q0400 = readJson('docs/ops/0400-queue.json');
const landgrab = readJson('docs/ops/landgrab-calendar.json');
const todayIssue = readJson('src/data/today-issue.json');

function latestAnalytics() {
  const dir = join(ROOT, 'src', 'data', 'analytics');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => /^naver-analytics-search-.*\.json$/.test(f))
    .sort();
  if (!files.length) return null;
  return readJson(`src/data/analytics/${files.at(-1)}`);
}
const analytics = latestAnalytics();

function loadPosts() {
  const base = join(ROOT, 'src', 'data', 'issues');
  const posts = [];
  if (!existsSync(base)) return posts;
  for (const d of readdirSync(base)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const dir = join(base, d);
    let st;
    try {
      st = statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      try {
        const o = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        posts.push({
          title: o.title ?? f,
          slug: o.slug ?? f.replace(/\.json$/, ''),
          date: o.date ?? d,
          publishedAt: o.publishedAt ?? null,
          targetQuery: o.targetQuery ?? null,
          parseOk: true,
        });
      } catch {
        posts.push({
          title: `${f} (파싱 실패)`,
          slug: f.replace(/.json$/, ''),
          date: d,
          publishedAt: null,
          targetQuery: null,
          parseOk: false,
        });
      }
    }
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
  return posts;
}
const posts = loadPosts();
const postBySlug = new Map();
for (const p of posts) {
  postBySlug.set(p.slug, p);
  postBySlug.set(shortSlug(p.slug), p);
}

function loadCrons() {
  const dir = join(ROOT, '.github', 'workflows');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.yml') || x.endsWith('.yaml'))) {
    const text = readFileSync(join(dir, f), 'utf8');
    const crons = [...text.matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    const nameMatch = text.match(/^name:\s*(.+)$/m);
    out.push({ file: f, name: nameMatch ? nameMatch[1].trim() : f, crons });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}
const crons = loadCrons();

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function cronToKst(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { text: expr, times: [], daily: false, weekly: false };
  const [minS, hourS, dom, mon, dowS] = parts;
  const minute = Number(minS);
  if (Number.isNaN(minute) || hourS === '*' || /[/-]/.test(hourS) || dom !== '*' || mon !== '*') {
    return { text: `${expr} (UTC, 변환 생략)`, times: [], daily: false, weekly: false };
  }
  const hours = hourS.split(',').map(Number);
  const times = [];
  for (const hh of hours) {
    const kh = (hh + 9) % 24;
    const shift = hh + 9 >= 24 ? 1 : 0;
    times.push({ h: kh, m: minute, shift });
  }
  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = times.map((t) => `${pad(t.h)}:${pad(t.m)}`).join('·');
  if (dowS === '*') return { text: `매일 ${timeStr}`, times, daily: true, weekly: false };
  const days = dowS.split(',').map((d) => {
    const base = Number(d);
    if (Number.isNaN(base)) return d;
    const shifted = (base + (times[0]?.shift ?? 0)) % 7;
    return DOW[shifted];
  });
  return { text: `매주 ${days.join('·')} ${timeStr}`, times, daily: false, weekly: true };
}
function nextRunKst(expr) {
  const c = cronToKst(expr);
  if (!c.times.length || !c.daily) return null;
  const nowK = new Date(NOW.getTime() + KST_OFFSET_MS);
  const nowMin = nowK.getUTCHours() * 60 + nowK.getUTCMinutes();
  const upcoming = c.times.map((t) => t.h * 60 + t.m).sort((a, b) => a - b);
  const next = upcoming.find((m) => m > nowMin);
  const pad = (n) => String(n).padStart(2, '0');
  if (next !== undefined) return `오늘 ${pad(Math.floor(next / 60))}:${pad(next % 60)}`;
  const first = upcoming[0];
  return `내일 ${pad(Math.floor(first / 60))}:${pad(first % 60)}`;
}
const rankCron = crons.find((c) => c.file === 'naver-rank.yml')?.crons[0];
const rankNextKst = rankCron ? nextRunKst(rankCron) : null;

// ───────────────────────── 파생 데이터 ─────────────────────────
const byQuery = ranks.ok && ranks.data?.byQuery ? ranks.data.byQuery : {};
const rankQueries = Object.keys(byQuery);
const targetList = targets.ok && Array.isArray(targets.data?.targets) ? targets.data.targets : [];
const targetByQuery = new Map(targetList.map((t) => [t.query, t]));

function sortedHistory(entry) {
  const hist = Array.isArray(entry?.history) ? [...entry.history] : [];
  const key = (x) => Date.parse(x.ts ?? `${x.date}T00:00:00Z`) || 0;
  return hist.sort((a, b) => key(a) - key(b));
}
const rankRows = rankQueries.map((q) => {
  const e = byQuery[q];
  const latest = e?.latest ?? {};
  const hist = sortedHistory(e);
  const last = hist.at(-1);
  const prev = hist.at(-2);
  const kinds = {};
  for (const a of latest.above ?? []) kinds[a.kind ?? '?'] = (kinds[a.kind ?? '?'] ?? 0) + 1;
  const t = targetByQuery.get(q);
  return {
    query: q,
    rank: latest.rank ?? null,
    prevRank: prev ? (prev.rank ?? null) : undefined,
    curHist: last ? (last.rank ?? null) : undefined,
    url: latest.url ?? null,
    wholeBlock: latest.aboveIsWholeBlock === true,
    parseOk: latest.parseOk,
    date: latest.date ?? e?.first ?? null,
    kinds,
    openSlots: last?.openSlots,
    verdictT1: last?.verdictT1,
    verdictT2: last?.verdictT2,
    gov: latest.mainGovAbove,
    press: latest.pressAbove,
    inbound7d: t?.inbound7d ?? null,
    targetUrl: t?.url ?? null,
  };
});
rankRows.sort((a, b) => {
  const ra = a.rank ?? 999;
  const rb = b.rank ?? 999;
  if (ra !== rb) return ra - rb;
  return (b.inbound7d ?? 0) - (a.inbound7d ?? 0);
});
const rankBuckets = {
  top: rankRows.filter((r) => r.rank !== null && r.rank <= 3).length,
  mid: rankRows.filter((r) => r.rank !== null && r.rank > 3 && r.rank <= 10).length,
  low: rankRows.filter((r) => r.rank !== null && r.rank > 10).length,
  none: rankRows.filter((r) => r.rank === null).length,
};
const parseFails = rankRows.filter((r) => r.parseOk === false);
const unregisteredTargets = targetList.filter((t) => !byQuery[t.query]);

const pqItems = pq.ok && Array.isArray(pq.data?.items) ? pq.data.items : [];
const pqNew = pqItems.filter((i) => i.track === 'T1' || i.track === 'T2' || i.track === 'T3');
const pqUpd = pqItems.filter((i) => i.track === '갱신');
const pqWatch = pq.ok && Array.isArray(pq.data?.watch) ? pq.data.watch : [];
const pqExcluded = pq.ok && Array.isArray(pq.data?.excluded) ? pq.data.excluded : [];
const pqMeta = pq.ok ? (pq.data?.meta ?? {}) : {};
const serpResults = Array.isArray(pqMeta.serp?.results) ? pqMeta.serp.results : [];

const ciEntries = ci.ok && Array.isArray(ci.data?.entries) ? ci.data.entries : [];
const ciRegionOf = (e) => (Array.isArray(e.region) ? e.region : [e.region]).filter(Boolean);
const ciToday = ciEntries.filter((e) => e.date === TODAY);
const ciRecent = ciEntries.filter((e) => (e.date ?? '') >= YESTERDAY);
const ciByRegion = new Map();
for (const e of ciEntries) {
  if (e.rollup) continue;
  for (const g of ciRegionOf(e)) {
    if (!ciByRegion.has(g)) ciByRegion.set(g, []);
    ciByRegion.get(g).push(e);
  }
}
for (const list of ciByRegion.values())
  list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
const ciBySlug = new Map(ciEntries.map((e) => [shortSlug(e.slug), e]));
const REGIONS = [
  ...new Set([...(ci.ok ? (ci.data?.meta?.regions ?? []) : []), ...ciByRegion.keys()]),
].sort((a, b) => b.length - a.length);
function regionOf(text) {
  const s = String(text ?? '');
  for (const r of REGIONS) if (s.includes(r)) return r;
  return null;
}
function famsOf(entries) {
  return [...new Set(entries.map((e) => e.family).filter(Boolean))].join('·');
}
const norm = (s) => String(s ?? '').replace(/\s+/g, '');

const todayPosts = posts.filter((p) => p.date === TODAY);
const publishedTodayQueries = new Set(
  [...todayPosts.map((p) => p.targetQuery), ...ciToday.map((e) => e.targetQuery)].filter(Boolean),
);
const isPublishedToday = (i) =>
  publishedTodayQueries.has(i.query) || publishedTodayQueries.has(i.serp?.query);
const ranksUpdatedMs = ranks.ok && ranks.data?.updatedAt ? Date.parse(ranks.data.updatedAt) : 0;
function measuredState(p) {
  if (!p?.targetQuery) return { measured: false, why: '타깃 쿼리 없음' };
  const e = byQuery[p.targetQuery];
  if (!e) return { measured: false, why: '순위 추적 미등록' };
  const pubMs = p.publishedAt ? Date.parse(p.publishedAt) : 0;
  if (pubMs && ranksUpdatedMs && pubMs > ranksUpdatedMs)
    return { measured: false, why: '발행 후 아직 측정 전', rank: e.latest?.rank ?? null };
  return {
    measured: true,
    rank: e.latest?.rank ?? null,
    wholeBlock: e.latest?.aboveIsWholeBlock === true,
  };
}
const STATUS_KO = {
  proposed: '지시 대기',
  approved: '승인됨',
  published: '발행됨',
  rejected: '반려',
  hold: '보류',
  watch: '감시',
  scheduled: '예정',
  migrated: '이관됨',
};
const statusKo = (s) => STATUS_KO[s] ?? (s ? humanize(s) : '없음');

// ── 자동화 상태(워크플로별 마지막 산출) ──
const OUTPUT_OF = {
  'naver-rank.yml': ['순위 기록', ranks.ok ? Date.parse(ranks.data.updatedAt) : null],
  'keyword-pipeline.yml': ['파이프라인', pq.ok ? Date.parse(pqMeta.generatedAt) : null],
  'keyword-radar.yml': ['레이더', radar.ok ? Date.parse(radar.data.updatedAt) : null],
  'sync-issues.yml': ['오늘의 이슈', todayIssue.ok ? Date.parse(todayIssue.data?.syncedAt) : null],
};
const automation = crons
  .filter((c) => c.crons.length)
  .map((c) => {
    const k = cronToKst(c.crons[0]);
    const runsPerDay = k.daily ? Math.max(1, k.times.length) : 0;
    const expectH = k.daily ? 24 / runsPerDay : k.weekly ? 168 : null;
    const out = OUTPUT_OF[c.file];
    const lastMs = out?.[1] && !Number.isNaN(out[1]) ? out[1] : null;
    const ageH = lastMs ? (NOW.getTime() - lastMs) / 3600000 : null;
    let state = 'none';
    let stateText = '산출 파일 추적 안 함';
    if (out) {
      if (!lastMs) {
        state = 'crit';
        stateText = '산출 없음';
      } else if (expectH !== null && ageH > expectH + 3) {
        state = 'crit';
        stateText = '지연 또는 미pull';
      } else {
        state = 'good';
        stateText = '정상';
      }
    }
    return {
      file: c.file,
      name: c.name,
      schedule: c.crons.map((x) => cronToKst(x).text).join(' / '),
      next: k.daily ? nextRunKst(c.crons[0]) : null,
      outputName: out?.[0] ?? null,
      lastMs,
      state,
      stateText,
    };
  });
const delayed = automation.filter((a) => a.state === 'crit');

// ── 데이터 최신도(핵심 3파일 중 가장 오래된 것) ──
const coreFiles = [
  ['순위 기록', ranks.ok ? Date.parse(ranks.data.updatedAt) : null],
  ['파이프라인', pq.ok ? Date.parse(pqMeta.generatedAt) : null],
  ['레이더', radar.ok ? Date.parse(radar.data.updatedAt) : null],
].filter(([, t]) => t && !Number.isNaN(t));
const oldestCore = coreFiles.length ? coreFiles.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
const oldestAgeH = oldestCore ? (NOW.getTime() - oldestCore[1]) / 3600000 : null;

// ───────────────────────── ② 새 키워드 목록 ─────────────────────────
const nicheList = radar.ok && Array.isArray(radar.data?.niche) ? radar.data.niche : [];
const candList = radar.ok && Array.isArray(radar.data?.candidates) ? radar.data.candidates : [];
function ourPostsFor(term) {
  const region = regionOf(term);
  if (region && ciByRegion.has(region)) {
    const list = ciByRegion.get(region);
    return { has: true, region, slug: list[0].slug, fams: famsOf(list), count: list.length };
  }
  const n = norm(term);
  const hits = n
    ? posts.filter((p) => norm(p.title).includes(n) || (p.targetQuery && norm(p.targetQuery) === n))
    : [];
  if (hits.length) {
    const fam = ciBySlug.get(shortSlug(hits[0].slug))?.family;
    return { has: true, region, slug: hits[0].slug, fams: fam ?? '', count: hits.length };
  }
  return { has: false, region };
}
function variantsOf(item) {
  return String(item.variant ?? '')
    .split(' / ')
    .map((s) => s.trim())
    .filter(Boolean);
}
function itemMatches(item, term) {
  return item.query === term || item.serp?.query === term || variantsOf(item).includes(term);
}
function slotOf(term) {
  const it = pqItems.find((i) => i.serp && itemMatches(i, term));
  const s = it?.serp ?? serpResults.find((r) => r.query === term);
  if (s) {
    return {
      measured: true,
      verdict: true,
      open: s.verdictT1 === 'open' || s.verdictT2 === 'open',
      rank: s.rank ?? null,
      wholeBlock: s.aboveIsWholeBlock === true,
      gov: s.mainGovAbove,
      press: s.pressAbove,
      openSlots: s.openSlots,
      approx: s.approx === true,
      query: s.query,
    };
  }
  const e = byQuery[term];
  if (e?.latest && 'rank' in e.latest) {
    const l = e.latest;
    const hasVerdict = l.verdictT1 !== undefined || l.verdictT2 !== undefined;
    return {
      measured: true,
      verdict: hasVerdict,
      open: l.verdictT1 === 'open' || l.verdictT2 === 'open',
      rank: l.rank ?? null,
      wholeBlock: l.aboveIsWholeBlock === true,
      gov: l.mainGovAbove,
      press: l.pressAbove,
      openSlots: l.openSlots,
      approx: false,
      query: term,
    };
  }
  return { measured: false };
}
function slotHtml(s) {
  if (!s.measured) return badge('none', '미측정');
  const parts = [];
  if (s.verdict) {
    parts.push(badge(s.open ? 'good' : 'warn', s.open ? '열림' : '닫힘'));
    if (s.gov !== undefined || s.press !== undefined)
      parts.push(`위에 본청 ${num(s.gov)}·언론 ${num(s.press)}`);
  }
  parts.push(`우리 ${esc(rankText(s.rank, s.wholeBlock))}`);
  if (s.approx) parts.push('<span class="muted">(근사)</span>');
  return parts.join(' · ');
}
function verdictOf(term) {
  const it = pqItems.find((i) => itemMatches(i, term));
  if (it) {
    const st = isPublishedToday(it) ? '오늘 발행됨' : statusKo(it.status);
    return { kind: '후보', order: 0, text: `후보(${it.track}) · ${st}`, item: it };
  }
  const ex =
    pqExcluded.find((x) => x.query === term) ??
    pqExcluded.find((x) => String(x.reason ?? '').includes(`"${term}"`));
  if (ex) return { kind: '제외', order: 2, text: `제외: ${cut(humanize(ex.reason), 60)}` };
  return { kind: '미판정', order: 1, text: '미판정 — /naver로 실측 가능' };
}
const kwMap = new Map();
for (const n of nicheList) {
  if (!n?.term) continue;
  const r = byQuery[n.term]?.latest?.rank;
  if (typeof r === 'number' && r <= 3) continue; // 이미 1~3위면 틈새가 아니다
  kwMap.set(n.term, {
    term: n.term,
    opportunity: n.opportunity ?? null,
    stage: n.stage ?? null,
    age: n.age ?? null,
    kin: n.kinQuestions ?? null,
    blogTotal: n.blogTotal ?? null,
    recent7: n.recent7 ?? null,
    born: n.born === true,
    fromAnalytics: false,
    inbound7d: null,
    days: null,
    regionPattern: false,
    flaggedAt: n.flaggedAt ?? null,
    sources: ['niche'],
  });
}
for (const c of candList) {
  if (!c?.term) continue;
  const eligible =
    (c.born === true || c.fromAnalytics === true) &&
    (c.ourRank === null || c.ourRank === undefined || c.ourRank >= 4);
  if (!eligible) continue;
  const v = c.signals?.volume ?? {};
  const prev = kwMap.get(c.term) ?? { term: c.term, sources: [] };
  kwMap.set(c.term, {
    ...prev,
    opportunity: prev.opportunity ?? c.signals?.opportunity ?? null,
    stage: prev.stage ?? c.signals?.stage ?? null,
    age: prev.age ?? c.signals?.age ?? null,
    kin: prev.kin ?? c.signals?.kinQuestions ?? null,
    blogTotal: prev.blogTotal ?? null,
    recent7: prev.recent7 ?? v.recent7 ?? null,
    born: prev.born === true || c.born === true,
    fromAnalytics: prev.fromAnalytics === true || c.fromAnalytics === true,
    inbound7d: c.inbound7d ?? prev.inbound7d ?? null,
    days: v.days ?? prev.days ?? null,
    regionPattern: prev.regionPattern === true || c.regionPattern === true,
    flaggedAt: prev.flaggedAt ?? c.flaggedAt ?? null,
    sources: [...prev.sources, 'candidates'],
  });
}
const kwList = [...kwMap.values()].map((k) => ({
  ...k,
  ours: ourPostsFor(k.term),
  slot: slotOf(k.term),
  verdict: verdictOf(k.term),
}));
kwList.sort((a, b) => {
  if (a.verdict.order !== b.verdict.order) return a.verdict.order - b.verdict.order;
  const ia = a.inbound7d ?? -1;
  const ib = b.inbound7d ?? -1;
  if (ia !== ib) return ib - ia;
  return (b.opportunity ?? -1) - (a.opportunity ?? -1);
});
const kwStats = {
  total: kwList.length,
  today: kwList.filter((k) => kstDate(k.flaggedAt) === TODAY).length,
  born: kwList.filter((k) => k.born).length,
  fromAnalytics: kwList.filter((k) => k.fromAnalytics).length,
  usable: kwList.filter(
    (k) =>
      k.verdict.kind !== '제외' && k.slot.measured && k.slot.verdict && k.slot.open && !k.ours.has,
  ),
  unjudged: kwList.filter((k) => k.verdict.kind === '미판정').length,
  byVerdict: kwList.reduce((m, k) => {
    m[k.verdict.kind] = (m[k.verdict.kind] ?? 0) + 1;
    return m;
  }, {}),
};
function whyText(k) {
  const parts = [];
  if (k.born) parts.push(`신생 ${k.days !== null ? `${num(k.days)}일` : ''}`.trim());
  else if (k.stage === 'new') parts.push(`새로 뜸${k.age !== null ? `(${num(k.age)}일차)` : ''}`);
  else if (k.stage === 'rising')
    parts.push(`상승 중${k.age !== null ? `(${num(k.age)}일차)` : ''}`);
  if (k.kin !== null) parts.push(`질문 ${num(k.kin)}`);
  if (k.blogTotal !== null) parts.push(`블로그 ${num(k.blogTotal)}건`);
  if (k.inbound7d !== null) parts.push(`실유입 ${num(k.inbound7d)}/주`);
  if (k.opportunity !== null) parts.push(`기회도 ${num(k.opportunity)}`);
  return parts.join(' · ') || '신호 없음';
}
function oursHtml(o) {
  if (!o.has) return '<span class="none">없음</span>';
  const label = `${shortSlug(o.slug)}${o.fams ? ` (${o.fams})` : ''}`;
  return `있음: ${extLink(postUrl(o.slug), label)}${o.count > 1 ? ` <span class="muted">외 ${o.count - 1}</span>` : ''}`;
}
function kwRow(k) {
  const vk = k.verdict.kind === '후보' ? 'good' : k.verdict.kind === '제외' ? 'none' : 'warn';
  return `<div class="row"><div class="row-top"><b class="term">${esc(k.term)}</b> ${naverLink(k.term)}${k.regionPattern ? ' <span class="muted">지역형</span>' : ''}<span class="grow"></span>${badge(vk, k.verdict.kind)}</div><div class="row-why">${esc(whyText(k))}</div><div class="row-kv">${kv('우리 글', oursHtml(k.ours))}${kv('빈자리', slotHtml(k.slot))}${kv('판정', esc(k.verdict.text))}</div></div>`;
}

// ───────────────────────── ① 오늘 할 일 ─────────────────────────
const todos = [];
{
  const proposed = pqNew.filter((i) => i.status === 'proposed' && !isPublishedToday(i));
  if (proposed.length) {
    const t1 = proposed.filter((i) => i.track === 'T1').length;
    const t2 = proposed.length - t1;
    todos.push({
      tone: 'warn',
      html: `발행 후보 ${proposed.length}건(지역 ${t1}·롱테일 ${t2})을 검토해 발행을 지시하세요 — 지시 대기 중`,
      href: '#ideas',
      label: '오늘 쓸 글감',
    });
  }
  if (kwList.length) {
    const u = kwStats.usable.length;
    todos.push({
      tone: u ? 'good' : 'none',
      html: u
        ? `새 키워드 중 쓸 수 있는 자리 ${u}건(${kwStats.usable
            .slice(0, 3)
            .map((k) => `'${esc(k.term)}'`)
            .join(', ')}${u > 3 ? ' 외' : ''}) — ③에 없으면 /naver 실측을 지시하세요`
        : `새 키워드 ${kwStats.total}건 관측, 쓸 수 있음 판정 0건 — 미판정 ${kwStats.unjudged}건은 /naver로 실측 가능`,
      href: '#keywords',
      label: '새 키워드',
    });
  }
  const due = pqUpd
    .map((i) => ({ i, d: i.dueDate ? dayDiff(TODAY, i.dueDate) : (i.daysLeft ?? null) }))
    .filter((x) => x.d !== null && x.d <= 0);
  if (due.length) {
    const names = due
      .slice(0, 4)
      .map((x) => x.i.region ?? cut(x.i.query ?? shortSlug(x.i.slug), 14))
      .join('·');
    todos.push({
      tone: 'warn',
      html: `갱신 기한 도래 ${due.length}건(${esc(names)}${due.length > 4 ? ' 외' : ''}) — 사실·날짜만 정정하세요`,
      href: '#updates',
      label: '갱신 필요 글',
    });
  }
  const nullWithInbound = rankRows
    .filter((r) => r.rank === null && r.inbound7d)
    .sort((a, b) => b.inbound7d - a.inbound7d);
  for (const r of nullWithInbound.slice(0, 1)) {
    const region = regionOf(r.query);
    const recentCut = addDays(TODAY, -14);
    const list = region ? (ciByRegion.get(region) ?? []) : [];
    const hit =
      list.find((e) => e.date === TODAY) ??
      list.find((e) => e.family !== 'A' && (e.date ?? '') >= recentCut);
    const tail = hit
      ? `대응 글 ${hit.date === TODAY ? '오늘' : esc(hit.date ?? '')} 발행됨(${esc(shortSlug(hit.slug))}, ${esc(hit.family)}) — 순위 재측정 결과 확인`
      : '대응 글 없음(최근 14일 이 지역 B·V 글 없음) — 지급 후 각도 후보를 검토하세요';
    todos.push({
      tone: hit ? 'none' : 'warn',
      html: `'${esc(r.query)}' 미노출(${r.wholeBlock ? '블록 만석' : '블록 밖'})인데 주 ${num(r.inbound7d)} 유입 → ${tail}`,
      href: '#ranks',
      label: '순위',
    });
  }
  if (ciRecent.length) {
    const label = ciRecent.map((e) => `${ciRegionOf(e).join('/')} ${e.family}`).join('·');
    const unmeasured = ciRecent.filter(
      (e) =>
        !measuredState(postBySlug.get(shortSlug(e.slug)) ?? { targetQuery: e.targetQuery })
          .measured,
    ).length;
    todos.push({
      tone: 'none',
      html: `어제·오늘 낸 글 ${ciRecent.length}건(${esc(label)}) 결과 확인 — ${unmeasured ? `${unmeasured}건 아직 측정 전, ` : ''}다음 순위 측정 ${esc(rankNextKst ?? '없음')}`,
      href: '#ranks',
      label: '순위',
    });
  }
  const q0 = q0400.ok ? q0400.data?.[TODAY] : null;
  if (q0 && typeof q0 === 'object') {
    todos.push({
      tone: 'none',
      html: `오늘 04시 자동 발행 지정 있음: ${esc(
        q0.mode === 'update'
          ? `갱신 ${shortSlug(basename(String(q0.target ?? ''), '.json'))}`
          : `신규 '${q0.keyword ?? '없음'}'`,
      )} — 결과 확인`,
      href: '#schedule',
      label: '일정',
    });
  }
  if (delayed.length) {
    todos.push({
      tone: 'crit',
      html: `자동화 지연 ${delayed.length}건(${delayed.map((a) => esc(a.file.replace(/\.ya?ml$/, ''))).join('·')}) — git pull 후 다시 뽑거나 Actions를 확인하세요`,
      href: '#more-auto',
      label: '자동화',
    });
  }
  if (parseFails.length) {
    todos.push({
      tone: 'crit',
      html: `순위 파싱 실패 ${parseFails.length}건(${parseFails
        .slice(0, 3)
        .map((r) => `'${esc(r.query)}'`)
        .join(', ')}) — 측정 스크립트를 확인하세요`,
      href: '#ranks',
      label: '순위',
    });
  }
}
const todoOrder = { crit: 0, warn: 1, good: 2, none: 3 };
todos.sort((a, b) => todoOrder[a.tone] - todoOrder[b.tone]);

// ───────────────────────── 섹션 렌더 ─────────────────────────
function todoSection() {
  const body = todos.length
    ? `<ol class="todo">${todos
        .slice(0, 6)
        .map(
          (t) =>
            `<li class="t-${t.tone}"><span>${t.html}</span> <a class="jump" href="${t.href}">${esc(t.label)} →</a></li>`,
        )
        .join('')}</ol>`
    : empty('오늘 할 일 없음 — 파이프라인·순위·잠금 장부에 신호가 없다');
  return card(
    'todo',
    '오늘 할 일',
    [
      srcItem('docs/ops/pipeline-queue.json', pq.ok ? kst(pqMeta.generatedAt) : pq.error),
      srcItem('src/data/naver-ranks.json', ranks.ok ? kst(ranks.data?.updatedAt) : ranks.error),
      srcItem('docs/ops/cluster-intents.json', ci.ok ? `수정 ${kst(ci.mtime)}` : ci.error),
      `<li>규칙으로만 파생(구 '오늘의 결론'): 후보 → 새 키워드 → 갱신 기한 → 미노출·유입 → 결과 확인 → 0400 → 자동화</li>`,
    ],
    body,
  );
}

function keywordSection() {
  if (!radar.ok)
    return card(
      'keywords',
      '새 키워드 — 신생·틈새',
      [srcItem('src/data/keyword-radar.json', radar.error)],
      empty(),
    );
  // 성격이 다른 둘을 나눠 보여준다(2026-09-11 운영자: "창원·문경은 글이 있는데 왜 새 키워드냐").
  // A = 우리 글이 없는 새 자리(신생·틈새). B = 글은 있는데 이 검색 표현으로는 약함(4위 아래·미노출) — 새 주제가 아니라 새 표현.
  const hasOurs = (k) => Boolean(k.ours?.has);
  const groupA = kwList.filter((k) => !hasOurs(k));
  const groupB = kwList.filter(hasOurs);
  const renderGroup = (title, note, items, limit) => {
    const shown = items.slice(0, limit);
    const rest = items.slice(limit);
    const list = shown.length
      ? `<div class="rows">${shown.map(kwRow).join('')}</div>`
      : empty('없음');
    const more = rest.length
      ? `<details class="more"><summary>나머지 ${rest.length}건 보기</summary><div class="rows">${rest.map(kwRow).join('')}</div></details>`
      : '';
    return `<h3 class="sub">${esc(title)} <span class="muted">(${items.length})</span></h3><p class="foot">${esc(note)}</p>${list}${more}`;
  };
  const summary = `<p class="lead">오늘 새로 관측 <b>${num(kwStats.today)}</b> · 신생 <b>${num(kwStats.born)}</b> · 실유입에서 발견 <b>${num(kwStats.fromAnalytics)}</b> <span class="muted">(전체 ${num(kwStats.total)} · 후보 ${num(kwStats.byVerdict.후보 ?? 0)} · 미판정 ${num(kwStats.byVerdict.미판정 ?? 0)} · 제외 ${num(kwStats.byVerdict.제외 ?? 0)})</span></p>`;
  const list =
    renderGroup(
      '① 우리 글이 없는 새 자리',
      '새로 생겼거나(신생) 질문·유입은 있는데 우리 글이 없는 검색어. 새 글감 후보.',
      groupA,
      6,
    ) +
    renderGroup(
      '② 글은 있는데 이 검색 표현으로는 약함',
      '새 주제가 아니라 새 표현이다. 예: "창원 민생지원금" 글은 있는데 사람들은 "창원 지원금"으로 검색하고 그 표현에서 우리는 4위 아래. 기존 글 제목은 못 바꾸니 다른 의도(패밀리)의 새 글이나 갱신으로 대응한다.',
      groupB,
      6,
    );
  const more = '';
  const foot =
    '<p class="foot">최종 발행 판정은 잠금 장부·검색 결과 실측을 거친 ③ "오늘 쓸 글감"에서.</p>';
  return card(
    'keywords',
    '새 키워드 — 신생·틈새',
    [
      srcItem(
        'src/data/keyword-radar.json',
        `${kst(radar.data?.updatedAt)} · 틈새 ${nicheList.length} · 후보 ${candList.length}`,
      ),
      srcItem(
        'docs/ops/pipeline-queue.json',
        pq.ok ? `판정·빈자리 ${kst(pqMeta.generatedAt)}` : pq.error,
      ),
      srcItem(
        'src/data/naver-ranks.json',
        ranks.ok ? `자사 순위 ${kst(ranks.data?.updatedAt)}` : ranks.error,
      ),
      '<li>후보 조건: 신생이거나 실유입에서 발견됐고 우리 순위가 없거나 4위 아래. 이미 1~3위인 틈새는 뺐다.</li>',
    ],
    summary + list + more + foot,
  );
}

function ideasSection() {
  if (!pq.ok)
    return card(
      'ideas',
      '오늘 쓸 글감',
      [srcItem('docs/ops/pipeline-queue.json', pq.error)],
      empty(),
    );
  const proposed = pqNew.filter((i) => i.status === 'proposed');
  const t1 = proposed
    .filter((i) => i.track === 'T1')
    .sort((a, b) => {
      const da = a.start ? Math.abs(dayDiff(TODAY, a.start)) : 9999;
      const db = b.start ? Math.abs(dayDiff(TODAY, b.start)) : 9999;
      if (da !== db) return da - db;
      return (b.score ?? 0) - (a.score ?? 0);
    });
  const rest = proposed
    .filter((i) => i.track !== 'T1')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const shown = [...t1, ...rest].slice(0, 8);
  const rows = shown.map((i) => {
    const s = i.serp ? slotOf(i.serp.query ?? i.query) : { measured: false };
    const pubToday = isPublishedToday(i);
    const trackKo = i.track === 'T1' ? '지역' : i.track === 'T2' ? '롱테일' : '선점';
    const variantNote =
      i.serp?.query && i.serp.query !== i.query
        ? `<div class="row-why muted">실측 쿼리: ${esc(i.serp.query)}</div>`
        : '';
    const ev = Array.isArray(i.evidence) && i.evidence[0] ? cut(humanize(i.evidence[0]), 90) : '';
    const when = i.start ? `${esc(i.start.slice(5))} ${esc(dday(TODAY, i.start))}` : '';
    const cond = i.condition
      ? `<div class="row-cond" title="${esc(humanize(i.condition))}"><i>조건</i> ${esc(cut(humanize(i.condition), 140))}</div>`
      : '';
    return `<div class="row"><div class="row-top"><span class="tag">${esc(trackKo)}${i.family ? ` ${esc(i.family)}` : ''}</span> <b class="term">${esc(i.query)}</b> ${naverLink(i.serp?.query ?? i.query)}${when ? ` <span class="muted">개시 ${when}</span>` : ''}<span class="grow"></span>${pubToday ? badge('good', '오늘 발행됨') : badge('warn', statusKo(i.status))}</div>${variantNote}${ev ? `<div class="row-why">${esc(ev)}</div>` : ''}<div class="row-kv">${kv('예상 유입', esc(i.expectedInbound ?? '없음'))}${kv('빈자리', slotHtml(s))}${(i.region ?? i.cluster) ? kv('묶음', esc(i.region ?? i.cluster)) : ''}</div>${cond}</div>`;
  });
  const exBody = pqExcluded.length
    ? `<ul class="plain">${pqExcluded
        .map(
          (x) =>
            `<li><b>${esc(x.query)}</b>${x.track ? ` <span class="muted">${esc(x.track)}</span>` : ''} · ${esc(cut(humanize(x.reason), 80))}</li>`,
        )
        .join('')}</ul>`
    : empty('제외 항목 없음');
  const serp = pqMeta.serp ?? {};
  return card(
    'ideas',
    '오늘 쓸 글감',
    [
      srcItem(
        'docs/ops/pipeline-queue.json',
        `${kst(pqMeta.generatedAt)} · 기준일 ${pqMeta.today ?? '없음'}`,
      ),
      `<li>실측 예산 ${num(serp.used)}/${num(serp.budget?.total)}${serp.error ? ` · 오류 ${esc(serp.error)}` : ''}${pqMeta.dryRun ? ' · 시험 실행' : ''}</li>`,
      '<li>지역 글은 개시일 임박순, 롱테일은 점수순. 발행은 운영자 지시 후 수동.</li>',
    ],
    `${rows.length ? `<div class="rows">${rows.join('')}</div>` : empty('지시 대기 후보 없음')}${proposed.length > shown.length ? `<p class="muted">후보 ${proposed.length}건 중 ${shown.length}건 표시</p>` : ''}<details class="more"><summary>제외·보류 ${pqExcluded.length}건</summary>${exBody}</details>`,
  );
}

function ranksSection() {
  if (!ranks.ok)
    return card('ranks', '순위', [srcItem('src/data/naver-ranks.json', ranks.error)], empty());
  const tiles = `<div class="tiles"><div class="tile"><span class="tile-v good">${num(rankBuckets.top)}</span><span class="tile-l">1~3위</span></div><div class="tile"><span class="tile-v warn">${num(rankBuckets.mid)}</span><span class="tile-l">4~10위</span></div><div class="tile"><span class="tile-v none">${num(rankBuckets.none)}</span><span class="tile-l">미노출</span></div></div>${rankBuckets.low ? `<p class="muted">11위 아래 ${num(rankBuckets.low)}건은 미노출에 넣지 않았다.</p>` : ''}`;
  const changed = rankRows
    .filter((r) => r.prevRank !== undefined && r.curHist !== undefined && r.prevRank !== r.curHist)
    .sort((a, b) => (b.inbound7d ?? 0) - (a.inbound7d ?? 0))
    .slice(0, 6);
  const arrow = (r) => {
    const up = r.curHist !== null && (r.prevRank === null || r.curHist < r.prevRank);
    return `<span class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'}</span>`;
  };
  const changes = changed.length
    ? `<h3>변동 <span class="muted">전회 대비 · 마지막 측정 ${esc(kstShort(ranks.data?.updatedAt))}</span></h3><ul class="plain">${changed
        .map(
          (r) =>
            `<li>${arrow(r)} <b>${esc(r.query)}</b> · ${esc(rankText(r.prevRank))} → ${esc(rankText(r.curHist, r.wholeBlock))}${r.inbound7d !== null ? ` · 실유입 ${num(r.inbound7d)}/주` : ''}</li>`,
        )
        .join('')}</ul>`
    : '<h3>변동</h3><p class="muted">전회 대비 바뀐 순위 없음</p>';
  const core = targetList
    .filter((t) => t.inbound7d !== null && t.inbound7d !== undefined)
    .sort((a, b) => b.inbound7d - a.inbound7d)
    .slice(0, 8);
  const coreHtml = core.length
    ? `<h3>수익 클러스터 핵심 <span class="muted">실유입 있는 타깃</span></h3><div class="tw"><table class="mini"><thead><tr><th>쿼리</th><th>순위</th><th>실유입/주</th></tr></thead><tbody>${core
        .map((t) => {
          const e = byQuery[t.query];
          const rk = e?.latest
            ? rankBadge(e.latest.rank ?? null, e.latest.aboveIsWholeBlock === true)
            : badge('none', '미측정');
          return `<tr><td>${esc(t.query)}${t.url ? ` ${extLink(`${SITE}${t.url}`, '글')}` : ''}</td><td>${rk}</td><td class="num">${num(t.inbound7d)}</td></tr>`;
        })
        .join('')}</tbody></table></div>`
    : '';
  const fullRows = rankRows.map((r) => {
    const above =
      r.gov !== undefined || r.press !== undefined
        ? `본청 ${num(r.gov)}·언론 ${num(r.press)}`
        : `기관 ${num(r.kinds.institutional ?? 0)}·언론 ${num(r.kinds.press ?? 0)}`;
    const verdict =
      r.verdictT1 !== undefined
        ? badge(r.verdictT1 === 'open' ? 'good' : 'warn', r.verdictT1 === 'open' ? '열림' : '닫힘')
        : '<span class="muted">—</span>';
    const delta =
      r.prevRank === undefined || r.curHist === undefined
        ? '<span class="muted">신규</span>'
        : r.prevRank === r.curHist
          ? '<span class="muted">＝</span>'
          : `${arrow(r)} 이전 ${esc(rankText(r.prevRank))}`;
    return `<tr><td class="qcol">${esc(r.query)}${r.url ? ` ${extLink(r.url, '글')}` : ''}${r.parseOk === false ? ` ${badge('crit', '파싱 실패')}` : ''}</td><td class="nw">${rankBadge(r.rank, r.wholeBlock)}</td><td class="nw">${delta}</td><td class="num">${r.openSlots !== undefined ? num(r.openSlots) : '<span class="muted">—</span>'}</td><td class="nw">${verdict}</td><td class="nw">${above}</td><td class="num">${r.inbound7d !== null ? num(r.inbound7d) : '<span class="muted">—</span>'}</td><td class="nw">${esc(r.date ?? '없음')}</td></tr>`;
  });
  const full = `<details class="more"><summary>전체 ${rankRows.length}건 보기</summary><p><input id="rank-filter" type="search" placeholder="쿼리 필터" class="filter"></p><div class="tw"><table id="rank-table"><thead><tr><th>쿼리</th><th>순위</th><th>변동</th><th>빈자리</th><th>지역 자리</th><th>위에</th><th>실유입/주</th><th>측정일</th></tr></thead><tbody>${fullRows.join('')}</tbody></table></div></details>`;
  return card(
    'ranks',
    '순위',
    [
      srcItem(
        'src/data/naver-ranks.json',
        `${kst(ranks.data?.updatedAt)} · ${rankQueries.length}쿼리`,
      ),
      srcItem(
        'docs/ops/rank-targets.json',
        targets.ok ? `수정 ${kst(targets.mtime)}` : targets.error,
      ),
      `<li>자동 측정 ${esc(rankCron ? cronToKst(rankCron).text : '없음')} · 다음 ${esc(rankNextKst ?? '없음')}</li>`,
      '<li>변동은 마지막 두 회차 비교. 실유입/주는 쿼리 문자열이 완전히 같을 때만 붙는다.</li>',
    ],
    tiles + changes + coreHtml + full,
  );
}

function trafficSection() {
  if (!analytics?.ok) return card('traffic', '트래픽', [], empty('애널리틱스 전사본 없음'));
  const a = analytics.data;
  const sum = a.summary ?? {};
  const per = a.period ?? {};
  const big = `<div class="bignum"><span class="bn">${num(sum.searchInbound)}</span><span class="bn-l">7일 검색 유입 <span class="muted">${esc(per.from ?? '?')} ~ ${esc(per.to ?? '?')}</span></span></div>`;
  let share = '';
  if (vs.ok && vs.data?.shares) {
    const sh = vs.data.shares;
    const other = (sh.head?.pct ?? 0) + (sh.other?.pct ?? 0);
    const segs = [
      ['민생×지역', sh.minsaengRegional?.pct, 's1'],
      ['롤업', sh.rollup?.pct, 's2'],
      ['전국 제도', sh.national?.pct, 's3'],
      ['기타', sh.head || sh.other ? other : null, 's4'],
    ].filter(([, v]) => typeof v === 'number');
    share = segs.length
      ? `<div class="stack">${segs.map(([l, v, c]) => `<div class="seg ${c}" style="width:${v.toFixed(1)}%" title="${esc(l)} ${pct(v)}"></div>`).join('')}</div><div class="legend">${segs.map(([l, v, c]) => `<span><i class="sw ${c}"></i>${esc(l)} <b>${pct(v)}</b></span>`).join('')}</div>`
      : '';
  }
  const kws = Array.isArray(a.keywords)
    ? a.keywords.filter((k) => k.query !== '(검색어 없음)')
    : [];
  const top = kws.slice(0, 5);
  const topHtml = top.length
    ? `<h3>상위 유입 검색어</h3><div class="tw"><table class="mini"><thead><tr><th>검색어</th><th>유입</th><th>우리 순위</th></tr></thead><tbody>${top
        .map((k) => {
          const e = byQuery[k.query];
          const rk = e?.latest
            ? rankBadge(e.latest.rank ?? null, e.latest.aboveIsWholeBlock === true)
            : badge('none', '미측정');
          return `<tr><td>${esc(k.query)}</td><td class="num">${num(k.visits)}</td><td>${rk}</td></tr>`;
        })
        .join('')}</tbody></table></div>`
    : '';
  return card(
    'traffic',
    '트래픽',
    [
      srcItem(analytics.path, `${per.from ?? '?'}~${per.to ?? '?'} · 수정 ${kst(analytics.mtime)}`),
      srcItem('docs/ops/volume-scale.json', vs.ok ? kst(vs.data?.meta?.generatedAt) : vs.error),
      '<li>점유 바의 기타 = 헤드 + 기타. 분모는 상위 행 유입(검색어 없음 제외).</li>',
    ],
    `${big}${share}${topHtml}<p class="foot">상위 160 검색어 기준(전체의 약 34%), 주 1회 전사본. 미측정 = 순위 추적 대상이 아니라는 뜻이지 순위가 없다는 뜻이 아니다.</p>`,
  );
}

function updatesSection() {
  if (!pq.ok)
    return card(
      'updates',
      '갱신 필요 글',
      [srcItem('docs/ops/pipeline-queue.json', pq.error)],
      empty(),
    );
  const list = pqUpd
    .map((i) => ({ i, d: i.dueDate ? dayDiff(TODAY, i.dueDate) : (i.daysLeft ?? null) }))
    .sort((a, b) => (a.d ?? 9999) - (b.d ?? 9999));
  const row = (x) => {
    const { i, d } = x;
    const when =
      d === null
        ? badge('none', '기한 없음')
        : d <= 0
          ? badge('warn', d === 0 ? '오늘' : `D+${-d}`)
          : badge('good', `D-${d}`);
    const what = Array.isArray(i.evidence) && i.evidence[0] ? cut(humanize(i.evidence[0]), 90) : '';
    const title = i.slug
      ? extLink(postUrl(i.slug), i.query ?? shortSlug(i.slug))
      : esc(i.query ?? '');
    return `<li>${when} <b>${title}</b>${i.region ? ` <span class="muted">${esc(i.region)}</span>` : ''}${what ? `<div class="row-why">${esc(what)}</div>` : ''}</li>`;
  };
  const shown = list.slice(0, 5);
  const rest = list.slice(5);
  return card(
    'updates',
    '갱신 필요 글',
    [
      srcItem(
        'docs/ops/pipeline-queue.json',
        `갱신 트랙 ${pqUpd.length}건 · ${kst(pqMeta.generatedAt)}`,
      ),
      '<li>D-day는 이 화면 생성 시각 기준으로 다시 계산했다.</li>',
    ],
    `${shown.length ? `<ul class="plain upd">${shown.map(row).join('')}</ul>` : empty('갱신 후보 없음')}${rest.length ? `<details class="more"><summary>나머지 ${rest.length}건</summary><ul class="plain upd">${rest.map(row).join('')}</ul></details>` : ''}<p class="foot">사실·날짜·갱신 기록만, 제목·구조는 그대로.</p>`,
  );
}

function scheduleSection() {
  const events = [];
  const year = TODAY.slice(0, 4);
  for (const w of pqWatch) {
    if (w.kind === 'wave') {
      const m = String(w.text ?? '').match(/개시 (\d{2})\/(\d{2})/);
      const date = m ? `${year}-${m[1]}-${m[2]}` : null;
      const what = String(w.text ?? '')
        .replace(/^.*? — /, '')
        .replace(/개시 \d{2}\/\d{2} D[-+]?\d* · /, '')
        .replace(/개시일 미정 · /, '');
      events.push({
        region: w.region ?? regionOf(w.text),
        what: `물결 · ${what}`,
        date,
        undated: !date,
      });
    } else if (w.kind === 'milestone') {
      const m = String(w.text ?? '').match(/(\d{4}-\d{2}-\d{2})/);
      const what = String(w.text ?? '').split(' — ')[0];
      events.push({
        region: w.region ?? regionOf(w.text),
        what: `갱신 · ${what}`,
        date: m ? m[1] : null,
        undated: !m,
      });
    }
  }
  for (const i of pqNew) {
    if (!i.start || i.start < TODAY) continue;
    if (events.some((e) => e.region === i.region && e.date === i.start)) continue;
    events.push({ region: i.region, what: `개시 · ${i.query}`, date: i.start, undated: false });
  }
  events.sort((a, b) => {
    if (a.undated !== b.undated) return a.undated ? 1 : -1;
    return (a.date ?? '').localeCompare(b.date ?? '');
  });
  const evRow = (e) => {
    const ours =
      e.region && ciByRegion.has(e.region)
        ? `있음 (${esc(famsOf(ciByRegion.get(e.region)))})`
        : '<span class="none">없음</span>';
    const dd = e.date ? dday(TODAY, e.date) : '미정';
    const tone = !e.date ? 'none' : dayDiff(TODAY, e.date) <= 3 ? 'warn' : 'good';
    return `<li>${badge(tone, dd)} <b>${esc(e.region ?? '—')}</b> · ${esc(humanize(e.what))} <span class="muted">· 우리 글 ${ours}</span></li>`;
  };
  const shown = events.slice(0, 6);
  const rest = events.slice(6);
  const evHtml = shown.length
    ? `<ul class="plain">${shown.map(evRow).join('')}</ul>${rest.length ? `<details class="more"><summary>나머지 ${rest.length}건</summary><ul class="plain">${rest.map(evRow).join('')}</ul></details>` : ''}`
    : empty('물결 감시 항목 없음');
  // 0400 다음 지정
  let q0400Html = '';
  if (q0400.ok) {
    const keys = Object.keys(q0400.data ?? {})
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k > TODAY)
      .sort();
    const k = keys[0];
    if (k) {
      const v = q0400.data[k] && typeof q0400.data[k] === 'object' ? q0400.data[k] : {};
      const what =
        v.mode === 'update'
          ? `갱신 · ${v.target ? localLink(v.target, shortSlug(basename(v.target, '.json'))) : '대상 없음'}`
          : `신규 · ${esc(v.keyword ?? '없음')}`;
      q0400Html = `<li>${badge('good', dday(TODAY, k))} <b>04시 자동 발행</b> · ${esc(k)} ${what}${keys.length > 1 ? ` <span class="muted">(이후 ${keys.length - 1}건 더)</span>` : ''}</li>`;
    } else {
      q0400Html = '<li><b>04시 자동 발행</b> · 다음 지정 없음 → 평소 선정</li>';
    }
  }
  // 선점 캘린더
  let lgHtml = '';
  if (landgrab.ok && Array.isArray(landgrab.data?.items)) {
    const up = landgrab.data.items
      .filter((i) => typeof i.writeBy === 'string' && i.writeBy >= TODAY)
      .sort((a, b) => a.writeBy.localeCompare(b.writeBy))
      .slice(0, 2);
    lgHtml = up
      .map(
        (i) =>
          `<li>${badge('good', dday(TODAY, i.writeBy))} <b>선점</b> · ${esc(i.topic)} <span class="muted">작성 기한 ${esc(i.writeBy)} · ${esc(statusKo(i.status))}</span></li>`,
      )
      .join('');
  }
  const other =
    q0400Html || lgHtml
      ? `<h3>자동 발행 · 선점</h3><ul class="plain">${q0400Html}${lgHtml}</ul>`
      : '';
  return card(
    'schedule',
    '다가오는 일정',
    [
      srcItem(
        'docs/ops/pipeline-queue.json',
        `감시 ${pqWatch.length}줄 · ${kst(pqMeta.generatedAt)}`,
      ),
      srcItem('docs/ops/0400-queue.json', q0400.ok ? `수정 ${kst(q0400.mtime)}` : q0400.error),
      srcItem(
        'docs/ops/landgrab-calendar.json',
        landgrab.ok ? `갱신 ${landgrab.data?.updated ?? '없음'}` : landgrab.error,
      ),
      '<li>물결 날짜는 감시 문장의 "개시 MM/DD"·"YYYY-MM-DD"에서 읽고 D-day는 오늘 기준으로 다시 계산.</li>',
    ],
    `<h3>물결 · 갱신 시점</h3>${evHtml}${other}`,
  );
}

function moreSection() {
  // 자동화
  const autoRows = automation.length
    ? `<div class="tw"><table class="mini"><thead><tr><th>워크플로</th><th>예정(KST)</th><th>마지막 산출</th><th>상태</th></tr></thead><tbody>${automation
        .map(
          (a) =>
            `<tr><td>${esc(a.file.replace(/\.ya?ml$/, ''))}</td><td>${esc(a.schedule)}${a.next ? ` <span class="muted">다음 ${esc(a.next)}</span>` : ''}</td><td>${a.outputName ? `${esc(a.outputName)} ${a.lastMs ? esc(kstShort(a.lastMs)) : '없음'}` : '<span class="muted">—</span>'}</td><td>${badge(a.state === 'good' ? 'good' : a.state === 'crit' ? 'crit' : 'none', a.stateText)}</td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : empty('워크플로 cron 없음');
  const noCron = crons.filter((c) => !c.crons.length).map((c) => c.file.replace(/\.ya?ml$/, ''));
  const noCronHtml = noCron.length
    ? `<p class="muted">시간표 없이 이벤트·수동으로 도는 것: ${noCron.map((f) => esc(f)).join(' · ')} (04시 자동 발행 포함 — 스케줄이 다른 곳에 있거나 수동)</p>`
    : '';
  const unregHtml = unregisteredTargets.length
    ? `<p class="muted">순위 추적 대상인데 아직 측정 기록이 없는 쿼리 ${unregisteredTargets.length}건: ${unregisteredTargets.map((t) => esc(t.query)).join(' · ')}</p>`
    : '';
  // API
  const au = radar.ok ? (radar.data?.apiUsage ?? {}) : {};
  const g = au.groups ?? {};
  const apiHtml =
    g.search || g.datalab
      ? `<ul class="plain">${g.search ? `<li>검색 API · 일 ${num(g.search.perDay)} / ${num(g.search.dailyQuota)} (${pct(g.search.dailyPct)}) · 월 ${num(g.search.perMonth)} / ${num(g.search.monthlyQuota)} (${pct(g.search.monthlyPct)})</li>` : ''}${g.datalab ? `<li>데이터랩 · 월 ${num(g.datalab.perMonth)} / ${num(g.datalab.monthlyQuota)} (${pct(g.datalab.monthlyPct)})</li>` : ''}</ul><p class="muted">스케줄대로 돌 때의 산출값(하루 ${num(au.runsPerDay)}회 · 회차당 ${num(au.thisRun)}회). 실누적은 Ncloud 콘솔.</p>`
      : empty('사용량 기록 없음');
  // 잠금 장부
  const m = ci.ok ? (ci.data?.meta ?? {}) : {};
  const lockHtml = ci.ok
    ? `<ul class="plain"><li>지역 ${num(m.regionCount)} · 글 ${num(m.entryCount)} · A ${num(m.families?.A)} / B ${num(m.families?.B)} / V ${num(m.families?.V)} · 민생 잠금 ${num(m.clusters?.minsaeng)} · 롤업 ${num(m.rollups)}</li><li>오늘 편입 ${ciToday.length}건${ciToday.length ? `: ${ciToday.map((e) => `${esc(ciRegionOf(e).join('/'))} ${esc(e.family)} ${extLink(postUrl(e.slug), shortSlug(e.slug))}`).join(' · ')}` : ''}</li></ul><p class="muted">거부 규칙: 같은 지자체×같은 패밀리, 또는 A 있는 지역에 V 추가. 판정은 build-cluster-intents.mjs --check가 한다.</p>`
    : empty(ci.error ?? '데이터 없음');
  const howto = `<ul class="plain"><li>데이터랩 값은 상대값(기준 키워드=100)이지 검색량이 아니다. 발행 근거는 SERP 실측이 우선.</li><li>미노출 ≠ 유입 0. 블록 만석은 자사 글이 웹문서 블록 밖으로 밀린 상태이고, 순위가 있어도 유입이 0일 수 있다.</li><li>트래픽의 상위 160 검색어는 전체 검색 유입의 약 34%다. 점유율은 전체가 아니라 상위 행 기준.</li><li>D-day와 "오늘"은 이 화면을 생성한 시각에 고정된다. 하루 지났으면 다시 뽑는다.</li><li>모든 값은 로컬 파일 기준. 봇이 커밋한 최신 파일은 git pull 뒤에 보인다.</li></ul>`;
  const details = (id, title, body) =>
    `<details class="more" id="${id}"><summary>${esc(title)}</summary>${body}</details>`;
  return `<section class="card thin" id="more"><h2>자세히</h2>${details('more-auto', `자동화 상태${delayed.length ? ` — 지연 ${delayed.length}` : ''}`, autoRows + noCronHtml + unregHtml)}${details('more-api', 'API 사용량', apiHtml)}${details('more-lock', '잠금 장부 요약', lockHtml)}${details('more-howto', '읽는 법', howto)}</section>`;
}

// ───────────────────────── 조립 ─────────────────────────
const sections = [
  todoSection(),
  keywordSection(),
  ideasSection(),
  ranksSection(),
  trafficSection(),
  updatesSection(),
  scheduleSection(),
  moreSection(),
];

const CSS = `
:root{color-scheme:light;--bg:#f6f6f3;--card:#ffffff;--line:#e5e4df;--text:#16160f;--text2:#5a5955;--muted:#8b8a85;--link:#1d5db3;
--good:#1f7a3a;--good-bg:#e4f3e8;--warn:#9a6b12;--warn-bg:#fbf0d5;--none:#6a6965;--none-bg:#ededea;--crit:#b3261e;--crit-bg:#fae5e3;
--s1:#2f6fd0;--s2:#e07a3f;--s3:#2aa876;--s4:#a3a29d}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#121211;--card:#1b1b1a;--line:#2f2e2b;--text:#f1f0ea;--text2:#bcbbb2;--muted:#8a8982;--link:#8fb8ee;
--good:#6fcf8a;--good-bg:#173a22;--warn:#e6b85e;--warn-bg:#3b2f13;--none:#a6a59e;--none-bg:#2a2a28;--crit:#f08f84;--crit-bg:#41211d;--s4:#6d6c67}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#121211;--card:#1b1b1a;--line:#2f2e2b;--text:#f1f0ea;--text2:#bcbbb2;--muted:#8a8982;--link:#8fb8ee;
--good:#6fcf8a;--good-bg:#173a22;--warn:#e6b85e;--warn-bg:#3b2f13;--none:#a6a59e;--none-bg:#2a2a28;--crit:#f08f84;--crit-bg:#41211d;--s4:#6d6c67}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;word-break:keep-all;overflow-wrap:anywhere}
a{color:var(--link)}a.local{color:var(--text2);text-decoration-style:dotted}a.nv{font-size:12px;color:var(--muted);text-decoration:none;border:1px solid var(--line);border-radius:4px;padding:0 5px;vertical-align:middle}a.nv:hover{color:var(--link);border-color:var(--link)}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line)}
.bar{max-width:860px;margin:0 auto;padding:10px 20px;display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;font-size:12.5px;color:var(--text2)}
.bar b{font-size:15px;color:var(--text)}
main{max-width:860px;margin:0 auto;padding:12px 20px 40px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 22px;margin:16px 0}
.card.thin{padding:14px 22px}
.card-h{display:flex;align-items:baseline;gap:12px;margin-bottom:10px}
h2{font-size:18px;margin:0;font-weight:700}h3{font-size:14px;margin:18px 0 8px;color:var(--text2);font-weight:600}h3.sub{font-size:14px;margin:14px 0 4px;color:var(--text)}h3.sub+.foot{margin:0 0 8px}h3 .muted{font-weight:400}
.src{font-size:12px;color:var(--muted);margin-left:auto}.src summary{cursor:pointer;list-style:none;padding:0 6px;border:1px solid var(--line);border-radius:4px}.src summary::-webkit-details-marker{display:none}
.src ul{margin:6px 0 0;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);box-shadow:0 4px 16px rgba(0,0,0,.12);list-style:none;font-size:12px;position:absolute;right:0;width:max-content;min-width:240px;max-width:min(440px,80vw);z-index:3;overflow-wrap:normal;word-break:keep-all;text-align:left}.src{position:relative}.src li{margin:2px 0}.src li span{color:var(--muted);margin-left:6px}
.sub,.lead{margin:0 0 10px;color:var(--text2);font-size:13.5px}.lead b{color:var(--text)}
.muted{color:var(--muted)}.none{color:var(--none)}.empty{color:var(--muted);font-style:italic;margin:6px 0}
.foot{font-size:12.5px;color:var(--muted);margin:12px 0 0}
.b{display:inline-block;padding:0 9px;border-radius:999px;font-size:12px;font-weight:600;line-height:1.7;white-space:nowrap;vertical-align:middle}
.b-good{color:var(--good);background:var(--good-bg)}.b-warn{color:var(--warn);background:var(--warn-bg)}.b-none{color:var(--none);background:var(--none-bg)}.b-crit{color:var(--crit);background:var(--crit-bg)}
.todo{margin:0;padding-left:22px}.todo li{margin:8px 0;padding-left:4px}.todo li::marker{color:var(--muted)}
.todo .jump{font-size:12.5px;white-space:nowrap;margin-left:6px;text-decoration:none}.todo .jump:hover{text-decoration:underline}
.todo li.t-crit>span{color:var(--crit)}.todo li.t-warn>span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--warn);margin-right:8px;vertical-align:1px}.todo li.t-good>span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--good);margin-right:8px;vertical-align:1px}.todo li.t-none>span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--none);margin-right:8px;vertical-align:1px}.todo li.t-crit>span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--crit);margin-right:8px;vertical-align:1px}
.rows{display:flex;flex-direction:column;gap:10px}
.row{border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.row-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.row-top .term{font-size:15px}.grow{flex:1}
.row-why{font-size:13px;color:var(--text2);margin-top:3px}
.row-kv{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:13px;margin-top:6px}.kv i{font-style:normal;color:var(--muted);margin-right:6px;font-size:12px}
.row-cond{font-size:12.5px;color:var(--text2);margin-top:6px;padding-top:6px;border-top:1px dashed var(--line)}.row-cond i{font-style:normal;color:var(--muted);margin-right:6px;font-size:12px}
.tag{font-size:11.5px;padding:0 6px;border:1px solid var(--line);border-radius:4px;color:var(--text2);white-space:nowrap}
.tiles{display:flex;gap:12px;flex-wrap:wrap}.tile{flex:1;min-width:120px;border:1px solid var(--line);border-radius:10px;padding:10px 14px;display:flex;flex-direction:column}.tile-v{font-size:26px;font-weight:700;line-height:1.2}.tile-l{font-size:12.5px;color:var(--text2)}
.tile-v.good{color:var(--good)}.tile-v.warn{color:var(--warn)}.tile-v.none{color:var(--none)}
.up{color:var(--good);font-weight:700}.down{color:var(--crit);font-weight:700}
.plain{margin:4px 0;padding-left:0;list-style:none}.plain li{margin:6px 0}.plain.upd li{padding:6px 0;border-bottom:1px solid var(--line)}.plain.upd li:last-child{border-bottom:none}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--text2);white-space:nowrap;font-size:12px}td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}td.qcol{min-width:16em}td.nw{white-space:nowrap}
table.mini td,table.mini th{padding:5px 8px}
.bignum{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:4px 0 12px}.bn{font-size:34px;font-weight:700;line-height:1.1}.bn-l{font-size:13.5px;color:var(--text2)}
.stack{display:flex;height:16px;gap:2px;border-radius:6px;overflow:hidden}.seg{height:100%;min-width:2px}.s1{background:var(--s1)}.s2{background:var(--s2)}.s3{background:var(--s3)}.s4{background:var(--s4)}
.legend{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12.5px;margin-top:6px;color:var(--text2)}.legend b{color:var(--text)}.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
details.more{margin-top:12px}details.more>summary{cursor:pointer;font-size:13px;color:var(--text2);padding:6px 0}details.more[open]>summary{margin-bottom:6px}
.filter{width:100%;max-width:320px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--text);font:inherit;font-size:13px}
footer{font-size:12px;color:var(--muted);margin:16px 0;text-align:center}
@media (max-width:600px){main{padding:8px 12px 30px}.card{padding:14px 14px}.bar{padding:8px 12px}.tile-v{font-size:22px}.bn{font-size:28px}.src ul{max-width:80vw}}
@media print{header{position:static}.card{break-inside:avoid;border:none;padding:0 0 12px}.tw{overflow:visible}a{color:inherit;text-decoration:none}a.nv{display:none}.src{display:none}}
`;

const JS = `
document.addEventListener('DOMContentLoaded',function(){
  var f=document.getElementById('rank-filter');var t=document.getElementById('rank-table');
  if(f&&t){f.addEventListener('input',function(){var v=f.value.trim().toLowerCase();t.querySelectorAll('tbody tr').forEach(function(tr){tr.hidden=!!v&&tr.textContent.toLowerCase().indexOf(v)<0;});});}
  document.addEventListener('click',function(e){document.querySelectorAll('details.src[open]').forEach(function(d){if(!d.contains(e.target))d.removeAttribute('open');});});
});
`;

const genKst = kst(NOW);
const freshness = oldestCore
  ? `데이터 최신: ${esc(oldestCore[0])} ${esc(agoText(oldestCore[1]))}${oldestAgeH > 24 ? ` ${badge('warn', 'git pull 후 다시 뽑기')}` : ''}`
  : '데이터 최신: 핵심 파일 없음';
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>awoo 운영 ${esc(TODAY)}</title>
<style>${CSS}</style>
</head>
<body>
<header><div class="bar"><b>awoo 운영</b><span>기준일 ${esc(TODAY)} (KST)</span><span>생성 ${esc(genKst)}</span><span>${freshness}</span><span>${extLink(SITE, 'awoo.or.kr')}</span></div></header>
<main>
${sections.join('\n')}
</main>
<footer>scripts/ops-dashboard.mjs · 생성 ${esc(genKst)} KST · 로컬 전용 생성물(커밋하지 않음) · 비밀 파일은 읽지 않았다</footer>
<script>${JS}</script>
</body>
</html>
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html, 'utf8');
const bytes = Buffer.byteLength(html, 'utf8');
console.log(
  `${rel(OUT)} 생성 — ${(bytes / 1024).toFixed(1)} KB · 섹션 ${sections.length} · 할 일 ${todos.length}줄 · 새 키워드 ${kwList.length}건 · 기준일 ${TODAY} · 생성 ${genKst} KST`,
);
if (bytes > 1.5 * 1024 * 1024) {
  console.error('경고: 1.5MB 초과');
  process.exitCode = 1;
}
