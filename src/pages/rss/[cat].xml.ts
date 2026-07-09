import type { APIRoute, GetStaticPaths } from 'astro';
import { issueUrlPath } from '@/lib/issue-url.mjs';

// 카테고리별 RSS — 이슈 포스트를 카테고리 채널로 분리 구독
// /rss/welfare.xml, /rss/housing.xml 등. feed-issues.xml(전체)의 카테고리 필터판.

const SITE = 'https://awoo.or.kr';

// 영문 슬러그 → 이슈 category(한글) 매핑
const CATEGORIES: Record<string, string> = {
  welfare: '복지',
  assets: '자산',
  education: '교육',
  agriculture: '농업',
  housing: '주거',
  startup: '창업',
  employment: '취업',
};

export const getStaticPaths: GetStaticPaths = () =>
  Object.keys(CATEGORIES).map((cat) => ({ params: { cat } }));

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

export const GET: APIRoute = async ({ params }) => {
  const cat = String(params.cat ?? '');
  const ko = CATEGORIES[cat];
  if (!ko) return new Response('Not found', { status: 404 });

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
    if (mod.default?.category !== ko) continue;
    posts.push({ date, slug, data: mod.default });
  }

  posts.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.data.publishedAt ?? '').localeCompare(a.data.publishedAt ?? '');
  });

  const top = posts.slice(0, 30);
  const lastBuildISO = top[0]?.data.publishedAt
    ? new Date(top[0].data.publishedAt).toUTCString()
    : new Date().toUTCString();
  const lastBuildISOAtom = top[0]?.data.publishedAt
    ? new Date(top[0].data.publishedAt).toISOString()
    : new Date().toISOString();

  const xmlItems = top
    .map(({ date, slug, data }) => {
      const url = `${SITE}${issueUrlPath(date, slug)}`;
      const pubDate = new Date(data.publishedAt ?? date).toUTCString();
      const tagCats = (data.tags ?? [])
        .slice(0, 5)
        .map((c) => `\n      <category>${escapeXml(c)}</category>`)
        .join('');
      const trending = data.freshness?.trendingTerm
        ? `[트렌딩 ${data.freshness.trendingTerm} · ${data.freshness.daysActive ?? 1}일 연속] `
        : '';
      return `    <item>
      <title>${escapeXml(data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>김준혁</dc:creator>
      <category>${escapeXml(data.category)}</category>${tagCats}
      <description>${escapeXml(trending + data.metaDescription)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>지원금가이드 — ${escapeXml(ko)} 이슈</title>
    <link>${SITE}/issues/</link>
    <atom:link href="${SITE}/rss/${cat}.xml" rel="self" type="application/rss+xml" />
    <description>${escapeXml(ko)} 분야 정부 지원금 정책 이슈만 모아 구독하세요.</description>
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
