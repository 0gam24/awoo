#!/usr/bin/env node
// sync-history.mjs — 트렌딩 term → 영구 포스트 매핑(postSlug/postDate)을 발행 포스트에서 자동 derive.
//
// 진실 소스 = 각 포스트의 freshness.trendingTerm. 운영자가 _history.json 을 손으로 고칠 필요 제거.
//
// 소유권 분리(중요):
//   - 이 스크립트는 byTerm[term] 의 postSlug/postDate 만 갱신.
//   - 카운트(totalCount/daysActive/dailyCounts/firstSeen/lastSeen 등)는 sync-issues 소유 → 건드리지 않음.
//   - 매칭 포스트가 없는 term 은 기존 매핑 보존(레거시 자동발행 엔트리 호환).
//   - byTerm 에 없는 term 은 새로 만들지 않음(엔트리 생성은 sync-issues 카운트 파이프라인 소유).
//
// 동일 term 후보 선택 규칙: 최신 date 우선 → 같은 날이면 freshness.trendingPrimary=true 우선 → publishedAt 늦은 순.
// 실행 순서(워크플로): sync:issues(카운트) → sync:history(매핑) → lint:content(무결성 게이트).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ISSUES_DIR = path.join(ROOT, 'src/data/issues');
const HISTORY_PATH = path.join(ISSUES_DIR, '_history.json');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

// 발행 포스트 전수 스캔 → freshness.trendingTerm 별 후보 수집
function collectPostsByTerm() {
  const byTerm = {};
  if (!existsSync(ISSUES_DIR)) return byTerm;
  for (const dateDir of readdirSync(ISSUES_DIR, { withFileTypes: true })) {
    if (!dateDir.isDirectory()) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir.name)) continue;
    const dir = path.join(ISSUES_DIR, dateDir.name);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      let data;
      try {
        data = readJson(path.join(dir, f));
      } catch {
        continue;
      }
      const term = data?.freshness?.trendingTerm;
      if (!term) continue;
      const slug = data.slug ?? f.replace(/\.json$/, '');
      const date = data.date ?? dateDir.name;
      if (!byTerm[term]) byTerm[term] = [];
      byTerm[term].push({
        slug,
        date,
        publishedAt: data.publishedAt ?? `${date}T00:00:00.000Z`,
        primary: data.freshness?.trendingPrimary === true,
      });
    }
  }
  return byTerm;
}

function pickTarget(cands) {
  return [...cands].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1; // 최신 date 우선
    if (a.primary !== b.primary) return a.primary ? -1 : 1; // primary 우선
    return a.publishedAt < b.publishedAt ? 1 : -1; // publishedAt 늦은 순
  })[0];
}

const history = existsSync(HISTORY_PATH) ? readJson(HISTORY_PATH) : { byTerm: {} };
history.byTerm ??= {};
const postsByTerm = collectPostsByTerm();

const changes = [];
for (const [term, entry] of Object.entries(history.byTerm)) {
  const cands = postsByTerm[term];
  if (!cands || cands.length === 0) continue; // 매칭 포스트 없음 → 기존 매핑 보존
  const t = pickTarget(cands);
  const prevSlug = entry.postSlug ?? '(none)';
  const prevDate = entry.postDate ?? entry.firstSeen ?? '?';
  if (entry.postSlug !== t.slug || entry.postDate !== t.date) {
    changes.push(`${term}: ${prevSlug}@${prevDate} → ${t.slug}@${t.date}`);
  }
  entry.postSlug = t.slug;
  entry.postDate = t.date;
}

writeFileSync(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`, 'utf8');

const taggedPosts = Object.values(postsByTerm).reduce((n, a) => n + a.length, 0);
if (changes.length) {
  console.log(`[sync-history] ${changes.length}개 term 매핑 갱신:`);
  for (const c of changes) console.log(`  • ${c}`);
} else {
  console.log('[sync-history] 변경 없음 (매핑 최신).');
}
console.log(
  `[sync-history] freshness.trendingTerm 보유 포스트 ${taggedPosts}건 / byTerm ${Object.keys(history.byTerm).length}개 term`,
);
