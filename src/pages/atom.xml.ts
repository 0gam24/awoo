import type { APIRoute } from 'astro';
import { issueUrlPath } from '@/lib/issue-url.mjs';

// Atom 1.0 — 오늘의 이슈 포스트 (RSS·JSON Feed와 동일 콘텐츠, 표준 Atom 구독자용)
// feed-issues.xml(RSS)·feed.json(JSON Feed)과 3종 세트

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

  posts.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.data.publishedAt ?? '').localeCompare(a.data.publishedAt ?? '');
  });

  const top = posts.slice(0, 50);
  const updatedISO = top[0]?.data.publishedAt
    ? new Date(top[0].data.publishedAt).toISOString()
    : new Date().toISOString();

  const entries = top
    .map(({ date, slug, data }) => {
      const url = `${SITE}${issueUrlPath(date, slug)}`;
      const iso = new Date(data.publishedAt ?? date).toISOString();
      const cats = [data.category, ...(data.tags ?? []).slice(0, 5)]
        .map((c) => `\n    <category term="${escapeXml(c)}" />`)
        .join('');
      return `  <entry>
    <title>${escapeXml(data.title)}</title>
    <link href="${url}" />
    <id>${url}</id>
    <updated>${iso}</updated>
    <published>${iso}</published>
    <author><name>김준혁</name></author>${cats}
    <summary>${escapeXml(data.metaDescription)}</summary>
  </entry>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ko-KR">
  <title>지원금가이드 — 오늘의 정책 이슈</title>
  <link href="${SITE}/issues/" />
  <link href="${SITE}/atom.xml" rel="self" type="application/atom+xml" />
  <id>${SITE}/atom.xml</id>
  <updated>${updatedISO}</updated>
  <author><name>김준혁</name></author>
  <subtitle>이번 주 가장 화제인 정부 지원금 정책 이슈. 자격·금액·신청 방법까지 한 페이지 요약.</subtitle>
${entries}
</feed>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
