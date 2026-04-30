#!/usr/bin/env node
// cycle-runner.mjs — 운영 사이클 상태 디스패처
//
// 사용:
//   node scripts/cycle-runner.mjs status              # 현재 phase·다음 phase·cycle_no 출력 (JSON)
//   node scripts/cycle-runner.mjs advance             # 다음 phase로 전이 + frontmatter 갱신
//   node scripts/cycle-runner.mjs advance --skip-execute  # P0 0건일 때 EXECUTE 건너뜀
//   node scripts/cycle-runner.mjs reset               # cycle_no 1, phase PLAN으로 초기화 (확인 프롬프트)
//
// 본 스크립트는 ops/OPS_CYCLE.md frontmatter만 읽고 쓴다. 모든 산출물 생성은 /cycle 슬래시 커맨드가 담당.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CYCLE_FILE = join(ROOT, 'ops', 'OPS_CYCLE.md');

const PHASES = ['PLAN', 'REVIEW', 'EXECUTE', 'OPERATE', 'OBSERVE'];

function readCycle() {
  const raw = readFileSync(CYCLE_FILE, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('OPS_CYCLE.md frontmatter 파싱 실패');
  }
  const [, fm, body] = match;
  const meta = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m) {
      let v = m[2].trim();
      if (v === 'null') v = null;
      else if (/^\d+$/.test(v)) v = Number.parseInt(v, 10);
      else if (v.startsWith('"') && v.endsWith('"')) {
        // JSON 형식의 quoted string — escape 시퀀스 정확히 복구 (이중 escape 누적 방지)
        try {
          v = JSON.parse(v);
        } catch {
          v = v.slice(1, -1);
        }
      }
      meta[m[1]] = v;
    }
  }
  return { meta, body, raw };
}

function writeCycle(meta, body) {
  const fmKeys = [
    'phase',
    'cycle_no',
    'last_completed',
    'last_completed_at',
    'next_command',
    'trigger',
    'goal',
  ];
  const lines = ['---'];
  for (const k of fmKeys) {
    const v = meta[k];
    if (v === null || v === undefined) {
      lines.push(`${k}: null`);
    } else if (typeof v === 'number') {
      lines.push(`${k}: ${v}`);
    } else if (/[":#]/.test(String(v))) {
      lines.push(`${k}: ${JSON.stringify(String(v))}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('---');
  writeFileSync(CYCLE_FILE, `${lines.join('\n')}\n${body}`, 'utf8');
}

function todayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function nowKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace('T', ' ').slice(0, 19);
}

function nextPhase(current, skipExecute = false) {
  const idx = PHASES.indexOf(current);
  if (idx === -1) throw new Error(`알 수 없는 phase: ${current}`);
  if (skipExecute && current === 'REVIEW') return 'OPERATE';
  return PHASES[(idx + 1) % PHASES.length];
}

const cmd = process.argv[2];
const flags = process.argv.slice(3);

if (cmd === 'status') {
  const { meta } = readCycle();
  const skip = flags.includes('--skip-execute');
  const out = {
    phase: meta.phase,
    cycle_no: meta.cycle_no,
    last_completed: meta.last_completed,
    last_completed_at: meta.last_completed_at,
    next_phase: nextPhase(meta.phase, skip),
    today: todayKST(),
    proposals_dir: `ops/proposals/${todayKST()}`,
    review_file: `ops/reviews/${todayKST()}.md`,
    execute_log: `ops/execute-log/${todayKST()}.md`,
    observation_file: `ops/observations/${todayKST()}.md`,
    branch_suggestion: `cycle/${meta.cycle_no}-${todayKST()}`,
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (cmd === 'advance') {
  const skip = flags.includes('--skip-execute');
  const { meta, body } = readCycle();
  const completed = meta.phase;
  const next = nextPhase(completed, skip);

  const newMeta = { ...meta };
  newMeta.last_completed = completed;
  newMeta.last_completed_at = nowKST();
  newMeta.phase = next;

  // Cycle #4 P0-7: OPERATE → OBSERVE 전이 시 fact-check 7일 합계 ≥3 알림
  if (completed === 'OPERATE' && next === 'OBSERVE') {
    try {
      const historyPath = join(ROOT, 'src/data/issues/_history.json');
      const history = JSON.parse(readFileSync(historyPath, 'utf8'));
      const fcFails = history.factCheckFails ?? {};
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      let total = 0;
      for (const [date, n] of Object.entries(fcFails)) {
        if (new Date(date).getTime() >= cutoff) total += Number(n) || 0;
      }
      if (total >= 3) {
        const msg = `[cycle-runner] ⚠️ Fact-check 7일 합계 ${total}건 (≥3 임계 초과) — generate-issue-posts 결과 검토 필요`;
        console.warn(msg);
        if (process.env.GITHUB_STEP_SUMMARY) {
          console.log(`::warning title=Fact-check 7d≥3::sum=${total}`);
        }
      } else if (total > 0) {
        console.log(`[cycle-runner] fact-check 7일: ${total}건 (정상 범위)`);
      }
    } catch {
      // _history.json 없거나 파싱 실패는 무시 (초기 상태)
    }
  }

  // OBSERVE → PLAN 전이 시 cycle_no +1
  if (completed === 'OBSERVE' && next === 'PLAN') {
    newMeta.cycle_no = (Number(meta.cycle_no) || 0) + 1;
  }

  writeCycle(newMeta, body);
  console.log(
    JSON.stringify(
      {
        completed_phase: completed,
        new_phase: next,
        new_cycle_no: newMeta.cycle_no,
        skip_execute: skip,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (cmd === 'reset') {
  const { meta, body } = readCycle();
  const newMeta = {
    ...meta,
    phase: 'PLAN',
    cycle_no: 1,
    last_completed: null,
    last_completed_at: null,
  };
  writeCycle(newMeta, body);
  console.log('Reset 완료. cycle_no=1, phase=PLAN');
  process.exit(0);
}

console.error(`사용법:
  node scripts/cycle-runner.mjs status [--skip-execute]
  node scripts/cycle-runner.mjs advance [--skip-execute]
  node scripts/cycle-runner.mjs reset
`);
process.exit(1);
