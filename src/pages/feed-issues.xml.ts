import type { APIRoute } from 'astro';
import { issueUrlPath } from '@/lib/issue-url.mjs';

// 오늘의 이슈 포스트 전용 RSS — Substack·AI agent 인용 친화
// /feed.xml (지원금 신규)와 분리 — 검색 봇·뉴스 큐레이터가 카테고리별 구독 가능

const SITE = 'https://awoo.or.kr';

interface PostMeta {
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

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 본문 인라인 마크다운 → HTML. 상대 링크는 절대 URL로 (피드 리더·검색봇이 따라갈 수 있게) */
const inline = (s: string): string =>
  escapeHtml(s)
    .replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, (_m, t, href) => `<a href="${SITE}${href}">${t}</a>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

/**
 * 본문 전체 HTML — 네이버 서치어드바이저 RSS 가이드가 요구하는 "본문 전체 공개".
 * 요약(metaDescription)만 담으면 색인 대상이 되지 못한다.
 */
function renderFullText(data: PostMeta, url: string): string {
  const out: string[] = [];
  if (data.answer) out.push(`<p><strong>${inline(data.answer)}</strong></p>`);
  if (data.tldr?.length) {
    out.push(`<ul>${data.tldr.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
  }
  if (data.coreFacts) {
    const labels: Record<string, string> = {
      who: '대상',
      amount: '금액',
      deadline: '기간',
      where: '신청',
    };
    const rows = Object.entries(data.coreFacts)
      .filter(([, v]) => typeof v === 'string' && v)
      .map(([k, v]) => `<li><strong>${labels[k] ?? k}</strong> ${inline(v)}</li>`)
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

export const GET: APIRoute = async () => {
  const issueModules = import.meta.glob<{ default: PostMeta }>('/src/data/issues/*/*.json', {
    eager: true,
  });

  const posts: Array<{ date: string; slug: string; data: PostMeta }> = [];
  for (const [path, mod] of Object.entries(issueModules)) {
    const m = path.match(/\/issues\/(\d{4}-\d{2}-\d{2})\/([^/]+)\.json$/);
    if (!m) continue;
    const date = m[1];
    const slug = m[2];
    if (!date || !slug || slug.startsWith('_')) continue;
    posts.push({ date, slug, data: mod.default });
  }

  // 최신순 정렬 — date desc, 같은 날이면 publishedAt desc
  posts.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.data.publishedAt ?? '').localeCompare(a.data.publishedAt ?? '');
  });

  // 전문(content:encoded) 포함 → 네이버 RSS 10MB 제한 대비 30건으로 축소
  const top = posts.slice(0, 30);
  const lastBuildISO = top[0]?.data.publishedAt
    ? new Date(top[0].data.publishedAt).toUTCString()
    : new Date().toUTCString();

  const xmlItems = top
    .map(({ date, slug, data }) => {
      const url = `${SITE}${issueUrlPath(date, slug)}`;
      const pubDate = new Date(data.publishedAt ?? date).toUTCString();
      const categories = (data.tags ?? []).slice(0, 5);
      const trending = data.freshness?.trendingTerm
        ? `[트렌딩 ${data.freshness.trendingTerm} · ${data.freshness.daysActive ?? 1}일 연속] `
        : '';
      return `    <item>
      <title>${escapeXml(data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>김준혁</dc:creator>
      <category>${escapeXml(data.category)}</category>${categories
        .map((c) => `\n      <category>${escapeXml(c)}</category>`)
        .join('')}
      <description>${escapeXml(trending + data.metaDescription)}</description>
      <content:encoded><![CDATA[${renderFullText(data, url)}]]></content:encoded>
    </item>`;
    })
    .join('\n');

  const lastBuildISOAtom = top[0]?.data.publishedAt
    ? new Date(top[0].data.publishedAt).toISOString()
    : new Date().toISOString();

  // Cycle #4 P0-5: dc:creator + atom:updated 추가
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>지원금가이드 — 오늘의 정책 이슈</title>
    <link>${SITE}/issues/</link>
    <atom:link href="${SITE}/feed-issues.xml" rel="self" type="application/rss+xml" />
    <description>이번 주 가장 화제인 정부 지원금 정책 이슈. 자격·금액·신청 방법까지 한 페이지 요약.</description>
    <language>ko-KR</language>
    <dc:creator>김준혁</dc:creator>
    <lastBuildDate>${lastBuildISO}</lastBuildDate>
    <atom:updated>${lastBuildISOAtom}</atom:updated>
${xmlItems}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
