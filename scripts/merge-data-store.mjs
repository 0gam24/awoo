#!/usr/bin/env node
/**
 * merge-data-store — 시계열 운영 데이터 파일 두 벌을 합친다.
 *
 * 왜 필요한가: keyword-radar / naver-rank 워크플로는 실행에 수 분이 걸리고 그 사이
 * 다른 실행이 main에 push할 수 있다. 그러면 rebase가 JSON 충돌로 죽는다.
 * 이 파일들은 "이전 상태 + 이번 회차 결과"라서 어느 한쪽을 고르면 회차가 통째로 날아간다.
 * 올바른 해법은 **원격 위에 우리 회차를 다시 얹는 것**이다.
 *
 * 사용: node scripts/merge-data-store.mjs <원격파일(덮어쓸 대상)> <우리결과>
 *   원격 파일을 base로 삼고 우리 결과의 새 항목만 얹어 <원격파일> 자리에 쓴다.
 *
 * 두 형태를 자동 판별한다.
 *   snapshots+byTerm  → keyword-radar.json
 *   byQuery           → naver-ranks.json
 */
import { readFile, writeFile } from 'node:fs/promises';

const SNAPSHOT_SIZE_GUARD = 700 * 1024;
const TERM_HIST_CAP = 30;
const RANK_KEEP_DAYS = 90;

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const laterOf = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
const earlierOf = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

/** keyword-radar.json */
function mergeRadar(base, ours) {
  const out = { ...base };

  // 스냅샷: ts로 합집합 — 같은 회차가 양쪽에 있으면 하나만 남는다
  const byTs = new Map();
  for (const s of [...(base.snapshots ?? []), ...(ours.snapshots ?? [])]) {
    if (s?.ts) byTs.set(s.ts, s);
  }
  out.snapshots = [...byTs.values()].sort((a, b) => (a.ts < b.ts ? -1 : 1));

  // byTerm: 양쪽 관측을 합친다
  out.byTerm = { ...(base.byTerm ?? {}) };
  for (const [term, o] of Object.entries(ours.byTerm ?? {})) {
    const b = out.byTerm[term];
    if (!b) {
      out.byTerm[term] = o;
      continue;
    }
    // hist는 [날짜, 점수, gap] 튜플 — 완전 동일한 것만 중복으로 본다
    const seen = new Set();
    const hist = [...(b.hist ?? []), ...(o.hist ?? [])]
      .filter((h) => {
        const k = JSON.stringify(h);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((x, y) => (x[0] < y[0] ? -1 : 1))
      .slice(-TERM_HIST_CAP);

    out.byTerm[term] = {
      ...b,
      ...o,
      firstSeen: earlierOf(b.firstSeen, o.firstSeen),
      lastSeen: laterOf(b.lastSeen, o.lastSeen),
      bestScore: Math.max(b.bestScore ?? 0, o.bestScore ?? 0),
      // appearances는 양쪽이 각자 센 러닝 카운터다. 합하면 중복 계상되므로 큰 쪽을 쓴다.
      appearances: Math.max(b.appearances ?? 0, o.appearances ?? 0),
      hist,
    };
  }

  // 최신 회차의 산출물을 취한다
  const oursNewer = (ours.updatedAt ?? '') >= (base.updatedAt ?? '');
  const latest = oursNewer ? ours : base;
  out.updatedAt = laterOf(base.updatedAt, ours.updatedAt);
  if (latest.niche) out.niche = latest.niche;
  if (latest.apiUsage) out.apiUsage = latest.apiUsage;
  if (latest.updateCandidates) out.updateCandidates = latest.updateCandidates;

  // 용량 가드 — 오래된 스냅샷부터 버린다 (keyword-radar.mjs와 같은 규칙)
  while (JSON.stringify(out).length > SNAPSHOT_SIZE_GUARD && out.snapshots.length > 4) {
    out.snapshots.shift();
  }
  return out;
}

/** naver-ranks.json */
function mergeRanks(base, ours) {
  const out = { ...base, byQuery: { ...(base.byQuery ?? {}) } };
  const cutoff = new Date(Date.now() - RANK_KEEP_DAYS * 86400_000).toISOString().slice(0, 10);

  for (const [q, o] of Object.entries(ours.byQuery ?? {})) {
    const b = out.byQuery[q];
    if (!b) {
      out.byQuery[q] = o;
      continue;
    }
    // 같은 날짜는 나중 측정으로 덮는다
    const byDate = new Map((b.history ?? []).map((h) => [h.date, h]));
    for (const h of o.history ?? []) byDate.set(h.date, h);
    const history = [...byDate.values()]
      .filter((h) => h.date >= cutoff)
      .sort((x, y) => (x.date < y.date ? -1 : 1));

    const oursNewer = (o.latest?.date ?? '') >= (b.latest?.date ?? '');
    out.byQuery[q] = {
      ...b,
      first: earlierOf(b.first, o.first),
      history,
      latest: oursNewer ? o.latest : b.latest,
    };
  }
  out.updatedAt = laterOf(base.updatedAt, ours.updatedAt);
  return out;
}

async function main() {
  const [target, oursPath] = process.argv.slice(2);
  if (!target || !oursPath) {
    console.error('사용: node scripts/merge-data-store.mjs <원격파일> <우리결과>');
    process.exit(2);
  }

  const base = await readJson(target);
  const ours = await readJson(oursPath);

  let merged;
  let kind;
  if (base.snapshots || ours.snapshots) {
    kind = 'keyword-radar';
    merged = mergeRadar(base, ours);
  } else if (base.byQuery || ours.byQuery) {
    kind = 'naver-ranks';
    merged = mergeRanks(base, ours);
  } else {
    console.error('[merge] 알 수 없는 형태 — snapshots도 byQuery도 없다');
    process.exit(1);
  }

  await writeFile(target, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  const n =
    kind === 'keyword-radar'
      ? `스냅샷 ${merged.snapshots.length} / term ${Object.keys(merged.byTerm).length}`
      : `쿼리 ${Object.keys(merged.byQuery).length}`;
  console.log(`[merge] ${kind} 병합 완료 → ${target} (${n})`);
}

main().catch((e) => {
  console.error('[merge] 실패:', e.message);
  process.exit(1);
});
