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

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AGENT_PATH = join(ROOT, 'agents', 'seo-geo-news-poster.md');
const TODAY_ISSUE_PATH = join(ROOT, 'src', 'data', 'today-issue.json');
const _MANIFEST_PATH = join(ROOT, 'src', 'data', 'subsidies', '_gov24', '_manifest.json');
const CURATED_DIR = join(ROOT, 'src', 'data', 'subsidies', '_curated');
const GOV24_DIR = join(ROOT, 'src', 'data', 'subsidies', '_gov24');
const PERSONAS_PATH = join(ROOT, 'src', 'data', 'personas.json');
const ISSUES_OUT_DIR = join(ROOT, 'src', 'data', 'issues');
const HISTORY_PATH = join(ROOT, 'src', 'data', 'issues', '_history.json');

// Cycle #7 — 1일 1개 고정 메인. + Cycle #11 P0-2 보너스: 신규 키워드 + 지속성 게이트.
// 메인 1건 후, 트렌딩 중 (totalCount ≥ 2 AND 영구 포스트 0건 AND primary subsidy dedup 통과) 추가 생성.
// 1일 캡 BONUS_MAX_PER_DAY (단발 노이즈·비용 방어).
const POSTS_PER_DAY = 1;
const BONUS_MAX_PER_DAY = 2; // 1일 최대 메인 1 + 보너스 2 = 3
const BONUS_TOTAL_COUNT_MIN = 2; // 신규 키워드 지속성 게이트 (1일치 단발 차단)
const FALLBACK_CANDIDATES = 5;
const TOP_N = FALLBACK_CANDIDATES; // 호환 alias
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
  const _text = `${headline} ${term}`;
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

// ─────────────────────────────────────────────────────────────
// Cycle #7 — 최근 7일 primary subsidy 집합 (콘텐츠 중복 방지)
//   동일 지원금이 단기간 반복 포스팅되는 것을 차단.
//   primary = matchedSubsidies[0].id
// ─────────────────────────────────────────────────────────────
async function loadRecentPrimaries(days = 7) {
  const set = new Set();
  try {
    const dateDirs = await readdir(ISSUES_OUT_DIR);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    for (const dir of dateDirs) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dir)) continue;
      if (new Date(dir) < cutoff) continue;
      const dirPath = join(ISSUES_OUT_DIR, dir);
      const files = await readdir(dirPath).catch(() => []);
      for (const f of files) {
        if (!f.endsWith('.json') || f.startsWith('_')) continue;
        try {
          const post = JSON.parse(await readFile(join(dirPath, f), 'utf8'));
          const primary = post.matchedSubsidies?.[0]?.id ?? post.relatedSubsidies?.[0]?.id;
          if (primary) set.add(primary);
        } catch {}
      }
    }
  } catch {}
  return set;
}

async function saveHistory(history) {
  await mkdir(dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
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
// Cycle #5 P0-7: 재시도 로직 — 429/503 일시 실패 시 exponential backoff 3회
async function fetchWithRetry(url, init, maxRetries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      // 429/503/502/504 일시 실패만 재시도, 4xx는 즉시 throw
      if (![429, 502, 503, 504].includes(res.status)) return res;
      const wait = 1000 * 2 ** attempt; // 1s, 2s, 4s
      console.warn(
        `[claude-retry] attempt ${attempt + 1} 실패 (HTTP ${res.status}), ${wait}ms 후 재시도`,
      );
      await new Promise((r) => setTimeout(r, wait));
      lastErr = res;
    } catch (e) {
      // 네트워크 오류 등
      const wait = 1000 * 2 ** attempt;
      console.warn(
        `[claude-retry] attempt ${attempt + 1} 네트워크 실패, ${wait}ms 후 재시도: ${e.message}`,
      );
      await new Promise((r) => setTimeout(r, wait));
      lastErr = e;
    }
  }
  if (lastErr instanceof Response) return lastErr;
  throw lastErr;
}

/**
 * Claude API 호출.
 * @returns {Promise<{ content: string, usage: object }>}
 *   content: 생성된 텍스트
 *   usage: cache_creation_input_tokens / cache_read_input_tokens / input_tokens / output_tokens
 */
async function callClaude(systemPrompt, userPrompt, apiKey, staticContext = '') {
  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Cycle #3 P0-8: prompt caching — system prompt(521줄, ~1400 토큰)을 ephemeral 캐시
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      // Cycle #5 P0-8: 정적 컨텍스트 별도 cache block (+~500 토큰 추가 캐시)
      messages: [
        {
          role: 'user',
          content: staticContext
            ? [
                { type: 'text', text: staticContext, cache_control: { type: 'ephemeral' } },
                { type: 'text', text: userPrompt },
              ]
            : userPrompt,
        },
      ],
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
  const usage = json.usage ?? {};
  if (usage.cache_creation_input_tokens || usage.cache_read_input_tokens) {
    console.log(
      `[claude-cache] create=${usage.cache_creation_input_tokens ?? 0} read=${usage.cache_read_input_tokens ?? 0} input=${usage.input_tokens ?? 0} output=${usage.output_tokens ?? 0}`,
    );
  }
  return { content, usage };
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

  const sourceText = sourceArticles.map((a) => `${a.title ?? ''} ${a.description ?? ''}`).join(' ');

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
  return {
    passed,
    score: Number(score.toFixed(2)),
    unmatched: unmatched.slice(0, 10),
    totalClaims: claims.length,
    matched,
  };
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
// Cycle #40: Title sanitizer — AI 클리셰 패턴 제거 (사용자 요청)
// 콜론(:)·대시(- — – ―) + '대상·금액·신청 방법 총정리' 같은 클리셰 부분 제거.
// ─────────────────────────────────────────────────────────────
function sanitizeTitle(raw) {
  if (!raw) return raw;
  let t = String(raw).trim();
  // 1. AI 클리셰 suffix 제거 — 'X: 대상·금액·신청 방법 총정리', 'X — Y 총정리' 등
  const cliches = [
    /\s*[:—–-]\s*대상[·\s]*금액[·\s]*신청\s*방법\s*총정리\s*$/,
    /\s*[:—–-]\s*[가-힣\s·]*총정리\s*$/,
    /\s*[:—–-]\s*[가-힣\s·]*완벽정리\s*$/,
    /\s*[:—–-]\s*[가-힣\s·]*한눈에\s*$/,
  ];
  for (const re of cliches) t = t.replace(re, '');
  // 2. 콜론·대시를 공백으로 (남은 것만)
  t = t.replace(/\s*:\s*/g, ' ');
  t = t.replace(/\s*[—–―]\s*/g, ' ');
  // 일반 hyphen은 단어 일부 (예: K-스타트업)일 수 있어 보존 — 단 공백+- 형태만 제거
  t = t.replace(/\s+-\s+/g, ' ');
  // 3. 다중 공백 정리
  t = t.replace(/\s+/g, ' ').trim();
  return t;
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

  // Cycle #5 P0-8: 정적 컨텍스트 (매 호출 동일) — 별도 cache block으로 분리
  const staticContext = [
    '# 페르소나 참조 맵 (모든 호출 공통)',
    '',
    JSON.stringify(personas, null, 2),
    '',
    '# 카테고리 → 페르소나 매핑',
    '',
    JSON.stringify(CAT_TO_PERSONAS, null, 2),
  ].join('\n');

  console.log(
    `📦 시스템 프롬프트 ${systemPrompt.length}자 / 정적 컨텍스트 ${staticContext.length}자 / 지원금 ${allSubsidies.length}건 / 페르소나 ${personas.length}건`,
  );

  const trending = todayIssue.trending ?? [];
  if (trending.length === 0) {
    console.error('❌ trending 비어 있음');
    process.exit(1);
  }

  const date = todayDateStr();
  await mkdir(join(ISSUES_OUT_DIR, date), { recursive: true });

  // Cycle #7: 최근 7일에 1순위로 다뤘던 지원금은 중복으로 간주 → fallback 후보로 넘어감
  const recentPrimaries = await loadRecentPrimaries(7);
  if (recentPrimaries.size > 0) {
    console.log(`🛡️  최근 7일 primary subsidy ${recentPrimaries.size}건 중복 차단 대상`);
  }

  let success = 0;
  let mainSuccess = 0;
  let bonusSuccess = 0;
  let failed = 0;
  const failures = [];
  const skippedDuplicates = [];
  const bonusSkipped = [];
  // Cycle #4 P0-8: cache 통계 영속 로깅 — 1주 hit ratio 측정
  const cacheLog = [];
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

    // Cycle #11 P0-2: 보너스 포스팅 게이트 — 메인 1건 이미 성공 시 추가 조건 검사
    const isBonusCandidate = mainSuccess >= POSTS_PER_DAY;
    if (isBonusCandidate) {
      // Gate 1: 지속성 (단발 노이즈 차단)
      if (count < BONUS_TOTAL_COUNT_MIN) {
        console.log(`  ⤳ 보너스 스킵: count ${count} < ${BONUS_TOTAL_COUNT_MIN} (지속성 부족)`);
        bonusSkipped.push({ rank: idx + 1, term, reason: 'count_below_min' });
        continue;
      }
      // Gate 2: 1:1 매핑 보장 — 이미 영구 포스트 있는 키워드 skip
      if (history.byTerm?.[term]?.postSlug) {
        console.log(
          `  ⤳ 보너스 스킵: "${term}" 이미 영구 포스트 존재 (${history.byTerm[term].postSlug})`,
        );
        bonusSkipped.push({ rank: idx + 1, term, reason: 'has_existing_post' });
        continue;
      }
      // Gate 3: 일일 보너스 캡
      if (bonusSuccess >= BONUS_MAX_PER_DAY) {
        console.log(`  ⤳ 보너스 캡 도달 (${BONUS_MAX_PER_DAY}건) — 종료`);
        break;
      }
      console.log(`  🎁 보너스 후보 — count ${count} ≥ ${BONUS_TOTAL_COUNT_MIN}, 신규 키워드`);
    }

    // 매칭 지원금
    const matchedSubsidies = matchSubsidies(headline, term, category, allSubsidies, 6);
    // Cycle #7: 콘텐츠 중복 방지 — primary subsidy가 7일 내 이미 포스팅됐으면 fallback
    const primaryId = matchedSubsidies[0]?.id;
    if (primaryId && recentPrimaries.has(primaryId)) {
      console.log(`  ⤳ 중복 차단: primary "${primaryId}" 7일 내 포스팅됨 → 다음 후보로`);
      skippedDuplicates.push({ rank: idx + 1, term, primaryId });
      continue;
    }
    // 매칭 페르소나
    const personaIds = CAT_TO_PERSONAS[category] ?? ['office-rookie'];
    const matchedPersonas = personas.filter((p) => personaIds.includes(p.id));

    // 이력 정보 (이번 회차 update 전 상태로 daysActive 계산)
    const histEntry = history.byTerm[term];
    const daysActive =
      (histEntry?.daysActive ?? 0) + (histEntry?.dailyCounts?.[date] === undefined ? 1 : 0);
    const totalCount = (histEntry?.totalCount ?? 0) + count;

    // Cycle #40 (사용자 요청): 다중 소스 종합 강화 — 화제 키워드의 모든 매칭 기사 활용
    // 우선순위: trendingArticlesByTerm[term] (Cycle #7 매체 다양성 12건) > topTrendingArticles(1위만) > 폴백
    let articlesForTopic;
    const fromTermMap = todayIssue.trendingArticlesByTerm?.[term];
    if (Array.isArray(fromTermMap) && fromTermMap.length >= 2) {
      // 신규 우선: 키워드별 매체 다양성 12건 (description 포함)
      articlesForTopic = fromTermMap;
    } else if (
      idx === 0 &&
      Array.isArray(todayIssue.topTrendingArticles) &&
      todayIssue.topTrendingArticles.length > 0
    ) {
      articlesForTopic = todayIssue.topTrendingArticles;
    } else {
      const fromCandidates = (todayIssue.candidates ?? []).filter((c) => c.title?.includes(term));
      articlesForTopic = [topArticle, ...fromCandidates].filter(Boolean).slice(0, 8);
    }
    // Cycle #3 P0-7 / Cycle #40: 입력 캡 — N≤12 + JSON 직렬화 30KB 초과 시 뒤에서부터 잘라냄
    articlesForTopic = articlesForTopic.slice(0, 12);
    while (articlesForTopic.length > 1 && JSON.stringify(articlesForTopic).length > 30000) {
      articlesForTopic.pop();
    }

    // Cycle #40 (사용자 요청): 출처 다양성 게이트 — 단일 매체 재구성 thin content 차단
    // 매체 ≥ 2개 + 기사 ≥ 3건 미만이면 skip (다른 후보로 fallback)
    const uniquePublishers = new Set(
      articlesForTopic.map((a) => {
        try {
          return new URL(a.link).hostname.replace(/^www\./, '');
        } catch {
          return a.publisher || a.link;
        }
      }),
    );
    if (uniquePublishers.size < 2 || articlesForTopic.length < 3) {
      console.log(
        `  ⤳ 다양성 미달: 매체 ${uniquePublishers.size}곳 / 기사 ${articlesForTopic.length}건 (요구 ≥2 매체 + ≥3건) — 다음 후보로`,
      );
      bonusSkipped.push({ rank: idx + 1, term, reason: 'source_diversity_below_min' });
      continue;
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
    let callUsage = null;
    try {
      const result = await callClaude(systemPrompt, userPrompt, apiKey, staticContext);
      // Cycle #4 P0-8: callClaude 반환 구조 변경 — 하위호환 (string도 처리)
      const raw = typeof result === 'string' ? result : result.content;
      callUsage = typeof result === 'string' ? null : result.usage;
      if (callUsage) {
        cacheLog.push({
          term,
          rank: idx + 1,
          cache_creation: callUsage.cache_creation_input_tokens ?? 0,
          cache_read: callUsage.cache_read_input_tokens ?? 0,
          input: callUsage.input_tokens ?? 0,
          output: callUsage.output_tokens ?? 0,
          at: new Date().toISOString(),
        });
      }
      post = parseJsonFromResponse(raw);
    } catch (e) {
      const reason = e?.message ?? String(e);
      console.warn(`⚠️ Claude 호출 실패: ${reason}`);
      if (isCI) {
        // GitHub Actions annotation — 워크플로 요약에 노출
        console.log(
          `::warning title=Claude 포스트 생성 실패::${term} (${idx + 1}/${TOP_N}): ${reason}`,
        );
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

    // Cycle #40: title sanitize — AI 클리셰 패턴 제거 (사용자 요청: 콜론·대시 금지)
    if (post.title) {
      post.title = sanitizeTitle(post.title);
    }

    // 6. 슬러그 충돌 해결
    if (!post.slug) post.slug = `issue-${idx + 1}`;
    const finalSlug = await resolveSlug(date, post.slug);
    post.slug = finalSlug;
    post.publishedAt = new Date().toISOString();
    post.date = date;
    // factCheck 점수도 메타에 저장 — 운영자 모니터링용
    post.factCheckScore = fc.score;
    // Cycle #7: primary subsidy ID 보존 — 미래 7일 dedup 안정성
    if (!post.matchedSubsidies && matchedSubsidies.length > 0) {
      post.matchedSubsidies = matchedSubsidies;
    }

    // 7. 저장
    const outPath = join(ISSUES_OUT_DIR, date, `${finalSlug}.json`);
    await writeFile(outPath, `${JSON.stringify(post, null, 2)}\n`, 'utf8');
    console.log(`✅ ${outPath}`);

    // 8. 히스토리 갱신
    updateHistory(history, term, count, finalSlug);

    success++;
    if (isBonusCandidate) {
      bonusSuccess++;
      console.log(`  🎁 보너스 ${bonusSuccess}/${BONUS_MAX_PER_DAY}`);
    } else {
      mainSuccess++;
    }

    // Cycle #11: 메인 + 보너스 캡 도달 시 종료 (메인 1 + 보너스 ≤ BONUS_MAX_PER_DAY)
    if (mainSuccess >= POSTS_PER_DAY && bonusSuccess >= BONUS_MAX_PER_DAY) {
      console.log(`\n✓ 메인 ${mainSuccess} + 보너스 ${bonusSuccess} 캡 도달 — 처리 종료`);
      break;
    }
  }

  // 8. _history.json 저장
  await saveHistory(history);
  console.log(
    `\n📊 메인 ${mainSuccess} + 보너스 ${bonusSuccess} = ${success} 성공 / ${failed} 실패 / ${skippedDuplicates.length} 중복스킵 / ${bonusSkipped.length} 보너스조건불충족 — 히스토리 갱신`,
  );

  // Cycle #7: 모든 후보가 중복이라 0건 성공 → 포스팅 자체 스킵 (사용자 요청: 다른 화제로도 안 만듦)
  if (success === 0 && skippedDuplicates.length > 0 && failed === 0) {
    console.log(
      `📭 ${skippedDuplicates.length}개 후보 모두 7일 내 primary 중복 — 오늘 포스팅 없음`,
    );
    if (isCI && process.env.GITHUB_STEP_SUMMARY) {
      const lines = [
        `## 📭 오늘의 이슈 포스팅 없음 (전 후보 중복)`,
        '',
        `최근 7일 내 primary subsidy 중복으로 ${skippedDuplicates.length}건 모두 스킵.`,
        '',
        '| 순위 | 토픽 | primary subsidy |',
        '|---|---|---|',
        ...skippedDuplicates.map((s) => `| ${s.rank} | ${s.term} | \`${s.primaryId}\` |`),
      ];
      try {
        const { appendFile } = await import('node:fs/promises');
        await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
      } catch {}
    }
  }

  // 8-1. Cycle #4 P0-8: Claude API cache 통계 영속 로깅 (_cache-{date}.json)
  if (cacheLog.length > 0) {
    const totalCreate = cacheLog.reduce((s, e) => s + e.cache_creation, 0);
    const totalRead = cacheLog.reduce((s, e) => s + e.cache_read, 0);
    const totalInput = cacheLog.reduce((s, e) => s + e.input, 0);
    const totalOutput = cacheLog.reduce((s, e) => s + e.output, 0);
    const cachePath = join(ISSUES_OUT_DIR, date, `_cache-${date}.json`);
    try {
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(
        cachePath,
        `${JSON.stringify(
          {
            date,
            model: MODEL,
            calls: cacheLog.length,
            totals: {
              cache_creation: totalCreate,
              cache_read: totalRead,
              input: totalInput,
              output: totalOutput,
              cache_hit_ratio:
                totalRead > 0 ? (totalRead / (totalCreate + totalRead)).toFixed(3) : '0',
            },
            calls_detail: cacheLog,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
      console.log(`📝 Cache 로그 저장: ${cachePath} (read=${totalRead} create=${totalCreate})`);
    } catch (e) {
      console.warn(`⚠️ Cache 로그 저장 실패: ${e.message}`);
    }
  }

  // 9. 실패 로그 — .fail.json (운영 모니터링용)
  if (failures.length > 0) {
    const failPath = join(ISSUES_OUT_DIR, date, `_fail-${date}.json`);
    await writeFile(
      failPath,
      `${JSON.stringify(
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
      )}\n`,
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
        ...failures.map(
          (f) => `| ${f.rank} | ${f.term} | ${f.reason.replace(/\|/g, '\\|').slice(0, 120)} |`,
        ),
      ];
      try {
        const { appendFile } = await import('node:fs/promises');
        await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
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
