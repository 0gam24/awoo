#!/usr/bin/env node
/**
 * ingest-search-advisor — 네이버 서치어드바이저에서 내려받은 CSV를 읽어 JSON으로 적재한다.
 *
 * 왜 필요한가(2026-09-16): 순위 측정이 공식 웹문서 검색 API로 바뀌면서 **사람이 보는 화면에서의
 * 순위**를 잴 길이 없어졌다(API 순위는 색인 안의 자리라 화면 순위와 다르다 — 실측 8건에서 화면 3위가
 * API 13위). 서치어드바이저 리포트는 네이버가 사이트 주인에게 직접 주는 값이라 **화면 노출·평균순위·
 * 클릭의 유일한 진실값**이다. 주 1회 운영자가 CSV를 내려받아 inbox에 넣으면 이 스크립트가 적재한다.
 *
 * 받는 법: https://searchadvisor.naver.com → 웹마스터 도구 → 사이트 선택 → 리포트(검색 유입/검색어·
 * 페이지) → 기간 선택 → CSV(엑셀) 내려받기. 검색어 탭과 문서(페이지) 탭 둘 다 받으면 둘 다 적재된다.
 *
 * 사용:
 *   node scripts/ingest-search-advisor.mjs                      # docs/ops/inbox/*.csv 전부
 *   node scripts/ingest-search-advisor.mjs --input=<파일|폴더>
 *   node scripts/ingest-search-advisor.mjs --period=2026-09-09_15   # 파일명에 쓸 기간(기본 오늘 KST)
 *   node scripts/ingest-search-advisor.mjs --dry-run            # 읽기만 하고 요약만
 *   (원본 CSV는 지우지 않는다 — 확인 후 운영자가 직접 지운다)
 *
 * 산출: src/data/search-advisor/search-advisor-<기간>.json
 *   { meta:{period, importedAt, files[], rows}, queries:[{query, impressions, clicks, ctr, position}],
 *     docs:[{url, impressions, clicks, position}] }
 *
 * 원칙: **열 이름을 못 알아보면 멈추고 그대로 보여준다.** 아무 열이나 순위로 집어넣으면 판정이
 * 조용히 틀어진다 — 네이버가 리포트 양식을 바꾸면 그때 여기 KEYS에 이름을 한 줄 더한다.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = join(ROOT, 'docs', 'ops', 'inbox');
const OUT_DIR = join(ROOT, 'src', 'data', 'search-advisor');

const args = process.argv.slice(2);
const argValue = (name) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
const DRY_RUN = args.includes('--dry-run');
const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// 열 이름 사전. 네이버 리포트는 탭마다 이름이 조금씩 다르고 영문 내보내기도 있다.
const KEYS = {
  query: [/^검색어/, /^키워드/, /query/i, /keyword/i],
  url: [/^url$/i, /주소/, /^문서/, /페이지/, /랜딩/, /^page/i],
  impressions: [/노출\s*수?/, /impression/i, /^노출$/],
  clicks: [/클릭\s*수/, /^클릭$/, /click(s)?$/i],
  ctr: [/클릭\s*률/, /ctr/i],
  position: [/평균\s*(노출)?\s*순위/, /^순위/, /position/i, /ranking/i],
  date: [/^날짜/, /^일자/, /^기간/, /date/i],
};

/** 헤더 한 칸이 어떤 필드인지. 모르면 null. 클릭률이 클릭으로 잡히지 않게 ctr을 먼저 본다. */
function fieldOf(header) {
  const h = String(header ?? '').trim();
  if (!h) return null;
  for (const key of ['ctr', 'position', 'impressions', 'clicks', 'query', 'url', 'date']) {
    if (KEYS[key].some((re) => re.test(h))) return key;
  }
  return null;
}

/** UTF-8로 읽어 깨지면 EUC-KR로 다시 읽는다(네이버 CSV는 둘 다 나온다). BOM 제거. */
async function readText(file) {
  const buf = await readFile(file);
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('�')) {
    try {
      text = new TextDecoder('euc-kr').decode(buf);
    } catch {
      /* euc-kr을 못 쓰면 utf-8 결과를 그대로 쓴다 */
    }
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** 따옴표·줄바꿈을 지키는 최소 CSV 파서. 구분자는 첫 줄에서 콤마/탭 중 많은 쪽. */
function parseCsv(text) {
  const head = text.slice(0, text.indexOf('\n') + 1 || text.length);
  const sep = (head.match(/\t/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? '\t' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

/** "1,234" · "12.3%" · "3.2위" → 숫자. 못 읽으면 null. */
function num(v) {
  const s = String(v ?? '')
    .replace(/[,\s위%]/g, '')
    .trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * 표 하나를 읽는다. 헤더 줄은 "아는 이름이 2개 이상"인 첫 줄 — 네이버 CSV는 위에 제목·기간 줄이 붙는다.
 * @returns {{kind:'query'|'doc'|null, rows:object[], headers:string[], mapped:object}}
 */
function readTable(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const map = rows[i].map(fieldOf);
    if (map.filter(Boolean).length < 2) continue;
    const kind = map.includes('query') ? 'query' : map.includes('url') ? 'doc' : null;
    if (!kind) continue;
    const out = [];
    for (const r of rows.slice(i + 1)) {
      const rec = {};
      r.forEach((cell, j) => {
        const f = map[j];
        if (!f) return;
        rec[f] = f === 'query' || f === 'url' || f === 'date' ? String(cell).trim() : num(cell);
      });
      const key = kind === 'query' ? rec.query : rec.url;
      if (!key || /^(합계|총계|total)$/i.test(key)) continue;
      out.push(rec);
    }
    return { kind, rows: out, headers: rows[i], mapped: map };
  }
  return { kind: null, rows: [], headers: rows[0] ?? [], mapped: [] };
}

async function listInputs() {
  const input = argValue('--input');
  if (input) {
    const p = isAbsolute(input) ? input : resolve(ROOT, input);
    if (!existsSync(p)) throw new Error(`입력을 찾을 수 없다: ${input}`);
    const isDir = (await readdir(p).catch(() => null)) !== null;
    if (!isDir) return [p];
    return (await readdir(p)).filter((f) => /\.(csv|tsv|txt)$/i.test(f)).map((f) => join(p, f));
  }
  if (!existsSync(INBOX)) return [];
  return (await readdir(INBOX))
    .filter((f) => /\.(csv|tsv|txt)$/i.test(f))
    .map((f) => join(INBOX, f));
}

async function main() {
  const files = await listInputs();
  if (files.length === 0) {
    console.log('[advisor] 읽을 CSV가 없다.');
    console.log(`  1) https://searchadvisor.naver.com → 웹마스터 도구 → 리포트에서 CSV를 내려받고`);
    console.log(`  2) docs/ops/inbox/ 에 넣은 뒤 다시 실행하라 (또는 --input=<파일>).`);
    return;
  }

  const queries = new Map(); // 검색어 → 행(같은 검색어가 날짜별로 여러 줄이면 합산)
  const docs = new Map();
  const used = [];
  const skipped = [];

  for (const file of files) {
    const table = readTable(parseCsv(await readText(file)));
    if (!table.kind || table.rows.length === 0) {
      skipped.push({ file: basename(file), headers: table.headers });
      continue;
    }
    for (const r of table.rows) {
      const store = table.kind === 'query' ? queries : docs;
      const key = table.kind === 'query' ? r.query : r.url;
      const prev = store.get(key);
      if (!prev) {
        store.set(key, { ...r });
        continue;
      }
      // 날짜별로 쪼개진 행은 노출·클릭을 더하고, 순위는 노출 가중평균으로 모은다
      const wPrev = prev.impressions ?? 0;
      const wCur = r.impressions ?? 0;
      if (prev.position != null && r.position != null && wPrev + wCur > 0) {
        prev.position =
          Math.round(((prev.position * wPrev + r.position * wCur) / (wPrev + wCur)) * 10) / 10;
      } else prev.position = prev.position ?? r.position;
      prev.impressions = (prev.impressions ?? 0) + (r.impressions ?? 0);
      prev.clicks = (prev.clicks ?? 0) + (r.clicks ?? 0);
      prev.ctr = prev.impressions
        ? Math.round((prev.clicks / prev.impressions) * 1000) / 10
        : prev.ctr;
    }
    used.push({ file: basename(file), kind: table.kind, rows: table.rows.length });
  }

  if (skipped.length) {
    console.warn('[advisor] 열 이름을 못 알아본 파일 — 적재하지 않았다:');
    for (const s of skipped) console.warn(`  ${s.file}: ${s.headers.slice(0, 8).join(' | ')}`);
    console.warn(
      '  네이버가 리포트 양식을 바꿨을 수 있다. scripts/ingest-search-advisor.mjs의 KEYS에 이름을 더하라.',
    );
  }
  if (used.length === 0) {
    console.error('[advisor] 적재할 표가 없다.');
    process.exitCode = 1;
    return;
  }

  const period = argValue('--period') ?? kstDate();
  const sortByImp = (a, b) => (b.impressions ?? 0) - (a.impressions ?? 0);
  const out = {
    _readme:
      '네이버 서치어드바이저 리포트 적재본. 화면(통합검색)에서의 노출수·클릭수·평균순위 — 웹문서 검색 API 순위(naver-ranks.json)와 다른 자다. 주 1회 운영자가 CSV를 docs/ops/inbox/에 넣고 npm run advisor:import.',
    meta: {
      period,
      importedAt: new Date().toISOString(),
      files: used,
      rows: queries.size + docs.size,
    },
    queries: [...queries.values()].sort(sortByImp),
    docs: [...docs.values()].sort(sortByImp),
  };

  const top = out.queries.slice(0, 10);
  console.log(
    `[advisor] 검색어 ${out.queries.length}건 · 문서 ${out.docs.length}건 (${used.map((u) => u.file).join(', ')})`,
  );
  for (const q of top) {
    console.log(
      `  노출 ${String(q.impressions ?? '-').padStart(6)} · 클릭 ${String(q.clicks ?? '-').padStart(5)} · 평균 ${q.position ?? '-'}위  ${q.query}`,
    );
  }
  if (DRY_RUN) {
    console.log('[advisor] --dry-run — 파일 쓰기 생략');
    return;
  }
  await mkdir(OUT_DIR, { recursive: true });
  const outFile = join(OUT_DIR, `search-advisor-${period}.json`);
  await writeFile(outFile, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`[advisor] 적재 완료 → src/data/search-advisor/search-advisor-${period}.json`);
  console.log('[advisor] inbox의 원본 CSV는 지우지 않았다 — 확인 후 직접 지워라.');
}

main().catch((e) => {
  console.error('[advisor] 실패:', e.message);
  process.exit(1);
});
