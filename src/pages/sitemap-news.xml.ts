import type { APIRoute } from 'astro';

// Cycle #33: Google News sitemap — 영구 포스트만 대상 (NewsArticle 자격)
// Google News 인덱싱: 발행 ≤ 2일 이내 글만 사용. 오래된 글 자동 제거 (Google 정책).
// 본 사이트는 publication.name='지원금가이드' (한국어).

interface PostMeta {
  title: string;
  publishedAt: string;
  date: string;
  tags?: string[];
}

const issueModules = import.meta.glob<{ default: PostMeta }>('/src/data/issues/*/*.json', {
  eager: true,
});

export const prerender = true;

export const GET: APIRoute = () => {
  const cutoffMs = Date.now() - 2 * 24 * 60 * 60 * 1000; // Google News 가이드라인: 2일 이내
  const recent: Array<{ url: string; title: string; publishedAt: string; tags: string[] }> = [];

  for (const [filePath, mod] of Object.entries(issueModules)) {
    const m = filePath.match(/\/issues\/(\d{4}-\d{2}-\d{2})\/([^/]+)\.json$/);
    if (!m) continue;
    const date = m[1];
    const slug = m[2];
    if (!date || !slug || slug.startsWith('_')) continue;
    const publishedAt = mod.default.publishedAt || `${date}T00:00:00.000Z`;
    if (new Date(publishedAt).getTime() < cutoffMs) continue;
    recent.push({
      url: `https://awoo.or.kr/issues/${date}/${slug}/`,
      title: mod.default.title,
      publishedAt,
      tags: mod.default.tags ?? [],
    });
  }

  // Google News는 최대 1000개 권장, 본 사이트는 일평균 1-3개라 cap 무관
  recent.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const escapeXml = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const items = recent
    .map(
      (p) => `  <url>
    <loc>${p.url}</loc>
    <news:news>
      <news:publication>
        <news:name>지원금가이드</news:name>
        <news:language>ko</news:language>
      </news:publication>
      <news:publication_date>${p.publishedAt}</news:publication_date>
      <news:title>${escapeXml(p.title)}</news:title>
      ${p.tags.length > 0 ? `<news:keywords>${escapeXml(p.tags.slice(0, 10).join(', '))}</news:keywords>` : ''}
    </news:news>
  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
