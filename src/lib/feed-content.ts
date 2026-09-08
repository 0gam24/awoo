// RSS 본문 전문 렌더러 — feed-issues.xml / rss/[cat].xml 공용
//
// 네이버 서치어드바이저 RSS 가이드: "각 item의 본문은 일부가 아닌 모든 내용"을 요구한다.
// 요약(metaDescription)만 담은 피드는 제출해도 본문 색인 대상이 되지 못한다.

export const SITE = 'https://awoo.or.kr';

export interface FeedPost {
  title: string;
  slug: string;
  metaDescription: string;
  answer?: string;
  tldr?: string[];
  coreFacts?: Record<string, string>;
  sections?: Array<{ heading: string; lead?: string; body: string }>;
  table?: { title?: string; headers: string[]; rows: string[][] };
  faq?: Array<{ q: string; a: string }>;
  category: string;
  tags?: string[];
  publishedAt: string;
  date: string;
  freshness?: { trendingTerm?: string; daysActive?: number; totalCount?: number };
}

export const escapeXml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 본문 인라인 마크다운 → HTML. 상대 링크는 절대 URL로 (피드 리더·검색봇이 따라갈 수 있게) */
export const inline = (s: string): string =>
  escapeHtml(s)
    .replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, (_m, t, href) => `<a href="${SITE}${href}">${t}</a>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

const FACT_LABELS: Record<string, string> = {
  who: '대상',
  amount: '금액',
  deadline: '기간',
  where: '신청',
};

/** 포스트 본문 전체를 HTML로. content:encoded 안에 CDATA로 넣는다. */
export function renderFullText(data: FeedPost, url: string): string {
  const out: string[] = [];
  if (data.answer) out.push(`<p><strong>${inline(data.answer)}</strong></p>`);
  if (data.tldr?.length) {
    out.push(`<ul>${data.tldr.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
  }
  if (data.coreFacts) {
    const rows = Object.entries(data.coreFacts)
      .filter(([, v]) => typeof v === 'string' && v)
      .map(([k, v]) => `<li><strong>${FACT_LABELS[k] ?? k}</strong> ${inline(v)}</li>`)
      .join('');
    if (rows) out.push(`<ul>${rows}</ul>`);
  }
  for (const s of data.sections ?? []) {
    out.push(`<h2>${inline(s.heading)}</h2>`);
    if (s.lead) out.push(`<p>${inline(s.lead)}</p>`);
    for (const block of (s.body ?? '').split('\n\n')) {
      const lines = block.split('\n');
      if (lines.length > 0 && lines.every((l) => l.startsWith('- '))) {
        out.push(`<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`);
      } else if (block.trim()) {
        out.push(`<p>${inline(block)}</p>`);
      }
    }
  }
  if (data.table?.headers?.length) {
    const head = data.table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
    const body = (data.table.rows ?? [])
      .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
      .join('');
    out.push(
      `${data.table.title ? `<h2>${escapeHtml(data.table.title)}</h2>` : ''}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
    );
  }
  if (data.faq?.length) {
    out.push('<h2>자주 묻는 질문</h2>');
    for (const f of data.faq) {
      out.push(`<h3>${inline(f.q)}</h3><p>${inline(f.a)}</p>`);
    }
  }
  out.push(`<p><a href="${url}">원문 보기</a></p>`);
  // CDATA 조기 종료 방지
  return out.join('\n').replaceAll(']]>', ']]&gt;');
}

/** 트렌딩 접두사 — description 앞에 붙는다 */
export const trendingPrefix = (data: FeedPost): string =>
  data.freshness?.trendingTerm
    ? `[트렌딩 ${data.freshness.trendingTerm} · ${data.freshness.daysActive ?? 1}일 연속] `
    : '';

export interface FeedSubsidy {
  id: string;
  title: string;
  agency?: string | undefined;
  category: string;
  summary: string;
  amountLabel?: string | undefined;
  monthly?: string | undefined;
  period?: string | undefined;
  deadline?: string | undefined;
  status?: string | undefined;
  eligibility?: string[] | undefined;
  benefits?: string[] | undefined;
  documents?: string[] | undefined;
  applyUrl?: string | undefined;
}

const list = (heading: string, items?: string[]): string =>
  items?.length
    ? `<h2>${heading}</h2><ul>${items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`
    : '';

/**
 * 지원금 DB 항목의 전체 내용. 산문 본문이 없는 레코드형 문서라
 * 요약·자격·혜택·서류·기간 필드 전부가 곧 본문이다 — 일부만 담으면 네이버 요구사항 미달.
 */
export function renderSubsidyFullText(s: FeedSubsidy, url: string): string {
  const out: string[] = [`<p><strong>${inline(s.summary)}</strong></p>`];

  const facts: Array<[string, string | undefined]> = [
    ['소관', s.agency],
    ['분야', s.category],
    ['지원금액', s.monthly || s.amountLabel],
    ['신청기간', s.deadline || s.period],
    ['상태', s.status],
  ];
  const rows = facts
    .filter((f): f is [string, string] => Boolean(f[1]))
    .map(([k, v]) => `<li><strong>${k}</strong> ${inline(v)}</li>`)
    .join('');
  if (rows) out.push(`<ul>${rows}</ul>`);

  out.push(list('지원 대상·자격', s.eligibility));
  out.push(list('지원 내용', s.benefits));
  out.push(list('준비 서류', s.documents));

  if (s.applyUrl) out.push(`<p><a href="${s.applyUrl}">신청 바로가기</a></p>`);
  out.push(`<p><a href="${url}">원문 보기</a></p>`);

  return out.filter(Boolean).join('\n').replaceAll(']]>', ']]&gt;');
}
