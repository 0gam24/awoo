#!/usr/bin/env node
/**
 * fact-checker LITE — awoo 환각 자동 차단 게이트 (Cycle #84).
 *
 * 매일 02:00 KST .github/workflows/fact-check.yml 자동 실행:
 *   1. 직전 24h 발행된 영구 포스트(JSON) + flagship 가이드(MD) 수집
 *   2. 정적 분석으로 환각 위험 분류 (low / medium / high)
 *      - sources[] 누락 / 빈 배열 → high
 *      - factCheckScore < 0.6 (Claude generator self-eval) → high
 *      - 본문 publisher 인용 빈도 < 출처 수의 1/2 → medium
 *      - 추정 표현(약·추정·통상 + 정확 수치) 감지 → medium
 *      - 그 외 → low
 *   3. fact-check-queue/{KST date}.json 저장
 *   4. high-risk > 0 → exit 1 (workflow fail → 운영자 alert)
 *
 * AI 호출 X — 정적 분석 only (LITE 패턴, 메인 Layer 4 복제).
 *
 * 콘텐츠 자동 수정 X — audit 만, 정정은 운영자.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const QUEUE_DIR = resolve(REPO_ROOT, 'fact-check-queue');
mkdirSync(QUEUE_DIR, { recursive: true });

// awoo 콘텐츠 경로 — JSON(영구 이슈 포스트) + MD(flagship 가이드)
const CONTENT_DIRS = [
  { path: 'src/data/issues', kind: 'json' }, // /{date}/{slug}.json
  { path: 'src/content/guides', kind: 'md' }, // /{slug}.md (현재 0편)
];

// KST 기준 오늘 / 24h 윈도우
const NOW_MS = Date.now();
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const kstNow = new Date(NOW_MS + KST_OFFSET_MS);
const todayKst = kstNow.toISOString().slice(0, 10); // YYYY-MM-DD
const windowStartMs = NOW_MS - 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────
// 콘텐츠 수집
// ─────────────────────────────────────────────────────────

function walkDir(rootPath) {
  const out = [];
  if (!existsSync(rootPath)) return out;
  const stack = [rootPath];
  while (stack.length) {
    const cur = stack.pop();
    const entries = readdirSync(cur, { withFileTypes: true });
    for (const ent of entries) {
      const full = join(cur, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }
  return out;
}

function collectIssuePosts() {
  const items = [];
  const root = resolve(REPO_ROOT, 'src/data/issues');
  if (!existsSync(root)) return items;
  for (const file of walkDir(root)) {
    if (!file.endsWith('.json')) continue;
    const base = file.split(/[\\/]/).pop();
    if (base.startsWith('_')) continue; // _fail-*, _history, _cache-* 제외
    if (base === '_history.json') continue;
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      console.warn(
        `[fact-check] JSON parse 실패 skip: ${relative(REPO_ROOT, file)} (${err.message})`,
      );
      continue;
    }
    const publishedAtIso = data.publishedAt;
    if (!publishedAtIso) continue;
    const publishedMs = Date.parse(publishedAtIso);
    if (Number.isNaN(publishedMs)) continue;
    if (publishedMs < windowStartMs) continue; // 24h 윈도우 밖
    items.push({ path: file, kind: 'issue-json', data, publishedAt: publishedAtIso });
  }
  return items;
}

function collectFlagshipGuides() {
  const items = [];
  const root = resolve(REPO_ROOT, 'src/content/guides');
  if (!existsSync(root)) return items;
  for (const file of walkDir(root)) {
    if (!file.endsWith('.md')) continue;
    const base = file.split(/[\\/]/).pop();
    if (base.startsWith('_')) continue; // _template.md, _draft 제외
    const raw = readFileSync(file, 'utf8');
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];
    const body = fmMatch[2];
    const publishedAt = fm.match(/^publishedAt:\s*['"]?([^'"\n]+)['"]?\s*$/m)?.[1]?.trim() ?? null;
    if (!publishedAt) continue;
    const publishedMs = Date.parse(`${publishedAt}T00:00:00+09:00`);
    if (Number.isNaN(publishedMs)) continue;
    if (publishedMs < windowStartMs) continue;
    items.push({ path: file, kind: 'guide-md', frontmatter: fm, body, publishedAt });
  }
  return items;
}

// ─────────────────────────────────────────────────────────
// audit — JSON 영구 이슈 포스트
// ─────────────────────────────────────────────────────────

function buildIssueFullText(data) {
  const parts = [];
  if (Array.isArray(data.tldr)) parts.push(...data.tldr);
  if (data.metaDescription) parts.push(data.metaDescription);
  if (data.coreFacts) {
    parts.push(
      data.coreFacts.who,
      data.coreFacts.amount,
      data.coreFacts.deadline,
      data.coreFacts.where,
    );
  }
  if (Array.isArray(data.sections)) {
    for (const s of data.sections) {
      parts.push(s.heading, s.lead, s.body);
    }
  }
  if (Array.isArray(data.faq)) {
    for (const f of data.faq) parts.push(f.q, f.a);
  }
  return parts.filter(Boolean).join('\n');
}

function auditIssue(item) {
  const findings = {
    path: relative(REPO_ROOT, item.path).replaceAll('\\', '/'),
    kind: item.kind,
    publishedAt: item.publishedAt,
    riskLevel: 'low',
    issues: [],
    metrics: {
      sourcesCount: 0,
      claimsCount: 0,
      publisherMentionCount: 0,
      factCheckScore: null,
      sourceConfidence: null,
    },
  };

  const data = item.data;
  const sources = Array.isArray(data.sources) ? data.sources : [];
  findings.metrics.sourcesCount = sources.length;

  // sources 누락 → high
  if (sources.length === 0) {
    findings.riskLevel = 'high';
    findings.issues.push('sources 누락');
    return findings;
  }
  // 각 source의 url/publisher 검증
  const invalidSources = sources.filter((s) => !s?.url || !s?.publisher);
  if (invalidSources.length > 0) {
    findings.riskLevel = 'high';
    findings.issues.push(`sources ${invalidSources.length}건 url/publisher 누락`);
  }

  // factCheckScore — Claude self-eval (Cycle #23 P0-3 도입)
  const fcs = typeof data.factCheckScore === 'number' ? data.factCheckScore : null;
  findings.metrics.factCheckScore = fcs;
  if (fcs !== null && fcs < 0.6) {
    findings.riskLevel = 'high';
    findings.issues.push(`factCheckScore=${fcs.toFixed(2)} < 0.6`);
  } else if (fcs !== null && fcs < 0.8 && findings.riskLevel === 'low') {
    findings.riskLevel = 'medium';
    findings.issues.push(`factCheckScore=${fcs.toFixed(2)} < 0.8`);
  }

  // sourceConfidence (Cycle #70)
  const sc = typeof data.sourceConfidence === 'string' ? data.sourceConfidence : null;
  findings.metrics.sourceConfidence = sc;
  if (sc === 'low' && findings.riskLevel === 'low') {
    findings.riskLevel = 'medium';
    findings.issues.push('sourceConfidence=low');
  }

  const fullText = buildIssueFullText(data);

  // 수치 claims 추출 — 한국어 패턴 (만원·억원·원·%·명·건·일·개월·년·억)
  const numericClaims =
    fullText.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:만원|억원|원|%|명|건|일|개월|년|억|호)/g) ??
    [];
  findings.metrics.claimsCount = numericClaims.length;

  // publisher 인용 빈도 — 본문에 sources[].publisher 가 몇 번 등장하는지
  const publishers = Array.from(new Set(sources.map((s) => s.publisher).filter(Boolean)));
  let publisherMentions = 0;
  for (const p of publishers) {
    const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    publisherMentions += (fullText.match(re) ?? []).length;
  }
  findings.metrics.publisherMentionCount = publisherMentions;

  // 본문 publisher 인용 < 출처의 절반 → medium (출처 페어링 부족)
  if (publishers.length >= 2 && publisherMentions < Math.ceil(publishers.length / 2)) {
    if (findings.riskLevel === 'low') findings.riskLevel = 'medium';
    findings.issues.push(
      `publisher 인용 ${publisherMentions}회 / 출처 ${publishers.length}매체 — 페어링 부족`,
    );
  }

  // 환각 의심 키워드 — "약/추정/통상 + 정확 수치"
  const suspiciousMatches = [/(?:약|추정|통상)\s*\d+(?:[.,]\d+)?\s*(?:%|만원|억원|원|명|건)/g];
  for (const re of suspiciousMatches) {
    const hits = fullText.match(re) ?? [];
    if (hits.length > 0) {
      if (findings.riskLevel === 'low') findings.riskLevel = 'medium';
      findings.issues.push(`추정 표현 ${hits.length}건: ${hits.slice(0, 2).join(', ')}`);
    }
  }

  // vague claims — "확인 필요" 등 broad claims (audit-specificity와 동일 패턴)
  const vague = (fullText.match(/(?:확인\s*필요|문의\s*요망|공식\s*공고\s*참조)/g) ?? []).length;
  if (vague >= 5) {
    if (findings.riskLevel === 'low') findings.riskLevel = 'medium';
    findings.issues.push(`vague 표현 ${vague}건 (확인 필요/문의 요망)`);
  }

  return findings;
}

// ─────────────────────────────────────────────────────────
// audit — flagship 가이드 (markdown frontmatter)
// ─────────────────────────────────────────────────────────

function auditGuide(item) {
  const findings = {
    path: relative(REPO_ROOT, item.path).replaceAll('\\', '/'),
    kind: item.kind,
    publishedAt: item.publishedAt,
    riskLevel: 'low',
    issues: [],
    metrics: {
      sourcesCount: 0,
      claimsCount: 0,
      footnoteCount: 0,
    },
  };

  const body = item.body;

  // sources frontmatter — guide schema에는 sources 필드 없음. 본문 hyperlink 카운트
  // (정부 공식 사이트로 연결되면 OK 신호)
  const govLinks =
    body.match(
      /\[[^\]]+\]\((https?:\/\/[^)\s]*?(?:bokjiro|gov\.kr|gov24|hf\.go\.kr|moel|moef|molit|mohw)[^)\s]*?)\)/gi,
    ) ?? [];
  findings.metrics.sourcesCount = govLinks.length;

  if (govLinks.length === 0) {
    findings.riskLevel = 'high';
    findings.issues.push('정부 공식 사이트 링크 0개 — 1차 출처 부재');
    return findings;
  }

  // 수치 claims
  const numericClaims =
    body.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:만원|억원|원|%|명|건|일|개월|년|억|호)/g) ?? [];
  findings.metrics.claimsCount = numericClaims.length;

  // footnote 마커 [^N]
  const footnotes = body.match(/\[\^[a-zA-Z0-9_-]+\]/g) ?? [];
  findings.metrics.footnoteCount = footnotes.length;

  // claims는 많은데 footnote 0건 → medium (출처 페어링 부족)
  if (numericClaims.length >= 5 && footnotes.length === 0) {
    findings.riskLevel = 'medium';
    findings.issues.push(`수치 ${numericClaims.length}건 / footnote 0개 — 페어링 부족`);
  }

  // 추정 표현
  const suspicious = body.match(/(?:약|추정|통상)\s*\d+(?:[.,]\d+)?\s*(?:%|만원|억원|원)/g) ?? [];
  if (suspicious.length > 0) {
    if (findings.riskLevel === 'low') findings.riskLevel = 'medium';
    findings.issues.push(`추정 표현 ${suspicious.length}건`);
  }

  return findings;
}

// ─────────────────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────────────────

const issuePosts = collectIssuePosts();
const guides = collectFlagshipGuides();
const total = issuePosts.length + guides.length;

console.log(`[fact-check] KST ${todayKst} — 직전 24h 발행 콘텐츠 ${total}건`);
console.log(`  · 영구 이슈 포스트(JSON): ${issuePosts.length}건`);
console.log(`  · flagship 가이드(MD):    ${guides.length}건`);

const audited = [...issuePosts.map(auditIssue), ...guides.map(auditGuide)];

const summary = {
  date: todayKst,
  ranAt: new Date().toISOString(),
  windowHours: 24,
  totalAudited: audited.length,
  low: audited.filter((a) => a.riskLevel === 'low').length,
  medium: audited.filter((a) => a.riskLevel === 'medium').length,
  high: audited.filter((a) => a.riskLevel === 'high').length,
  contentDirs: CONTENT_DIRS.map((d) => d.path),
  audited,
};

const outPath = join(QUEUE_DIR, `${todayKst}.json`);
writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`[fact-check] ${relative(REPO_ROOT, outPath).replaceAll('\\', '/')}`);
console.log(`  · low=${summary.low}  medium=${summary.medium}  high=${summary.high}`);

// GitHub Actions step summary (CI 컨텍스트만)
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## fact-check LITE 결과',
    '',
    `- KST: **${todayKst}**`,
    `- 직전 24h 콘텐츠: **${audited.length}건**`,
    `- low / medium / **high**: ${summary.low} / ${summary.medium} / **${summary.high}**`,
    '',
  ];
  if (summary.high > 0) {
    lines.push('### 🚨 HIGH-RISK 발견 (운영자 1시간 내 검토)');
    for (const a of audited.filter((x) => x.riskLevel === 'high')) {
      lines.push(`- \`${a.path}\` — ${a.issues.join(', ')}`);
    }
    lines.push('');
  }
  if (summary.medium > 0) {
    lines.push('### ⚠️ MEDIUM');
    for (const a of audited.filter((x) => x.riskLevel === 'medium')) {
      lines.push(`- \`${a.path}\` — ${a.issues.join(', ')}`);
    }
  }
  try {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  } catch {
    // best-effort
  }
}

// high-risk 발견 시 workflow fail → 운영자 alert
if (summary.high > 0) {
  console.error(`\n🚨 HIGH-RISK ${summary.high}건 발견 — 운영자 즉시 검토 필요`);
  for (const a of audited.filter((x) => x.riskLevel === 'high')) {
    console.error(`  · ${a.path}`);
    for (const issue of a.issues) console.error(`    - ${issue}`);
  }
  process.exit(1);
}

process.exit(0);
