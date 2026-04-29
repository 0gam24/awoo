import type { APIRoute } from 'astro';

// 오늘의 이슈 포스트 전용 RSS — Substack·AI agent 인용 친화
// /feed.xml (지원금 신규)와 분리 — 검색 봇·뉴스 큐레이터가 카테고리별 구독 가능

const SITE = 'https://awoo.or.kr';

interface PostMeta {
  title: string;
  slug: string;
  metaDescription: string;
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

export const GET: APIRoute = async () => {
  const issueModules = import.meta.glob<{ default: PostMeta }>(
    '/src/data/issues/*/*.json',
    { eager: true },
  );

  const posts: Array<{ date: string; slug: string; data: PostMeta }> = [];
  for (const [path, mod] of Object.entries(issueModules)) {
    const m = path.match(/\/issues\/(\d{4}-\d{2}-\d{2})\/([^/]+)\.json$/);
    if (!m) continue;
    const slug = m[2]!;
    if (slug.startsWith('_')) continue;
    posts.push({ date: m[1]!, slug, data: mod.default });
  }

  // 최신순 정렬 — date desc, 같은 날이면 publishedAt desc
  posts.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.data.publishedAt ?? '').localeCompare(a.data.publishedAt ?? '');
  });

  const top = posts.slice(0, 50);
  const lastBuildISO = top[0]?.data.publishedAt
    ? new Date(top[0].data.publishedAt).toUTCString()
    : new Date().toUTCString();

  const xmlItems = top
    .map(({ date, slug, data }) => {
      const url = `${SITE}/issues/${date}/${slug}/`;
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
      <category>${escapeXml(data.category)}</category>${categories
        .map((c) => `\n      <category>${escapeXml(c)}</category>`)
        .join('')}
      <description>${escapeXml(trending + data.metaDescription)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>지원금가이드 — 오늘의 정책 이슈</title>
    <link>${SITE}/issues/</link>
    <atom:link href="${SITE}/feed-issues.xml" rel="self" type="application/rss+xml" />
    <description>매일 자동 큐레이션되는 정부 지원금 정책 이슈. 트렌딩 키워드별 SEO/GEO 표준 포스트.</description>
    <language>ko-KR</language>
    <lastBuildDate>${lastBuildISO}</lastBuildDate>
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
