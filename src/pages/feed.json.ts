import type { APIRoute } from 'astro';

// JSON Feed 1.1 — 오늘의 이슈 포스트 (AI 에이전트·모던 리더 친화)
// feed-issues.xml(RSS)과 동일 콘텐츠를 JSON Feed 포맷으로 제공
// https://www.jsonfeed.org/version/1.1/

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

  const top = posts.slice(0, 50);

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: '지원금가이드 — 오늘의 정책 이슈',
    home_page_url: `${SITE}/issues/`,
    feed_url: `${SITE}/feed.json`,
    description:
      '이번 주 가장 화제인 정부 지원금 정책 이슈. 자격·금액·신청 방법까지 한 페이지 요약.',
    language: 'ko-KR',
    authors: [{ name: '김준혁' }],
    items: top.map(({ date, slug, data }) => {
      const url = `${SITE}/issues/${date}/${slug}/`;
      const iso = new Date(data.publishedAt ?? date).toISOString();
      const trending = data.freshness?.trendingTerm
        ? `[트렌딩 ${data.freshness.trendingTerm} · ${data.freshness.daysActive ?? 1}일 연속] `
        : '';
      return {
        id: url,
        url,
        title: data.title,
        summary: data.metaDescription,
        content_text: trending + data.metaDescription,
        date_published: iso,
        authors: [{ name: '김준혁' }],
        tags: [data.category, ...(data.tags ?? []).slice(0, 5)],
      };
    }),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
