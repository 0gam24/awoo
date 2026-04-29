import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { recentlyAddedSlugs, getRegDateISO } from '@/lib/subsidies-meta';

const SITE = 'https://awoo.or.kr';

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = async () => {
  const subsidies = await getCollection('subsidies');
  const bySlug = new Map(subsidies.map((s) => [s.data.id, s.data]));

  // 최근 등록 30건
  const items = recentlyAddedSlugs(30)
    .map(({ slug, regDate }) => ({ s: bySlug.get(slug), regDate }))
    .filter((x): x is { s: NonNullable<ReturnType<typeof bySlug.get>>; regDate: number } => x.s !== undefined);

  const lastBuildISO = items[0]?.regDate ? new Date(items[0].regDate).toUTCString() : new Date().toUTCString();

  const xmlItems = items
    .map(({ s, regDate }) => {
      const url = `${SITE}/subsidies/${s.id}/`;
      const pubDate = new Date(regDate).toUTCString();
      return `    <item>
      <title>${escapeXml(s.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(s.category)}</category>
      <description>${escapeXml(s.summary)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>지원금가이드 — 신규 정부 지원금</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>최근 새로 등록된 정부 지원금을 한눈에 확인하세요.</description>
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
