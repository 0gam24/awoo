#!/usr/bin/env node
/**
 * ops-widget — "오늘 쓸 글감" 클릭 지시 위젯(HTML 조각)을 만든다.
 *
 * 오른쪽 브라우저 창(정적 대시보드)은 채팅에 말을 걸 수 없다. 대신 이 조각을 채팅 안 위젯으로
 * 띄우면(show_widget) 버튼 클릭이 sendPrompt()로 "/post <쿼리> …" 지시를 채팅에 넣는다.
 * 운영자 지시(2026-09-11): "지시 대기에서 클릭하면 포스팅하는 기능".
 *
 * 사용:
 *   node scripts/ops-widget.mjs            # stdout에 HTML 조각
 *   node scripts/ops-widget.mjs --limit=6
 *   node scripts/ops-widget.mjs --count     # "오늘 발행 N건(자동 1 · 수동 N) · 어제 N건" 한 줄
 *
 *   node scripts/ops-widget.mjs --waves=4  # "다음에 크게 뜰 주제" 칸 줄 수(기본 6)
 *
 * 입력: docs/ops/pipeline-queue.json (status proposed, 발행된 targetQuery와 겹치지 않는 것)
 *       src/data/issues/** (targetQuery만 — 발행 여부 판정)
 *       docs/ops/next-wave.json (다음에 크게 뜰 주제 — scripts/next-wave.mjs, 없으면 그 칸을 빼고 그린다)
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EYE_LABEL, eyeFor, loadEyeStore } from './lib/eye-offset.mjs';
import { revenueOf, valueOrder } from './lib/revenue-weight.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const LIMIT = Number(argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? 8);
const COUNT_ONLY = argv.includes('--count');
const KST_TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const KST_YDAY = new Date(Date.now() + 9 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);

const norm = (s) => String(s ?? '').replace(/\s+/g, '');
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const jsStr = (v) => JSON.stringify(String(v ?? ''));

function readJson(rel) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  } catch {
    return null;
  }
}

/** 하루치 발행 글 목록 — 0400 자동 1건 + 수동 분리(운영자가 매일 묻는 수량) */
function publishedOn(day) {
  const dir = join(ROOT, 'src/data/issues', day);
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  } catch {
    return [];
  }
  // 파일이 있어도 커밋 전이면 사이트에 없다 — 발행 수량은 git 추적 파일만 센다(2026-09-12 실측: 보류된 초안이 발행으로 집계됐다)
  let tracked = null;
  try {
    tracked = new Set(
      execFileSync('git', ['ls-files', `src/data/issues/${day}`], { cwd: ROOT, encoding: 'utf8' })
        .split('\n')
        .map((l) => l.trim().split('/').pop())
        .filter(Boolean),
    );
  } catch {
    /* git이 없으면 전부 센다 */
  }
  return files
    .filter((f) => !tracked || tracked.has(f))
    .map((f) => {
      try {
        const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        return { title: j.title ?? f, slug: j.slug ?? f, targetQuery: j.targetQuery ?? null };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** "오늘 발행 N건(자동 1 · 수동 N) · 어제 N건" — 자동/수동은 큐 status로 가른다 */
function countLine() {
  const today = publishedOn(KST_TODAY);
  const yday = publishedOn(KST_YDAY);
  const q = readJson('docs/ops/pipeline-queue.json');
  const fromQueue = new Set(
    (q?.items ?? [])
      .filter((i) => i.status === 'published' || i.publishedSlug)
      // publishedSlug는 파일명(날짜 접미 포함)으로 적히기도 해서 글의 slug 필드와 맞추려면 접미를 뗀다
      .flatMap((i) =>
        [
          i.query,
          i.publishedSlug,
          String(i.publishedSlug ?? '').replace(/-\d{4}-\d{2}-\d{2}$/, ''),
        ].filter(Boolean),
      )
      .map(norm),
  );
  // 큐(운영자 지시)에서 나온 것 = 수동. 나머지는 0400 자동으로 본다.
  const manual = today.filter(
    (p) => fromQueue.has(norm(p.targetQuery)) || fromQueue.has(norm(p.slug)),
  ).length;
  const auto = today.length - manual;
  const detail = today.length ? ` — ${today.map((p) => p.title).join(' · ')}` : '';
  return `오늘 발행 ${today.length}건(자동 ${auto} · 수동 ${manual}) · 어제 ${yday.length}건${detail}`;
}

if (COUNT_ONLY) {
  console.log(countLine());
  process.exit(0);
}

/** 발행 글의 targetQuery(공백 제거) 집합 */
function publishedQueries() {
  const set = new Set();
  const dir = join(ROOT, 'src/data/issues');
  let days = [];
  try {
    days = readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  } catch {
    return set;
  }
  for (const d of days) {
    const p = join(dir, d);
    if (!statSync(p).isDirectory()) continue;
    for (const f of readdirSync(p)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      try {
        const j = JSON.parse(readFileSync(join(p, f), 'utf8'));
        if (j.targetQuery) set.add(norm(j.targetQuery));
      } catch {
        /* 깨진 파일은 무시 */
      }
    }
  }
  return set;
}

/** 기계 문장 → 사람 말. 대시보드와 같은 규칙의 축약판 */
function humanize(text) {
  let t = String(text ?? '');
  t = t
    .replace(/\(계획[^)]*\)/g, '')
    .replace(/\(결정 #\d+\)/g, '')
    .replace(/결정 #\d+:?/g, '')
    .replace(/--check[^·]*·?/g, '')
    .replace(/big-keywords "([^"]+)" alias "([^"]+)"/g, "'$1'의 다른 표현 '$2'")
    .replace(/롤업 축 "([^"]+)" × \w+[^·]*/g, "'$1' 축 지역별 묶음 글 없음")
    .replace(/실유입 "([^"]+)" (\d[\d,]*)\/주 순위 미측정/g, "'$1' 주 $2명 유입, 순위 미측정")
    .replace(/SERP 미측정 — --serp로 openSlots ≥2·자매 0 확인/g, '검색 결과 실측 필요')
    .replace(/공고 go\.kr URL 미확보\(fact-checker 대조 필요\)/g, '공고 URL 확인 필요')
    .replace(/webDocOffset ([\d.]+)%[^·]*/g, '웹문서 묶음 위치 $1%')
    .replace(/webDocOffset/g, '웹문서 묶음 위치')
    .replace(
      /뉴스 벽 경고: 같은 제목 기사 (\d+)건[^·]*/g,
      '같은 제목 기사 $1곳 — 개시일 언론 벽 주의',
    )
    .replace(/눈 확인 그 아래/g, '검색 결과 한참 아래')
    .replace(/openSlots/g, '빈자리')
    .replace(/rank null/g, '미노출')
    .replace(/\(자사 미노출·미측정분 회수\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ ·( ·)+/g, ' ·')
    .trim()
    .replace(/^·\s*|\s*·$/g, '');
  return t;
}
/** evidence 첫 줄에서 사람이 읽을 한 줄(≤40자) */
function why(item) {
  const first = humanize(item.evidence?.[0] ?? '').split(' · ')[0] || '';
  return first.length > 40 ? `${first.slice(0, 39)}…` : first;
}
function how(item) {
  const fam = item.family ? `새 글 ${item.family}` : item.track === 'T2' ? '새 글 롱테일' : '새 글';
  const inb = humanize(item.expectedInbound ?? '').replace(/\/주$/, '');
  return inb ? `${fam} · ${inb}/주` : fam;
}
function cond(item) {
  const c = humanize(item.condition ?? '');
  if (!c) return '';
  return c.length > 60 ? `${c.slice(0, 59)}…` : c;
}

const q = readJson('docs/ops/pipeline-queue.json');
if (!q || !Array.isArray(q.items)) {
  console.log(
    '<p style="color:var(--text-secondary)">글감 큐가 없습니다. 먼저 npm run pipeline 을 돌리세요.</p>',
  );
  process.exit(0);
}
const published = publishedQueries();
const items = q.items
  .filter((i) => i.status === 'proposed' && i.track !== '갱신')
  .filter((i) => {
    const keys = [i.query, ...String(i.variant ?? '').split(' / ')].map(norm).filter(Boolean);
    return !keys.some((k) => published.has(k));
  });
// 큐는 keyword-pipeline이 세운 순서지만, wave-split이 뒤에 붙인 빈틈 항목은 그 순서 밖이다.
// 같은 자로 한 번 더 세운다 — 자리 잡을 수 있는 글감 먼저, 그 안에서 노출 가능성 × 주제 수익 배수(2026-10-06).
const ready = items.filter((i) => i.exposure?.score != null).sort(valueOrder);
const pending = items
  .filter((i) => i.exposure?.score == null)
  .sort((a, b) => (b.inbound7d ?? 0) - (a.inbound7d ?? 0) || (b.recent7 ?? 0) - (a.recent7 ?? 0));

// 하루 몇 달러짜리 글감인가 — 운영자 목표(2026-10-06) "일 200달러 평균". 금액 자료는 로컬 전용
// docs/ops/adsense-private/rpm-groups.json(공개 저장소라 gitignore). 없으면(봇·다른 PC) 이 칸을 통째로 뺀다.
const money = readJson('docs/ops/adsense-private/rpm-groups.json');
// 데이터랩 1점(실업급여=100)당 1~2위 주 방문자 — docs/ops/volume-scale.json 9/2~8 실측 계수 중앙값(군 99·시 32·묶음 151)
const VISITORS_PER_POINT = 50;
/** 주 방문자 — 실유입이 있으면 그것, 다음은 검색량×계수(1~2위 가정), 없으면 큐 추정 "주 A~B"의 가운데. 모르면 null */
function visitorsWeek(i) {
  if (i.inbound7d != null) return Number(i.inbound7d) || 0;
  if (i.recent7 != null) return Number(i.recent7) * VISITORS_PER_POINT;
  const m = String(i.expectedInbound ?? '').match(/(\d[\d,]*)\s*~\s*(\d[\d,]*)/);
  if (!m) return null;
  const [a, b] = [m[1], m[2]].map((x) => Number(x.replace(/,/g, '')));
  return (a + b) / 2;
}
/** 1~3위에 들었을 때 하루 예상 수익(달러). 계산 불가면 null */
function usdPerDay(i) {
  if (!money?.rpm) return null;
  const v = visitorsWeek(i);
  if (v == null) return null;
  const rpm = money.rpm[revenueOf(i).key] ?? money.rpm.other ?? 0;
  return (v * (money.pvPerVisitor ?? 1.2) * rpm) / 1000 / 7;
}
const fmtUsd = (x) => (x >= 10 ? Math.round(x).toString() : x >= 1 ? x.toFixed(1) : x.toFixed(2));
function goalHtml() {
  if (!money?.goalPerDay) return '';
  const vals = shown.map(usdPerDay).filter((x) => x != null);
  const sum = vals.reduce((s, x) => s + x, 0);
  const unknown = shown.length - vals.length;
  const now = money.recent?.usdPerDay;
  const pct = now ? Math.min(100, Math.round((now / money.goalPerDay) * 100)) : 0;
  return `<div style="margin:2px 0 8px;padding:8px 10px;border-radius:8px;background:var(--surface-2, rgba(127,127,127,.08))">
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">
    <span style="font-size:14px;font-weight:500">목표 하루 ${money.goalPerDay}달러</span>
    <span style="font-size:13px;color:var(--text-secondary)">최근 하루 평균 ${now ?? '?'}달러 (${esc(money.recent?.from?.slice(5) ?? '')}~${esc(money.recent?.to?.slice(5) ?? '')})</span>
  </div>
  <div style="height:6px;border-radius:3px;background:rgba(127,127,127,.2);margin:6px 0 4px"><div style="height:6px;border-radius:3px;width:${pct}%;background:var(--text-success)"></div></div>
  <div style="font-size:12px;color:var(--text-muted)">아래 글감이 모두 1~3위에 들어도 하루 약 +${fmtUsd(sum + tiny.reduce((s, i) => s + (usdPerDay(i) ?? 0), 0))}달러${unknown ? ` (${unknown}건은 검색량을 몰라 뺌)` : ''} · 글감 옆 금액 = 1~3위일 때 하루 예상</div>
</div>`;
}
// 하루 1달러도 안 되는 글감은 접는다(운영자 2026-10-06 "진행해" — 목표 하루 200달러). 검색량을 몰라 계산 못 한 글감은 남긴다.
// 금액 자료가 없는 곳(봇·다른 PC)에서는 아무것도 접지 않는다.
const MIN_USD = money?.minUsdPerDay ?? 1;
const tiny = money
  ? ready.filter((i) => {
      const u = usdPerDay(i);
      return u != null && u < MIN_USD;
    })
  : [];
const shown = ready.filter((i) => !tiny.includes(i)).slice(0, LIMIT);
const tinyHtml = tiny.length
  ? `<div style="font-size:12px;color:var(--text-muted);padding:8px 0 0;border-top:0.5px solid var(--border)">하루 ${MIN_USD}달러 미만이라 접어 둔 글감 ${tiny.length}건: ${tiny
      .slice(0, 8)
      .map((i) => `${esc(i.query)}(${fmtUsd(usdPerDay(i))})`)
      .join(' · ')}${tiny.length > 8 ? ' …' : ''} — 1위를 해도 목표에 거의 보탬이 안 됩니다</div>`
  : '';
const genIso = q.meta?.generatedAt ?? q.generatedAt ?? null;
// 큐의 시각은 UTC ISO — 화면은 KST
const generated = genIso
  ? new Date(new Date(genIso).getTime() + 9 * 3600 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ')
  : '';

// 눈 확인(웹문서 블록 위치) — API로 못 재는 값이라 운영자가 직접 본다(결정 2026-09-15).
// 상위 EYE_ROWS건에만 버튼을 단다. 하루 1분, 안 눌러도 감점 없음.
const EYE_ROWS = 5;
const eyeStore = await loadEyeStore();
function eyeHtml(query, idx) {
  if (idx >= EYE_ROWS) return '';
  const cur = eyeFor(eyeStore, query);
  const btn = (v, label) => {
    const cmd = `눈확인: "${query}" = ${label} — eye-offset에 기록하고 목록을 다시 보여줘`;
    const on = cur === v;
    return `<button onclick="sendPrompt(${esc(jsStr(cmd))})" style="font-size:11px;padding:1px 6px;${on ? 'font-weight:600' : 'color:var(--text-secondary)'}">${on ? '✓ ' : ''}${label}</button>`;
  };
  const state = cur
    ? `<span style="font-size:11px;color:var(--text-muted)">검색 결과에서 ${esc(EYE_LABEL[cur])}</span>`
    : `<span style="font-size:11px;color:var(--text-muted)">네이버에서 이 검색어를 직접 보고 눌러 주세요 — 웹문서 묶음이 어디쯤?</span>`;
  return `<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:3px">${state} ${btn(1, '첫 화면')}${btn(2, '한 번 스크롤')}${btn(3, '그 아래')}</div>`;
}

const rows = shown
  .map((i, idx) => {
    // 슬래시로 시작하는 버튼 문구는 앱이 명령으로 해석하다 전송을 놓친다(2026-09-25) — 일반 문장 "발행:"으로 시작
    const cmd = `발행: ${i.query} — 대시보드 지시(큐 ${i.id ?? ''}). 파이프라인 큐 항목의 트랙·패밀리·조건을 브리프로 쓰고, 검증 통과 시 결재 질문 없이 발행한다.`;
    const hold = `보류: "${i.query}" — 큐 status를 hold로 바꾸고 이유는 묻지 말 것`;
    const c = cond(i);
    const condHtml = c
      ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">조건: ${esc(c)}</div>`
      : '';
    const ex = i.exposure ?? {};
    const tone =
      ex.label === '높음'
        ? 'var(--text-success)'
        : ex.label === '중간'
          ? 'var(--text-warning)'
          : 'var(--text-secondary)';
    const badge =
      ex.score == null
        ? ''
        : `<span style="font-size:12px;color:${tone};flex-shrink:0">${esc(ex.label)} ${ex.score}</span>`;
    const rv = revenueOf(i);
    const rvChip = rv.tag
      ? `<span style="font-size:12px;color:${rv.weight >= 1.5 ? 'var(--text-success)' : 'var(--text-muted)'};flex-shrink:0">${esc(rv.tag)}</span>`
      : '';
    const usd = usdPerDay(i);
    const usdChip =
      usd == null
        ? ''
        : `<span style="font-size:12px;color:var(--text-secondary);flex-shrink:0">하루 약 ${fmtUsd(usd)}달러</span>`;
    const reason = (ex.reasons ?? []).join(' · ') || why(i);
    return `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:0.5px solid var(--border)">
  <div style="flex:1;min-width:0">
    <div style="display:flex;gap:8px;align-items:baseline"><span style="font-size:15px;font-weight:500">${esc(i.query)}</span>${badge}${rvChip}${usdChip}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:2px">${esc(reason)} · ${esc(how(i))}</div>${condHtml}${eyeHtml(i.query, idx)}
  </div>
  <div style="display:flex;gap:6px;flex-shrink:0">
    <button onclick="sendPrompt(${esc(jsStr(cmd))})" style="font-size:13px">발행 지시 ↗</button>
    <button onclick="sendPrompt(${esc(jsStr(hold))})" style="font-size:13px;color:var(--text-secondary)">보류</button>
  </div>
</div>`;
  })
  .join('\n');

// 실측 대기 — 검색 결과를 아직 안 본 키워드. 버튼을 누르면 그 자리만 재고 목록을 다시 준다.
const pendingRows = pending.length
  ? `<div style="margin-top:10px;padding-top:8px;border-top:0.5px solid var(--border)">
  <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px">실측 대기 ${pending.length}건 — 검색 결과를 봐야 순위 가능성을 안다</div>
${pending
  .slice(0, 5)
  .map((i) => {
    const cmd = `실측: "${i.query}" — 검색 결과를 재고 큐를 갱신해 목록을 다시 보여줘`;
    const demand = i.inbound7d ? `유입 ${i.inbound7d}/주` : `검색량 ${i.recent7 ?? '미측정'}`;
    return `<div style="display:flex;gap:12px;align-items:center;padding:6px 0">
  <div style="flex:1;min-width:0"><span style="font-size:14px">${esc(i.query)}</span> <span style="font-size:12px;color:var(--text-muted)">${esc(demand)}</span></div>
  <button onclick="sendPrompt(${esc(jsStr(cmd))})" style="font-size:12px;flex-shrink:0">실측 ↗</button>
</div>`;
  })
  .join('\n')}
</div>`
  : '';

// 다음에 크게 뜰 주제 — scripts/next-wave.mjs가 묶음 단위로 잰 결과(운영자 지시 2026-10-02:
// "빈틈 목록 요청하면 다음에 크게 뜰 주제도 함께"). 검색어 하나가 아니라 주제 묶음이 커지는지를 본다.
const WAVE_LIMIT = Number(argv.find((a) => a.startsWith('--waves='))?.slice(8) ?? 6);
const WAVE_STAGE = {
  rising: { label: '지금 뜨는 중', tone: 'var(--text-success)' },
  soon: { label: '곧 뜸', tone: 'var(--text-warning)' },
  growing: { label: '커지는 중', tone: 'var(--text-secondary)' },
  gap: { label: '큰데 우리 글 적음', tone: 'var(--text-secondary)' },
};
/** 주간 8칸 → 작은 선 그래프(SVG). 색은 글자색을 따른다 */
function spark(weekly) {
  const v = (weekly ?? []).map((x) => Number(x) || 0);
  if (v.length < 2) return '';
  const max = Math.max(...v, 0.1);
  const pts = v
    .map((y, i) => `${(i * 56) / (v.length - 1)},${(18 - (y / max) * 16).toFixed(1)}`)
    .join(' ');
  return `<svg width="56" height="20" viewBox="0 0 56 20" aria-hidden="true" style="flex-shrink:0;color:var(--text-secondary)"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
}
function waveDetail(w) {
  const lv = Math.round(w.level);
  const mine = w.posts ? `우리 글 ${w.posts}개` : '우리 글 없음';
  const regions = w.regions?.length >= 3 ? ` · 기사에 지역 ${w.regions.length}곳` : '';
  if (w.stage === 'soon')
    return `지금 ${lv} · 작년엔 ${w.season.month}월에 ${w.season.up}배로 커짐 · ${mine}${regions}`;
  if (w.stage === 'gap') return `지금 ${lv} · 이미 큰 주제인데 ${mine}${regions}`;
  return `지금 ${lv} · 3주 전보다 ${w.growth}배 · ${mine}${regions}`;
}
function wavesHtml() {
  const nw = readJson('docs/ops/next-wave.json');
  if (!nw?.items?.length) return '';
  // 보류(ignore)는 다음 측정부터 빠지지만, 그날 이미 잰 결과에서도 바로 숨긴다
  const ignore = new Set((readJson('docs/ops/next-wave-seeds.json')?.ignore ?? []).map(norm));
  const picks = nw.items
    .filter((w) => WAVE_STAGE[w.stage] && !ignore.has(norm(w.term)))
    .slice(0, WAVE_LIMIT);
  const fading = nw.items.filter((w) => w.stage === 'fading').slice(0, 4);
  const rowsHtml = picks
    .map((w) => {
      const st = WAVE_STAGE[w.stage];
      const go = `선점: "${w.term}" — 다음 물결. 지역·세부 검색어로 쪼개서 빈틈 목록에 넣고 다시 보여줘`;
      const hold = `보류: "${w.term}" 물결 — next-wave 감시에서 빼고 이유는 묻지 말 것`;
      return `<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-top:0.5px solid var(--border)">
  ${spark(w.weekly)}
  <div style="flex:1;min-width:0">
    <div style="display:flex;gap:8px;align-items:baseline"><span style="font-size:15px;font-weight:500">${esc(w.term)}</span><span style="font-size:12px;color:${st.tone}">${esc(st.label)}${w.isNew ? ' · 새로 등장' : ''}</span></div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:2px">${esc(waveDetail(w))}</div>
  </div>
  <div style="display:flex;gap:6px;flex-shrink:0">
    <button onclick="sendPrompt(${esc(jsStr(go))})" style="font-size:13px">선점 ↗</button>
    <button onclick="sendPrompt(${esc(jsStr(hold))})" style="font-size:13px;color:var(--text-secondary)">보류</button>
  </div>
</div>`;
    })
    .join('\n');
  const fadingHtml = fading.length
    ? `<div style="font-size:12px;color:var(--text-muted);padding-top:6px">꺾이는 중: ${fading
        .map((w) => `${esc(w.term)} ${w.growth}배`)
        .join(' · ')} — 새 글보다 기존 글 갱신만</div>`
    : '';
  return `<div style="margin-top:14px;padding-top:8px;border-top:1px solid var(--border)">
  <div style="font-size:13px;color:var(--text-secondary);margin-bottom:2px">다음에 크게 뜰 주제 · 묶음 검색량(실업급여 = 100) · ${esc(nw.meta?.today ?? '')} 측정</div>
${rowsHtml || '<p style="font-size:13px;color:var(--text-secondary)">지금 커지는 주제가 없습니다.</p>'}
${fadingHtml}
</div>`;
}

console.log(`<h2 class="sr-only" style="position:absolute;left:-9999px">오늘 쓸 글감 ${shown.length}건 — 버튼을 누르면 발행 지시가 채팅에 입력됩니다</h2>
<div style="padding:0.5rem 0 0">
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
    <span style="font-size:13px;color:var(--text-secondary)">오늘 쓸 글감 ${shown.length}건 · 자리 잡을 수 있는 것 중 돈 되는 순 · 큐 ${esc(generated)} KST</span>
    <span style="font-size:12px;color:var(--text-muted)">${esc(countLine())}</span>
  </div>
${goalHtml()}
${rows || '<p style="color:var(--text-secondary)">지시 대기 글감이 없습니다.</p>'}
${tinyHtml}
${pendingRows}
${wavesHtml()}
</div>`);
