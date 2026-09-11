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
 *
 * 입력: docs/ops/pipeline-queue.json (status proposed, 발행된 targetQuery와 겹치지 않는 것)
 *       src/data/issues/** (targetQuery만 — 발행 여부 판정)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const LIMIT = Number(argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? 8);

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
    .replace(/webDocOffset/g, '웹문서 비중')
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
// 큐가 이미 노출 가능성 순으로 정렬돼 있다(keyword-pipeline). 그 순서를 그대로 쓴다.
const ready = items.filter((i) => i.exposure?.score != null);
const pending = items
  .filter((i) => i.exposure?.score == null)
  .sort((a, b) => (b.inbound7d ?? 0) - (a.inbound7d ?? 0) || (b.recent7 ?? 0) - (a.recent7 ?? 0));
const shown = ready.slice(0, LIMIT);
const genIso = q.meta?.generatedAt ?? q.generatedAt ?? null;
// 큐의 시각은 UTC ISO — 화면은 KST
const generated = genIso
  ? new Date(new Date(genIso).getTime() + 9 * 3600 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ')
  : '';

const rows = shown
  .map((i) => {
    const cmd = `/post ${i.query} — 대시보드 지시(큐 ${i.id ?? ''}). 파이프라인 큐 항목의 트랙·패밀리·조건을 브리프로 쓰고, 검증 통과 시 결재 질문 없이 발행한다.`;
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
    const reason = (ex.reasons ?? []).join(' · ') || why(i);
    return `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:0.5px solid var(--border)">
  <div style="flex:1;min-width:0">
    <div style="display:flex;gap:8px;align-items:baseline"><span style="font-size:15px;font-weight:500">${esc(i.query)}</span>${badge}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:2px">${esc(reason)} · ${esc(how(i))}</div>${condHtml}
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

console.log(`<h2 class="sr-only" style="position:absolute;left:-9999px">오늘 쓸 글감 ${shown.length}건 — 버튼을 누르면 발행 지시가 채팅에 입력됩니다</h2>
<div style="padding:0.5rem 0 0">
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
    <span style="font-size:13px;color:var(--text-secondary)">오늘 쓸 글감 ${shown.length}건 · 노출 가능성 높은 순 · 큐 ${esc(generated)} KST</span>
    <span style="font-size:12px;color:var(--text-muted)">발행 지시 = 작성·검증 후 바로 발행</span>
  </div>
${rows || '<p style="color:var(--text-secondary)">지시 대기 글감이 없습니다.</p>'}
${pendingRows}
</div>`);
