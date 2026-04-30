#!/usr/bin/env node
/**
 * 오늘의 이슈 영구 포스트 생성 — Claude API + agents/seo-geo-news-poster.md
 *
 * 사용:
 *   npm run generate:issues
 *
 * 동작:
 *   1. agents/seo-geo-news-poster.md 를 system prompt 로 로드
 *   2. today-issue.json 의 trending Top N 을 순회
 *   3. 각 토픽에 대해:
 *      - 매칭 지원금 추출 (헤드라인 N-gram → _gov24/_curated 제목 매칭)
 *      - 매칭 페르소나 추출 (카테고리 매핑)
 *      - 후보 기사 5건
 *      - Claude API 호출 (claude-haiku-4-5)
 *      - JSON 파싱 → src/data/issues/[date]/[slug].json 저장
 *   4. _history.json 누적 갱신 (daysActive, totalCount)
 *
 * 환경변수:
 *   ANTHROPIC_API_KEY — Claude API 키
 *
 * PSI 호환: 빌드타임만. 런타임 API 호출 X.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AGENT_PATH = join(ROOT, 'agents', 'seo-geo-news-poster.md');
const TODAY_ISSUE_PATH = join(ROOT, 'src', 'data', 'today-issue.json');
const MANIFEST_PATH = join(ROOT, 'src', 'data', 'subsidies', '_gov24', '_manifest.json');
const CURATED_DIR = join(ROOT, 'src', 'data', 'subsidies', '_curated');
const GOV24_DIR = join(ROOT, 'src', 'data', 'subsidies', '_gov24');
const PERSONAS_PATH = join(ROOT, 'src', 'data', 'personas.json');
const ISSUES_OUT_DIR = join(ROOT, 'src', 'data', 'issues');
const HISTORY_PATH = join(ROOT, 'src', 'data', 'issues', '_history.json');

const TOP_N = 3; // 매일 상위 3개 트렌딩에 대해 포스트 생성
const MODEL = 'claude-sonnet-4-6'; // 한국어 정책 글의 자연스러움·뉘앙스 우선
const MAX_TOKENS = 4096;

// ─────────────────────────────────────────────────────────────
// .env 로드 (값 비노출)
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
// 카테고리 → 추천 페르소나 매핑
// ─────────────────────────────────────────────────────────────
const CAT_TO_PERSONAS = {
  주거: ['office-rookie', 'newlywed-family'],
  취업: ['office-rookie'],
  창업: ['self-employed', 'office-rookie'],
  교육: ['newlywed-family'],
  복지: ['low-income', 'senior'],
  자산: ['office-rookie', 'self-employed'],
  농업: ['farmer'],
};

// ─────────────────────────────────────────────────────────────
// 매칭 지원금 (헤드라인 N-gram → 우리 DB 제목 매칭)
// ─────────────────────────────────────────────────────────────
async function loadAllSubsidies() {
  const all = [];
  for (const dir of [CURATED_DIR, GOV24_DIR]) {
    try {
      const files = await readdir(dir);
      for (const f of files) {
        if (!f.endsWith('.json') || f.startsWith('_')) continue;
        try {
          const data = JSON.parse(await readFile(join(dir, f), 'utf8'));
          all.push(data);
        } catch {}
      }
    } catch {}
  }
  return all;
}

function matchSubsidies(headline, term, category, allSubsidies, limit = 6) {
  const text = `${headline} ${term}`;
  const scored = allSubsidies.map((s) => {
    let score = 0;
    // 제목 매칭
    if (s.title && term && s.title.includes(term)) score += 20;
    if (s.title && headline) {
      // 키워드 추출 (3자 이상 한글 토큰)
      const tokens = headline.match(/[가-힣]{3,}/g) || [];
      for (const t of tokens) {
        if (s.title.includes(t)) score += 5;
      }
    }
    // 태그 매칭
    if (Array.isArray(s.tags) && term) {
      for (const tag of s.tags) {
        if (tag.includes(term) || term.includes(tag)) score += 8;
      }
    }
    // 카테고리 매칭
    if (s.category === category) score += 3;
    return { s, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => ({
      id: x.s.id,
      title: x.s.title,
      agency: x.s.agency,
      summary: (x.s.summary ?? '').slice(0, 160),
      category: x.s.category,
    }));
}

async function loadPersonas() {
  try {
    return JSON.parse(await readFile(PERSONAS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// _history.json — 누적 트렌드 추적
// ─────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    return JSON.parse(await readFile(HISTORY_PATH, 'utf8'));
  } catch {
    return { byTerm: {} };
  }
}

async function saveHistory(history) {
  await mkdir(dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf8');
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateHistory(history, term, count, slug) {
  const today = todayDateStr();
  const entry = history.byTerm[term] ?? {
    firstSeen: today,
    lastSeen: today,
    totalCount: 0,
    daysActive: 0,
    dailyCounts: {},
    postSlug: slug,
  };
  if (entry.dailyCounts[today] === undefined) {
    entry.daysActive = (entry.daysActive ?? 0) + 1;
  }
  entry.dailyCounts[today] = count;
  entry.totalCount = Object.values(entry.dailyCounts).reduce((a, b) => a + b, 0);
  entry.lastSeen = today;
  entry.postSlug = entry.postSlug ?? slug;
  history.byTerm[term] = entry;
}

// ─────────────────────────────────────────────────────────────
// Claude API 호출
// ─────────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userPrompt, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Cycle #3 P0-8: prompt caching — system prompt(521줄, ~1400 토큰)을 ephemeral 캐시에 마킹
      // 일간 Top 3 토픽 처리 시 2~3회차는 cache_read (90% 절감) → 일 35% 토큰 절감
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    let body = await res.text().catch(() => '');
    body = body.replace(new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json.content?.[0]?.text;
  if (!content) throw new Error('Empty Claude response');
  // 캐시 통계 console 로그 (운영 모니터링 — _fail-{date}.json 옆 _cache-{date}.json 누적은 P1)
  const usage = json.usage ?? {};
  if (usage.cache_creation_input_tokens || usage.cache_read_input_tokens) {
    console.log(`[claude-cache] create=${usage.cache_creation_input_tokens ?? 0} read=${usage.cache_read_input_tokens ?? 0} input=${usage.input_tokens ?? 0} output=${usage.output_tokens ?? 0}`);
  }
  return content;
}

// ─────────────────────────────────────────────────────────────
// Fact-check 2단계 — sources 매칭 검증
//
// 생성된 포스트의 핵심 주장 (금액·날짜·기관·자격기준)이 입력 sourceArticles 텍스트
// 안에 등장하는지 검증. 환각 (출처 없는 주장) 차단.
//
// 검증 방식:
//   - 정수 금액 (만원·억원·% 등) 추출 → sources에 같은 숫자가 있는지
//   - YYYY·MM월 날짜 추출 → sources에 같은 패턴이 있는지
//   - 기관명 (~부·청·공단 등) → sources에 등장하는지
//   - 5개 미만 매칭이면 fail (Claude가 만든 숫자·날짜를 정당화할 출처 없음)
//
// 한계: 간접 표현·동의어는 매칭 못함. 보수적 판정 — false positive 허용.
// ─────────────────────────────────────────────────────────────
function extractClaims(post) {
  const text = [
    post.title ?? '',
    post.metaDescription ?? '',
    ...(post.tldr ?? []),
    ...(post.sections ?? []).map((s) => `${s.heading} ${s.lead} ${s.body}`),
    ...(post.faq ?? []).map((f) => `${f.q} ${f.a}`),
  ].join(' ');

  const claims = new Set();
  // 금액 (10만원, 1.5억원, 30%)
  const moneyMatches = text.matchAll(/\d[\d,.]*\s*(?:만원|억원|만|천|백|%|배)/g);
  for (const m of moneyMatches) claims.add(m[0].replace(/\s+/g, ''));
  // 날짜 (2026년, 5월, 5월 1일)
  const dateMatches = text.matchAll(/\d{4}년|\d{1,2}월\s*\d{1,2}일|\d{1,2}월/g);
  for (const m of dateMatches) claims.add(m[0].replace(/\s+/g, ''));
  // 기관 (~부·청·공단·공사)
  const orgMatches = text.matchAll(/[가-힣]{2,8}(?:부|청|공단|공사|진흥원)/g);
  for (const m of orgMatches) claims.add(m[0]);

  return [...claims];
}

function factCheck(post, sourceArticles) {
  const claims = extractClaims(post);
  if (claims.length === 0) return { passed: true, score: 1, unmatched: [] };

  const sourceText = sourceArticles
    .map((a) => `${a.title ?? ''} ${a.description ?? ''}`)
    .join(' ');

  const unmatched = [];
  let matched = 0;
  for (const claim of claims) {
    // 정확 일치 또는 핵심 숫자 일치
    if (sourceText.includes(claim)) {
      matched++;
    } else {
      // 숫자만 추출해 부분 매칭 시도
      const num = claim.match(/[\d,.]+/)?.[0];
      if (num && num.length >= 2 && sourceText.includes(num)) {
        matched++;
      } else {
        unmatched.push(claim);
      }
    }
  }

  const score = matched / claims.length;
  // 70% 이상 매칭이면 pass — 30%는 동의어·간접 표현 허용
  const passed = score >= 0.7;
  return { passed, score: Number(score.toFixed(2)), unmatched: unmatched.slice(0, 10), totalClaims: claims.length, matched };
}

function parseJsonFromResponse(text) {
  // 코드블록 fence 제거
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  // 첫 { 부터 마지막 } 까지 추출
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object in response');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ─────────────────────────────────────────────────────────────
// 슬러그 충돌 해결
// ─────────────────────────────────────────────────────────────
async function resolveSlug(date, slug) {
  const dateDir = join(ISSUES_OUT_DIR, date);
  const candidate = `${slug}.json`;
  if (!existsSync(join(dateDir, candidate))) return slug;
  // 충돌 시 숫자 suffix
  let i = 2;
  while (existsSync(join(dateDir, `${slug}-${i}.json`))) i++;
  return `${slug}-${i}`;
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────
async function main() {
  const env = await loadEnv();
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY 미설정 (.env.local 또는 환경변수)');
    process.exit(1);
  }
  console.log('🔑 Anthropic API 키 로드 완료');

  // 1. 입력 데이터 로드
  const systemPrompt = await readFile(AGENT_PATH, 'utf8');
  const todayIssue = JSON.parse(await readFile(TODAY_ISSUE_PATH, 'utf8'));
  const allSubsidies = await loadAllSubsidies();
  const personas = await loadPersonas();
  const history = await loadHistory();

  console.log(`📦 시스템 프롬프트 ${systemPrompt.length}자 / 지원금 ${allSubsidies.length}건 / 페르소나 ${personas.length}건`);

  const trending = todayIssue.trending ?? [];
  if (trending.length === 0) {
    console.error('❌ trending 비어 있음');
    process.exit(1);
  }

  const date = todayDateStr();
  await mkdir(join(ISSUES_OUT_DIR, date), { recursive: true });

  let success = 0;
  let failed = 0;
  const failures = [];
  // GitHub Actions 환경 감지 — annotation 출력
  const isCI = !!process.env.GITHUB_ACTIONS;

  // 2. Top N 토픽 순회
  for (const [idx, t] of trending.slice(0, TOP_N).entries()) {
    const term = t.term;
    const count = t.count;
    const topArticle = t.topArticle;
    const headline = topArticle?.title ?? term;
    const category = topArticle?.category ?? '복지';

    console.log(`\n[${idx + 1}/${TOP_N}] ${term} (${count}회) — ${headline.slice(0, 50)}...`);

    // 매칭 지원금
    const matchedSubsidies = matchSubsidies(headline, term, category, allSubsidies, 6);
    // 매칭 페르소나
    const personaIds = CAT_TO_PERSONAS[category] ?? ['office-rookie'];
    const matchedPersonas = personas.filter((p) => personaIds.includes(p.id));

    // 이력 정보 (이번 회차 update 전 상태로 daysActive 계산)
    const histEntry = history.byTerm[term];
    const daysActive = (histEntry?.daysActive ?? 0) + (histEntry?.dailyCounts?.[date] === undefined ? 1 : 0);
    const totalCount = (histEntry?.totalCount ?? 0) + count;

    // 다중 소스 종합 — Top 1 토픽이면 topTrendingArticles 전체 (10+건),
    // Top 2,3 토픽이면 topArticle + candidates 중 매칭 키워드 포함된 것
    let articlesForTopic;
    if (idx === 0 && Array.isArray(todayIssue.topTrendingArticles) && todayIssue.topTrendingArticles.length > 0) {
      articlesForTopic = todayIssue.topTrendingArticles;
    } else {
      const fromCandidates = (todayIssue.candidates ?? []).filter((c) => c.title?.includes(term));
      articlesForTopic = [topArticle, ...fromCandidates].filter(Boolean).slice(0, 8);
    }
    // Cycle #3 P0-7: 입력 캡 — N≤10 + JSON 직렬화 30KB 초과 시 뒤에서부터 잘라냄
    // (토큰·비용 폭주 + prompt injection 표면 동시 차단)
    articlesForTopic = articlesForTopic.slice(0, 10);
    while (articlesForTopic.length > 1 && JSON.stringify(articlesForTopic).length > 30000) {
      articlesForTopic.pop();
    }

    // 3. user prompt 빌드
    const userInput = {
      trendingTopic: {
        term,
        count,
        daysActive,
        totalCount,
        rankToday: idx + 1,
      },
      // ★ 1건이 아닌 N건 전체 — Claude가 다중 소스 종합 분석
      sourceArticles: articlesForTopic,
      sourceCount: articlesForTopic.length,
      matchedSubsidies,
      matchedPersonas,
      todayDate: date,
    };

    const userPrompt = `다음 입력 데이터로 오늘의 이슈 포스트를 작성하세요. 출력은 반드시 JSON 객체 1개로만, 다른 텍스트 없이.

입력:
\`\`\`json
${JSON.stringify(userInput, null, 2)}
\`\`\``;

    // 4. Claude 호출
    let post;
    try {
      const raw = await callClaude(systemPrompt, userPrompt, apiKey);
      post = parseJsonFromResponse(raw);
    } catch (e) {
      const reason = e?.message ?? String(e);
      console.warn(`⚠️ Claude 호출 실패: ${reason}`);
      if (isCI) {
        // GitHub Actions annotation — 워크플로 요약에 노출
        console.log(`::warning title=Claude 포스트 생성 실패::${term} (${idx + 1}/${TOP_N}): ${reason}`);
      }
      failures.push({
        rank: idx + 1,
        term,
        count,
        category,
        reason,
        at: new Date().toISOString(),
      });
      failed++;
      continue;
    }

    // 5. Fact-check — 환각 차단
    const fc = factCheck(post, articlesForTopic);
    if (!fc.passed) {
      console.warn(
        `⚠️ Fact-check 실패 (${term}): ${fc.matched}/${fc.totalClaims} 매칭 (score ${fc.score})`,
      );
      console.warn(`   미매칭 주장: ${fc.unmatched.slice(0, 5).join(', ')}`);
      if (isCI) {
        console.log(
          `::warning title=Fact-check 실패::${term} score=${fc.score} (matched ${fc.matched}/${fc.totalClaims})`,
        );
      }
      failures.push({
        rank: idx + 1,
        term,
        count,
        category,
        reason: `fact-check fail: ${fc.matched}/${fc.totalClaims} matched (score ${fc.score})`,
        unmatched: fc.unmatched,
        at: new Date().toISOString(),
      });
      // Cycle #4 P0-7: factCheckFails 누적 카운터 — OBSERVE phase에서 7일 추세 모니터링
      const today = new Date().toISOString().slice(0, 10);
      history.factCheckFails ??= {};
      history.factCheckFails[today] = (history.factCheckFails[today] ?? 0) + 1;
      failed++;
      continue;
    }
    console.log(`  ✓ Fact-check: ${fc.matched}/${fc.totalClaims} (${fc.score})`);

    // 6. 슬러그 충돌 해결
    if (!post.slug) post.slug = `issue-${idx + 1}`;
    const finalSlug = await resolveSlug(date, post.slug);
    post.slug = finalSlug;
    post.publishedAt = new Date().toISOString();
    post.date = date;
    // factCheck 점수도 메타에 저장 — 운영자 모니터링용
    post.factCheckScore = fc.score;

    // 7. 저장
    const outPath = join(ISSUES_OUT_DIR, date, `${finalSlug}.json`);
    await writeFile(outPath, JSON.stringify(post, null, 2) + '\n', 'utf8');
    console.log(`✅ ${outPath}`);

    // 8. 히스토리 갱신
    updateHistory(history, term, count, finalSlug);

    success++;
  }

  // 8. _history.json 저장
  await saveHistory(history);
  console.log(`\n📊 ${success} 성공 / ${failed} 실패 — 히스토리 갱신`);

  // 9. 실패 로그 — .fail.json (운영 모니터링용)
  if (failures.length > 0) {
    const failPath = join(ISSUES_OUT_DIR, date, `_fail-${date}.json`);
    await writeFile(
      failPath,
      JSON.stringify(
        {
          date,
          model: MODEL,
          attempted: TOP_N,
          succeeded: success,
          failed: failures.length,
          failures,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    console.log(`📝 실패 로그 저장: ${failPath}`);

    // CI 환경에서는 step summary에도 기록
    if (isCI && process.env.GITHUB_STEP_SUMMARY) {
      const lines = [
        `## ⚠️ 오늘의 이슈 포스트 생성: ${failures.length}건 실패`,
        '',
        `- 모델: \`${MODEL}\``,
        `- 성공: ${success} / 시도: ${TOP_N}`,
        '',
        '| 순위 | 토픽 | 사유 |',
        '|---|---|---|',
        ...failures.map((f) => `| ${f.rank} | ${f.term} | ${f.reason.replace(/\|/g, '\\|').slice(0, 120)} |`),
      ];
      try {
        const { appendFile } = await import('node:fs/promises');
        await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
      } catch {}
    }
  }

  // 0건 성공이면 exit code 1 — CI 명시 실패
  if (success === 0 && failed > 0) {
    console.error('💥 모든 포스트 생성 실패');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('💥', e?.message ?? e);
  process.exit(1);
});
