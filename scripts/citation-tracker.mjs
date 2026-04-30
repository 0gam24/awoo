#!/usr/bin/env node

/**
 * AI 답변 엔진 인용 점유율 측정 — Perplexity API 기반.
 *
 * 50개 정부 지원금 핵심 쿼리에 대해 답변을 받고, 본 사이트 (awoo.or.kr) 도메인이
 * sources에 포함됐는지 측정.
 *
 * 환경변수:
 *   PERPLEXITY_API_KEY — Perplexity API 키 (https://docs.perplexity.ai/)
 *
 * 출력:
 *   src/data/citations/_summary.json — 누적 시계열 (주별 인용률)
 *   src/data/citations/[YYYY-MM-DD].json — 회차별 상세
 *
 * Cron 권장: 주 1회 (Sunday 23:00 UTC = 월요일 08:00 KST)
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'src', 'data', 'citations');
const SUMMARY_PATH = join(OUT_DIR, '_summary.json');

const HOST = 'awoo.or.kr';
const MODEL = 'sonar'; // Perplexity 기본 sonar 또는 sonar-pro
const PER_QUERY_DELAY_MS = 1500; // rate limit 보호 (Perplexity ~600 req/min)

// ─────────────────────────────────────────────────────────────
// 50개 측정 쿼리 — 정부 지원금 의도 망라
// ─────────────────────────────────────────────────────────────
const QUERIES = [
  // 청년 (10)
  '청년 월세 지원금 자격',
  '청년도약계좌 가입 조건',
  '청년 월세 특별지원 신청 방법',
  '청년내일저축계좌 자격',
  '청년 주거 지원 정책',
  '청년 취업 지원금 종류',
  '국민취업지원제도 1유형 자격',
  '청년 창업 지원금',
  '예비창업패키지 신청',
  '청년창업사관학교 모집 일정',
  // 신혼·육아 (10)
  '신혼부부 특별공급 자격',
  '신혼부부 전세대출 지원',
  '부모급여 0세 100만원 신청',
  '아동수당 신청 방법',
  '첫만남이용권 200만원',
  '출산 지원금 종합',
  '난임부부 시술비 지원',
  '맞벌이 가구 보육비 지원',
  '다자녀 가구 혜택',
  '다둥이 출산 정책',
  // 저소득·복지 (10)
  '기초생활수급자 자격',
  '생계급여 지급액',
  '주거급여 신청',
  '의료급여 1종 2종',
  '차상위계층 혜택',
  '한부모가족 지원금',
  '장애인 활동지원',
  '에너지바우처 신청',
  '재난적 의료비 지원',
  '저소득층 통신비 감면',
  // 중장년·시니어 (5)
  '기초연금 자격 65세',
  '노인 일자리 지원',
  '중장년 재취업 지원금',
  '폐업 자영업자 지원',
  '실업급여 지급액 계산',
  // 교육·자산 (5)
  '국가장학금 신청 자격',
  '학자금 대출 무이자',
  '평생교육바우처 35만원',
  '근로장려금 신청',
  '자녀장려금 자격',
  // 농업·기타 (5)
  '청년농업인 영농정착지원',
  '귀농 지원금 자격',
  '농업창업 자금 융자',
  '소상공인 정책자금',
  '재난 피해 지원금 신청',
  // 보편 (5)
  '2026년 정부 지원금 종합',
  '내가 받을 수 있는 지원금 진단',
  '신혼 출산 청년 지원금 차이',
  '중위소득 기준 자격',
  '기준 중위소득 60% 70%',
];

// ─────────────────────────────────────────────────────────────
// .env 로드
// ─────────────────────────────────────────────────────────────
async function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    try {
      const text = await readFile(join(ROOT, file), 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
      }
    } catch {}
  }
  return env;
}

// ─────────────────────────────────────────────────────────────
// Perplexity API 호출
// ─────────────────────────────────────────────────────────────
async function askPerplexity(query, apiKey) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: `${query}\n\n한국어로 간결히 답변. 출처 url 명시.`,
        },
      ],
      // citation 포함 — sonar 기본 동작
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Perplexity ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  // Perplexity 응답에서 citations 추출 (sonar는 citations 배열 제공)
  const citations = json.citations ?? [];
  const content = json.choices?.[0]?.message?.content ?? '';

  return {
    citations,
    content,
    usage: json.usage,
  };
}

function isOurDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname === HOST || u.hostname === `www.${HOST}`;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  const env = await loadEnv();
  const apiKey = env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.error('❌ PERPLEXITY_API_KEY 미설정 (.env.local 또는 GH secret)');
    console.error('   docs/ops/AI-CITATION.md 참조');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const results = [];
  let cited = 0;
  let failed = 0;

  console.log(`[citation] ${QUERIES.length}개 쿼리 측정 시작 (model: ${MODEL})`);

  for (const [i, query] of QUERIES.entries()) {
    process.stdout.write(`  [${i + 1}/${QUERIES.length}] ${query.slice(0, 30)}…`);
    try {
      const { citations, content } = await askPerplexity(query, apiKey);
      const ourCitation = citations.find((c) => isOurDomain(c));
      const isCited = !!ourCitation;
      if (isCited) cited++;
      results.push({
        query,
        cited: isCited,
        ourUrl: ourCitation ?? null,
        sourcesCount: citations.length,
        contentLen: content.length,
      });
      console.log(isCited ? ' ✓' : ' ✗');
    } catch (e) {
      failed++;
      results.push({
        query,
        cited: false,
        error: e?.message?.slice(0, 100) ?? 'unknown',
      });
      console.log(` 💥 ${e?.message?.slice(0, 50)}`);
    }
    if (i < QUERIES.length - 1) {
      await new Promise((r) => setTimeout(r, PER_QUERY_DELAY_MS));
    }
  }

  const total = QUERIES.length - failed;
  const rate = total > 0 ? cited / total : 0;

  console.log('');
  console.log(`[citation] 인용 ${cited} / 측정 ${total} / 실패 ${failed}`);
  console.log(`[citation] 인용률: ${(rate * 100).toFixed(1)}%`);

  // 회차별 상세 저장
  await writeFile(
    join(OUT_DIR, `${today}.json`),
    JSON.stringify({ date: today, model: MODEL, cited, total, failed, rate, results }, null, 2) +
      '\n',
    'utf-8',
  );

  // 누적 summary
  let summary = { runs: [] };
  if (existsSync(SUMMARY_PATH)) {
    try {
      summary = JSON.parse(await readFile(SUMMARY_PATH, 'utf-8'));
    } catch {}
  }
  summary.runs.push({ date: today, cited, total, failed, rate });
  // 최근 52주 (1년) 한정
  if (summary.runs.length > 52) summary.runs = summary.runs.slice(-52);
  summary.lastRun = today;
  summary.latestRate = rate;
  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');

  // CI step summary
  if (process.env.GITHUB_STEP_SUMMARY) {
    const recentRuns = summary.runs.slice(-5);
    const lines = [
      `## 📊 AI Citation 측정 — ${today}`,
      '',
      `- 인용률: **${(rate * 100).toFixed(1)}%** (${cited}/${total})`,
      `- 모델: \`${MODEL}\``,
      `- 실패: ${failed}건`,
      '',
      '### 최근 5회 추이',
      '',
      '| 날짜 | 인용률 | cited/total |',
      '|---|---:|---:|',
      ...recentRuns.map(
        (r) => `| ${r.date} | ${(r.rate * 100).toFixed(1)}% | ${r.cited}/${r.total} |`,
      ),
      '',
      '### 인용된 쿼리 (Top 10)',
      '',
      ...results
        .filter((r) => r.cited)
        .slice(0, 10)
        .map((r) => `- \`${r.query}\` → ${r.ourUrl}`),
    ];
    try {
      const { appendFile } = await import('node:fs/promises');
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
    } catch {}
  }
}

main().catch((e) => {
  console.error('💥', e?.message ?? e);
  process.exit(1);
});
