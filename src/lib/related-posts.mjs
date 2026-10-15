// 글 아래 "같은 주제 다른 글" 칸 — 2026-10-15 수익 계획(운영자 "진행해").
// 네이버 애널리틱스 9/2~8 실측: 방문 35,261회에 페이지뷰 36,964, 손님이 한 번 와서 1.05쪽만 보고 나간다.
// 날짜순 이전/다음 글은 주제와 상관없어 이어 읽기가 생기지 않는다.
//
// 고르는 법: 제목·검색어·태그의 낱말 가운데 드문 것(지역·제도 이름)이 겹칠수록 가깝다고 본다(IDF 합).
// 같은 화제어(freshness.trendingTerm)면 더한다. 그 안에서는 단가 높은 주제(revenueOf weight)를 조금 앞세운다.
// 낱말 둘 이상이 겹치는 글 → 드문 낱말 하나가 겹치는 글 → 같은 분류의 최신 글 순으로 채운다.
import { revenueOf } from '../../scripts/lib/revenue-weight.mjs';

// 거의 모든 글에 나오는 말 — 겹쳐도 같은 주제라는 뜻이 아니다
const STOP = new Set(
  `신청 지원금 지원 방법 대상 조건 기간 총정리 정리 얼마 언제 받는 받을 확인 사용처 지급 지급일 무엇 어디 어떻게
  지금 이유 차이 비교 가이드 안내 변경 달라진 새로 올해 내년 받나요 되나요 하나요 있나요 뭐가 누가 얼마나 나오나
  계산 계산법 금액 마감 시작 결과 사용 사용기한 조회 서류 자격 기준 소득 신청기간 신청방법 연장 개편 확대 인상
  전액 최대 최소 모집 선정 발표 공고 접수 무주택 거주 정부 복지 지역 전국`.split(/\s+/),
);
const MIN_STRICT = 4.5; // 낱말 둘 이상 겹칠 때 최소 점수
const MIN_LOOSE = 5; // 낱말 하나만 겹칠 때 — 그 낱말이 충분히 드물어야 한다
const REVENUE_TILT = 1.5; // 단가 배수 1에서 1 오를 때 더하는 점수

/** 낱말 하나를 비교용으로 다듬는다 — 조사 떼기, "김해시"·"영암군" → "김해"·"영암" */
function norm(word) {
  let t = word.replace(/[^가-힣]/g, '');
  if (t.length >= 4)
    t = t.replace(/(으로|에서|까지|부터)$/, '').replace(/[은는이가을를과와의도에로]$/, '');
  else if (t.length === 3) t = t.replace(/^([가-힣]{2})[은는을를과와의도에로]$/, '$1');
  if (t.length >= 3) t = t.replace(/^([가-힣]{2,})[시군구]$/, '$1');
  return t;
}

/** @param {{ title: string, targetQuery?: string, tags?: string[] }} data */
function tokensOf(data) {
  const text = [data.title, data.targetQuery ?? '', ...(data.tags ?? [])].join(' ');
  const out = new Set();
  for (const w of text.split(/[\s,·:;!?()「」『』"'“”‘’\-—/|]+/)) {
    const t = norm(w);
    if (t.length < 2 || STOP.has(t)) continue;
    out.add(t);
  }
  return out;
}

/**
 * @typedef {{ date: string, slug: string, data: { title: string, targetQuery?: string, tags?: string[], category?: string, freshness?: { trendingTerm?: string } } }} RelEntry
 * @typedef {{ date: string, slug: string, title: string }} RelPost
 */

/**
 * 모든 글의 "같은 주제 다른 글"을 한 번에 고른다. 키는 `${date}/${slug}`.
 * @param {RelEntry[]} entries
 * @param {number} [limit]
 * @returns {Map<string, RelPost[]>}
 */
export function buildRelatedMap(entries, limit = 4) {
  const n = entries.length;
  const toks = entries.map((e) => tokensOf(e.data));
  /** @type {Map<string, number>} */
  const df = new Map();
  for (const s of toks) for (const t of s) df.set(t, (df.get(t) ?? 0) + 1);
  /** @param {string} t */
  const idf = (t) => Math.log(n / (df.get(t) ?? 1));
  const tilt = entries.map(
    (e) =>
      REVENUE_TILT *
      (revenueOf({ query: `${e.data.title} ${e.data.targetQuery ?? ''}` }).weight - 1),
  );
  /** @type {Map<string, RelPost[]>} */
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const a = toks[i];
    const me = entries[i];
    const termA = me.data.freshness?.trendingTerm;
    /** @type {{ j: number, tier: number, rank: number }[]} */
    const cand = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const other = entries[j];
      if (other.data.title === me.data.title) continue;
      let score = 0;
      let shared = 0;
      for (const t of toks[j]) {
        if (!a.has(t)) continue;
        score += idf(t);
        shared++;
      }
      const sameTerm = Boolean(termA) && termA === other.data.freshness?.trendingTerm;
      if (sameTerm) score += 2;
      const rank = score + tilt[j];
      if ((shared >= 2 || sameTerm) && score >= MIN_STRICT) cand.push({ j, tier: 0, rank });
      else if (shared === 1 && score >= MIN_LOOSE) cand.push({ j, tier: 1, rank });
      else if (me.data.category && other.data.category === me.data.category)
        cand.push({ j, tier: 2, rank: tilt[j] });
    }
    cand.sort(
      (x, y) =>
        x.tier - y.tier ||
        (x.tier === 2 ? 0 : y.rank - x.rank) ||
        (entries[y.j].date > entries[x.j].date
          ? 1
          : entries[y.j].date < entries[x.j].date
            ? -1
            : 0),
    );
    map.set(
      `${me.date}/${me.slug}`,
      cand.slice(0, limit).map(({ j }) => ({
        date: entries[j].date,
        slug: entries[j].slug,
        title: entries[j].data.title,
      })),
    );
  }
  return map;
}
