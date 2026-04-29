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

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'src', 'data', 'today-issue.json');
const HISTORY_PATH = join(ROOT, 'src', 'data', 'issues', '_history.json');
const CURATED_DIR = join(ROOT, 'src', 'data', 'subsidies', '_curated');
const GOV24_DIR = join(ROOT, 'src', 'data', 'subsidies', '_gov24');

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

// ─────────────────────────────────────────────────────────────
// 매칭 지원금 추출 — 헤드라인/토픽 → _gov24 + _curated 제목 매칭
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

function matchSubsidies(headline, term, category, allSubsidies, limit = 4) {
  const scored = allSubsidies.map((s) => {
    let score = 0;
    if (s.title && term && s.title.includes(term)) score += 20;
    if (s.title && headline) {
      const tokens = headline.match(/[가-힣]{3,}/g) || [];
      for (const t of tokens) {
        if (s.title.includes(t)) score += 5;
      }
    }
    if (Array.isArray(s.tags) && term) {
      for (const tag of s.tags) {
        if (tag.includes(term) || term.includes(tag)) score += 8;
      }
    }
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
      category: x.s.category,
      icon: x.s.icon,
      amount: x.s.amount,
      amountLabel: x.s.amountLabel,
    }));
}

// ─────────────────────────────────────────────────────────────
// _history.json 로드 (누적 시그널 — 있으면 활용)
// ─────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    return JSON.parse(await readFile(HISTORY_PATH, 'utf8'));
  } catch {
    return { byTerm: {} };
  }
}

// ─────────────────────────────────────────────────────────────
// 매체명 추출 (URL 도메인 → 한국 매체)
// ─────────────────────────────────────────────────────────────
const PUBLISHER_MAP = {
  'yna.co.kr': '연합뉴스', 'newsis.com': '뉴시스',
  'kbs.co.kr': 'KBS', 'imnews.imbc.com': 'MBC', 'sbs.co.kr': 'SBS', 'ytn.co.kr': 'YTN',
  'joongang.co.kr': '중앙일보', 'chosun.com': '조선일보', 'donga.com': '동아일보',
  'hani.co.kr': '한겨레', 'khan.co.kr': '경향신문',
  'hankyung.com': '한국경제', 'mk.co.kr': '매일경제', 'sedaily.com': '서울경제',
  'jtbc.co.kr': 'JTBC', 'mbn.co.kr': 'MBN',
  'mt.co.kr': '머니투데이', 'asiae.co.kr': '아시아경제', 'edaily.co.kr': '이데일리',
  'newspim.com': '뉴스핌', 'kukinews.com': '쿠키뉴스',
};
function extractPublisher(link) {
  if (!link) return null;
  try {
    const host = new URL(link).hostname.replace(/^www\./, '');
    for (const [k, v] of Object.entries(PUBLISHER_MAP)) {
      if (host.endsWith(k)) return v;
    }
    return host;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 다중 기사 집계 — 지자체/매체/최신 발표 추출
// ─────────────────────────────────────────────────────────────
// 시·군·구 추출 노이즈 필터 — 일반 한국어 단어 중 시/군/구로 끝나는 것
const CITY_NOISE_PREFIX = [
  '공백에', '홍보', '제공', '진행', '서비스', '실현', '예고', '자료',
  '향후', '다음', '실시', '주거', '가능', '대상', '시행', '관계',
  '제출', '선정', '경우', '발표', '이용', '신청', '검토', '준비',
];
function isNoiseCity(city) {
  for (const noise of CITY_NOISE_PREFIX) {
    if (city.startsWith(noise)) return true;
  }
  return false;
}

function aggregateArticles(articles) {
  // 행정구역: 한글 2~4자 + 시/군/구, 뒤에 조사·구두점·공백이 와야 함 (조사 뒤따라야 정식 지명일 가능성↑)
  const cityRe = /([가-힣]{2,4}(?:시|군|구))(?=[은는이가에의을를도과와로\s,\.\)\]·]|$)/g;
  const cities = new Map(); // 출현 빈도
  const publishers = new Set();
  let newestTs = 0;
  let newestArticle = null;

  for (const a of articles) {
    const text = `${a.title} ${a.description ?? ''}`;
    const seenInArticle = new Set();
    let m;
    cityRe.lastIndex = 0;
    while ((m = cityRe.exec(text)) !== null) {
      const city = m[1];
      if (city.length < 2 || city.length > 5) continue;
      if (isNoiseCity(city)) continue;
      if (seenInArticle.has(city)) continue;
      seenInArticle.add(city);
      cities.set(city, (cities.get(city) ?? 0) + 1);
    }
    const pub = extractPublisher(a.link);
    if (pub) publishers.add(pub);
    const ts = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    if (!Number.isNaN(ts) && ts > newestTs) {
      newestTs = ts;
      newestArticle = a;
    }
  }

  const topCities = [...cities.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => c);

  return {
    cities: topCities,
    publisherCount: publishers.size,
    publishers: [...publishers].slice(0, 8),
    newestArticle,
    newestPubDate: newestArticle?.pubDate ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// summary 자동 생성 — 다중 기사 집계 + 헤드라인 패턴 분기 + 훅 카피
// ─────────────────────────────────────────────────────────────
function generateSummary({ term, count, daysActive, totalCount, category, allArticles, matchedCount }) {
  const agg = aggregateArticles(allArticles);

  // 헤드라인 — 시청자 임팩트 우선순위
  // 1) 다수 지자체 동시 시행 (사회적 증거 강함)
  // 2) 며칠 연속 화제 (지속성)
  // 3) 매체 주목 (단발성)
  let headline;
  if (agg.cities.length >= 2) {
    headline = `${term} — ${agg.cities.length}개 지자체 동시 시행 중`;
  } else if (daysActive >= 5) {
    headline = `${term} — ${daysActive}일 연속 화제`;
  } else if (daysActive >= 3) {
    headline = `${term} — ${daysActive}일째 매체 주목`;
  } else {
    headline = `${term} — 이번 주 화제`;
  }

  // 부제 — 집계 시그널
  const parts = [];
  if (agg.cities.length >= 2) {
    parts.push(`${agg.cities.slice(0, 4).join('·')} 신청 접수`);
  } else if (agg.cities.length === 1) {
    parts.push(`${agg.cities[0]} 시행`);
  }
  const totalText = totalCount > count ? `누적 ${totalCount}회` : `${count}회`;
  parts.push(`매체 ${totalText} 언급`);
  if (matchedCount > 0) parts.push(`관련 지원금 ${matchedCount}건 매칭`);
  const subhead = parts.join(' · ');

  // 훅 카피 — 행동 유도, 시청자 감정 트리거
  let hookCopy = null;
  if (agg.cities.length >= 2) {
    hookCopy = `${agg.cities[0]}·${agg.cities[1]} 거주자라면 즉시 신청 검토. 일부 지자체는 신청 기한이 짧아 놓치기 쉽습니다.`;
  } else if (matchedCount > 0) {
    hookCopy = '받을 수 있는 분이라면 지금 확인하세요. 관련 지원금이 우리 DB에서 매칭됐습니다.';
  } else if (daysActive >= 3) {
    hookCopy = '며칠째 매체에서 주목받는 정책입니다. 자세한 분석을 확인하세요.';
  } else {
    hookCopy = '이번 주 처음 화제가 된 정책입니다. 정확한 정보를 빠르게 확인하세요.';
  }

  // 핵심 사실 4박스 — 빠른 스캔용
  const coreFacts = [
    {
      label: '시행 지역',
      value: agg.cities.length > 0 ? `${agg.cities.length}곳` : '확인 필요',
      sub: agg.cities.length > 0 ? agg.cities.slice(0, 2).join('·') : '',
    },
    {
      label: '매체 언급',
      value: `${totalCount}회`,
      sub: `${agg.publisherCount}개 매체`,
    },
    {
      label: '트렌드',
      value: daysActive >= 2 ? `${daysActive}일째` : '신규',
      sub: daysActive >= 2 ? '연속 보도' : '오늘 등장',
    },
    {
      label: '분야',
      value: category ?? '복지',
      sub: '카테고리',
    },
  ];

  return { headline, subhead, hookCopy, coreFacts, aggregate: agg };
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
// 안전한 텍스트 정제 — HTML 모든 태그·주석·CDATA·제어문자 제거.
// Claude 프롬프트로 들어가는 외부 텍스트의 prompt injection 표면 축소.
const MAX_TITLE_LEN = 200;
const MAX_DESC_LEN = 500;

function clean(text, maxLen = 0) {
  if (!text) return '';
  let s = String(text);
  // HTML 주석·CDATA 제거
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  // script·style 블록 통째 제거
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // 모든 HTML 태그 제거 (속성 포함)
  s = s.replace(/<[^>]*>/g, '');
  // HTML 엔티티 디코드
  s = s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  // 제어 문자 제거 (탭·개행 제외)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // javascript:·data: URI 스킴 흔적 무력화 (텍스트일 뿐이지만 토큰 절약)
  s = s.replace(/javascript:/gi, 'javascript_').replace(/data:/gi, 'data_');
  // 다중 공백 정리
  s = s.replace(/\s+/g, ' ').trim();
  if (maxLen > 0 && s.length > maxLen) {
    s = s.slice(0, maxLen) + '…';
  }
  return s;
}

function cleanTitle(t) { return clean(t, MAX_TITLE_LEN); }
function cleanDesc(t) { return clean(t, MAX_DESC_LEN); }

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
  const title = cleanTitle(item.title);
  const desc = cleanDesc(item.description);
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

  // 3. 트렌딩 토픽별 매칭 기사 전체 수집 + 대표 기사 선정
  const trendingWithArticles = [];
  for (const [term, count] of ranked) {
    const matching = articles.filter((a) => a.title.includes(term));
    const scored = matching
      .map((a) => scoreItem(a, deriveCategory(a.title + ' ' + a.description)))
      .filter(Boolean)
      .sort((s1, s2) => s2.score - s1.score);

    if (scored.length > 0) {
      trendingWithArticles.push({
        term,
        count,
        topArticle: scored[0],
        allArticles: scored, // 다중 소스 종합용 (sync 결과에는 압축, post 생성엔 전체 전달)
      });
    }
  }

  if (trendingWithArticles.length === 0) {
    console.error('❌ 모든 트렌딩 토픽이 필터 통과 못함');
    process.exit(1);
  }

  // 1위 = 최다 언급 트렌딩의 대표 기사
  const top = trendingWithArticles[0].topArticle;
  const topTrendTerm = trendingWithArticles[0].term;
  const topTrendCount = trendingWithArticles[0].count;

  // ─────────────────────────────────────────────────────────────
  // 매칭 지원금 추출 (Top 4) + 누적 히스토리 + 다중 기사 집계 summary
  // ─────────────────────────────────────────────────────────────
  const allSubsidies = await loadAllSubsidies();
  const history = await loadHistory();

  const matched = matchSubsidies(top.title, topTrendTerm, top.category, allSubsidies, 4);

  const histEntry = history.byTerm?.[topTrendTerm];
  const daysActive = (histEntry?.daysActive ?? 0) + 1;
  const totalCount = (histEntry?.totalCount ?? 0) + topTrendCount;

  // 1위 토픽의 전체 매칭 기사
  const topAllArticles = trendingWithArticles[0].allArticles ?? [top];

  const summary = generateSummary({
    term: topTrendTerm,
    count: topTrendCount,
    daysActive,
    totalCount,
    category: top.category,
    allArticles: topAllArticles,
    matchedCount: matched.length,
  });

  console.log(`📝 summary: "${summary.headline}"`);
  console.log(`           ${summary.subhead}`);
  console.log(`🌍 지자체: ${summary.aggregate.cities.join(', ') || '(없음)'}`);
  console.log(`📰 매체: ${summary.aggregate.publisherCount}곳`);
  console.log(`🎯 매칭 지원금 ${matched.length}건`);

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
    // 누적 시그널 + 다중 기사 집계 요약 (LLM 없이 결정론적)
    summary: {
      headline: summary.headline,
      subhead: summary.subhead,
      hookCopy: summary.hookCopy,
      coreFacts: summary.coreFacts,
    },
    aggregate: summary.aggregate, // cities, publisherCount, publishers, newestPubDate
    daysActive,
    totalCount,
    matchedSubsidies: matched,
    // 사이드바용 — Top 5 트렌딩 + 각각 대표 기사 + 매칭 기사 수
    trending: trendingWithArticles.slice(0, 5).map((t) => ({
      term: t.term,
      count: t.count,
      articleCount: t.allArticles?.length ?? 1,
      topArticle: {
        title: t.topArticle.title,
        link: t.topArticle.link,
        pubDate: t.topArticle.pubDate,
        pubDateKR: formatDateKR(t.topArticle.pubDate),
        category: t.topArticle.category,
      },
    })),
    // 1위 토픽의 전체 기사 메타 (post 생성에서 다중 소스 종합 시 활용)
    topTrendingArticles: topAllArticles.map((a) => ({
      title: a.title,
      description: (a.description ?? '').slice(0, 240),
      pubDate: a.pubDate,
      pubDateKR: formatDateKR(a.pubDate),
      link: a.link,
      publisher: extractPublisher(a.link) ?? '',
      category: a.category,
    })),
    // 디버그용 — 모든 트렌딩 N-gram 빈도 (Top 10)
    trendingAll: ranked.slice(0, 10).map(([term, count]) => ({ term, count })),
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
