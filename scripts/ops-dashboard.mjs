#!/usr/bin/env node
/**
 * ops-dashboard — 운영자 로컬 전용 대시보드 생성기.
 *
 * 목적은 하나다. 포스팅이 네이버 최상단에 올라 트래픽을 모으고 애드센스 수익을 최대화한다.
 * 이 스크립트는 리포 안의 운영 데이터를 읽어 `docs/ops/dashboard.html` 한 파일로 요약한다.
 * 공개 사이트와 무관하며(생성물은 .gitignore), 외부 리소스 0 · 인라인 CSS/JS만 · file:// 로 열린다.
 *
 * 사용:
 *   node scripts/ops-dashboard.mjs                # docs/ops/dashboard.html 생성
 *   node scripts/ops-dashboard.mjs --today=2026-09-10   # 날짜 고정(재현용)
 *   npm run ops:dashboard
 *
 * 입력(전부 읽기만 · 비밀 파일은 절대 읽지 않는다):
 *   docs/ops/pipeline-queue.json · docs/ops/DAILY-KEYWORDS.md · src/data/naver-ranks.json
 *   docs/ops/rank-targets.json · docs/ops/volume-scale.json · src/data/analytics/naver-analytics-search-*.json
 *   docs/ops/cluster-intents.json · src/data/keyword-radar.json(조각만) · docs/ops/0400-queue.json
 *   docs/ops/landgrab-calendar.json · docs/ops/big-keywords.json · src/data/issues/**（제목·메타만）
 *   src/data/today-issue.json · docs/ops/NAVER-API-QUOTA.md(한도 숫자만) · .github/workflows/*.yml(cron 줄만)
 *
 * 원칙: 없는 파일·빈 필드에 죽지 않는다(섹션마다 '데이터 없음'). 파일에 없는 숫자는 만들지 않는다.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
function readText(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return { ok: false, path: relPath, text: '', mtime: null };
  return { ok: true, path: relPath, text: readFileSync(abs, 'utf8'), mtime: mtimeOf(abs) };
}
function fileHref(relPath) {
  return pathToFileURL(join(ROOT, relPath)).href;
}
function postUrl(slug) {
  if (!slug) return null;
  return `${SITE}/issues/${slug.replace(/-\d{4}-\d{2}-\d{2}$/, '')}/`;
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
function td(v, cls = '') {
  return `<td${cls ? ` class="${cls}"` : ''}>${v}</td>`;
}
function table(headers, rows, opts = {}) {
  if (!rows.length) return `<p class="empty">${esc(opts.empty ?? '데이터 없음')}</p>`;
  const th = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.join('')}</tr>`).join('\n');
  return `<div class="tw"><table><thead><tr>${th}</tr></thead><tbody>\n${body}\n</tbody></table></div>`;
}
function extLink(href, label) {
  return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}
function localLink(relPath, label) {
  return `<a href="${esc(fileHref(relPath))}" class="local">${esc(label ?? relPath)}</a>`;
}
function section(id, title, meta, body, pitfalls = []) {
  const metaHtml = meta.length
    ? `<div class="src">${meta.map((m) => `<span>${m}</span>`).join('')}</div>`
    : '';
  const pit = pitfalls.length
    ? `<ul class="pitfalls">${pitfalls.map((p) => `<li>${p}</li>`).join('')}</ul>`
    : '';
  return `<section id="${id}"><h2>${esc(title)}</h2>${metaHtml}${body}${pit}</section>`;
}
function srcTag(relPath, when) {
  return `${localLink(relPath)} <b>${esc(when ?? '없음')}</b>`;
}
function rankBadge(rank, wholeBlock) {
  if (rank === null || rank === undefined) {
    return `<span class="rk rk-null" title="자사 미노출">미노출${wholeBlock ? ' · 블록 만석' : ''}</span>`;
  }
  const cls = rank <= 3 ? 'rk-top' : rank <= 10 ? 'rk-mid' : 'rk-low';
  return `<span class="rk ${cls}">${rank}위</span>`;
}
function delta(cur, prev) {
  if (cur === undefined || prev === undefined) return '<span class="dl dl-new">신규</span>';
  if (cur === null && prev === null) return '<span class="dl">＝</span>';
  if (cur === null) return `<span class="dl dl-down">▼ 이탈(${prev}위→미노출)</span>`;
  if (prev === null) return `<span class="dl dl-up">▲ 진입(미노출→${cur}위)</span>`;
  const d = prev - cur;
  if (d === 0) return '<span class="dl">＝</span>';
  return d > 0 ? `<span class="dl dl-up">▲${d}</span>` : `<span class="dl dl-down">▼${-d}</span>`;
}
function bar(value, max, label, opts = {}) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `<div class="bar-row"><div class="bar-label">${label}</div><div class="bar-track"><div class="bar-fill ${opts.cls ?? ''}" style="width:${w.toFixed(1)}%"></div></div><div class="bar-val">${opts.val ?? num(value)}</div></div>`;
}
function meter(value, max, label, valLabel) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `<div class="meter"><div class="meter-head"><span>${esc(label)}</span><b>${esc(valLabel)}</b></div><div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%"></div></div></div>`;
}

// ───────────────────────── 데이터 적재 ─────────────────────────
const pq = readJson('docs/ops/pipeline-queue.json');
const dailyMd = readText('docs/ops/DAILY-KEYWORDS.md');
const ranks = readJson('src/data/naver-ranks.json');
const targets = readJson('docs/ops/rank-targets.json');
const vs = readJson('docs/ops/volume-scale.json');
const ci = readJson('docs/ops/cluster-intents.json');
const radar = readJson('src/data/keyword-radar.json');
const q0400 = readJson('docs/ops/0400-queue.json');
const landgrab = readJson('docs/ops/landgrab-calendar.json');
const big = readJson('docs/ops/big-keywords.json');
const todayIssue = readJson('src/data/today-issue.json');
const quotaMd = readText('docs/ops/NAVER-API-QUOTA.md');

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
          dateModified: o.dateModified ?? null,
          targetQuery: o.targetQuery ?? null,
          contentVersion: o.contentVersion ?? null,
          factCheckScore: typeof o.factCheckScore === 'number' ? o.factCheckScore : null,
          updates: Array.isArray(o.updates) ? o.updates.length : 0,
          lastUpdate:
            Array.isArray(o.updates) && o.updates.length ? (o.updates.at(-1)?.date ?? null) : null,
          category: o.category ?? null,
          reportType: o.reportType ?? null,
          folder: d,
        });
      } catch {
        posts.push({
          title: `${f} (파싱 실패)`,
          slug: f.replace(/.json$/, ''),
          date: d,
          publishedAt: null,
          dateModified: null,
          targetQuery: null,
          contentVersion: null,
          factCheckScore: null,
          updates: 0,
          lastUpdate: null,
          category: null,
          reportType: null,
          folder: d,
        });
      }
    }
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
  return posts;
}
const posts = loadPosts();

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
  if (parts.length !== 5) return { text: expr, times: [] };
  const [minS, hourS, dom, mon, dowS] = parts;
  const minute = Number(minS);
  if (Number.isNaN(minute) || hourS === '*' || /[/-]/.test(hourS) || dom !== '*' || mon !== '*') {
    return { text: `${expr} (UTC, 변환 생략)`, times: [] };
  }
  const hours = hourS.split(',').map(Number);
  const times = [];
  const dowShiftSet = new Set();
  for (const h of hours) {
    const kh = (h + 9) % 24;
    const shift = h + 9 >= 24 ? 1 : 0;
    times.push({ h: kh, m: minute, shift });
    dowShiftSet.add(shift);
  }
  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = times.map((t) => `${pad(t.h)}:${pad(t.m)}`).join('·');
  if (dowS === '*') return { text: `매일 ${timeStr}`, times };
  const days = dowS.split(',').map((d) => {
    const base = Number(d);
    if (Number.isNaN(base)) return d;
    const shifted = (base + (times[0]?.shift ?? 0)) % 7;
    return DOW[shifted];
  });
  return { text: `매주 ${days.join('·')} ${timeStr}`, times };
}
function nextRunKst(expr) {
  const c = cronToKst(expr);
  if (!c.times.length) return null;
  const nowK = new Date(NOW.getTime() + KST_OFFSET_MS);
  const nowMin = nowK.getUTCHours() * 60 + nowK.getUTCMinutes();
  const daily = c.text.startsWith('매일');
  if (!daily) return null;
  const upcoming = c.times.map((t) => t.h * 60 + t.m).sort((a, b) => a - b);
  const next = upcoming.find((m) => m > nowMin);
  const pad = (n) => String(n).padStart(2, '0');
  if (next !== undefined) return `오늘 ${pad(Math.floor(next / 60))}:${pad(next % 60)}`;
  const first = upcoming[0];
  return `내일 ${pad(Math.floor(first / 60))}:${pad(first % 60)}`;
}
const rankCron = crons.find((c) => c.file === 'naver-rank.yml')?.crons[0];
const rankCronKst = rankCron ? cronToKst(rankCron).text : null;
const rankNextKst = rankCron ? nextRunKst(rankCron) : null;

// ───────────────────────── 파생 데이터 ─────────────────────────
const byQuery = ranks.ok && ranks.data?.byQuery ? ranks.data.byQuery : {};
const rankQueries = Object.keys(byQuery);
const targetList = targets.ok && Array.isArray(targets.data?.targets) ? targets.data.targets : [];
const targetByQuery = new Map(targetList.map((t) => [t.query, t]));

function sortedHistory(entry) {
  const h = Array.isArray(entry?.history) ? [...entry.history] : [];
  const key = (x) => Date.parse(x.ts ?? `${x.date}T00:00:00Z`) || 0;
  return h.sort((a, b) => key(a) - key(b));
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
    webDocCount: latest.webDocCount ?? null,
    wholeBlock: latest.aboveIsWholeBlock === true,
    onPage: latest.onPage,
    parseOk: latest.parseOk,
    date: latest.date ?? e?.first ?? null,
    kinds,
    openSlots: last?.openSlots,
    verdictT1: last?.verdictT1,
    verdictT2: last?.verdictT2,
    inbound7d: t?.inbound7d ?? null,
    volumeRelative: t?.volumeRelative ?? null,
    externalSeen: t?.externalSeen,
    targetUrl: t?.url ?? null,
    note: t?.note ?? null,
    histLen: hist.length,
  };
});
rankRows.sort((a, b) => {
  const ra = a.rank ?? 999;
  const rb = b.rank ?? 999;
  if (ra !== rb) return ra - rb;
  return (b.inbound7d ?? 0) - (a.inbound7d ?? 0);
});
const rankBuckets = {
  '1~3위': rankRows.filter((r) => r.rank !== null && r.rank <= 3).length,
  '4~10위': rankRows.filter((r) => r.rank !== null && r.rank > 3 && r.rank <= 10).length,
  '11위+': rankRows.filter((r) => r.rank !== null && r.rank > 10).length,
  미노출: rankRows.filter((r) => r.rank === null).length,
};
const unregisteredTargets = targetList.filter((t) => !byQuery[t.query]);

const pqItems = pq.ok && Array.isArray(pq.data?.items) ? pq.data.items : [];
const pqNew = pqItems.filter((i) => i.track === 'T1' || i.track === 'T2' || i.track === 'T3');
const pqUpd = pqItems.filter((i) => i.track === '갱신');
const pqWatch = pq.ok && Array.isArray(pq.data?.watch) ? pq.data.watch : [];
const pqExcluded = pq.ok && Array.isArray(pq.data?.excluded) ? pq.data.excluded : [];
const pqMeta = pq.ok ? (pq.data?.meta ?? {}) : {};

const ciEntries = ci.ok && Array.isArray(ci.data?.entries) ? ci.data.entries : [];
const ciToday = ciEntries.filter((e) => e.date === TODAY);
const ciRegionOf = (e) => (Array.isArray(e.region) ? e.region : [e.region]).filter(Boolean);

const todayPosts = posts.filter((p) => p.date === TODAY);
// 오늘 발행된 글의 targetQuery(issues + cluster-intents 오늘 편입) — pipeline-queue의 stale status 보정용
const publishedTodayQueries = new Set(
  [...todayPosts.map((p) => p.targetQuery), ...ciToday.map((e) => e.targetQuery)].filter(Boolean),
);
const isPublishedToday = (i) =>
  publishedTodayQueries.has(i.query) || publishedTodayQueries.has(i.serp?.query);
const yesterdayPosts = posts.filter((p) => p.date === YESTERDAY);
const ranksUpdatedMs = ranks.ok && ranks.data?.updatedAt ? Date.parse(ranks.data.updatedAt) : 0;
function measuredState(p) {
  if (!p.targetQuery) return { text: 'targetQuery 없음', measured: false };
  const e = byQuery[p.targetQuery];
  if (!e) return { text: '순위 미측정(등록 전)', measured: false };
  const pubMs = p.publishedAt ? Date.parse(p.publishedAt) : 0;
  if (pubMs && ranksUpdatedMs && pubMs > ranksUpdatedMs) {
    return {
      text: `발행 후 미측정(마지막 측정 ${kst(ranks.data.updatedAt)})`,
      measured: false,
      rank: e.latest?.rank ?? null,
    };
  }
  return {
    text: '',
    measured: true,
    rank: e.latest?.rank ?? null,
    wholeBlock: e.latest?.aboveIsWholeBlock === true,
  };
}

// ───────────────────────── 오늘의 결론(규칙 기반) ─────────────────────────
const conclusions = [];
{
  // 1. 갱신 기한 도래
  const due = pqUpd.filter((i) => typeof i.daysLeft === 'number' && i.daysLeft <= 0);
  if (due.length) {
    const names = due
      .slice(0, 4)
      .map((i) => i.region ?? i.slug)
      .join('·');
    conclusions.push(
      `갱신 기한 도래 ${due.length}건(${esc(names)}${due.length > 4 ? ' 외' : ''}) → 사실·날짜·updates[]만 정정, 제목·slug 불변`,
    );
  }
  // 2. 어제·오늘 발행 글 순위 미측정
  const recent = [...yesterdayPosts, ...todayPosts];
  const unmeasured = recent.filter((p) => !measuredState(p).measured);
  if (unmeasured.length) {
    const when = rankNextKst
      ? `${rankNextKst}(${rankCronKst}, naver-rank.yml)`
      : '다음 측정 시각 없음';
    conclusions.push(
      `어제·오늘 발행 ${recent.length}건 중 ${unmeasured.length}건 순위 미측정 → 다음 측정 ${esc(when)}`,
    );
  }
  // 3. 미노출(블록 만석)인데 실유입 있는 쿼리 → 오늘 대응 글 여부
  const nullWithInbound = rankRows
    .filter((r) => r.rank === null && r.inbound7d)
    .sort((a, b) => b.inbound7d - a.inbound7d);
  for (const r of nullWithInbound.slice(0, 1)) {
    const region = r.query.split(/\s+/)[0].replace(/(군|시|구|도)$/, '');
    const hit = ciToday.find((e) =>
      ciRegionOf(e).some((g) => region.startsWith(g) || g.startsWith(region)),
    );
    const tail = hit
      ? `→ 오늘 ${esc(hit.family)}글 발행됨(${esc(hit.slug)})`
      : '→ 오늘 대응 글 없음(cluster-intents 오늘 편입에 해당 지역 없음)';
    conclusions.push(
      `'${esc(r.query)}' 자사 미노출${r.wholeBlock ? '(블록 만석)' : ''}·주 ${num(r.inbound7d)} 유입 ${tail}`,
    );
  }
  // 4. 오늘 편입 글 결과 대기
  if (ciToday.length) {
    const label = ciToday.map((e) => `${ciRegionOf(e).join('/')} ${e.family}`).join('·');
    conclusions.push(
      `오늘 편입 ${ciToday.length}건(${esc(label)}) 결과 대기 — 첫 측정 ${esc(rankNextKst ?? '없음')}`,
    );
  }
  // 5. T1 열린 자리
  const openT1All = pqNew.filter(
    (i) => i.track === 'T1' && i.serp?.verdictT1 === 'open' && i.status === 'proposed',
  );
  const openT1 = openT1All.filter((i) => !isPublishedToday(i));
  const openT1Done = openT1All.filter(isPublishedToday);
  if (openT1.length) {
    const doneTail = openT1Done.length
      ? ` · 나머지 ${openT1Done.length}건은 오늘 발행됨(${openT1Done
          .map((i) => `'${esc(i.query)}'`)
          .join(', ')})`
      : '';
    conclusions.push(
      `T1 열린 자리 ${openT1.length}건: ${openT1
        .slice(0, 3)
        .map((i) => `'${esc(i.serp?.query ?? i.query)}'(openSlots ${i.serp?.openSlots ?? '?'})`)
        .join(', ')} — 운영자 지시 대기(status proposed)${doneTail}`,
    );
  } else if (openT1Done.length) {
    conclusions.push(
      `T1 열린 자리 ${openT1Done.length}건 전부 오늘 발행됨(pipeline-queue status는 proposed 그대로) — 첫 측정 ${esc(rankNextKst ?? '없음')}`,
    );
  }
  // 6. 0400 지정
  if (q0400.ok) {
    const todayKey = q0400.data?.[TODAY];
    if (todayKey && typeof todayKey === 'object') {
      conclusions.push(
        `0400 지정 있음: ${esc(todayKey.mode === 'update' ? `갱신 ${todayKey.target ?? '없음'}` : `신규 ${todayKey.keyword ?? '없음'}`)}`,
      );
    } else {
      const upcoming = Object.keys(q0400.data ?? {})
        .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k > TODAY)
        .sort()[0];
      conclusions.push(
        `0400 오늘 지정 없음 → 평소 선정${upcoming ? ` · 다음 지정 ${esc(upcoming)}(${esc(dday(TODAY, upcoming))})` : ''}`,
      );
    }
  }
  // 7. SERP 예산
  if (pqMeta.serp) {
    const s = pqMeta.serp;
    conclusions.push(
      `SERP 정찰 ${num(s.used)}/${num(s.budget?.total)}${s.error ? ` · 오류: ${esc(s.error)}` : ''} (pipeline ${kst(pqMeta.generatedAt)})`,
    );
  }
  if (!conclusions.length)
    conclusions.push('데이터 없음 — pipeline-queue·naver-ranks·issues가 없다');
}

// ───────────────────────── 섹션: KPI ─────────────────────────
function kpiSection() {
  const sum = analytics?.ok ? (analytics.data?.summary ?? {}) : {};
  const per = analytics?.ok ? (analytics.data?.period ?? {}) : {};
  const tiles = [
    ['7일 검색 유입', num(sum.searchInbound), per.from ? `${per.from}~${per.to}` : '없음'],
    ['7일 방문', num(sum.visits), sum.dailyRange ? `일 ${sum.dailyRange}` : ''],
    [
      '7일 PV',
      num(sum.pageviews),
      vs.ok ? `PV/방문 ${num(vs.data?.meta?.internalMove?.pvPerVisit, 3)}` : '',
    ],
    [
      '순위 측정 쿼리',
      num(rankQueries.length),
      ranks.ok ? `1~3위 ${rankBuckets['1~3위']} · 미노출 ${rankBuckets.미노출}` : '없음',
    ],
    [
      '오늘 후보',
      pq.ok
        ? `${num(pqMeta.counts?.T1)}/${num(pqMeta.counts?.T2)}/${num(pqMeta.counts?.T3)}`
        : '없음',
      pq.ok ? `T1/T2/T3 · 갱신 ${num(pqMeta.counts?.갱신)} · 제외 ${num(pqMeta.counts?.제외)}` : '',
    ],
    ['발행 글', num(posts.length), `오늘 ${todayPosts.length} · 어제 ${yesterdayPosts.length}`],
  ];
  const html = `<div class="kpis">${tiles
    .map(
      ([l, v, s]) =>
        `<div class="kpi"><div class="kpi-l">${esc(l)}</div><div class="kpi-v">${esc(v)}</div><div class="kpi-s">${esc(s)}</div></div>`,
    )
    .join('')}</div>`;
  return section(
    'kpi',
    '핵심 숫자',
    [
      analytics
        ? srcTag(
            analytics.path,
            `${analytics.data?.period?.from ?? '?'}~${analytics.data?.period?.to ?? '?'}`,
          )
        : '애널리틱스 파일 없음',
      srcTag('src/data/naver-ranks.json', ranks.ok ? kst(ranks.data?.updatedAt) : '없음'),
      srcTag('docs/ops/pipeline-queue.json', pq.ok ? kst(pqMeta.generatedAt) : '없음'),
    ],
    html,
    ['애널리틱스는 주 1회 스크린샷 전사본이라 실시간이 아니다. 81~90위 누락.'],
  );
}

// ───────────────────────── 섹션: 순위판 ─────────────────────────
function rankSection() {
  if (!ranks.ok)
    return section(
      'ranks',
      '네이버 순위판',
      [srcTag('src/data/naver-ranks.json', ranks.error)],
      '<p class="empty">데이터 없음</p>',
    );
  const maxB = Math.max(1, ...Object.values(rankBuckets));
  const dist = `<div class="chart"><div class="chart-title">순위 분포 (${rankQueries.length}쿼리)</div>${Object.entries(
    rankBuckets,
  )
    .map(([k, v]) => bar(v, maxB, esc(k)))
    .join('')}</div>`;
  const kindLabel = {
    institutional: '기관',
    press: '언론',
    commercial: '상업',
    naver: '네이버',
    sister: '자매',
    ugc: 'UGC',
  };
  const rows = rankRows.map((r) => {
    const kinds = Object.entries(r.kinds)
      .map(([k, v]) => `${kindLabel[k] ?? k} ${v}`)
      .join(' · ');
    const link = r.url
      ? extLink(r.url, '글')
      : r.targetUrl
        ? extLink(`${SITE}${r.targetUrl}`, '대상글')
        : '<span class="muted">글 없음</span>';
    const verdict =
      r.verdictT1 || r.verdictT2
        ? `T1 ${esc(r.verdictT1 ?? '-')} / T2 ${esc(r.verdictT2 ?? '-')}`
        : '<span class="muted">없음</span>';
    const flags = [];
    if (r.parseOk === false) flags.push('파싱 실패');
    // rank null이면 이미 '미노출' 배지가 있어 중복 — 순위가 있는데 페이지 밖일 때만 표시
    if (r.rank !== null && r.rank !== undefined && r.onPage === false) flags.push('페이지 밖');
    return [
      td(
        `<div class="q">${esc(r.query)}</div>${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}`,
      ),
      td(
        rankBadge(r.rank, r.wholeBlock) +
          (flags.length ? ` <span class="flag">${esc(flags.join('·'))}</span>` : ''),
        'nowrap',
      ),
      td(delta(r.curHist, r.prevRank), 'nowrap'),
      td(num(r.webDocCount), 'num'),
      td(r.openSlots !== undefined ? num(r.openSlots) : '<span class="muted">없음</span>', 'num'),
      td(verdict, 'nowrap'),
      td(kinds || '<span class="muted">없음</span>'),
      td(r.inbound7d !== null ? num(r.inbound7d) : '<span class="muted">-</span>', 'num'),
      td(
        r.volumeRelative !== null ? num(r.volumeRelative, 2) : '<span class="muted">-</span>',
        'num',
      ),
      td(link, 'nowrap'),
      td(esc(r.date ?? '없음'), 'nowrap'),
    ];
  });
  const filter =
    '<p><input id="rank-filter" type="search" placeholder="쿼리·호스트 필터" class="filter"></p>';
  const tbl =
    filter +
    table(
      [
        '쿼리',
        '순위',
        '변동',
        '웹문서',
        'openSlots',
        '판정',
        '위에 있는 것',
        '유입/주',
        'rel30',
        '링크',
        '측정일',
      ],
      rows,
    );
  const unreg = unregisteredTargets.length
    ? `<p class="small">rank-targets에만 있고 아직 순위 없는 쿼리 ${unregisteredTargets.length}건: ${unregisteredTargets
        .map((t) => esc(t.query))
        .join(' · ')}</p>`
    : '';
  return section(
    'ranks',
    '네이버 순위판',
    [
      srcTag('src/data/naver-ranks.json', kst(ranks.data?.updatedAt)),
      srcTag('docs/ops/rank-targets.json', targets.ok ? `mtime ${kst(targets.mtime)}` : '없음'),
      rankCronKst
        ? `<span>자동 측정 ${esc(rankCronKst)} · 다음 ${esc(rankNextKst ?? '')}</span>`
        : '',
    ].filter(Boolean),
    dist + tbl + unreg,
    [
      '변동은 history의 마지막 두 회차(ts 정렬) 비교다. 같은 날 여러 회차가 있으면 하루 안의 흔들림도 변동으로 보인다.',
      "'유입/주'와 rel30은 rank-targets의 inbound7d(9/2~9/8 실유입)·volumeRelative(실업급여=100)이고, 쿼리 문자열이 완전히 같을 때만 붙는다.",
      '미노출 + 블록 만석은 자사 글이 웹문서 블록 밖으로 밀려난 상태다. 순위가 있어도 실유입이 0일 수 있다(의령형).',
      'openSlots·판정은 2026-09-10 이후 회차에만 기록된다. 없음 = 그 필드가 아직 없는 회차.',
    ],
  );
}

// ───────────────────────── 섹션: 오늘 후보(파이프라인) ─────────────────────────
function pipelineSection() {
  if (!pq.ok)
    return section(
      'pipeline',
      '오늘 후보 · 파이프라인',
      [srcTag('docs/ops/pipeline-queue.json', pq.error)],
      '<p class="empty">데이터 없음</p>',
    );
  const statusCls = {
    proposed: 'st-proposed',
    approved: 'st-ok',
    published: 'st-ok',
    rejected: 'st-no',
    hold: 'st-hold',
  };
  const newRows = pqNew.map((i) => {
    const s = i.serp ?? {};
    const v =
      s.verdictT1 || s.verdictT2
        ? `T1 ${esc(s.verdictT1 ?? '-')} / T2 ${esc(s.verdictT2 ?? '-')}`
        : '없음';
    const ev = Array.isArray(i.evidence) && i.evidence.length ? esc(i.evidence[0]) : '';
    return [
      td(
        `<span class="tag">${esc(i.track)}</span>${i.family ? ` <span class="tag tag-f">${esc(i.family)}</span>` : ''}`,
        'nowrap',
      ),
      td(
        `<div class="q">${esc(i.query)}</div>${i.variant ? `<div class="note">변형: ${esc(i.variant)}</div>` : ''}${ev ? `<div class="note">${ev}</div>` : ''}`,
      ),
      td(esc(i.region ?? i.cluster ?? '-'), 'nowrap'),
      td(
        i.start
          ? `${esc(i.start)} (${esc(dday(TODAY, i.start))})${i.inWindow ? ' <span class="tag tag-ok">창 안</span>' : ''}`
          : '-',
        'nowrap',
      ),
      td(s.rank !== undefined ? rankBadge(s.rank, s.aboveIsWholeBlock) : '없음', 'nowrap'),
      td(
        s.openSlots !== undefined
          ? `${num(s.openSlots)}${s.webDocOffset !== undefined ? ` · offset ${pct(s.webDocOffset)}` : ''}${s.approx ? ' (근사)' : ''}`
          : '없음',
        'nowrap',
      ),
      td(v, 'nowrap'),
      td(num(i.score, 1), 'num'),
      td(esc(i.expectedInbound ?? '없음'), 'nowrap'),
      td(
        `<span class="st ${statusCls[i.status] ?? ''}">${esc(i.status ?? '없음')}</span>${isPublishedToday(i) ? ' <span class="tag tag-ok" title="같은 targetQuery의 글이 오늘 발행됨 — pipeline-queue status가 낡음">발행됨(오늘)</span>' : ''}`,
        'nowrap',
      ),
      td(i.condition ? `<div class="note">${esc(i.condition)}</div>` : ''),
    ];
  });
  const updRows = pqUpd
    .slice()
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
    .map((i) => [
      td(
        i.daysLeft !== undefined
          ? `<b>${i.daysLeft <= 0 ? '기한 도래' : `D-${i.daysLeft}`}</b>`
          : '없음',
        'nowrap',
      ),
      td(`${esc(i.dueDate ?? '없음')}`, 'nowrap'),
      td(esc(i.region ?? '-'), 'nowrap'),
      td(
        `<div class="q">${i.slug ? extLink(postUrl(i.slug), i.slug) : esc(i.query ?? '')}</div>${Array.isArray(i.evidence) && i.evidence[0] ? `<div class="note">${esc(i.evidence[0])}</div>` : ''}`,
      ),
      td(i.path ? localLink(i.path, '파일') : '', 'nowrap'),
      td(
        `<span class="st ${statusCls[i.status] ?? ''}">${esc(i.status ?? '없음')}</span>`,
        'nowrap',
      ),
    ]);
  const watchHtml = pqWatch.length
    ? `<ul class="list">${pqWatch.map((w) => `<li><span class="tag">${esc(w.kind)}</span> ${esc(w.text)}</li>`).join('')}</ul>`
    : '<p class="empty">감시 항목 없음</p>';
  const exByTrack = {};
  for (const x of pqExcluded) exByTrack[x.track ?? '?'] = (exByTrack[x.track ?? '?'] ?? 0) + 1;
  const serp = pqMeta.serp ?? {};
  const head = `<p class="lead">생성 ${esc(kst(pqMeta.generatedAt))} · 기준일 ${esc(pqMeta.today ?? '없음')} · SERP ${num(serp.used)}/${num(serp.budget?.total)}(T1 ${num(serp.budget?.T1)}·T2 ${num(serp.budget?.T2)}·재측정 ${num(serp.budget?.remeasure)})${serp.error ? ` · <b class="warn">오류 ${esc(serp.error)}</b>` : ''}${pqMeta.dryRun ? ' · dry-run' : ''} · 보고문 ${localLink('docs/ops/DAILY-KEYWORDS.md', 'DAILY-KEYWORDS.md')}${dailyMd.ok ? ` (${esc(dailyMd.text.match(/생성 (\d{4}-\d{2}-\d{2} \d{2}:\d{2})Z/)?.[1] ?? '?')}Z)` : ' (없음)'}</p>`;
  return section(
    'pipeline',
    '오늘 후보 · 파이프라인',
    [
      srcTag('docs/ops/pipeline-queue.json', kst(pqMeta.generatedAt)),
      srcTag('docs/ops/DAILY-KEYWORDS.md', dailyMd.ok ? `mtime ${kst(dailyMd.mtime)}` : '없음'),
    ],
    `${head}<h3>신규 후보 (T1 ${pqNew.filter((i) => i.track === 'T1').length} · T2 ${pqNew.filter((i) => i.track === 'T2').length} · T3 ${pqNew.filter((i) => i.track === 'T3').length})</h3>${table(
      [
        '트랙',
        '쿼리',
        '지역/클러스터',
        '개시',
        'SERP 순위',
        'openSlots',
        '판정',
        '점수',
        '예상/주',
        '상태',
        '조건',
      ],
      newRows,
    )}<h3>갱신 후보 (${pqUpd.length})</h3>${table(['기한', '마감', '지역', '글', '파일', '상태'], updRows)}<h3>다음 물결 감시 (${pqWatch.length})</h3>${watchHtml}<h3>제외 ${pqExcluded.length}건</h3><p class="small">${
      Object.entries(exByTrack)
        .map(([k, v]) => `${esc(k)} ${v}`)
        .join(' · ') || '없음'
    } — 사유는 ${localLink('docs/ops/DAILY-KEYWORDS.md', 'DAILY-KEYWORDS.md')} '제외(사유)' 참조</p>`,
    [
      '파이프라인은 보고만 한다. 발행은 운영자 지시 후 수동(결정 #12). status가 전부 proposed면 아직 아무것도 지시하지 않은 상태다.',
      '점수 = recent7 × min(openSlots,4) × 계수. T1은 점수보다 개시일 임박순이 우선이다.',
      'SERP 순위·판정은 변형 쿼리(variant)에 대한 측정일 수 있다 — 쿼리 열의 변형 표기를 확인.',
    ],
  );
}

// ───────────────────────── 섹션: 유입 점유율(volume-scale) ─────────────────────────
function shareSection() {
  if (!vs.ok)
    return section(
      'shares',
      '유입 점유율 · 지역',
      [srcTag('docs/ops/volume-scale.json', vs.error)],
      '<p class="empty">데이터 없음</p>',
    );
  const d = vs.data;
  const sh = d.shares ?? {};
  const segs = [
    ['민생×지역', sh.minsaengRegional, 's1'],
    ['롤업', sh.rollup, 's2'],
    ['전국 제도', sh.national, 's3'],
    ['헤드', sh.head, 's4'],
    ['기타', sh.other, 's5'],
  ].filter(([, v]) => v && typeof v.pct === 'number');
  const stacked = segs.length
    ? `<div class="chart"><div class="chart-title">상위 행 유입 점유(검색어 없음 제외 · 분모 ${num(d.meta?.coverage?.topRowsVisitsExNone)})</div><div class="stack">${segs
        .map(
          ([l, v, c]) =>
            `<div class="seg ${c}" style="width:${v.pct}%" title="${esc(l)} ${pct(v.pct)}"></div>`,
        )
        .join('')}</div><div class="legend">${segs
        .map(
          ([l, v, c]) =>
            `<span><i class="sw ${c}"></i>${esc(l)} <b>${pct(v.pct)}</b> (${num(v.visits)} · ${num(v.queries)}쿼리 · 전체 검색유입의 ${pct(v.pctOfSearchInbound)})</span>`,
        )
        .join(
          '',
        )}</div><p class="small">민생 전체(지역+롤업+헤드) ${pct(sh.combined?.minsaengAll?.pct)} = ${num(sh.combined?.minsaengAll?.visits)} · 상위 행 커버리지 ${pct(d.meta?.coverage?.pctExNone)} · 미측정 ${num(d.meta?.coverage?.unmeasured)}</p></div>`
    : '<p class="empty">shares 없음</p>';
  const regions = Array.isArray(d.regions)
    ? d.regions.slice().sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))
    : [];
  const maxV = Math.max(1, ...regions.map((r) => r.visits ?? 0));
  const regionRows = regions.map((r) => [
    td(`<b>${esc(r.region)}</b> <span class="muted">${esc(r.level ?? '')}</span>`, 'nowrap'),
    td(bar(r.visits ?? 0, maxV, '', { val: num(r.visits) }), 'barcell'),
    td(num(r.queries), 'num'),
    td(
      r.bestRank === null || r.bestRank === undefined
        ? '<span class="muted">없음</span>'
        : rankBadge(r.bestRank, false),
      'nowrap',
    ),
    td(
      Array.isArray(r.posts) && r.posts.length
        ? r.posts
            .map(
              (p) =>
                `${extLink(p.url ? `${SITE}${p.url}` : postUrl(p.slug), p.slug)} <span class="tag tag-f">${esc(p.family ?? '?')}</span>`,
            )
            .join('<br>')
        : '<span class="muted">글 없음</span>',
    ),
  ]);
  const zero = Array.isArray(d.zeroCases) ? d.zeroCases : [];
  const zeroLabel = {
    trafficNoFreshPost: '유입 있음·새 글 없음',
    postNoTraffic: '글 있음·유입 0',
    volumeNoTraffic: '검색량 있음·유입 0',
  };
  // volume-scale의 rank:null은 '미측정'(rankNote 참조)이지 미노출이 아니다. naver-ranks에 실제 측정값이 있을 때만 그 값을 쓴다.
  const zeroRankCell = (z) => {
    if (z.rank === undefined) return '-';
    if (typeof z.rank === 'number') return rankBadge(z.rank, false);
    const e = z.query ? byQuery[z.query] : undefined;
    if (e?.latest && 'rank' in e.latest) {
      return rankBadge(e.latest.rank ?? null, e.latest.aboveIsWholeBlock === true);
    }
    return `<span class="muted"${z.rankNote ? ` title="${esc(z.rankNote)}"` : ''}>미측정</span>`;
  };
  const zeroRows = zero.map((z) => [
    td(`<span class="tag">${esc(zeroLabel[z.type] ?? z.type)}</span>`, 'nowrap'),
    td(esc(z.region ?? z.query ?? '-'), 'nowrap'),
    td(
      z.visits !== undefined
        ? num(z.visits)
        : z.regionVisits !== undefined
          ? num(z.regionVisits)
          : '-',
      'num',
    ),
    td(zeroRankCell(z), 'nowrap'),
    td(`<div class="note">${esc(z.note ?? '')}</div>`),
  ]);
  const coef = Array.isArray(d.coefficients)
    ? d.coefficients.filter((c) => c.perPoint !== null && c.perPoint !== undefined)
    : [];
  const coefRows = coef.map((c) => [
    td(esc(c.class), 'nowrap'),
    td(esc(c.rankBucket), 'nowrap'),
    td(num(c.perPoint, 1), 'num'),
    td(num(c.n), 'num'),
  ]);
  return section(
    'shares',
    '유입 점유율 · 지역',
    [
      srcTag('docs/ops/volume-scale.json', kst(d.meta?.generatedAt)),
      `<span>기간 ${esc(d.meta?.period?.from ?? '?')}~${esc(d.meta?.period?.to ?? '?')}</span>`,
    ],
    `${stacked}<h3>지역별 유입 (${regions.length})</h3>${table(['지역', '유입(7일)', '쿼리', '최고 순위', '글'], regionRows)}<h3>0 사례 (${zero.length})</h3>${table(['유형', '지역/쿼리', '유입', '순위', '메모'], zeroRows)}<h3>계수 perPoint (유입/주 ÷ recent7)</h3>${table(['클래스', '순위 버킷', 'perPoint', 'n'], coefRows)}`,
    [
      `점유율 분모는 상위 ${num(d.meta?.topRows)}행(전체 검색유입의 ${pct(d.meta?.coverage?.pctExNone)})이다 — 전체 점유가 아니다.`,
      'perPoint n이 1~3인 셀은 중앙값이 아니라 사실상 한 쿼리 값이다. 예측에 쓰면 안 된다.',
      '데이터랩 창(오늘 기준 7일)과 애널리틱스 기간은 며칠 어긋난다.',
    ],
  );
}

// ───────────────────────── 섹션: 실유입 검색어 ─────────────────────────
function analyticsSection() {
  if (!analytics?.ok)
    return section(
      'inbound',
      '실유입 검색어 상위',
      [],
      '<p class="empty">src/data/analytics/naver-analytics-search-*.json 없음</p>',
    );
  const kws = Array.isArray(analytics.data?.keywords) ? analytics.data.keywords : [];
  const top = kws.filter((k) => k.query !== '(검색어 없음)').slice(0, 15);
  const none = kws.find((k) => k.query === '(검색어 없음)');
  const maxV = Math.max(1, ...top.map((k) => k.visits ?? 0));
  const rows = top.map((k) => {
    const e = byQuery[k.query];
    const rk = e
      ? rankBadge(e.latest?.rank ?? null, e.latest?.aboveIsWholeBlock === true)
      : '<span class="muted">미측정</span>';
    return [
      td(num(k.rank), 'num'),
      td(esc(k.query)),
      td(bar(k.visits ?? 0, maxV, '', { val: num(k.visits) }), 'barcell'),
      td(rk, 'nowrap'),
    ];
  });
  return section(
    'inbound',
    '실유입 검색어 상위',
    [
      srcTag(
        analytics.path,
        `${analytics.data?.period?.from ?? '?'}~${analytics.data?.period?.to ?? '?'} · mtime ${kst(analytics.mtime)}`,
      ),
    ],
    `<p class="lead">방문자 ${num(analytics.data?.summary?.visitors)} · 방문 ${num(analytics.data?.summary?.visits)} · PV ${num(analytics.data?.summary?.pageviews)} · 검색유입 ${num(analytics.data?.summary?.searchInbound)}${none ? ` · (검색어 없음) ${num(none.visits)}` : ''} · 행 ${kws.length}</p>${table(['#', '검색어', '방문(7일)', '현재 순위'], rows)}`,
    [
      '현재 순위는 naver-ranks에 같은 문자열이 있을 때만 붙는다. 미측정 = 순위 추적 대상이 아니라는 뜻이지 순위가 없다는 뜻이 아니다.',
    ],
  );
}

// ───────────────────────── 섹션: 레이더 ─────────────────────────
function radarSection() {
  if (!radar.ok)
    return section(
      'radar',
      '키워드 레이더 · API 사용량',
      [srcTag('src/data/keyword-radar.json', radar.error)],
      '<p class="empty">데이터 없음</p>',
    );
  const r = radar.data;
  const snaps = Array.isArray(r.snapshots) ? r.snapshots : [];
  const last = snaps.at(-1);
  const kws =
    last && Array.isArray(last.keywords)
      ? last.keywords
          .slice()
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 10)
      : [];
  const kwRows = kws.map((k) => [
    td(esc(k.term)),
    td(num(k.score, 1), 'num'),
    td(num(k.signals?.momentum, 2), 'num'),
    td(num(k.signals?.kinQuestions), 'num'),
    td(num(k.signals?.datalab, 1), 'num'),
    td(esc(k.lifecycle?.stage ?? '없음'), 'nowrap'),
  ]);
  const status = last?.sourceStatus
    ? Object.entries(last.sourceStatus)
        .map(([k, v]) => `${esc(k)}: ${esc(v)}`)
        .join(' · ')
    : '없음';
  const niche = Array.isArray(r.niche) ? r.niche : [];
  const nicheRows = niche.map((n) => [
    td(esc(n.term)),
    td(num(n.opportunity), 'num'),
    td(num(n.demandPct), 'num'),
    td(num(n.supplyScarcity), 'num'),
    td(
      n.momentum === null || n.momentum === undefined
        ? '<span class="muted">없음</span>'
        : num(n.momentum, 2),
      'num',
    ),
    td(esc(n.stage ?? '없음'), 'nowrap'),
  ]);
  const uc = Array.isArray(r.updateCandidates)
    ? r.updateCandidates
        .slice()
        .sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0))
        .slice(0, 10)
    : [];
  const ucRows = uc.map((u) => [
    td(extLink(postUrl(u.slug), u.slug)),
    td(esc(u.date ?? '없음'), 'nowrap'),
    td(esc(u.term ?? '없음'), 'nowrap'),
    td(num(u.signalScore, 1), 'num'),
    td(num(u.markers), 'num'),
  ]);
  const au = r.apiUsage ?? {};
  const g = au.groups ?? {};
  const quotaSearchDaily = quotaMd.ok
    ? quotaMd.text.match(/NAVER 검색\*\*[^|]*\|[^|]*\|\s*([\d,]+)\s*\|\s*([\d,]+)/)
    : null;
  const meters = [
    g.search
      ? meter(
          g.search.perDay ?? 0,
          g.search.dailyQuota ?? 1,
          '검색 API 일',
          `${num(g.search.perDay)} / ${num(g.search.dailyQuota)} (${pct(g.search.dailyPct)})`,
        )
      : '',
    g.search
      ? meter(
          g.search.perMonth ?? 0,
          g.search.monthlyQuota ?? 1,
          '검색 API 월',
          `${num(g.search.perMonth)} / ${num(g.search.monthlyQuota)} (${pct(g.search.monthlyPct)})`,
        )
      : '',
    g.datalab
      ? meter(
          g.datalab.perMonth ?? 0,
          g.datalab.monthlyQuota ?? 1,
          '데이터랩 월',
          `${num(g.datalab.perMonth)} / ${num(g.datalab.monthlyQuota)} (${pct(g.datalab.monthlyPct)})`,
        )
      : '',
  ].join('');
  const detail = au.detail
    ? Object.entries(au.detail)
        .map(([k, v]) => `${esc(k)} ${num(v)}`)
        .join(' · ')
    : '없음';
  const candidates = Array.isArray(r.candidates) ? r.candidates.length : null;
  return section(
    'radar',
    '키워드 레이더 · API 사용량',
    [
      srcTag('src/data/keyword-radar.json', kst(r.updatedAt)),
      `<span>스냅샷 ${snaps.length}개 · 마지막 ${esc(kst(last?.ts))}</span>`,
      srcTag('docs/ops/NAVER-API-QUOTA.md', quotaMd.ok ? `mtime ${kst(quotaMd.mtime)}` : '없음'),
    ],
    `<p class="lead">소스 상태: ${status}</p><p class="small">candidates: ${candidates === null ? '키 없음(파이프라인은 애널리틱스로 대체 중)' : num(candidates)} · byTerm ${num(r.byTerm ? Object.keys(r.byTerm).length : null)}</p><h3>최신 스냅샷 상위 (${kws.length})</h3>${table(['키워드', '점수', '모멘텀', '지식iN', '데이터랩', '단계'], kwRows)}<h3>니치 (${niche.length})</h3>${table(['키워드', '기회', '수요%', '공급 희소', '모멘텀', '단계'], nicheRows)}<h3>갱신 신호 글 (${uc.length})</h3>${table(['글', '발행일', '키워드', '신호 점수', '마커'], ucRows)}<h3>API 사용량 (${esc(au.mode ?? '없음')} · 일 ${num(au.runsPerDay)}회 · 이번 회차 ${num(au.thisRun)}회 · ${esc(kst(au.ts))})</h3>${meters || '<p class="empty">apiUsage 없음</p>'}<p class="small">회차 내역: ${detail}${quotaSearchDaily ? ` · 문서 한도 검색 일 ${esc(quotaSearchDaily[1])} / 월 ${esc(quotaSearchDaily[2])}` : ''}</p>`,
    [
      'apiUsage는 실누적이 아니라 "이 스케줄대로 돌면 얼마"의 산출값이다. 실누적은 Ncloud 콘솔.',
      '레이더 점수는 네이버 내부 신호(지식iN·데이터랩)의 합성이지 검색량이 아니다. 발행 근거는 SERP 실측이 우선.',
      '데이터랩은 검색 0인 날이 응답에서 빠져 희소 시계열이 과대일 수 있다.',
    ],
  );
}

// ───────────────────────── 섹션: 발행 현황 ─────────────────────────
function postsSection() {
  if (!posts.length)
    return section('posts', '발행 현황', [], '<p class="empty">src/data/issues 없음</p>');
  const since = addDays(TODAY, -13);
  const recent = posts.filter((p) => p.date >= since);
  const perDay = {};
  for (let i = 13; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    perDay[d] = 0;
  }
  for (const p of recent) perDay[p.date] = (perDay[p.date] ?? 0) + 1;
  const maxD = Math.max(1, ...Object.values(perDay));
  const days = `<div class="chart"><div class="chart-title">최근 14일 발행 건수</div><div class="cols">${Object.entries(
    perDay,
  )
    .map(
      ([d, v]) =>
        `<div class="col" title="${d} ${v}건"><div class="col-val">${v || ''}</div><div class="col-track"><div class="col-fill" style="height:${((v / maxD) * 100).toFixed(0)}%"></div></div><div class="col-lab">${d.slice(5)}</div></div>`,
    )
    .join('')}</div></div>`;
  const fc = posts.filter((p) => typeof p.factCheckScore === 'number');
  const fcAvg = fc.length ? fc.reduce((s, p) => s + p.factCheckScore, 0) / fc.length : null;
  const v2 = posts.filter((p) => p.contentVersion === 2).length;
  const withUpd = posts.filter((p) => p.updates > 0).length;
  const stats = `<p class="lead">전체 ${num(posts.length)}건 · 최근 14일 ${recent.length}건 · contentVersion 2: ${v2}건 · updates 있는 글 ${withUpd}건 · factCheckScore 평균 ${fcAvg === null ? '없음' : fcAvg.toFixed(2)}(${fc.length}건)</p>`;
  const rows = posts.slice(0, 20).map((p) => {
    const m = measuredState(p);
    const rk = m.measured
      ? rankBadge(m.rank, m.wholeBlock)
      : `<span class="muted">${esc(m.text)}</span>`;
    return [
      td(esc(p.date), 'nowrap'),
      td(
        `<div class="q">${extLink(postUrl(p.slug), p.title)}</div><div class="note">${esc(p.slug)}${p.reportType ? ` · ${esc(p.reportType)}` : ''}${p.category ? ` · ${esc(p.category)}` : ''}</div>`,
      ),
      td(p.targetQuery ? esc(p.targetQuery) : '<span class="muted">없음</span>'),
      td(rk, 'nowrap'),
      td(
        p.contentVersion === 2
          ? '<span class="tag tag-ok">v2</span>'
          : '<span class="muted">v1</span>',
        'nowrap',
      ),
      td(
        typeof p.factCheckScore === 'number'
          ? p.factCheckScore.toFixed(2)
          : '<span class="muted">없음</span>',
        'num',
      ),
      td(
        p.updates
          ? `${p.updates}건${p.lastUpdate ? ` (${esc(p.lastUpdate)})` : ''}`
          : '<span class="muted">0</span>',
        'nowrap',
      ),
    ];
  });
  const ti = todayIssue.ok ? todayIssue.data : null;
  const tiHtml = ti
    ? `<h3>today-issue (${esc(kst(ti.syncedAt))})</h3><p class="small">${esc(ti.headline ?? '없음')} — ${esc(ti.trendingTopic ?? '')} ${ti.trendingTopicCount ? `×${num(ti.trendingTopicCount)}` : ''} · ${esc(ti.summary?.subhead ?? '')}${ti.link ? ` · ${extLink(ti.link, '기사')}` : ''}</p>`
    : '<p class="small">today-issue 없음</p>';
  return section(
    'posts',
    '발행 현황',
    [
      `<span>${localLink('src/data/issues', 'src/data/issues/**')} <b>최신 ${esc(posts[0]?.date ?? '없음')}</b></span>`,
      srcTag('src/data/today-issue.json', todayIssue.ok ? kst(todayIssue.data?.syncedAt) : '없음'),
    ],
    `${stats}${days}<h3>최근 20건</h3>${table(['날짜', '글', 'targetQuery', '순위', '가독성', '팩트', 'updates'], rows)}${tiHtml}`,
    [
      '순위는 targetQuery가 naver-ranks에 등록돼 있고 마지막 측정이 발행 이후일 때만 유효하다. 그 전엔 "발행 후 미측정".',
      '_drafts·_scheduled·_ 접두 파일은 제외. 본문은 읽지 않는다(제목·메타만).',
    ],
  );
}

// ───────────────────────── 섹션: 잠금 레지스트리(cluster-intents) ─────────────────────────
function intentsSection() {
  if (!ci.ok)
    return section(
      'intents',
      '지자체×패밀리 잠금',
      [srcTag('docs/ops/cluster-intents.json', ci.error)],
      '<p class="empty">데이터 없음</p>',
    );
  const m = ci.data.meta ?? {};
  const locked = ciEntries.filter((e) => e.cluster === 'minsaeng' && !e.rollup);
  const byRegion = new Map();
  for (const e of locked) {
    for (const g of ciRegionOf(e)) {
      if (!byRegion.has(g)) byRegion.set(g, { A: [], B: [], V: [] });
      const slot = byRegion.get(g);
      if (!slot[e.family]) slot[e.family] = [];
      slot[e.family].push(e);
    }
  }
  const regionsSorted = [...byRegion.entries()].sort((a, b) => {
    // 날짜는 문자열(YYYY-MM-DD)이라 Math.max를 쓰면 NaN이 된다 — 정렬 후 마지막 값이 최신
    const latest = (fam) =>
      Object.values(fam)
        .flat()
        .map((e) => e.date ?? '')
        .sort()
        .at(-1) ?? '';
    const la = latest(a[1]);
    const lb = latest(b[1]);
    return la < lb ? 1 : la > lb ? -1 : a[0].localeCompare(b[0]);
  });
  const cell = (list) =>
    list?.length
      ? list
          .map(
            (e) =>
              `<div class="note">${extLink(postUrl(e.slug), e.date ?? e.slug)}${e.knownPair ? ' <span class="tag">pair</span>' : ''}</div>`,
          )
          .join('')
      : '<span class="muted">—</span>';
  const rows = regionsSorted.map(([g, fam]) => [
    td(`<b>${esc(g)}</b>`, 'nowrap'),
    td(cell(fam.A)),
    td(cell(fam.B)),
    td(cell(fam.V)),
    td(
      fam.A?.length && fam.V?.length
        ? '<span class="tag">A+V</span>'
        : fam.A?.length && fam.B?.length
          ? '<span class="tag">A+B</span>'
          : '',
      'nowrap',
    ),
  ]);
  const todayHtml = ciToday.length
    ? `<ul class="list">${ciToday.map((e) => `<li>${esc(ciRegionOf(e).join('/'))} <span class="tag tag-f">${esc(e.family)}</span> ${extLink(postUrl(e.slug), e.slug)}${e.targetQuery ? ` — ${esc(e.targetQuery)}` : ''}</li>`).join('')}</ul>`
    : '<p class="small">오늘 편입 없음</p>';
  return section(
    'intents',
    '지자체×패밀리 잠금',
    [
      srcTag(
        'docs/ops/cluster-intents.json',
        `mtime ${kst(ci.mtime)} · 최신 편입 ${esc(
          ciEntries
            .map((e) => e.date ?? '')
            .sort()
            .at(-1) ?? '없음',
        )}`,
      ),
    ],
    `<p class="lead">항목 ${num(m.entryCount)} · 지역 ${num(m.regionCount)} · 패밀리 A ${num(m.families?.A)} / B ${num(m.families?.B)} / V ${num(m.families?.V)} · 민생 ${num(m.clusters?.minsaeng)} · 롤업 ${num(m.rollups)} · knownPair ${num(m.knownPairEntries)}</p><h3>오늘 편입 (${ciToday.length})</h3>${todayHtml}<h3>민생 잠금 매트릭스 (지역 ${regionsSorted.length} · 최신 편입순)</h3>${table(['지역', 'A', 'B', 'V', '조합'], rows)}`,
    [
      'VETO: 같은 지자체×같은 패밀리, 또는 A 있는 지역에 V 추가. FIX: coreFacts 2개 이상 일치면 기존 글 갱신. 판정은 build-cluster-intents.mjs --check가 한다 — 이 표는 참고용.',
    ],
  );
}

// ───────────────────────── 섹션: 자동화 일정 · 0400 · 선점 캘린더 ─────────────────────────
function scheduleSection() {
  const cronRows = crons
    .filter((c) => c.crons.length)
    .map((c) => [
      td(esc(c.file), 'nowrap'),
      td(esc(c.name)),
      td(c.crons.map((x) => `<code>${esc(x)}</code>`).join('<br>'), 'nowrap'),
      td(c.crons.map((x) => esc(cronToKst(x).text)).join('<br>'), 'nowrap'),
      td(c.crons.map((x) => esc(nextRunKst(x) ?? '-')).join('<br>'), 'nowrap'),
    ]);
  const noCron = crons.filter((c) => !c.crons.length).map((c) => c.file);
  const qd = q0400.ok ? q0400.data : null;
  const qKeys = qd
    ? Object.keys(qd)
        .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
        .sort()
    : [];
  const qRows = qKeys.map((k) => {
    const v = qd[k] && typeof qd[k] === 'object' ? qd[k] : {};
    const mode = v.mode === 'update' ? '갱신' : '신규';
    const what =
      v.mode === 'update'
        ? v.target
          ? localLink(v.target, v.target)
          : '<span class="muted">target 없음</span>'
        : `${esc(v.keyword ?? '')}${v.official_name ? ` — ${esc(v.official_name)}` : ''}`;
    const when =
      k === TODAY
        ? '<b>오늘</b>'
        : k > TODAY
          ? esc(dday(TODAY, k))
          : '<span class="muted">지남</span>';
    return [
      td(esc(k), 'nowrap'),
      td(when, 'nowrap'),
      td(`<span class="tag">${mode}</span>`, 'nowrap'),
      td(what),
      td(`<div class="note">${esc(v.status ?? v.note ?? '')}</div>`),
    ];
  });
  const watch = qd && Array.isArray(qd._watch) ? qd._watch : [];
  const watchHtml = watch.length
    ? `<ul class="list">${watch.map((w) => `<li><b>${esc(w.topic)}</b> — ${esc(w.note ?? '')}</li>`).join('')}</ul>`
    : '<p class="small">_watch 없음</p>';
  const lg = landgrab.ok && Array.isArray(landgrab.data?.items) ? landgrab.data.items : [];
  const lgRows = lg
    .slice()
    .sort((a, b) => ((a.writeBy ?? '9999') < (b.writeBy ?? '9999') ? -1 : 1))
    .map((i) => [
      td(esc(i.topic)),
      td(`<span class="st st-${esc(i.status ?? '')}">${esc(i.status ?? '없음')}</span>`, 'nowrap'),
      td(
        i.writeBy
          ? `${esc(i.writeBy)} (${esc(dday(TODAY, i.writeBy))})`
          : i.trigger
            ? `<div class="note">${esc(i.trigger)}</div>`
            : '<span class="muted">없음</span>',
      ),
      td(i.watchFrom ? `${esc(i.watchFrom)} (${esc(dday(TODAY, i.watchFrom))})` : '-', 'nowrap'),
      td(i.peakMonth ? `${num(i.peakMonth)}월 · ${num(i.peakRelative, 1)}` : '없음', 'nowrap'),
    ]);
  return section(
    'schedule',
    '자동화 일정 · 0400 큐 · 선점 캘린더',
    [
      `<span>${localLink('.github/workflows', '.github/workflows/*.yml')} cron ${crons.reduce((s, c) => s + c.crons.length, 0)}줄</span>`,
      srcTag('docs/ops/0400-queue.json', q0400.ok ? `mtime ${kst(q0400.mtime)}` : '없음'),
      srcTag(
        'docs/ops/landgrab-calendar.json',
        landgrab.ok ? `updated ${landgrab.data?.updated ?? '없음'}` : '없음',
      ),
    ],
    `<h3>워크플로 cron (KST 환산)</h3>${table(['파일', '이름', 'cron(UTC)', 'KST', '다음'], cronRows)}${noCron.length ? `<p class="small">cron 없음(이벤트·수동): ${noCron.map((f) => esc(f)).join(' · ')}</p>` : ''}<h3>0400 지정 큐 (오늘 ${qd?.[TODAY] ? '지정 있음' : '지정 없음 → 평소 선정'})</h3>${table(['날짜', 'D-day', '모드', '대상', '상태/메모'], qRows)}<h4>_watch</h4>${watchHtml}<h3>T3 선점 캘린더 (${lg.length})</h3>${table(['주제', '상태', 'writeBy', 'watchFrom', '피크(월·상대값)'], lgRows)}`,
    [
      'auto-publish-0400.yml에는 cron 줄이 없다(위 표에 없으면 스케줄이 다른 곳에 있거나 수동이다). 0400 발행은 매일 신규 1건 상한에 포함된다.',
      'cron KST 환산은 분·시·요일만 다룬다. 요일 지정은 UTC→KST 넘김(+9h)에 맞춰 하루 밀었다.',
      'landgrab writeBy null 항목은 날짜가 아니라 trigger 문장으로 발동한다(설 2027).',
    ],
  );
}

// ───────────────────────── 섹션: 대형 키워드 ─────────────────────────
function bigSection() {
  if (!big.ok)
    return section(
      'big',
      '대형 키워드(T2 입력)',
      [srcTag('docs/ops/big-keywords.json', big.error)],
      '<p class="empty">데이터 없음</p>',
    );
  const kws = Array.isArray(big.data?.keywords) ? big.data.keywords : [];
  const maxI = Math.max(1, ...kws.map((k) => k.evidence?.inbound7 ?? 0));
  const rows = kws
    .slice()
    .sort((a, b) => (b.evidence?.inbound7 ?? 0) - (a.evidence?.inbound7 ?? 0))
    .map((k) => {
      const dl = k.evidence?.datalab ?? {};
      return [
        td(
          `<b>${esc(k.term)}</b>${k.mode ? ` <span class="tag">${esc(k.mode)}</span>` : ''}<div class="note">${esc(k.cluster ?? '')}</div>`,
          'nowrap',
        ),
        td(bar(k.evidence?.inbound7 ?? 0, maxI, '', { val: num(k.evidence?.inbound7) }), 'barcell'),
        td(num(dl.rel30, 2), 'num'),
        td(num(dl.recent7, 2), 'num'),
        td(
          dl.trend === undefined || dl.trend === null
            ? '없음'
            : `${dl.trend >= 1 ? '▲' : '▼'} ${num(dl.trend, 2)}`,
          'nowrap',
        ),
        td(num(Array.isArray(k.aliases) ? k.aliases.length : null), 'num'),
        td(num(Array.isArray(k.existingSlugs) ? k.existingSlugs.length : null), 'num'),
      ];
    });
  return section(
    'big',
    '대형 키워드(T2 입력)',
    [
      srcTag('docs/ops/big-keywords.json', `updated ${big.data?.updated ?? '없음'}`),
      `<span>기준 ${esc(big.data?.benchmark ?? '없음')}=100</span>`,
    ],
    table(['키워드', '실유입 7일', 'rel30', 'recent7', '추세', '축', '기존 글'], rows),
    ['inbound7 0은 "없음"이 아니라 "상위 160 밖"이다. 데이터랩 값은 게이트가 아니라 정렬용.'],
  );
}

// ───────────────────────── 조립 ─────────────────────────
const sections = [
  kpiSection(),
  rankSection(),
  pipelineSection(),
  shareSection(),
  analyticsSection(),
  postsSection(),
  intentsSection(),
  radarSection(),
  scheduleSection(),
  bigSection(),
];
const nav = [
  ['kpi', '핵심 숫자'],
  ['ranks', '순위판'],
  ['pipeline', '오늘 후보'],
  ['shares', '점유율·지역'],
  ['inbound', '실유입'],
  ['posts', '발행'],
  ['intents', '잠금'],
  ['radar', '레이더·API'],
  ['schedule', '일정'],
  ['big', '대형 키워드'],
];

const CSS = `
:root{color-scheme:light;--bg:#f6f6f4;--surface:#fcfcfb;--line:#e4e3df;--text:#0b0b0b;--text2:#52514e;--muted:#8a8985;
--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--s5:#e87ba4;--good:#0ca30c;--warn:#fab219;--crit:#d03b3b;
--good-bg:#e3f5e3;--warn-bg:#fff3d1;--null-bg:#ececea;--link:#1c5cab}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#111110;--surface:#1a1a19;--line:#33332f;--text:#fff;--text2:#c3c2b7;--muted:#8d8c85;
--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s5:#d55181;--good-bg:#173a17;--warn-bg:#3d3112;--null-bg:#2a2a28;--link:#86b6ef}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#111110;--surface:#1a1a19;--line:#33332f;--text:#fff;--text2:#c3c2b7;--muted:#8d8c85;
--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s5:#d55181;--good-bg:#173a17;--warn-bg:#3d3112;--null-bg:#2a2a28;--link:#86b6ef}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;word-break:keep-all;overflow-wrap:anywhere}
a{color:var(--link)}a.local{color:var(--text2);text-decoration-style:dotted}
main{max-width:1180px;margin:0 auto;padding:16px}
header{position:sticky;top:0;z-index:5;background:var(--surface);border-bottom:1px solid var(--line);padding:10px 16px}
header .hd{max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline}
header h1{font-size:17px;margin:0}header .gen{color:var(--text2);font-size:12px}
nav{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;margin-top:4px}nav a{text-decoration:none;color:var(--text2)}nav a:hover{color:var(--link)}
section{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin:14px 0}
h2{font-size:16px;margin:0 0 6px}h3{font-size:14px;margin:16px 0 6px;color:var(--text)}h4{font-size:13px;margin:10px 0 4px;color:var(--text2)}
.src{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--text2);margin-bottom:10px}.src b{font-weight:600;color:var(--text)}
.pitfalls{margin:12px 0 0;padding-left:18px;font-size:11.5px;color:var(--muted)}
.lead{margin:4px 0 8px;color:var(--text2)}.small{font-size:12px;color:var(--text2)}.muted{color:var(--muted)}.empty{color:var(--muted);font-style:italic}
.warn{color:var(--crit)}
.concl{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--s1);border-radius:8px;padding:12px 16px;margin:14px 0}
.concl h2{margin-bottom:8px}.concl ol{margin:0;padding-left:22px;font-size:15px}.concl ol li{margin:4px 0}
.concl .more{margin:10px 0 0;padding-left:22px;font-size:12.5px;color:var(--text2)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kpi{border:1px solid var(--line);border-radius:6px;padding:10px 12px}.kpi-l{font-size:12px;color:var(--text2)}.kpi-v{font-size:24px;font-weight:600;line-height:1.2;margin:2px 0}.kpi-s{font-size:11.5px;color:var(--muted)}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--text2);white-space:nowrap;font-size:12px}td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}td.nowrap{white-space:nowrap}td.barcell{min-width:160px}
.q{font-weight:500;min-width:15em;max-width:32em}.note{font-size:11.5px;color:var(--text2);margin-top:2px;white-space:normal;min-width:15em;max-width:32em}
.rk{display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600;color:var(--text)}
.rk-top{background:var(--good-bg);box-shadow:inset 3px 0 0 var(--good)}.rk-mid{background:var(--warn-bg);box-shadow:inset 3px 0 0 var(--warn)}.rk-low{background:var(--null-bg);box-shadow:inset 3px 0 0 var(--muted)}.rk-null{background:var(--null-bg);color:var(--text2)}
.dl{font-size:12px;color:var(--text2)}.dl-up{color:var(--good);font-weight:600}.dl-down{color:var(--crit);font-weight:600}.dl-new{color:var(--muted)}
.flag{font-size:11px;color:var(--crit)}
.tag{display:inline-block;font-size:11px;padding:0 6px;border:1px solid var(--line);border-radius:4px;color:var(--text2);vertical-align:middle}.tag-f{border-color:var(--s1);color:var(--text)}.tag-ok{border-color:var(--good);color:var(--text)}
.st{font-size:11.5px;padding:0 6px;border-radius:4px;background:var(--null-bg)}.st-ok{background:var(--good-bg)}.st-no{text-decoration:line-through}.st-hold,.st-watch{background:var(--warn-bg)}.st-scheduled{background:var(--good-bg)}.st-migrated{color:var(--muted)}
.chart{margin:8px 0 12px}.chart-title{font-size:12px;color:var(--text2);margin-bottom:6px}
.bar-row{display:flex;align-items:center;gap:8px;margin:3px 0}.bar-label{width:70px;font-size:12px;color:var(--text2);flex:none}.bar-track{flex:1;height:14px;background:var(--null-bg);border-radius:0 4px 4px 0;overflow:hidden}.bar-fill{height:100%;background:var(--s1);border-radius:0 4px 4px 0}.bar-val{width:60px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;flex:none}
td.barcell .bar-label{display:none}td.barcell .bar-row{margin:0}
.meter{margin:6px 0}.meter-head{display:flex;justify-content:space-between;font-size:12px;color:var(--text2)}.meter-head b{color:var(--text)}.meter .bar-track{height:10px;margin-top:3px}
.stack{display:flex;height:22px;gap:2px;background:var(--surface)}.seg{height:100%;min-width:2px;border-radius:2px}.s1{background:var(--s1)}.s2{background:var(--s2)}.s3{background:var(--s3)}.s4{background:var(--s4)}.s5{background:var(--s5)}
.legend{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px;margin-top:6px;color:var(--text2)}.legend b{color:var(--text)}.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.cols{display:flex;gap:4px;align-items:flex-end;height:110px}.col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;min-width:0}.col-val{font-size:11px;color:var(--text2);height:16px}.col-track{flex:1;width:100%;max-width:24px;display:flex;align-items:flex-end}.col-fill{width:100%;background:var(--s1);border-radius:4px 4px 0 0}.col-lab{font-size:10px;color:var(--muted);margin-top:3px;white-space:nowrap}
.list{margin:4px 0;padding-left:18px;font-size:12.5px}.list li{margin:3px 0}
code{font-size:11.5px;background:var(--null-bg);padding:0 4px;border-radius:3px}
.filter{width:100%;max-width:360px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--text);font:inherit}
footer{font-size:11.5px;color:var(--muted);margin:20px 0;text-align:center}
@media (max-width:600px){main{padding:10px}section{padding:10px 12px}.kpi-v{font-size:20px}.concl ol{font-size:14px}.col-lab{font-size:9px}.cols{height:90px}}
@media print{header{position:static}section{break-inside:avoid;border:none;padding:0 0 10px}.tw{overflow:visible}a{color:inherit;text-decoration:none}nav{display:none}}
`;

const JS = `
document.addEventListener('DOMContentLoaded',function(){
  var f=document.getElementById('rank-filter');var t=document.querySelector('#ranks table');
  if(f&&t){f.addEventListener('input',function(){var v=f.value.trim().toLowerCase();t.querySelectorAll('tbody tr').forEach(function(tr){tr.hidden=v&&tr.textContent.toLowerCase().indexOf(v)<0;});});}
  document.querySelectorAll('h3[data-toggle]').forEach(function(h){h.style.cursor='pointer';h.addEventListener('click',function(){var n=h.nextElementSibling;if(n){n.hidden=!n.hidden;}});});
});
`;

const genKst = kst(NOW);
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>awoo 운영 대시보드 ${esc(TODAY)}</title>
<style>${CSS}</style>
</head>
<body>
<header><div class="hd"><h1>awoo 운영 대시보드</h1><span class="gen">기준일 ${esc(TODAY)} (KST) · 생성 ${esc(genKst)} KST · 로컬 전용 · ${extLink(SITE, 'awoo.or.kr')}</span></div>
<nav>${nav.map(([id, l]) => `<a href="#${id}">${esc(l)}</a>`).join('')}</nav></header>
<main>
<div class="concl"><h2>오늘의 결론</h2><ol>${conclusions
  .slice(0, 3)
  .map((c) => `<li>${c}</li>`)
  .join('')}</ol>${
  conclusions.length > 3
    ? `<ul class="more">${conclusions
        .slice(3)
        .map((c) => `<li>${c}</li>`)
        .join('')}</ul>`
    : ''
}<p class="small">규칙으로 자동 파생(갱신 기한 → 미측정 글 → 미노출·유입 → 오늘 편입 → T1 열린 자리 → 0400 → SERP 예산). 데이터에 없는 판단은 넣지 않는다.</p></div>
${sections.join('\n')}
</main>
<footer>scripts/ops-dashboard.mjs · 생성 ${esc(genKst)} KST · 이 파일은 생성물이며 커밋하지 않는다. 비밀(.env·API 키)은 읽지 않았다.</footer>
<script>${JS}</script>
</body>
</html>
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html, 'utf8');
const bytes = Buffer.byteLength(html, 'utf8');
console.log(
  `${rel(OUT)} 생성 — ${(bytes / 1024).toFixed(1)} KB · 섹션 ${sections.length} · 결론 ${conclusions.length}줄 · 기준일 ${TODAY} · 생성 ${genKst} KST`,
);
if (bytes > 1.5 * 1024 * 1024) {
  console.error('경고: 1.5MB 초과');
  process.exitCode = 1;
}
