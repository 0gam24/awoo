#!/usr/bin/env node
/**
 * wave-split — "다음 물결" 묶음 하나를 지역·세부 검색어로 쪼개 빈틈 목록(pipeline-queue)에 넣는다.
 *
 * 위젯의 "선점 ↗" 버튼이 부른다(운영자 지시 2026-10-02 — 다음에 크게 뜰 주제를 남보다 먼저).
 * 묶음 자체(예: "반값여행")는 관공서·언론이 채우지만, 그 안의 "밀양 반값여행"·"○○ 신청 기간" 같은
 * 세부 검색어는 비어 있는 경우가 많다. 수익 패턴(신생 대형 이슈 × 지역 분해 × 조기 선점)을 손이 아니라
 * 명령 하나로 돌리는 장치다.
 *
 * 순서:
 *   1) docs/ops/next-wave.json에서 그 묶음(기사에 같이 나온 지역)을 읽는다. 없으면 이름만으로 진행.
 *   2) 변형을 만든다 — 지역("{지역} {주제}"), 세부("{주제} 신청·대상·기간·사용처·환급·…"), 그리고
 *      지식iN 질문 제목에서 주제 바로 뒤에 자주 붙는 말("고향사랑기부제 답례품"처럼 묶음마다 다른 꼬리).
 *   3) keyword-volume.mjs로 검색량(실업급여 = 100)을 잰다. 이미 쓴 글·큐에 있는 검색어는 뺀다.
 *   4) 상위 --max건을 naver-rank-check --mode=scout로 검색 결과 실측한다.
 *   5) 자리가 열린 것만 "빈틈:<검색어>" 항목으로 큐에 넣는다(노출 가능성 점수는 파이프라인과 같은 exposureOf).
 *      빈틈 항목은 자동 후보에 안 잡혀도 21일 남는다(keyword-pipeline.mjs mergeQueue).
 *
 * 사용:
 *   node scripts/wave-split.mjs --term="고향사랑기부제"
 *   node scripts/wave-split.mjs --term="반값여행" --max=10
 *   node scripts/wave-split.mjs --term="..." --dry-run      # 큐에 쓰지 않고 결과만
 *
 * 문턱: 지역 변형은 검색량 0.3 이상(데이터랩이 지역 롱테일을 약 10배 과소평가한다 — 2026-09-09 실유입 대조),
 *       세부 변형은 0.5 이상. 실측 상한 12건(정찰 예산). 호출: 지식iN 2회 + 데이터랩 ~8회 + 실측 건당 2회.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exposureOf } from './lib/exposure.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE_REL = 'docs/ops/pipeline-queue.json';
const argv = process.argv.slice(2);
const arg = (k) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const TERM = (arg('term') ?? '').trim();
const MAX = Math.min(Number(arg('max') ?? 8) || 8, 12);
const DRY = argv.includes('--dry-run');
const TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const NOW_ISO = new Date().toISOString();

const REGION_FLOOR = 0.3;
const DETAIL_FLOOR = 0.5;
const KIN_TAIL_MIN = 3; // 지식iN 제목 3건 이상에서 주제 뒤에 붙은 말만 변형으로
const DETAILS = [
  '신청',
  '신청 방법',
  '신청 기간',
  '대상',
  '조건',
  '일정',
  '사용처',
  '사용 기한',
  '환급',
  '지급일',
  '한도',
  '세액공제',
  '잔액',
];
const JOSA_TAIL = /(으로|은|는|이|가|을|를|에|의|도|로|와|과|만|좀|요)$/;
// 질문 제목에 흔한 군말 — 검색어 꼬리가 아니다
const KIN_STOP = new Set([
  '에대해서',
  '에대해',
  '질문',
  '문의',
  '관련',
  '보는거',
  '궁금',
  '어떻게',
  '도와주세요',
  '인기',
]);
const STAGE_LABEL = {
  rising: '지금 뜨는 중',
  soon: '곧 뜸',
  growing: '커지는 중',
  gap: '큰데 우리 글 적음',
  steady: '평이',
  fading: '꺾이는 중',
};

const norm = (s) => String(s ?? '').replace(/\s+/g, '');
function readJson(rel, fallback) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  } catch {
    return fallback;
  }
}

if (!TERM) {
  console.error('사용: node scripts/wave-split.mjs --term="<주제>" [--max=8] [--dry-run]');
  process.exit(2);
}

function loadEnv() {
  const env = { ...process.env };
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(join(ROOT, f), 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) env[m[1]] = m[2].trim();
      }
    } catch {
      /* 파일 없으면 환경변수만 쓴다 */
    }
  }
  return env;
}

/** 지식iN 질문 제목에서 "{주제} X"의 X를 센다 — 묶음마다 사람들이 실제로 붙여 묻는 꼬리 */
async function kinTails(term) {
  const env = loadEnv();
  const hub = Boolean(env.NCP_API_KEY_ID && env.NCP_API_KEY);
  const url = hub
    ? 'https://naverapihub.apigw.ntruss.com/search/v1/kin'
    : 'https://openapi.naver.com/v1/search/kin.json';
  const headers = hub
    ? { 'X-NCP-APIGW-API-KEY-ID': env.NCP_API_KEY_ID, 'X-NCP-APIGW-API-KEY': env.NCP_API_KEY }
    : {
        'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
      };
  const key = norm(term);
  const counts = new Map();
  for (const start of [1, 101]) {
    let items = [];
    try {
      const q = `${url}?query=${encodeURIComponent(term)}&display=100&start=${start}&sort=date`;
      const res = await fetch(q, { headers });
      if (res.ok) items = (await res.json()).items ?? [];
    } catch {
      /* 지식iN이 안 되면 고정 꼬리만 쓴다 */
    }
    for (const it of items) {
      // 띄어쓰기가 제각각이라("고향사랑 기부제") 공백을 지운 제목에서 주제 다음 글자를 찾고,
      // 원래 제목의 같은 위치 뒤 첫 낱말을 꼬리로 본다
      const title = String(it.title ?? '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ');
      let flatIdx = 0;
      let endAt = -1;
      for (let i = 0; i < title.length; i++) {
        if (title[i] === ' ') continue;
        if (title[i] === key[flatIdx]) {
          flatIdx++;
          if (flatIdx === key.length) {
            endAt = i + 1;
            break;
          }
        } else {
          flatIdx = title[i] === key[0] ? 1 : 0;
        }
      }
      if (endAt < 0) continue;
      const word = title
        .slice(endAt)
        .trim()
        .split(/[\s,.?!·()[\]]+/)[0]
        ?.replace(JOSA_TAIL, '');
      if (word && /^[가-힣]{2,6}$/.test(word) && !KIN_STOP.has(word))
        counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= KIN_TAIL_MIN)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
}

/** 발행 글의 targetQuery(공백 제거) */
function publishedKeys() {
  const set = new Set();
  const dir = join(ROOT, 'src/data/issues');
  for (const d of readdirSync(dir).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))) {
    if (!statSync(join(dir, d)).isDirectory()) continue;
    for (const f of readdirSync(join(dir, d))) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      try {
        const j = JSON.parse(readFileSync(join(dir, d, f), 'utf8'));
        if (j.targetQuery) set.add(norm(j.targetQuery));
      } catch {
        /* 깨진 파일은 무시 */
      }
    }
  }
  return set;
}

function runNode(script, args) {
  return execFileSync(process.execPath, [join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

async function main() {
  const nw = readJson('docs/ops/next-wave.json', { items: [] });
  const wave = nw.items.find((w) => norm(w.term) === norm(TERM)) ?? null;
  const regions = (wave?.regions ?? []).map((r) => r.name).slice(0, 8);

  // 2) 변형
  const tails = await kinTails(TERM);
  const variants = [
    ...regions.map((r) => ({ query: `${r} ${TERM}`, region: r, kind: 'region' })),
    ...[...new Set([...DETAILS, ...tails])].map((d) => ({
      query: `${TERM} ${d}`,
      region: null,
      kind: 'detail',
    })),
  ];
  const published = publishedKeys();
  const queue = readJson(QUEUE_REL, null);
  if (!queue?.items) {
    console.error(`[wave-split] ${QUEUE_REL}가 없다 — 먼저 npm run pipeline`);
    process.exit(1);
  }
  const inQueue = new Set(queue.items.map((i) => norm(i.query)));
  const fresh = variants.filter(
    (v) => !published.has(norm(v.query)) && !inQueue.has(norm(v.query)),
  );
  const skipped = variants.length - fresh.length;
  if (tails.length) console.log(`[wave-split] 지식iN 꼬리: ${tails.join(' · ')}`);
  if (!fresh.length) {
    console.log(`[wave-split] "${TERM}" — 새 변형 없음(이미 쓴 글·큐에 ${skipped}건)`);
    return;
  }

  // 3) 검색량
  const vol = JSON.parse(runNode('keyword-volume.mjs', ['--json', ...fresh.map((v) => v.query)]));
  const byTerm = new Map((vol.rows ?? []).map((r) => [norm(r.term), r]));
  const withDemand = fresh
    .map((v) => ({ ...v, recent7: byTerm.get(norm(v.query))?.recentRelative ?? null }))
    .filter((v) => (v.recent7 ?? 0) >= (v.kind === 'region' ? REGION_FLOOR : DETAIL_FLOOR))
    .sort((a, b) => b.recent7 - a.recent7)
    .slice(0, MAX);
  if (!withDemand.length) {
    console.log(`[wave-split] "${TERM}" — 검색량 문턱을 넘는 변형 없음(${fresh.length}건 측정)`);
    return;
  }

  // 4) 검색 결과 실측
  const tmp = mkdtempSync(join(tmpdir(), 'wave-split-'));
  let scout = [];
  try {
    const file = join(tmp, 'q.txt');
    writeFileSync(file, withDemand.map((v) => v.query).join('\n'), 'utf8');
    scout = JSON.parse(runNode('naver-rank-check.mjs', ['--mode=scout', `--file=${file}`]));
    if (!Array.isArray(scout)) scout = [scout];
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const scoutBy = new Map(scout.map((s) => [norm(s.query), s]));

  // 5) 큐 항목
  const waveLine = wave
    ? `다음 물결 ${STAGE_LABEL[wave.stage] ?? wave.stage}: 묶음 검색 ${Math.round(wave.level)} (3주 전보다 ${wave.growth}배)${
        wave.season ? ` · 작년엔 ${wave.season.month}월에 ${wave.season.up}배` : ''
      }`
    : `다음 물결 선점 지시: "${TERM}"(next-wave 측정 밖)`;
  const added = [];
  const closed = [];
  for (const v of withDemand) {
    const s = scoutBy.get(norm(v.query));
    if (!s) {
      closed.push(`${v.query} — 실측 실패`);
      continue;
    }
    if (s.rank != null && s.rank <= 3) {
      closed.push(`${v.query} — 이미 자사 ${s.rank}위`);
      continue;
    }
    if (s.verdictT2 !== 'open') {
      closed.push(`${v.query} — 자리 없음(${(s.reason ?? []).slice(0, 2).join(', ') || '닫힘'})`);
      continue;
    }
    const item = {
      id: `빈틈:${norm(v.query)}`,
      status: 'proposed',
      createdAt: NOW_ISO,
      source: `다음 물결 선점 ${TODAY}`,
      cluster: TERM,
      track: 'T2',
      family: null,
      region: v.region,
      query: v.query,
      variant: null,
      evidence: [
        waveLine,
        `데이터랩 최근7일 ${v.recent7} (실업급여=100)`,
        `scout ${TODAY}: ${s.rank == null ? '자사 미노출' : `자사 ${s.rank}위`} · 본청 ${s.mainGovAbove ?? '?'} · 빈자리 ${s.openSlots ?? '?'} · 뉴스7일 ${s.newsWall ?? '?'} · 자매 ${s.sisterAbove ?? 0}`,
      ],
      condition:
        '정부·지자체 1차 출처(공고·공식 페이지) 확인 · 같은 묶음 글끼리 각도·고유 사실을 다르게(같은 틀 반복 금지)',
      expectedInbound: `주 ${Math.round(v.recent7 * 5)}~${Math.round(v.recent7 * 30)} (추정: 검색량×5~30, 3위 안 가정)`,
      recent7: v.recent7,
      serp: {
        query: s.query,
        rank: s.rank ?? null,
        url: s.url ?? null,
        openSlots: s.openSlots ?? null,
        mainGovAbove: s.mainGovAbove ?? null,
        sisterAbove: s.sisterAbove ?? null,
        pressAbove: s.pressAbove ?? null,
        webDocOffset: s.webDocOffset ?? null,
        eyeOffset: s.eyeOffset ?? null,
        verdictT1: s.verdictT1,
        verdictT2: s.verdictT2,
        newsWall: s.newsWall ?? null,
        measuredBy: s.measuredBy ?? 'webkr-api',
        measuredAt: NOW_ISO,
        reason: s.reason ?? [],
      },
      lastSeenAt: NOW_ISO,
    };
    item.exposure = exposureOf(item);
    added.push(item);
  }

  for (const it of added)
    console.log(
      `넣음\t${it.query}\t검색 ${it.recent7}\t노출 가능성 ${it.exposure.label} ${it.exposure.score}\t${it.exposure.reasons.join(' · ')}`,
    );
  for (const c of closed) console.log(`뺌\t${c}`);
  console.log(
    `[wave-split] "${TERM}" 변형 ${variants.length}건(이미 있음 ${skipped}) → 검색량 통과 ${withDemand.length} → 큐에 ${added.length}건`,
  );
  if (DRY || !added.length) return;
  queue.items.push(...added);
  writeFileSync(join(ROOT, QUEUE_REL), `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
  console.log(`→ ${QUEUE_REL}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
