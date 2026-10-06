#!/usr/bin/env node
/**
 * wave-auto — 돈 되는 물결이 뜨면 운영자가 "선점"을 누르기 전에 봇이 먼저 지역·세부로 쪼갠다.
 *
 * 운영자 목표(2026-10-06): "일 200달러 평균". 하루 몇 센트짜리 빈틈으로는 닿지 않고, 수익은 큰 물결 ×
 * 지역 분해 × 조기 선점에서 나왔다(민생 절정 주 지원금 글 한 편이 주 125~184달러). 그 분해를 매일 자동으로 돌린다.
 *
 * 고르는 기준(docs/ops/next-wave.json):
 *   - 단계가 '지금 뜨는 중'(rising) 또는 '곧 뜸'(soon)
 *   - 주제 수익 배수(scripts/lib/revenue-weight.mjs) 1.5 이상 — 지원금·소상공인·바우처 묶음
 *   - 최근 7일 안에 이미 쪼갠 묶음은 건너뛴다(docs/ops/wave-auto-log.json)
 *   - 하루 최대 2묶음(데이터랩·검색 API 예산 — wave-split 1회 ≈ 지식iN 2 + 데이터랩 8 + 실측 16)
 * 고른 묶음마다 scripts/wave-split.mjs --term=… 를 돌린다. 큐(pipeline-queue)에 '빈틈:' 항목이 붙는다.
 *
 * 사용:
 *   node scripts/wave-auto.mjs            # 봇(keyword-pipeline 워크플로)이 파이프라인 뒤에 돌린다
 *   node scripts/wave-auto.mjs --dry-run  # 무엇을 쪼갤지만 보여 준다
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { revenueOf } from './lib/revenue-weight.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_REL = 'docs/ops/wave-auto-log.json';
const DRY = process.argv.includes('--dry-run');
const MAX_PER_DAY = 2;
const COOLDOWN_DAYS = 7;
const MIN_WEIGHT = 1.5;
const STAGES = new Set(['rising', 'soon']);
const TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function readJson(rel, fallback) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  } catch {
    return fallback;
  }
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const nw = readJson('docs/ops/next-wave.json', { items: [] });
const log = readJson(LOG_REL, { _readme: '', runs: [] });
log._readme =
  'scripts/wave-auto.mjs가 자동으로 쪼갠 묶음 기록. 같은 묶음은 7일 안에 다시 쪼개지 않는다. 지워도 된다(그러면 다음 실행에서 다시 쪼갠다).';
const recent = new Set(
  (log.runs ?? []).filter((r) => daysBetween(r.date, TODAY) < COOLDOWN_DAYS).map((r) => r.term),
);

const picks = (nw.items ?? [])
  .filter((w) => STAGES.has(w.stage))
  .map((w) => ({
    term: w.term,
    stage: w.stage,
    now: w.level ?? 0,
    rv: revenueOf({ query: w.term }),
  }))
  .filter((w) => w.rv.weight >= MIN_WEIGHT && !recent.has(w.term))
  .sort((a, b) => b.now * b.rv.weight - a.now * a.rv.weight)
  .slice(0, MAX_PER_DAY);

if (!picks.length) {
  console.log(
    `[wave-auto] ${TODAY} 쪼갤 묶음 없음 — 돈 되는 묶음(배수 ${MIN_WEIGHT}↑) 중 뜨는 것이 없거나 7일 안에 이미 쪼갬`,
  );
  process.exit(0);
}
for (const p of picks) {
  console.log(
    `[wave-auto] ${p.term} — ${p.stage} · 지금 ${p.now} · ${p.rv.label} ${p.rv.weight}배`,
  );
  if (DRY) continue;
  let added = null;
  try {
    const out = execFileSync(process.execPath, ['scripts/wave-split.mjs', `--term=${p.term}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      timeout: 8 * 60 * 1000,
    });
    process.stdout.write(out);
    added = Number(out.match(/큐에 (\d+)건/)?.[1] ?? 0);
  } catch (err) {
    console.error(
      `[wave-auto] ${p.term} 실패 — ${err instanceof Error ? err.message.split('\n')[0] : err}`,
    );
  }
  log.runs.push({ date: TODAY, term: p.term, stage: p.stage, weight: p.rv.weight, added });
}
if (!DRY) {
  log.runs = log.runs.filter((r) => daysBetween(r.date, TODAY) < 60);
  writeFileSync(join(ROOT, LOG_REL), `${JSON.stringify(log, null, 2)}\n`, 'utf8');
}
