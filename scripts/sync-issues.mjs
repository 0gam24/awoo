#!/usr/bin/env node
/**
 * 오늘의 이슈 자동 큐레이션 — Naver News Search API
 *
 * 사용:
 *   npm run sync:issues
 *
 * 동작:
 *   1. .env / .env.local 의 NAVER_CLIENT_ID/SECRET 로 인증
 *   2. 카테고리별 키워드 그룹 7개로 뉴스 검색 (주거/취업/창업/교육/복지/자산/농업)
 *   3. 후보 풀 점수화 (신선도 + 매체 신뢰도 + 키워드 임팩트 + 지원금 매칭)
 *   4. Top 1 선정 + 백업 후보 5건 → src/data/today-issue.json 저장
 *
 * PSI 100 호환: 빌드타임 fetch만 사용. 런타임 API 호출 없음.
 *
 * 보안: 키 값은 절대 출력 안 함.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'src', 'data', 'today-issue.json');

const NAVER_API = 'https://openapi.naver.com/v1/search/news.json';

// ─────────────────────────────────────────────────────────────
// .env 로딩 (값 비노출)
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
// 카테고리별 검색 키워드 (네이버 뉴스 검색 query)
// ─────────────────────────────────────────────────────────────
const KEYWORD_GROUPS = [
  { cat: '주거', queries: ['청년 월세 지원', '신혼부부 특별공급', '주택 임대 지원금'] },
  { cat: '취업', queries: ['청년 취업 지원금', '국민취업지원제도', '구직자 지원금'] },
  { cat: '창업', queries: ['청년 창업 지원금', '소상공인 정책자금', '예비창업패키지'] },
  { cat: '교육', queries: ['국가장학금', '내일배움카드', '평생교육 바우처'] },
  { cat: '복지', queries: ['부모급여', '아동수당', '기초생활보장 급여'] },
  { cat: '자산', queries: ['청년도약계좌', '청년내일저축계좌', '자산형성 지원'] },
  { cat: '농업', queries: ['청년 농업인 지원금', '귀농 정착지원', '영농 정착지원금'] },
];

// ─────────────────────────────────────────────────────────────
// HTML 엔티티 / <b> 태그 제거
// ─────────────────────────────────────────────────────────────
function clean(text) {
  if (!text) return '';
  return text
    .replace(/<\/?b>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// ─────────────────────────────────────────────────────────────
// Naver News 검색
// ─────────────────────────────────────────────────────────────
async function searchNaver(query, clientId, clientSecret) {
  const url = `${NAVER_API}?query=${encodeURIComponent(query)}&display=30&sort=date`;
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // 키 echo 방지
    const safe = body
      .replace(new RegExp(clientId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***')
      .replace(new RegExp(clientSecret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
    throw new Error(`Naver API ${res.status}: ${safe.slice(0, 200)}`);
  }
  const json = await res.json();
  return Array.isArray(json.items) ? json.items : [];
}

// ─────────────────────────────────────────────────────────────
// 매체 신뢰도 점수 (높을수록 신뢰)
// ─────────────────────────────────────────────────────────────
const TRUSTED_PUBLISHERS = {
  '연합뉴스': 30,
  '뉴시스': 25,
  'KBS': 20, 'MBC': 20, 'SBS': 20, 'YTN': 20,
  '중앙일보': 18, '조선일보': 18, '동아일보': 18, '한겨레': 18, '경향신문': 18,
  '한국경제': 15, '매일경제': 15, '서울경제': 15,
  'JTBC': 15, 'TV조선': 12, '채널A': 12, 'MBN': 12,
  '머니투데이': 12, '아시아경제': 10, '이데일리': 10,
};

function publisherScore(link) {
  if (!link) return 0;
  for (const [name, score] of Object.entries(TRUSTED_PUBLISHERS)) {
    if (link.includes(name) || link.includes(name.toLowerCase())) return score;
  }
  // 정부 도메인
  if (/\.go\.kr|\.gov\.kr/.test(link)) return 35;
  return 5;
}

// ─────────────────────────────────────────────────────────────
// 임팩트 키워드 점수
// ─────────────────────────────────────────────────────────────
const IMPACT_KEYWORDS = {
  '인상': 15, '확대': 15, '증액': 15, '상향': 12,
  '신설': 18, '신규': 12, '도입': 12, '시행': 10,
  '개편': 10, '확산': 8, '강화': 8, '추가': 8,
  '특별': 10, '첫': 10, '최대': 8, '역대': 12,
  '발표': 8, '결정': 8, '확정': 10,
};

function keywordScore(text) {
  let score = 0;
  for (const [kw, s] of Object.entries(IMPACT_KEYWORDS)) {
    if (text.includes(kw)) score += s;
  }
  return Math.min(score, 50); // cap
}

// ─────────────────────────────────────────────────────────────
// 신선도 점수 (최근일수록 high)
// ─────────────────────────────────────────────────────────────
function recencyScore(pubDate) {
  if (!pubDate) return 0;
  const ts = new Date(pubDate).getTime();
  if (Number.isNaN(ts)) return 0;
  const days = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  if (days < 1) return 40;
  if (days < 3) return 30;
  if (days < 7) return 20;
  if (days < 14) return 10;
  if (days < 30) return 5;
  return 0;
}

// ─────────────────────────────────────────────────────────────
// 후보 점수화
// ─────────────────────────────────────────────────────────────
function scoreItem(item, cat) {
  const title = clean(item.title);
  const desc = clean(item.description);
  const text = `${title} ${desc}`;

  const score =
    recencyScore(item.pubDate) +
    publisherScore(item.originallink || item.link) +
    keywordScore(text);

  return {
    title,
    description: desc,
    pubDate: item.pubDate,
    link: item.originallink || item.link,
    naverLink: item.link,
    category: cat,
    score,
  };
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────
async function main() {
  const env = await loadEnv();
  const clientId = env.NAVER_CLIENT_ID;
  const clientSecret = env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('❌ NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정');
    process.exit(1);
  }
  console.log('🔑 Naver API 키 로드 완료');

  // 카테고리별 검색
  const allCandidates = [];
  for (const group of KEYWORD_GROUPS) {
    for (const q of group.queries) {
      try {
        process.stdout.write(`\r🔍 ${group.cat}: ${q.padEnd(20)}`);
        const items = await searchNaver(q, clientId, clientSecret);
        for (const it of items) {
          allCandidates.push(scoreItem(it, group.cat));
        }
        // rate limit 대비 간단 delay
        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        console.warn(`\n⚠️ ${q} skip: ${e.message}`);
      }
    }
  }
  process.stdout.write('\n');
  console.log(`📦 후보 ${allCandidates.length}건 수집`);

  if (allCandidates.length === 0) {
    console.error('❌ 후보 0건 — 검색 실패 또는 키 권한 문제');
    process.exit(1);
  }

  // 중복 제거 (같은 링크)
  const seen = new Set();
  const unique = allCandidates.filter((c) => {
    if (!c.link || seen.has(c.link)) return false;
    seen.add(c.link);
    return true;
  });

  // 점수 desc 정렬
  unique.sort((a, b) => b.score - a.score);

  const top = unique[0];
  const candidates = unique.slice(1, 6); // 백업 5건

  // 출력 데이터 구성
  const output = {
    syncedAt: new Date().toISOString(),
    source: 'naver-news',
    headline: top.title,
    description: top.description.slice(0, 200),
    pubDate: top.pubDate,
    pubDateKR: formatDateKR(top.pubDate),
    link: top.link,
    category: top.category,
    score: top.score,
    candidates: candidates.map((c) => ({
      title: c.title,
      pubDate: c.pubDate,
      pubDateKR: formatDateKR(c.pubDate),
      link: c.link,
      category: c.category,
      score: c.score,
    })),
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`✅ 오늘의 이슈 선정 (점수 ${top.score})`);
  console.log(`   카테고리: ${top.category}`);
  console.log(`   ${top.title}`);
  console.log(`📂 ${OUT_PATH}`);
}

function formatDateKR(rfc822) {
  if (!rfc822) return '';
  const d = new Date(rfc822);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

main().catch((e) => {
  console.error('💥', e?.message ?? e);
  process.exit(1);
});
