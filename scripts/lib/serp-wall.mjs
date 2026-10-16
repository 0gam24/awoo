// 웹문서 앞 "벽" 추정 — 네이버 통합검색에서 웹문서 묶음이 얼마나 아래로 밀릴지 공식 API 신호로 짐작한다.
//
// 화면 배치는 어떤 공식 API도 주지 않고, 화면 수집은 robots 위반이라 2026-09-16에 끊었다(naver-rank-check.mjs).
// 그래서 운영자 눈 확인(eyeOffset)이 최종이고, 이 추정은 "누구를 눈으로 볼지" 고르는 데 쓴다.
// 기준점(2026-10-15 눈 확인 "그 아래" 2건): 소상공인 지원금 광고 10개·뉴스 100+·월 3.6만,
// 고향사랑기부제 광고 8개·뉴스 100+·월 10.2만. 눈 확인이 쌓이면 문턱을 다시 맞춘다.
//
// 신호와 무게(합이 벽 점수):
//   광고 평균 노출 수(검색광고 API plAvgDepth) 7개↑ 2점 · 4개↑ 1점 — 맨 위 파워링크·브랜드 콘텐츠
//   뉴스 최근 7일 50건↑(또는 100건 꽉 참) 1점 — 뉴스 묶음
//   블로그 최신 100건 중 제목에 검색어가 통째로 든 글 50건↑ 1점 · 20건↑ 0.5점 — 인플루언서·블로그 묶음
//   월간 검색 5만↑ 1점 · 2만↑ 0.5점 — 큰 머리 검색어일수록 AI 브리핑·공식 카드·이미지 묶음이 붙는다
//   지식백과에 같은 이름 항목 0.5점 — 지식백과 묶음
// 판정: 3점↑ 그 아래(3) · 1.5점↑ 한 번 스크롤(2) · 그 밑 첫 화면(1). 광고 값을 못 재면 partial 표시.

const NEWS_HEAVY = 50;
const BLOG_DAYS = 7;
const BLOG_TITLE_HEAVY = 50; // 최신 100건 중 절반이 제목에 그 검색어 — 블로그·인플루언서 묶음이 위에 붙는 수준
const BLOG_TITLE_SOME = 20;
const strip = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

/**
 * 블로그·지식백과 신호를 모은다. apiGet(name, params)는 호출한 쪽(HUB/레거시 이중 지원)이 넘긴다.
 * 하나가 실패해도 나머지는 살린다 — 실패한 값은 null.
 */
export async function fetchWallSignals(apiGet, query) {
  const out = { blog7: null, blog7Capped: false, blogTitleHits: null, encycHit: null };
  try {
    const json = await apiGet('blog', { query, display: 100, sort: 'date' });
    const since = Number(
      new Date(Date.now() + 9 * 3600 * 1000 - BLOG_DAYS * 86400_000)
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, ''),
    );
    const items = json.items ?? [];
    const dates = items.map((it) => String(it.postdate ?? '')).filter((d) => /^\d{8}$/.test(d));
    out.blog7 = dates.filter((d) => Number(d) >= since).length;
    out.blog7Capped = items.length > 0 && out.blog7 >= items.length;
    // 7일 수도, 최신 100건이 며칠에 몰렸는지도 웬만한 검색어가 다 꽉 찬다 — 블로그 검색은 낱말이 흩어져
    // 있어도 걸리기 때문이다(10/16 실측 16건 모두 7일 100+, 월 10회짜리 롱테일도 이틀에 100건).
    // 그래서 최신 100건 중 제목에 검색어가 통째로 들어간 글 수(blogTitleHits)로 그 주제 블로그 물량을 본다.
    const want = strip(query);
    out.blogTitleHits = items.filter((it) => strip(it.title).includes(want)).length;
  } catch {
    /* 블로그 신호 없이 간다 */
  }
  try {
    const json = await apiGet('encyc', { query, display: 3 });
    const want = strip(query);
    out.encycHit = (json.items ?? []).some((it) => strip(it.title) === want);
  } catch {
    /* 지식백과 신호 없이 간다 */
  }
  return out;
}

/**
 * @param {{ adDepth?: number | null, monthlySearch?: number | null, newsWall?: number | null, newsWallCapped?: boolean, blog7?: number | null, blog7Capped?: boolean, blogTitleHits?: number | null, encycHit?: boolean | null }} s
 * @returns {{ wallScore: number, wallEstimate: 1 | 2 | 3, wallReasons: string[], wallPartial: boolean }}
 */
export function wallOf(s) {
  let score = 0;
  const reasons = [];
  if (s.adDepth != null) {
    if (s.adDepth >= 7) score += 2;
    else if (s.adDepth >= 4) score += 1;
    if (s.adDepth >= 4) reasons.push(`광고 ${s.adDepth}개`);
  }
  if (s.newsWallCapped || (s.newsWall ?? 0) >= NEWS_HEAVY) {
    score += 1;
    reasons.push(`뉴스 7일 ${s.newsWallCapped ? '100+' : s.newsWall}건`);
  }
  if ((s.blogTitleHits ?? 0) >= BLOG_TITLE_HEAVY) {
    score += 1;
    reasons.push(`블로그 최신 100건 중 제목 일치 ${s.blogTitleHits}건`);
  } else if ((s.blogTitleHits ?? 0) >= BLOG_TITLE_SOME) {
    score += 0.5;
    reasons.push(`블로그 최신 100건 중 제목 일치 ${s.blogTitleHits}건`);
  }
  if (s.monthlySearch != null) {
    if (s.monthlySearch >= 50_000) {
      score += 1;
      reasons.push(`월 ${Math.round(s.monthlySearch / 10_000)}만 회`);
    } else if (s.monthlySearch >= 20_000) {
      score += 0.5;
      reasons.push(`월 ${Math.round(s.monthlySearch / 1_000) / 10}만 회`);
    }
  }
  if (s.encycHit) {
    score += 0.5;
    reasons.push('지식백과 항목');
  }
  const wallEstimate = score >= 3 ? 3 : score >= 1.5 ? 2 : 1;
  return { wallScore: score, wallEstimate, wallReasons: reasons, wallPartial: s.adDepth == null };
}

export const WALL_LABEL = { 1: '첫 화면', 2: '한 번 스크롤', 3: '그 아래' };

/** 큐·근사 측정으로 넘길 벽 필드. 측정 스크립트(scoutView) 이름과 같다 — 바꾸지 말고 추가만 */
export const WALL_FIELDS = [
  'adDepth',
  'adCompetition',
  'monthlySearch',
  'blogTitleHits',
  'encycHit',
  'wallScore',
  'wallEstimate',
  'wallReasons',
  'wallPartial',
];

/** 측정 결과에서 벽 필드만 골라 낸다. 없는 값(옛 측정)은 키째 뺀다 — 큐 JSON이 null로 불지 않게 */
export function wallPick(x) {
  const out = {};
  for (const k of WALL_FIELDS) if (x?.[k] !== undefined) out[k] = x[k];
  return out;
}
