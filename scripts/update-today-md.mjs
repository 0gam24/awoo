#!/usr/bin/env node
/**
 * update-today-md.mjs — 일일 사이트 변경 사항을 today.md에 누적 기록.
 *
 * 매일 06:00 KST sync-issues.yml cron의 generate:issues 직후 실행.
 * 운영자/메인 HQ가 "최근 N일 동안 awoo에 무엇이 새로 올라왔는가"를 한 눈에 파악.
 *
 * 동작 방식:
 *   - 매 실행마다 데이터를 풀스캔하여 `today.md` 전체 재구성 (idempotent)
 *   - 영구 이슈 포스트: publishedAt 기준 날짜별 bucket
 *   - 신규 지원금: gov24 manifest의 regDate 기준 (아카이브 제외)
 *   - 갱신 지원금: modDate 기준 (regDate와 다른 경우 = 실제 갱신)
 *   - 최근 30일만 유지 (이전 기록은 git history)
 *
 * 출력: ./today.md (최신 날짜가 최상단, desc 정렬)
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { issueUrlPath } from '../src/lib/issue-url.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DOMAIN = 'https://awoo.or.kr';
const OUT_PATH = join(REPO_ROOT, 'today.md');
const RETENTION_DAYS = 30;

// KST 기준 오늘 (cron이 UTC라 명시 변환 필수)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const kstNow = new Date(Date.now() + KST_OFFSET_MS);
const todayKst = kstNow.toISOString().slice(0, 10); // YYYY-MM-DD

// retention cutoff (KST 기준)
const cutoffMs = Date.now() + KST_OFFSET_MS - RETENTION_DAYS * 24 * 60 * 60 * 1000;
const cutoffKst = new Date(cutoffMs).toISOString().slice(0, 10);

function truncate(str, max = 140) {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// "20260508142345" → "2026-05-08" (KST 가정 — manifest는 KST 시각 그대로 저장)
function manifestDateToIso(raw) {
  if (typeof raw !== 'string' || raw.length < 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

// "2026-05-08T03:00:00.000Z" → "2026-05-08" (KST 변환)
function publishedAtToKstDate(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────
// 1. 영구 이슈 포스트 — 최근 30일치 publishedAt 기준 bucket
// ─────────────────────────────────────────────────────────

function collectIssuesBucketed() {
  const byDate = new Map(); // "YYYY-MM-DD" → [issue, ...]
  const root = join(REPO_ROOT, 'src/data/issues');
  if (!existsSync(root)) return byDate;
  for (const dateDir of readdirSync(root)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir)) continue;
    const dayPath = join(root, dateDir);
    for (const name of readdirSync(dayPath)) {
      if (!name.endsWith('.json')) continue;
      if (name.startsWith('_')) continue;
      const data = readJson(join(dayPath, name));
      if (!data?.slug) continue;
      // KST 기준 발행일 — publishedAt 우선, 없으면 디렉토리 이름
      const kstDate = publishedAtToKstDate(data.publishedAt) ?? dateDir;
      if (kstDate < cutoffKst) continue;
      if (!byDate.has(kstDate)) byDate.set(kstDate, []);
      byDate.get(kstDate).push({
        title: data.title ?? data.slug,
        url: `${DOMAIN}${issueUrlPath(dateDir, data.slug)}`,
        summary: truncate(data.metaDescription ?? data.tldr?.[0] ?? ''),
        category: data.category ?? '',
      });
    }
  }
  return byDate;
}

// ─────────────────────────────────────────────────────────
// 2. 지원금 — manifest의 regDate / modDate 기준 bucket
// ─────────────────────────────────────────────────────────

function collectSubsidiesBucketed() {
  const newByDate = new Map();
  const updatedByDate = new Map();
  const manifest = readJson(join(REPO_ROOT, 'src/data/subsidies/_gov24/_manifest.json'));
  if (!manifest?.items) return { newByDate, updatedByDate };

  for (const entry of Object.values(manifest.items)) {
    if (!entry?.slug) continue;
    if (entry.archivedAt) continue;
    const regKst = manifestDateToIso(entry.regDate);
    const modKst = manifestDateToIso(entry.modDate);

    const detail = readJson(join(REPO_ROOT, 'src/data/subsidies/_gov24', `${entry.slug}.json`));
    if (!detail) continue;
    const item = {
      title: detail.title ?? entry.slug,
      url: `${DOMAIN}/subsidies/${entry.slug}/`,
      summary: truncate(detail.summary ?? ''),
      agency: detail.agency ?? '',
      deadline: detail.deadline ?? '',
    };

    if (regKst && regKst >= cutoffKst) {
      if (!newByDate.has(regKst)) newByDate.set(regKst, []);
      newByDate.get(regKst).push(item);
    }
    // modDate가 regDate와 다른 경우만 "갱신"으로 카운트 (등록 당일 modDate 동일값은 노이즈)
    if (modKst && modKst >= cutoffKst && modKst !== regKst) {
      if (!updatedByDate.has(modKst)) updatedByDate.set(modKst, []);
      updatedByDate.get(modKst).push(item);
    }
  }
  return { newByDate, updatedByDate };
}

// ─────────────────────────────────────────────────────────
// 섹션 빌더
// ─────────────────────────────────────────────────────────

function buildSection(date, issues, newSubs, updatedSubs) {
  const lines = [`## ${date}${date === todayKst ? ' (오늘)' : ''}`];
  lines.push('');

  const total = issues.length + newSubs.length + updatedSubs.length;
  if (total === 0) {
    lines.push('_신규/갱신 콘텐츠 없음._');
    lines.push('');
    return lines.join('\n').trimEnd();
  }

  if (issues.length > 0) {
    lines.push(`### 📰 신규 이슈 포스트 (${issues.length}건)`);
    for (const it of issues) {
      const cat = it.category ? `\`${it.category}\` ` : '';
      lines.push(`- ${cat}[${it.title}](${it.url})`);
      if (it.summary) lines.push(`  - ${it.summary}`);
    }
    lines.push('');
  }

  if (newSubs.length > 0) {
    lines.push(`### 🆕 신규 지원금 (${newSubs.length}건)`);
    for (const it of newSubs) {
      lines.push(`- [${it.title}](${it.url}) — ${it.agency}`);
      if (it.summary) lines.push(`  - ${it.summary}`);
      if (it.deadline) lines.push(`  - 마감: ${it.deadline}`);
    }
    lines.push('');
  }

  if (updatedSubs.length > 0) {
    lines.push(`### ✏️ 갱신된 지원금 (${updatedSubs.length}건)`);
    for (const it of updatedSubs) {
      lines.push(`- [${it.title}](${it.url}) — ${it.agency}`);
      if (it.summary) lines.push(`  - ${it.summary}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

// ─────────────────────────────────────────────────────────
// 실행 — 모든 데이터 풀스캔 → today.md 전체 재생성
// ─────────────────────────────────────────────────────────

const issuesByDate = collectIssuesBucketed();
const { newByDate, updatedByDate } = collectSubsidiesBucketed();

// 모든 날짜 union (오늘은 콘텐츠 없어도 표시)
const allDates = new Set([
  todayKst,
  ...issuesByDate.keys(),
  ...newByDate.keys(),
  ...updatedByDate.keys(),
]);
const sortedDates = Array.from(allDates)
  .filter((d) => d >= cutoffKst)
  .sort((a, b) => (a < b ? 1 : -1));

const sections = sortedDates.map((d) =>
  buildSection(d, issuesByDate.get(d) ?? [], newByDate.get(d) ?? [], updatedByDate.get(d) ?? []),
);

const header = `# Today — awoo.or.kr 일일 변경 로그

> 매일 06:00 KST \`sync-issues\` cron 직후 \`scripts/update-today-md.mjs\` 자동 실행.
> 최근 ${RETENTION_DAYS}일치 누적. 더 오래된 기록은 git history 참조.
> 마지막 갱신: ${kstNow.toISOString().replace('T', ' ').slice(0, 16)} KST
`;

writeFileSync(OUT_PATH, `${header}\n${sections.join('\n\n')}\n`, 'utf8');

const totalChanges = sortedDates.reduce((sum, d) => {
  return (
    sum +
    (issuesByDate.get(d)?.length ?? 0) +
    (newByDate.get(d)?.length ?? 0) +
    (updatedByDate.get(d)?.length ?? 0)
  );
}, 0);

console.log(
  `[today-md] ./today.md 갱신 — ${sortedDates.length}일치, 총 ${totalChanges}건 변경 (issue + subsidy reg/mod, 최근 ${RETENTION_DAYS}일)`,
);
