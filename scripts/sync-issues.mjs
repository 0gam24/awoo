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
//   - "광역" 그룹: catch-all (시기성 핫토픽 흡수)
//   - "시사" 그룹: 시기성/긴급 (민생, 고유가, 재난 등)
//   - 나머지: 고정 카테고리
// ─────────────────────────────────────────────────────────────
// 광역 쿼리 3개 — 최신 정책 뉴스를 광범위하게 수집 (각 100건 최신순)
const BROAD_QUERIES = ['지원금', '보조금', '수당'];

// 트렌드 토픽 추출 대상 접미사 (N-gram의 마지막 단어)
const TRENDING_SUFFIXES = ['지원금', '보조금', '수당', '바우처', '장려금', '급여'];

// 카테고리 자동 분류 — 제목에 카테고리 키워드 매칭
const CAT_PATTERNS = [
  { cat: '주거', re: /주거|월세|전세|주택|임대|특별공급|분양|신혼/ },
  { cat: '취업', re: /취업|구직|고용|일자리|국민취업/ },
  { cat: '창업', re: /창업|소상공인|예비창업|정책자금/ },
  { cat: '교육', re: /장학|학비|교육|훈련|배움|평생교육/ },
  { cat: '자산', re: /도약계좌|저축계좌|자산|유류|난방비|유가/ },
  { cat: '농업', re: /농업|귀농|영농|농가|농어촌/ },
];

function deriveCategory(text) {
  for (const { cat, re } of CAT_PATTERNS) {
    if (re.test(text)) return cat;
  }
  return '복지'; // 기본값
}

// 제목 필수 키워드 — 제목에 하나라도 없으면 정책성 뉴스로 보지 않음
const TITLE_REQUIRED = [
  '지원금', '보조금', '장려금', '수당', '급여', '바우처', '이용권',
  '특별공급', '정책자금', '장학', '취업', '창업', '월세', '전세',
  '신청', '공모', '모집', '발표', '시행', '확대', '인상', '신설',
  '도약계좌', '저축계좌', '내일배움', '농업인', '귀농', '영농',
  '민생', '재난', '에너지', '고유가', '유류세', '난방비',
  '부모급여', '아동수당', '기초생활', '한부모',
];

function titleHasPolicyTerm(title) {
  return TITLE_REQUIRED.some((kw) => title.includes(kw));
}

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
// Naver News 검색 — 페이지네이션 (최대 100건/페이지, total ≤ 100)
// ─────────────────────────────────────────────────────────────
async function searchNaver(query, clientId, clientSecret, display = 100, start = 1) {
  const url = `${NAVER_API}?query=${encodeURIComponent(query)}&display=${display}&start=${start}&sort=date`;
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const safe = body
      .replace(new RegExp(clientId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***')
      .replace(new RegExp(clientSecret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
    throw new Error(`Naver API ${res.status}: ${safe.slice(0, 200)}`);
  }
  const json = await res.json();
  return Array.isArray(json.items) ? json.items : [];
}

// ─────────────────────────────────────────────────────────────
// 제목에서 트렌딩 N-gram 추출 (X지원금 / X보조금 / X수당 / X바우처 등)
// 한글 2~5자 + 접미사 패턴, 단어 경계 체크
// ─────────────────────────────────────────────────────────────
function extractTrendingNgrams(articles) {
  const counts = new Map();
  for (const a of articles) {
    const title = a.title;
    for (const suffix of TRENDING_SUFFIXES) {
      let idx = 0;
      while ((idx = title.indexOf(suffix, idx)) !== -1) {
        for (let preLen = 2; preLen <= 5; preLen++) {
          const start = idx - preLen;
          if (start < 0) continue;
          const pre = title.slice(start, idx);
          // 한글 연속 2~5자
          if (!/^[가-힣]+$/.test(pre)) continue;
          // 단어 경계: pre 직전이 한글이면 더 긴 단어 일부 → skip
          if (start > 0 && /[가-힣]/.test(title[start - 1])) continue;
          const ngram = pre + suffix;
          counts.set(ngram, (counts.get(ngram) ?? 0) + 1);
        }
        idx += suffix.length;
      }
    }
  }
  return counts;
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
  // 시기성/긴급
  '민생': 14, '긴급': 12, '재난': 10, '비상': 10,
  '지급': 8, '출시': 10, '시작': 8, '개시': 8,
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
// 정부 컨텍스트 — 정책/공공 뉴스 여부 판정
// (기업 제품 출시·일반 산업 뉴스를 후보에서 제외)
// 단독 모호한 한자(청/서/시 등) 제외 — 멀티자 키워드만
// ─────────────────────────────────────────────────────────────
const GOV_CONTEXT_KEYWORDS = [
  '정부', '부처', '지자체', '광역', '시청', '구청', '도청', '군청',
  '보건복지부', '국토교통부', '고용노동부', '기획재정부', '교육부', '여성가족부',
  '농림축산식품부', '중소벤처기업부', '산업통상자원부', '환경부', '문화체육관광부',
  '청년정책', '복지로', '정부24', '보조금24',
  '시도', '시군구', '국정',
  '대통령실', '국회', '여당', '야당',
  '시행', '공모', '모집', '신청', '접수',
  '지원금', '지원사업', '보조금', '장려금', '수당', '급여', '바우처', '이용권',
  '특별공급', '정책자금', '국가장학금', '국민취업', '국민연금', '기초생활',
  '특별재난', '재난지원', '민생', '긴급생계',
  '국세청', '통계청', '경찰청', '병무청', '검찰청',
];

function govContextScore(text) {
  let count = 0;
  for (const kw of GOV_CONTEXT_KEYWORDS) {
    if (text.includes(kw)) count++;
    if (count >= 4) break; // cap
  }
  return count;
}

// 상업/기업 뉴스 페널티 — 키워드 매칭 시 큰 음수
const COMMERCIAL_KEYWORDS = [
  '삼성', 'LG', '현대차', '기아', 'SK', '롯데', 'CJ', '한화', '신세계', 'GS',
  '포스코', '두산', 'OCI', '대한항공', '아시아나',
  '주가', '코스피', '코스닥', '주식', '증권', '시가총액', '실적', '영업이익', '매출액',
  '브랜드 출시', '신차', '신모델', '신제품',
  '광고', '마케팅', '프로모션',
  '인수합병', 'M&A', 'IPO',
  '특허', '히트펌프', '반도체',
];

function commercialPenalty(text) {
  let hits = 0;
  for (const kw of COMMERCIAL_KEYWORDS) {
    if (text.includes(kw)) hits++;
    if (hits >= 3) break;
  }
  return hits * -25; // 3 hits = -75
}

// ─────────────────────────────────────────────────────────────
// 후보 점수화
// ─────────────────────────────────────────────────────────────
function scoreItem(item, cat) {
  const title = clean(item.title);
  const desc = clean(item.description);
  const text = `${title} ${desc}`;

  // 1차 필터: 제목에 정책성 키워드 필수
  if (!titleHasPolicyTerm(title)) {
    return null;
  }

  const govCount = govContextScore(text);
  // 2차 필터: 정부 컨텍스트 2개 미만 → 제외
  if (govCount < 2) {
    return null;
  }

  const commercial = commercialPenalty(text);
  // 3차 필터: 상업 키워드 ≥ 2 → 제외
  if (commercial <= -50) {
    return null;
  }

  const score =
    recencyScore(item.pubDate) +
    publisherScore(item.originallink || item.link) +
    keywordScore(text) +
    govCount * 8 + // 정부 컨텍스트 가중치 (최대 +32)
    commercial; // 상업 페널티 (음수)

  return {
    title,
    description: desc,
    pubDate: item.pubDate,
    link: item.originallink || item.link,
    naverLink: item.link,
    category: cat,
    score,
    govCount,
  };
}

// ─────────────────────────────────────────────────────────────
// 메인 — 하이브리드: 광역 fetch → N-gram 빈도 → 트렌딩 토픽 → 베스트 기사 선정
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

  // 1. 광역 fetch — 최신순 100건씩 × 3 쿼리 = 300건
  const articles = [];
  const seenLinks = new Set();
  for (const q of BROAD_QUERIES) {
    try {
      process.stdout.write(`\r🔍 광역 fetch: ${q.padEnd(8)}`);
      const items = await searchNaver(q, clientId, clientSecret, 100);
      for (const it of items) {
        const link = it.originallink || it.link;
        if (!link || seenLinks.has(link)) continue;
        seenLinks.add(link);
        articles.push({
          title: clean(it.title),
          description: clean(it.description),
          pubDate: it.pubDate,
          link,
          naverLink: it.link,
        });
      }
      await new Promise((r) => setTimeout(r, 100));
    } catch (e) {
      console.warn(`\n⚠️ ${q} skip: ${e.message}`);
    }
  }
  process.stdout.write('\n');
  console.log(`📦 광역 수집 ${articles.length}건 (중복 제거)`);

  if (articles.length === 0) {
    console.error('❌ 기사 0건');
    process.exit(1);
  }

  // 2. 트렌딩 N-gram 추출 (제목에서 X지원금/X보조금/X수당/X바우처 패턴)
  const ngramCounts = extractTrendingNgrams(articles);
  const ranked = [...ngramCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count >= 2);

  console.log(`🔥 트렌딩 토픽 Top 10:`);
  ranked.slice(0, 10).forEach(([term, count], i) => {
    console.log(`   ${i + 1}. ${term} — ${count}회`);
  });

  if (ranked.length === 0) {
    console.error('❌ 트렌딩 토픽 0개 (모든 기사가 단발성)');
    process.exit(1);
  }

  // 3. 트렌딩 토픽별 매칭 기사 → 점수화 → 1위
  // 상위 트렌딩 토픽들을 순회하며 첫 번째 점수 통과 기사를 선정
  let top = null;
  let topTrendTerm = null;
  let topTrendCount = 0;
  const allScored = [];

  for (const [term, count] of ranked) {
    const matching = articles.filter((a) => a.title.includes(term));
    const scored = matching
      .map((a) => scoreItem(a, deriveCategory(a.title + ' ' + a.description)))
      .filter(Boolean)
      .sort((s1, s2) => s2.score - s1.score);

    allScored.push(...scored.map((s) => ({ ...s, trendTerm: term, trendCount: count })));

    if (!top && scored.length > 0) {
      top = scored[0];
      topTrendTerm = term;
      topTrendCount = count;
    }
  }

  if (!top) {
    console.error('❌ 모든 트렌딩 토픽이 필터 통과 못함');
    process.exit(1);
  }

  // 백업 후보 5건 (다른 트렌딩 토픽 또는 차순위 기사)
  const seenCandLinks = new Set([top.link]);
  const candidates = allScored
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      if (seenCandLinks.has(c.link)) return false;
      seenCandLinks.add(c.link);
      return true;
    })
    .slice(0, 5);

  // 출력
  const output = {
    syncedAt: new Date().toISOString(),
    source: 'naver-news',
    method: 'trending-ngram',
    headline: top.title,
    description: top.description.slice(0, 200),
    pubDate: top.pubDate,
    pubDateKR: formatDateKR(top.pubDate),
    link: top.link,
    category: top.category,
    score: top.score,
    trendingTopic: topTrendTerm,
    trendingTopicCount: topTrendCount,
    trending: ranked.slice(0, 10).map(([term, count]) => ({ term, count })),
    candidates: candidates.map((c) => ({
      title: c.title,
      pubDate: c.pubDate,
      pubDateKR: formatDateKR(c.pubDate),
      link: c.link,
      category: c.category,
      score: c.score,
      trendTerm: c.trendTerm,
      trendCount: c.trendCount,
    })),
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`\n✅ 오늘의 이슈: [${topTrendTerm}] (${topTrendCount}회 언급, score ${top.score})`);
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
