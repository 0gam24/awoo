#!/usr/bin/env node
/**
 * naver-rank-check — 발행한 글이 네이버에서 실제로 몇 위인지 측정한다.
 *
 * 이 사이트의 병목은 색인이 아니라 랭킹이다(2026-09-08 실측). 그런데 지금까지
 * "썼다"까지만 있고 "올라갔나"를 재는 장치가 없었다. 이 스크립트가 그 자리를 채운다.
 * 측정값이 있어야 다음 글의 각도를 고칠 수 있다 — 수정·보완 루프의 근거다.
 *
 * 대상: docs/ops/rank-targets.json + 포스트 JSON의 targetQuery 필드(자동 수집)
 * 산출: src/data/naver-ranks.json (90일 롤링)
 *
 * 사용:
 *   node scripts/naver-rank-check.mjs                    # 전체 측정
 *   node scripts/naver-rank-check.mjs --limit=5          # 상위 5건만
 *   node scripts/naver-rank-check.mjs --query="..."      # 단건 조회(적재 X)
 *   node scripts/naver-rank-check.mjs --dry-run          # 적재 생략
 *
 * 예의: 요청 간 3초 간격, 1회 실행 25건 상한. 자사 순위 확인 용도로만 쓴다.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS_FILE = join(ROOT, 'docs', 'ops', 'rank-targets.json');
const ISSUES_DIR = join(ROOT, 'src', 'data', 'issues');
const OUT_FILE = join(ROOT, 'src', 'data', 'naver-ranks.json');

const SITE_HOST = 'awoo.or.kr';
const DELAY_MS = 3000;
const MAX_PER_RUN = 25;
const KEEP_DAYS = 90;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// ── SERP 파싱 ────────────────────────────────────────────────
// 웹문서 블록은 결과 1건마다 `fds-web-doc-root` 클래스를 단 컨테이너가 하나씩 붙는다.
// 이 구조는 네이버가 언제든 바꾼다 — 0건이면 조용히 "순위 없음"으로 넘기지 말고
// parseOk:false로 남겨 "미노출"과 "못 읽음"을 구분한다.
/**
 * 기관 도메인 판정.
 * `go.kr`만 보면 과소 판정된다. 2026-09-09 실측에서 korea.kr(정부 대표 포털),
 * mil.kr(국방), nhis.or.kr(건보공단), energyv.or.kr(에너지바우처 공식),
 * 8899.or.kr(노란우산 공식), eiec.kdi.re.kr(KDI)이 전부 "외부 상업 사이트"로
 * 잡혔다. 그 결과 externalCount가 "우리가 들어갈 자리"를 과대평가한다 —
 * 본인부담상한액은 external 4로 보였지만 4건 전부 공공·공식기관이라 실제 빈자리는 0이었다.
 */
const isInstitutional = (h) =>
  /(^|\.)(go\.kr|or\.kr|re\.kr|mil\.kr|ac\.kr)$/.test(h) || h === 'korea.kr';

/** 자사(us) / 네이버 UGC(naver) / 기관(institutional) / 상업(commercial) */
function hostKind(host) {
  if (host === SITE_HOST) return 'us';
  if (host.includes('naver.com')) return 'naver';
  return isInstitutional(host) ? 'institutional' : 'commercial';
}

/**
 * 결과 제목. headline1 요소 안에 검색어 강조 태그가 섞여 있어
 * 첫 `<`에서 끊으면 "2026 "처럼 잘린다 — 태그만 걷어내고 링크 라벨 앞까지 취한다.
 * 상대 제목을 남겨야 "이긴 문서의 제목이 쿼리와 얼마나 겹치는가"를 자기 데이터로 검증할 수 있다.
 */
function docTitle(block) {
  const i = block.search(/sds-comps-text-type-headline1/);
  if (i === -1) return null;
  const j = block.indexOf('>', i);
  if (j === -1) return null;
  let w = block.slice(j + 1, j + 1200);
  const cut = w.indexOf('새 창 열림');
  if (cut !== -1) w = w.slice(0, cut);
  const t = w
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return t || null;
}

function parseSerp(html) {
  const blocks = html.split('fds-web-doc-root').slice(1);
  const webDocs = [];
  for (const b of blocks) {
    const m = b.match(/<a[^>]+href="(https?:\/\/[^"]+)"/);
    if (!m) continue;
    try {
      const host = new URL(m[1]).hostname.replace(/^www\./, '');
      webDocs.push({ url: m[1], host, kind: hostKind(host), title: docTitle(b) });
    } catch {
      /* URL 파싱 불가 항목은 건너뛴다 */
    }
  }

  const uniq = (re) => new Set(html.match(re) ?? []).size;
  const ugc = {
    blog: uniq(/blog\.naver\.com\/[A-Za-z0-9_-]+\/\d{6,}/g),
    cafe: uniq(/cafe\.naver\.com\/[A-Za-z0-9_-]+\/\d{3,}/g),
    kin: uniq(/kin\.naver\.com\/qna\/[A-Za-z0-9.?=&_-]{6,}/g),
  };

  const count = (k) => webDocs.filter((d) => d.kind === k).length;

  return {
    parseOk: blocks.length > 0,
    webDocs,
    webDocCount: webDocs.length,
    institutionalCount: count('institutional'),
    // 우리가 실제로 뺏을 수 있는 자리. 기관 도메인은 사실상 못 이긴다.
    commercialCount: count('commercial'),
    ugc,
  };
}

async function fetchSerp(query) {
  const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
  });
  if (!res.ok) throw new Error(`SERP ${res.status}`);
  return res.text();
}

/** 한 쿼리 측정 */
async function measure(query) {
  const html = await fetchSerp(query);
  const s = parseSerp(html);
  const idx = s.webDocs.findIndex((d) => d.host === SITE_HOST);

  // 미노출일 때 above를 비워두면, 원인 규명이 가장 필요한 케이스에서 근거가 없어진다.
  // 순위가 없으면 "우리 위"가 곧 블록 전체다.
  const above = (idx === -1 ? s.webDocs : s.webDocs.slice(0, idx)).map((d) => ({
    host: d.host,
    kind: d.kind,
    title: d.title,
  }));

  return {
    query,
    rank: idx === -1 ? null : idx + 1,
    url: idx === -1 ? null : s.webDocs[idx].url,
    webDocCount: s.webDocCount,
    above,
    aboveIsWholeBlock: idx === -1, // 미노출이라 블록 전체를 담았다는 표시
    commercialCount: s.commercialCount,
    institutionalCount: s.institutionalCount,
    ugc: s.ugc,
    // 웹문서 블록 밖(스마트블록 등)에 잡힌 경우도 놓치지 않는다
    onPage: html.includes(SITE_HOST),
    parseOk: s.parseOk,
  };
}

// ── 대상 수집 ────────────────────────────────────────────────
async function loadTargets() {
  const out = new Map(); // query → { query, url, source }

  try {
    const f = JSON.parse(await readFile(TARGETS_FILE, 'utf8'));
    for (const t of f.targets ?? []) {
      if (t.query) out.set(t.query, { query: t.query, url: t.url ?? null, source: 'targets' });
    }
  } catch {
    /* 파일이 없으면 포스트에서만 모은다 */
  }

  // 포스트가 targetQuery를 선언하면 자동 편입 — 신규 글은 별도 등록이 필요 없다
  try {
    for (const d of await readdir(ISSUES_DIR, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      for (const f of await readdir(join(ISSUES_DIR, d.name))) {
        if (!f.endsWith('.json') || f.startsWith('_')) continue;
        const p = JSON.parse(await readFile(join(ISSUES_DIR, d.name, f), 'utf8'));
        if (p.targetQuery && !out.has(p.targetQuery)) {
          out.set(p.targetQuery, { query: p.targetQuery, url: p.slug ?? null, source: 'post' });
        }
      }
    }
  } catch {
    /* 이슈 디렉토리 문제는 targets만으로 진행 */
  }

  return [...out.values()];
}

// ── 적재 ─────────────────────────────────────────────────────
async function loadStore() {
  try {
    return JSON.parse(await readFile(OUT_FILE, 'utf8'));
  } catch {
    return { updatedAt: null, byQuery: {} };
  }
}

function record(store, date, m) {
  const rec = store.byQuery[m.query] ?? { first: date, history: [] };
  // 날짜를 키로 덮어쓰면 같은 날 두 번 재면 앞의 관측이 사라진다. 실제로 2026-09-09에
  // 72분 간격 두 회차 중 1차가 소멸해, 변화 추적이 한 번도 작동하지 못했다.
  // 타임스탬프로 쌓고 집계는 읽는 쪽에서 한다.
  rec.history.push({
    ts: new Date().toISOString(),
    date,
    rank: m.rank,
    webDocCount: m.webDocCount,
    commercialCount: m.commercialCount,
    onPage: m.onPage,
  });
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString().slice(0, 10);
  rec.history = rec.history
    .filter((h) => (h.date ?? '') >= cutoff)
    .sort((a, b) => ((a.ts ?? a.date) < (b.ts ?? b.date) ? -1 : 1));
  rec.latest = { ...m, date };
  store.byQuery[m.query] = rec;
}

/** 직전 측정 대비 변화 */
function delta(rec) {
  const h = rec.history;
  if (h.length < 2) return null;
  const cur = h[h.length - 1].rank;
  const prev = h[h.length - 2].rank;
  if (cur == null && prev == null) return null;
  if (cur == null) return `이탈 (직전 ${prev}위)`;
  if (prev == null) return `신규 진입 ${cur}위`;
  if (cur === prev) return `${cur}위 유지`;
  return cur < prev ? `${prev}→${cur}위 (▲${prev - cur})` : `${prev}→${cur}위 (▼${cur - prev})`;
}

// ── main ─────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const one = args.find((a) => a.startsWith('--query='))?.slice(8);
  const limit = Number(args.find((a) => a.startsWith('--limit='))?.slice(8)) || MAX_PER_RUN;

  if (one) {
    console.log(JSON.stringify(await measure(one), null, 2));
    return;
  }

  const targets = await loadTargets();
  if (targets.length === 0) {
    console.log('[rank] 측정 대상 없음 — docs/ops/rank-targets.json에 추가하거나');
    console.log('       포스트 JSON에 targetQuery 필드를 넣어라.');
    return;
  }

  const batch = targets.slice(0, Math.min(limit, MAX_PER_RUN));
  console.log(`[rank] ${batch.length}건 측정 (전체 ${targets.length}건, 요청 간 ${DELAY_MS}ms)`);

  const date = kstDate();
  const store = await loadStore();
  const results = [];
  let failed = 0;

  for (const [i, t] of batch.entries()) {
    try {
      const m = await measure(t.query);
      if (!m.parseOk) {
        console.warn(`  ⚠ 파싱 실패: ${t.query} — SERP 구조 변경 의심`);
        failed++;
      } else {
        record(store, date, m);
        results.push(m);
        const pos = m.rank ? `${m.rank}위/${m.webDocCount}` : m.onPage ? '블록밖 노출' : '미노출';
        const d = delta(store.byQuery[t.query]);
        console.log(
          `  ${String(i + 1).padStart(2)}. ${pos.padEnd(12)} ${t.query}${d ? `  — ${d}` : ''}`,
        );
      }
    } catch (e) {
      console.warn(`  ⚠ ${t.query}: ${e.message}`);
      failed++;
    }
    if (i < batch.length - 1) await sleep(DELAY_MS);
  }

  const ranked = results.filter((r) => r.rank != null);
  const top3 = ranked.filter((r) => r.rank <= 3).length;
  // 상업 사이트가 0건인 쿼리 = 기관 도메인이 블록을 채운 자리. 글을 고칠 게 아니라 버릴 자리다.
  const noRoom = results.filter((r) => r.commercialCount === 0).length;
  console.log(
    `\n[rank] 노출 ${ranked.length}/${results.length} · 3위 이내 ${top3} · ` +
      `진입 불가(상업 0건) ${noRoom}건${failed ? ` · 실패 ${failed}` : ''}`,
  );
  if (ranked.length) {
    const avg = Math.round((ranked.reduce((s, r) => s + r.rank, 0) / ranked.length) * 10) / 10;
    console.log(`[rank] 평균 순위 ${avg}위 (웹문서 블록 기준)`);
  }

  if (dryRun) {
    console.log('[rank] --dry-run — 적재 생략');
    return;
  }
  if (results.length === 0) {
    console.log('[rank] 유효 측정 0건 — 적재 생략');
    return;
  }

  store.updatedAt = new Date().toISOString();
  await writeFile(OUT_FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  console.log(
    `[rank] 적재 완료 → src/data/naver-ranks.json (쿼리 ${Object.keys(store.byQuery).length}개)`,
  );
}

main().catch((e) => {
  console.error('[rank] 실패:', e.message);
  process.exit(1);
});
