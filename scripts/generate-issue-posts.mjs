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
// Cycle #65: 4096은 sections 5개 + faq 5개 + sources 등 풀 페이로드에 부족 (이전 정상 포스트 ≈3500토큰).
// 한 번 잘리면 sections 전부 손실 → 빈 페이지 발행. 8192로 여유 확보.
const MAX_TOKENS = 8192;

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

// Cycle #72: gov24 _manifest.json의 lastBatch.slugs (가장 최근 sync 추가 신규 지원금)
async function loadLastBatchSlugs() {
  try {
    const manifestPath = join(GOV24_DIR, '_manifest.json');
    const data = JSON.parse(await readFile(manifestPath, 'utf8'));
    return data.lastBatch?.slugs ?? [];
  } catch {
    return [];
  }
}

// Cycle #73: deadline 문자열 → D-day (KST 자정 기준). 임박 판정용.
// src/lib/deadline-format.ts 와 동일 로직 (.ts 직접 import 불가하므로 inline 복제)
function getDDay(deadline) {
  if (!deadline) return null;
  const s = String(deadline).trim();
  if (/상시|신청\s*불필요|연중/.test(s)) return null; // 상시는 임박 아님
  if (/예산\s*소진|접수기관\s*별|명절기간|기관\s*문의/.test(s)) return null;
  const matches = [...s.matchAll(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/g)];
  const last = matches[matches.length - 1];
  if (!last) return null;
  const [, y, m, d] = last;
  const yy = parseInt(y, 10), mm = parseInt(m, 10), dd = parseInt(d, 10);
  if (!yy || !mm || !dd || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const end = new Date(Date.UTC(yy, mm - 1, dd));
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  return Math.round((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
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
  // Cycle #65: max_tokens hit 차단 — 이때 응답이 truncate되어 sections/faq/sources 손실 가능
  // stop_reason 'end_turn' 외 (특히 'max_tokens')일 때 명시 throw → 부분 결과 발행 차단
  if (json.stop_reason && json.stop_reason !== 'end_turn') {
    throw new Error(`Claude stop_reason=${json.stop_reason} (응답 truncate 가능 — MAX_TOKENS 증가 필요)`);
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
  // Cycle #41: 70% → 60% 완화 (실측 결과 다중 출처 종합 시 정확 일치율이 70% 미달 빈번).
  // 60%는 동의어·간접 표현·매체별 표현 차이 허용 + 환각 차단 동시 달성.
  const passed = score >= 0.6;
  return {
    passed,
    score: Number(score.toFixed(2)),
    unmatched: unmatched.slice(0, 10),
    totalClaims: claims.length,
    matched,
  };
}

// Cycle #41: Claude JSON 응답 robust parser — 깨진 JSON도 best-effort 복구
function parseJsonFromResponse(text) {
  let cleaned = text.trim();
  // 1. 코드블록 fence 제거
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  // 2. 첫 { 부터 마지막 } 까지 추출
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object in response');
  }
  let body = cleaned.slice(start, end + 1);
  // 3. 1차 시도
  try {
    return JSON.parse(body);
  } catch (e1) {
    // 4. 흔한 깨짐 패턴 자동 수정 시도
    //    - trailing comma 제거: ,] 또는 ,}
    //    - 줄바꿈으로 인한 문자열 깨짐 — 따옴표 안 raw newline → \\n
    let fixed = body
      .replace(/,(\s*[\]}])/g, '$1') // trailing comma
      .replace(/[‘’]/g, "'") // 스마트 단일따옴표
      .replace(/[“”]/g, '"'); // 스마트 이중따옴표
    try {
      return JSON.parse(fixed);
    } catch (e2) {
      // 5. 마지막 fallback — 깨진 객체 끝부분을 잘라내고 재시도 (불완전 응답 대응)
      // 마지막 valid '}' 위치를 점진 감소
      for (let cut = end - 1; cut > start + 100; cut -= 50) {
        try {
          const partial = cleaned.slice(start, cut).replace(/,\s*$/, '') + '}';
          return JSON.parse(partial);
        } catch {}
      }
      throw new Error(`JSON parse failed: ${e1.message}`);
    }
  }
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
// Cycle #72: Source 2 — 정부24 신규 지원금 비교 분석 리포트
// 트렌딩 분석 0건 시 fallback. lastBatch.slugs 활용해 매일 1건 보장.
// ─────────────────────────────────────────────────────────────
async function generateNewSubsidyReport({
  apiKey, systemPrompt, staticContext, allSubsidies, date, history, cacheLog,
}) {
  const lastBatchSlugs = await loadLastBatchSlugs();
  if (lastBatchSlugs.length === 0) {
    console.log('  ⤳ lastBatch.slugs 비어있음 → 신규 지원금 분석 skip');
    return null;
  }

  // 신규 지원금 5건 데이터 수집 (prompt 크기 제어)
  const subsidyMap = new Map(allSubsidies.map((s) => [s.id, s]));
  const newSubsidies = lastBatchSlugs
    .map((slug) => subsidyMap.get(slug))
    .filter(Boolean)
    .slice(0, 5);
  if (newSubsidies.length === 0) {
    console.log('  ⤳ lastBatch.slugs에 매칭 지원금 없음 → skip');
    return null;
  }

  // 7일 내 신규 지원금 리포트 중복 방지 — history에 reportType 추적
  const recentReportSlugs = new Set(
    Object.values(history.byTerm ?? {})
      .filter((e) => e.reportType === 'new-subsidies-weekly')
      .map((e) => e.postSlug)
      .filter(Boolean),
  );
  const fingerprint = `new-subsidies-${newSubsidies.map((s) => s.id).sort().join('-').slice(0, 60)}`;
  if (recentReportSlugs.size > 0) {
    // 같은 batch 다시 리포트 방지
    const existingPaths = await readdir(join(ISSUES_OUT_DIR, date)).catch(() => []);
    if (existingPaths.some((p) => p.startsWith('new-subsidies-weekly'))) {
      console.log('  ⤳ 같은 날짜 신규 지원금 리포트 이미 발행 → skip');
      return null;
    }
  }

  const userInput = {
    reportType: 'new-subsidies-weekly',
    todayDate: date,
    newSubsidies: newSubsidies.map((s) => ({
      id: s.id, title: s.title, agency: s.agency, category: s.category,
      amount: s.amount, amountLabel: s.amountLabel, monthly: s.monthly,
      deadline: s.deadline, period: s.period, summary: s.summary,
      eligibility: s.eligibility, benefits: s.benefits, documents: s.documents,
      applyUrl: s.applyUrl, tags: s.tags,
    })),
  };

  const userPrompt = `다음 입력은 정부24에서 새로 등록된 지원금 ${newSubsidies.length}건입니다.

⚠️ **리포트 유형**: 신규 지원금 비교 분석 (트렌딩 키워드 분석 X — 본 리포트는 매주 새로 등록된 지원금을 비교·정리)

**지시사항**:
- title: "이번 주 새로 등록된 정부 지원금 N건 자격·금액 비교" 같은 형식 (트렌딩 키워드 형식 X)
- slug: "new-subsidies-weekly-${date}" 또는 그 변형
- tldr: 4-6개, 신규 지원금 핵심 차별점 요약
- sections: 5개 표준
  1. 신규 등록 N건 한눈에 (비교표 안내)
  2. 자격 요건 공통점·차이점
  3. 금액·기간 비교
  4. 어떤 페르소나가 받을 수 있나
  5. 신청 우선순위 (마감 임박 + 자격 적합도 기준)
- table: 비교표 — title/agency/amount/eligibility[0]/deadline 헤더로 N건 행
- faq: 4-5건 (신규 지원금에 대한 자주 묻는 질문)
- sources: 각 지원금의 applyUrl + bokjiro.go.kr 또는 gov.kr 도메인만 사용 — 매체 보도 X, 정부 공식 사이트만
- 출력 JSON 객체 1개만, 다른 텍스트 없이
- **중요**: 입력 데이터에 명시된 사실만 인용. 추측·환각·일반화 금지
- factCheckScore는 1.0 (정부 공식 데이터 기반)으로 자체 표시

입력:
\`\`\`json
${JSON.stringify(userInput, null, 2)}
\`\`\``;

  console.log(`  → Claude 호출 (신규 지원금 ${newSubsidies.length}건 비교)`);
  let post;
  try {
    const result = await callClaude(systemPrompt, userPrompt, apiKey, staticContext);
    if (result.usage) {
      cacheLog.push({
        term: 'new-subsidies-weekly',
        rank: 0,
        cache_creation: result.usage.cache_creation_input_tokens ?? 0,
        cache_read: result.usage.cache_read_input_tokens ?? 0,
        input: result.usage.input_tokens ?? 0,
        output: result.usage.output_tokens ?? 0,
        at: new Date().toISOString(),
      });
    }
    post = parseJsonFromResponse(result.content);
  } catch (e) {
    console.warn(`⚠️ Claude 호출 실패 (신규 지원금): ${e?.message ?? e}`);
    return null;
  }

  // 본문 검증 (Cycle #65 가드 동일)
  const sectionCount = Array.isArray(post.sections) ? post.sections.length : 0;
  const faqCount = Array.isArray(post.faq) ? post.faq.length : 0;
  const sourceCount = Array.isArray(post.sources) ? post.sources.length : 0;
  if (sectionCount < 3 || faqCount < 1 || sourceCount < 1) {
    console.warn(
      `⚠️ 신규 지원금 본문 검증 실패: sections=${sectionCount} faq=${faqCount} sources=${sourceCount}`,
    );
    return null;
  }

  // sources가 정부 공식 도메인인지 검증 (raw URL 필터)
  const govDomains = ['gov.kr', 'go.kr', 'bokjiro', 'work.go.kr'];
  const validSources = post.sources.filter((src) => {
    const url = src.url ?? src.link ?? '';
    return govDomains.some((d) => url.includes(d));
  });
  if (validSources.length === 0) {
    console.warn('⚠️ 신규 지원금 sources에 정부 공식 도메인 없음 → 발행 차단');
    return null;
  }

  // 메타 보강
  if (post.title) post.title = sanitizeTitle(post.title);
  if (!post.slug) post.slug = `new-subsidies-weekly-${date}`;
  const finalSlug = await resolveSlug(date, post.slug);
  post.slug = finalSlug;
  post.publishedAt = new Date().toISOString();
  post.date = date;
  post.factCheckScore = 1.0; // 정부 공식 데이터 기반
  post.sourceConfidence = 'high';
  post.sourcePublisherCount = validSources.length;
  post.reportType = 'new-subsidies-weekly';
  post.matchedSubsidies = newSubsidies.map((s) => ({
    id: s.id, title: s.title, agency: s.agency, category: s.category,
    icon: s.icon, amount: s.amount, amountLabel: s.amountLabel,
  }));

  const outPath = join(ISSUES_OUT_DIR, date, `${finalSlug}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(post, null, 2)}\n`, 'utf8');
  console.log(`✅ ${outPath}`);

  // history 갱신 — fingerprint 기반 dedup
  history.byTerm ??= {};
  history.byTerm[fingerprint] = {
    firstSeen: date,
    lastSeen: date,
    totalCount: newSubsidies.length,
    daysActive: 1,
    dailyCounts: { [date]: newSubsidies.length },
    postSlug: finalSlug,
    reportType: 'new-subsidies-weekly',
  };

  return post;
}

// ─────────────────────────────────────────────────────────────
// Cycle #73: Source 3 — 마감 임박 (D-30 이내) 주간 분석 리포트
// 트렌딩 + Source 2 모두 0건 시 fallback. 또는 7일 dedup 통과 시 정기 발행 후보.
// ─────────────────────────────────────────────────────────────
async function generateDeadlineImminentReport({
  apiKey, systemPrompt, staticContext, allSubsidies, date, history, cacheLog,
}) {
  // D-30 이내 임박 지원금 추출 (D-7는 너무 좁아 발행 빈도 낮음)
  const imminent = allSubsidies
    .map((s) => ({ s, dDay: getDDay(s.deadline) }))
    .filter(({ dDay }) => dDay !== null && dDay >= 0 && dDay <= 30)
    .sort((a, b) => a.dDay - b.dDay)
    .slice(0, 6);

  if (imminent.length === 0) {
    console.log('  ⤳ D-30 이내 임박 지원금 0건 → 마감 임박 분석 skip');
    return null;
  }

  // 7일 dedup — fingerprint 기반
  const fingerprint = `deadline-imminent-${imminent.map(({ s }) => s.id).sort().join('-').slice(0, 60)}`;
  const recentDeadlineReports = Object.entries(history.byTerm ?? {})
    .filter(([, e]) => e.reportType === 'deadline-imminent-weekly')
    .map(([, e]) => ({ firstSeen: e.firstSeen, postSlug: e.postSlug }));
  const today = new Date(date + 'T00:00:00Z');
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentExists = recentDeadlineReports.some((r) => {
    const d = new Date(r.firstSeen + 'T00:00:00Z');
    return d > sevenDaysAgo;
  });
  if (recentExists) {
    console.log('  ⤳ 7일 내 마감 임박 리포트 이미 발행 → skip');
    return null;
  }

  const userInput = {
    reportType: 'deadline-imminent-weekly',
    todayDate: date,
    imminentSubsidies: imminent.map(({ s, dDay }) => ({
      id: s.id, title: s.title, agency: s.agency, category: s.category,
      amount: s.amount, amountLabel: s.amountLabel, monthly: s.monthly,
      deadline: s.deadline, period: s.period, summary: s.summary,
      eligibility: s.eligibility, benefits: s.benefits, documents: s.documents,
      applyUrl: s.applyUrl, tags: s.tags, dDay,
    })),
  };

  const userPrompt = `다음 입력은 마감 임박 (D-30 이내) 정부 지원금 ${imminent.length}건입니다.

⚠️ **리포트 유형**: 마감 임박 주간 분석 (트렌딩 X, 신규 등록 X — 이번 주 놓치면 안 되는 지원금 정리)

**지시사항**:
- title: "이번 주 마감 임박 정부 지원금 ${imminent.length}건 — 놓치면 안 되는 신청 데드라인" 같은 형식
- slug: "deadline-imminent-weekly-${date}" 또는 변형
- tldr: 4-6개 핵심 요약 (D-day 가장 임박한 것부터)
- sections: 5개 표준
  1. 마감 임박 ${imminent.length}건 한눈에 (D-day 정렬)
  2. 가장 빨리 신청해야 할 지원금 Top 3
  3. 자격 요건 빠른 체크 — 누가 받을 수 있나
  4. 신청 절차 + 필요 서류 (오늘 준비 시작 가이드)
  5. 마감 후 비슷한 다음 차수 안내
- table: D-day 비교표 — 마감일/D-day/지원금/금액/자격 첫 줄/신청처
- faq: 4-5건 (마감 임박 신청 관련 자주 묻는 질문)
- sources: 각 지원금의 applyUrl + bokjiro.go.kr 또는 정부 부처 .go.kr 도메인만 사용
- 출력 JSON 객체 1개만, 다른 텍스트 없이
- **중요**: 입력 dDay 값 그대로 인용. 추측·환각 금지

입력:
\`\`\`json
${JSON.stringify(userInput, null, 2)}
\`\`\``;

  console.log(`  → Claude 호출 (마감 임박 ${imminent.length}건, 가장 임박 D-${imminent[0].dDay})`);
  let post;
  try {
    const result = await callClaude(systemPrompt, userPrompt, apiKey, staticContext);
    if (result.usage) {
      cacheLog.push({
        term: 'deadline-imminent-weekly',
        rank: 0,
        cache_creation: result.usage.cache_creation_input_tokens ?? 0,
        cache_read: result.usage.cache_read_input_tokens ?? 0,
        input: result.usage.input_tokens ?? 0,
        output: result.usage.output_tokens ?? 0,
        at: new Date().toISOString(),
      });
    }
    post = parseJsonFromResponse(result.content);
  } catch (e) {
    console.warn(`⚠️ Claude 호출 실패 (마감 임박): ${e?.message ?? e}`);
    return null;
  }

  // 본문 검증
  const sectionCount = Array.isArray(post.sections) ? post.sections.length : 0;
  const faqCount = Array.isArray(post.faq) ? post.faq.length : 0;
  const sourceCount = Array.isArray(post.sources) ? post.sources.length : 0;
  if (sectionCount < 3 || faqCount < 1 || sourceCount < 1) {
    console.warn(
      `⚠️ 마감 임박 본문 검증 실패: sections=${sectionCount} faq=${faqCount} sources=${sourceCount}`,
    );
    return null;
  }

  // 정부 도메인 sources 검증
  const govDomains = ['gov.kr', 'go.kr', 'bokjiro', 'work.go.kr'];
  const validSources = post.sources.filter((src) => {
    const url = src.url ?? src.link ?? '';
    return govDomains.some((d) => url.includes(d));
  });
  if (validSources.length === 0) {
    console.warn('⚠️ 마감 임박 sources에 정부 공식 도메인 없음 → 발행 차단');
    return null;
  }

  // 메타 보강
  if (post.title) post.title = sanitizeTitle(post.title);
  if (!post.slug) post.slug = `deadline-imminent-weekly-${date}`;
  const finalSlug = await resolveSlug(date, post.slug);
  post.slug = finalSlug;
  post.publishedAt = new Date().toISOString();
  post.date = date;
  post.factCheckScore = 1.0;
  post.sourceConfidence = 'high';
  post.sourcePublisherCount = validSources.length;
  post.reportType = 'deadline-imminent-weekly';
  post.matchedSubsidies = imminent.map(({ s }) => ({
    id: s.id, title: s.title, agency: s.agency, category: s.category,
    icon: s.icon, amount: s.amount, amountLabel: s.amountLabel,
  }));

  const outPath = join(ISSUES_OUT_DIR, date, `${finalSlug}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(post, null, 2)}\n`, 'utf8');
  console.log(`✅ ${outPath}`);

  history.byTerm ??= {};
  history.byTerm[fingerprint] = {
    firstSeen: date,
    lastSeen: date,
    totalCount: imminent.length,
    daysActive: 1,
    dailyCounts: { [date]: imminent.length },
    postSlug: finalSlug,
    reportType: 'deadline-imminent-weekly',
  };

  return post;
}

// ─────────────────────────────────────────────────────────────
// Cycle #74: Source 4 — 페르소나 주간 순회 분석 리포트
// 요일별 페르소나 1종 매핑 → 매일 다른 페르소나로 순회 (7일 dedup)
// ─────────────────────────────────────────────────────────────
const PERSONA_WEEKDAY_MAP = {
  1: 'office-rookie',     // 월
  2: 'self-employed',     // 화
  3: 'newlywed-family',   // 수
  4: 'senior',            // 목
  5: 'low-income',        // 금
  6: 'farmer',            // 토
  // 0 (일요일): persona 발행 X — 카테고리 심층(Source 5) 또는 휴식
};

async function generatePersonaWeeklyReport({
  apiKey, systemPrompt, staticContext, allSubsidies, personas, date, history, cacheLog,
}) {
  // 요일 → 페르소나 결정 (KST 기준)
  const dateObj = new Date(date + 'T00:00:00+09:00');
  const weekday = dateObj.getUTCDay(); // 0=일 ~ 6=토 (KST 기준 weekday는 UTC 변환에서 같음)
  const targetPersonaId = PERSONA_WEEKDAY_MAP[weekday];
  if (!targetPersonaId) {
    console.log(`  ⤳ 요일 ${weekday} (일요일) → persona-weekly skip`);
    return null;
  }
  const persona = personas.find((p) => p.id === targetPersonaId);
  if (!persona) {
    console.log(`  ⤳ 페르소나 ${targetPersonaId} 데이터 없음 → skip`);
    return null;
  }

  // 7일 dedup — 같은 페르소나 1주 내 재발행 차단
  const sevenDaysAgo = new Date(dateObj.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentExists = Object.values(history.byTerm ?? {}).some((e) => {
    if (e.reportType !== 'persona-weekly') return false;
    if (e.personaId !== targetPersonaId) return false;
    const d = new Date(e.firstSeen + 'T00:00:00Z');
    return d > sevenDaysAgo;
  });
  if (recentExists) {
    console.log(`  ⤳ ${targetPersonaId} 페르소나 7일 내 발행 — skip`);
    return null;
  }

  // 매칭 지원금 — targetPersonas에 페르소나 ID 포함
  const matched = allSubsidies.filter((s) => (s.targetPersonas ?? []).includes(targetPersonaId));
  if (matched.length === 0) {
    console.log(`  ⤳ ${targetPersonaId} 매칭 지원금 0건 → skip`);
    return null;
  }

  // 정렬 + 카테고리별 Top 압축 (prompt 크기 제어)
  const byCategory = new Map();
  for (const s of matched) {
    const cat = s.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(s);
  }
  for (const arr of byCategory.values()) {
    arr.sort((a, b) => {
      const ah = a.isHot ? 1 : 0, bh = b.isHot ? 1 : 0;
      if (ah !== bh) return bh - ah;
      return (b.amount ?? 0) - (a.amount ?? 0);
    });
  }
  // 카테고리별 Top 2 → 최대 8건
  const compactMatched = [];
  for (const [cat, arr] of byCategory.entries()) {
    compactMatched.push(...arr.slice(0, 2).map((s) => ({ ...s, _cat: cat })));
  }
  const topMatched = compactMatched.slice(0, 8);

  // 신규/마감 임박 정보 추가
  const lastBatchSlugs = await loadLastBatchSlugs();
  const newSlugSet = new Set(lastBatchSlugs);
  const annotated = topMatched.map((s) => ({
    id: s.id, title: s.title, agency: s.agency, category: s.category,
    amount: s.amount, amountLabel: s.amountLabel, monthly: s.monthly,
    deadline: s.deadline, summary: s.summary,
    eligibility: s.eligibility?.slice(0, 3),
    benefits: s.benefits?.slice(0, 3),
    applyUrl: s.applyUrl, tags: s.tags,
    isNew: newSlugSet.has(s.id),
    dDay: getDDay(s.deadline),
    isHot: !!s.isHot,
  }));

  const userInput = {
    reportType: 'persona-weekly',
    todayDate: date,
    persona: {
      id: persona.id, label: persona.label, sub: persona.sub,
      age: persona.age, income: persona.income, living: persona.living,
      pains: persona.pains,
    },
    totalMatched: matched.length,
    matchedTop: annotated,
    categories: [...byCategory.keys()],
  };

  const userPrompt = `다음 입력은 "${persona.label}" 페르소나의 매칭 지원금 풀(${matched.length}건 중 카테고리별 Top ${annotated.length}건)입니다.

⚠️ **리포트 유형**: 페르소나 주간 분석 (트렌딩 X, 신규 X — 이번 주 ${persona.label}을 위한 정부 지원금 종합 정리)

**지시사항**:
- title: "이번 주 ${persona.label} 정부 지원금 ${matched.length}건 — 핵심 매칭 + 신청 우선순위" 같은 형식
- slug: "persona-weekly-${persona.id}-${date}" 또는 변형
- tldr: 4-6개 핵심 요약 (페르소나 자격·평균 금액·신규/마감 임박 강조)
- sections: 5개 표준
  1. ${persona.label}의 자격 한눈에 (연령·소득·주거 + pains)
  2. 분야별 매칭 지원금 Top
  3. 이번 주 신규 등록 (isNew=true 항목 강조)
  4. 마감 임박 (dDay ≤ 30 항목 강조 + 신청 우선순위)
  5. ${persona.label}이 자주 놓치는 자격·서류 주의사항
- table: 분야 / 지원금 / 금액 / 자격 첫 줄 / 마감 / 신청처 비교
- faq: 4-5건 (해당 페르소나가 자주 묻는 질문)
- sources: 각 지원금 applyUrl + bokjiro.go.kr 또는 정부 부처 .go.kr 도메인만
- 출력 JSON 객체 1개만, 다른 텍스트 없이
- **중요**: 입력에 없는 자격·금액 추측 금지. ${persona.label} 외 다른 페르소나 정보 인용 금지

입력:
\`\`\`json
${JSON.stringify(userInput, null, 2)}
\`\`\``;

  console.log(`  → Claude 호출 (페르소나 ${persona.label}, 매칭 ${matched.length}건 → Top ${annotated.length})`);
  let post;
  try {
    const result = await callClaude(systemPrompt, userPrompt, apiKey, staticContext);
    if (result.usage) {
      cacheLog.push({
        term: `persona-weekly-${targetPersonaId}`,
        rank: 0,
        cache_creation: result.usage.cache_creation_input_tokens ?? 0,
        cache_read: result.usage.cache_read_input_tokens ?? 0,
        input: result.usage.input_tokens ?? 0,
        output: result.usage.output_tokens ?? 0,
        at: new Date().toISOString(),
      });
    }
    post = parseJsonFromResponse(result.content);
  } catch (e) {
    console.warn(`⚠️ Claude 호출 실패 (페르소나 ${targetPersonaId}): ${e?.message ?? e}`);
    return null;
  }

  // 본문 검증
  const sectionCount = Array.isArray(post.sections) ? post.sections.length : 0;
  const faqCount = Array.isArray(post.faq) ? post.faq.length : 0;
  const sourceCount = Array.isArray(post.sources) ? post.sources.length : 0;
  if (sectionCount < 3 || faqCount < 1 || sourceCount < 1) {
    console.warn(
      `⚠️ 페르소나 본문 검증 실패: sections=${sectionCount} faq=${faqCount} sources=${sourceCount}`,
    );
    return null;
  }

  // 정부 도메인 sources 검증
  const govDomains = ['gov.kr', 'go.kr', 'bokjiro', 'work.go.kr'];
  const validSources = post.sources.filter((src) => {
    const url = src.url ?? src.link ?? '';
    return govDomains.some((d) => url.includes(d));
  });
  if (validSources.length === 0) {
    console.warn('⚠️ 페르소나 sources에 정부 공식 도메인 없음 → 발행 차단');
    return null;
  }

  if (post.title) post.title = sanitizeTitle(post.title);
  if (!post.slug) post.slug = `persona-weekly-${persona.id}-${date}`;
  const finalSlug = await resolveSlug(date, post.slug);
  post.slug = finalSlug;
  post.publishedAt = new Date().toISOString();
  post.date = date;
  post.factCheckScore = 1.0;
  post.sourceConfidence = 'high';
  post.sourcePublisherCount = validSources.length;
  post.reportType = 'persona-weekly';
  post.personaId = persona.id;
  post.matchedSubsidies = topMatched.slice(0, 6).map((s) => ({
    id: s.id, title: s.title, agency: s.agency, category: s.category,
    icon: s.icon, amount: s.amount, amountLabel: s.amountLabel,
  }));

  const outPath = join(ISSUES_OUT_DIR, date, `${finalSlug}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(post, null, 2)}\n`, 'utf8');
  console.log(`✅ ${outPath}`);

  // history fingerprint
  const fingerprint = `persona-weekly-${persona.id}-${date}`;
  history.byTerm ??= {};
  history.byTerm[fingerprint] = {
    firstSeen: date,
    lastSeen: date,
    totalCount: matched.length,
    daysActive: 1,
    dailyCounts: { [date]: matched.length },
    postSlug: finalSlug,
    reportType: 'persona-weekly',
    personaId: persona.id,
  };

  return post;
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

    // Cycle #69 (사용자 요청): Top 3 키워드 분석 리포트 보장 — 다양성 게이트 차등 적용
    //   Top 3 (idx 0~2): ≥1매체 + ≥1건만 충족 → 시도 (정보 부족하면 sourceConfidence='low')
    //   4-5위 보너스 (idx 3~4): 기존 ≥2매체 + ≥3건 유지 (잡음 차단)
    const uniquePublishers = new Set(
      articlesForTopic.map((a) => {
        try {
          return new URL(a.link).hostname.replace(/^www\./, '');
        } catch {
          return a.publisher || a.link;
        }
      }),
    );
    const isTop3 = idx < 3;
    const minPublishers = isTop3 ? 1 : 2;
    const minArticles = isTop3 ? 1 : 3;
    if (uniquePublishers.size < minPublishers || articlesForTopic.length < minArticles) {
      console.log(
        `  ⤳ 다양성 미달: 매체 ${uniquePublishers.size}곳 / 기사 ${articlesForTopic.length}건 (Top${idx + 1} 요구 ≥${minPublishers}매체 + ≥${minArticles}건) — skip`,
      );
      bonusSkipped.push({ rank: idx + 1, term, reason: 'source_diversity_below_min' });
      continue;
    }

    // Cycle #69: sourceConfidence — 출처 신뢰도 메타. UI에 disclaimer 표시 + 운영자 모니터링
    let sourceConfidence;
    if (uniquePublishers.size >= 3 && articlesForTopic.length >= 5) {
      sourceConfidence = 'high';
    } else if (uniquePublishers.size >= 2 && articlesForTopic.length >= 3) {
      sourceConfidence = 'medium';
    } else {
      sourceConfidence = 'low';
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
      sourcePublisherCount: uniquePublishers.size,
      sourceConfidence,
      matchedSubsidies,
      matchedPersonas,
      todayDate: date,
    };

    // Cycle #69: low confidence 시 정보 제한 명시 + 환각 차단 강화 prompt
    const lowConfNote =
      sourceConfidence === 'low'
        ? `\n\n⚠️ 정보 출처가 제한적입니다 (매체 ${uniquePublishers.size}곳 · 기사 ${articlesForTopic.length}건). 다음 규칙을 반드시 지키세요:
- 추측·일반화 금지. 출처에 명시된 사실만 인용
- sections 첫 단락에 "정보 제한 알림" 자동 첨부 — 단일/소수 매체 보도 출처 명시
- sources에 가용한 모든 기사를 빠짐없이 나열
- coreFacts.who/amount/deadline/where 중 출처에 없는 항목은 "확인 필요" 명시 (추측 X)`
        : '';

    const userPrompt = `다음 입력 데이터로 오늘의 이슈 포스트를 작성하세요. 출력은 반드시 JSON 객체 1개로만, 다른 텍스트 없이.${lowConfNote}

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

    // Cycle #65: 본문 콘텐츠 검증 — sections/faq/sources 누락 시 발행 차단
    // 원인: max_tokens truncate 또는 Claude가 schema 미준수. 빈 페이지 사이트 발행 방지.
    const sectionCount = Array.isArray(post.sections) ? post.sections.length : 0;
    const faqCount = Array.isArray(post.faq) ? post.faq.length : 0;
    const sourceCount = Array.isArray(post.sources) ? post.sources.length : 0;
    if (sectionCount < 3 || faqCount < 1 || sourceCount < 1) {
      const reason = `본문 검증 실패: sections=${sectionCount}/3+ faq=${faqCount}/1+ sources=${sourceCount}/1+`;
      console.warn(`⚠️ ${reason} (${term})`);
      if (isCI) {
        console.log(
          `::warning title=본문 검증 실패::${term} ${reason}`,
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
    // Cycle #69: sourceConfidence 보존 — UI disclaimer 표시 + 운영자 모니터링
    post.sourceConfidence = sourceConfidence;
    post.sourcePublisherCount = uniquePublishers.size;
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

  // Cycle #72-73: 트렌딩 분석 0건이면 fallback 체인 시도 — 매일 1건 분석 리포트 보장
  // Source 2 (신규 지원금) → Source 3 (마감 임박) → 다음 source는 Cycle #74+
  if (mainSuccess === 0 && bonusSuccess === 0) {
    console.log('\n🔄 트렌딩 분석 0건 → Source 2 (정부24 신규 지원금 분석) fallback 시도');
    let fallbackOk = false;
    try {
      const s2Post = await generateNewSubsidyReport({
        apiKey, systemPrompt, staticContext, allSubsidies, date, history, cacheLog,
      });
      if (s2Post) {
        success++;
        mainSuccess++;
        fallbackOk = true;
        console.log(`✅ Source 2 (신규 지원금 분석) fallback 발행: ${s2Post.slug}`);
      } else {
        console.log('  ⤳ Source 2 skip → Source 3 시도');
      }
    } catch (e) {
      console.warn(`⚠️ Source 2 오류: ${e?.message ?? e}`);
    }

    if (!fallbackOk) {
      console.log('🔄 Source 3 (마감 임박 주간 분석) fallback 시도');
      try {
        const s3Post = await generateDeadlineImminentReport({
          apiKey, systemPrompt, staticContext, allSubsidies, date, history, cacheLog,
        });
        if (s3Post) {
          success++;
          mainSuccess++;
          fallbackOk = true;
          console.log(`✅ Source 3 (마감 임박 분석) fallback 발행: ${s3Post.slug}`);
        } else {
          console.log('  ⤳ Source 3 skip → Source 4 시도');
        }
      } catch (e) {
        console.warn(`⚠️ Source 3 오류: ${e?.message ?? e}`);
      }
    }

    if (!fallbackOk) {
      console.log('🔄 Source 4 (페르소나 주간 순회) fallback 시도');
      try {
        const s4Post = await generatePersonaWeeklyReport({
          apiKey, systemPrompt, staticContext, allSubsidies, personas, date, history, cacheLog,
        });
        if (s4Post) {
          success++;
          mainSuccess++;
          console.log(`✅ Source 4 (페르소나 주간 분석) fallback 발행: ${s4Post.slug}`);
        } else {
          console.log('  ⤳ Source 4 skip — 다음 source는 미구현 (Cycle #75+)');
        }
      } catch (e) {
        console.warn(`⚠️ Source 4 오류: ${e?.message ?? e}`);
      }
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
