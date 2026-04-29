/**
 * Schema.org JSON-LD 헬퍼 — 모든 페이지에서 일관 사용.
 *
 * 정책:
 *   - @id 절대 URL 명시 (Google rich result 안정성)
 *   - inLanguage: 'ko-KR' 일괄
 *   - publisher 단일 Organization 참조 (상호 링크)
 */

const SITE_URL = 'https://awoo.or.kr';

export interface BreadcrumbItem {
  name: string;
  /** 절대 또는 상대 경로 ('/' 시작) */
  href: string;
}

/**
 * BreadcrumbList JSON-LD 생성.
 *
 * @example
 *   buildBreadcrumb([
 *     { name: '홈', href: '/' },
 *     { name: '지원금', href: '/subsidies/' },
 *   ])
 */
export function buildBreadcrumb(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.href.startsWith('http') ? item.href : `${SITE_URL}${item.href}`,
    })),
  };
}

export interface ItemListEntry {
  /** 절대 또는 상대 URL */
  url: string;
  /** 사용자 노출 이름 */
  name: string;
}

/**
 * CollectionPage + ItemList JSON-LD — hub 인덱스 페이지 SEO 향상.
 *
 * @example
 *   buildCollectionPage({
 *     name: '용어 사전',
 *     description: '...',
 *     pageUrl: '/glossary/',
 *     items: glossary.map(g => ({ url: `/glossary/${g.id}/`, name: g.term }))
 *   })
 */
export function buildCollectionPage(opts: {
  name: string;
  description: string;
  pageUrl: string;
  items: ItemListEntry[];
}) {
  const absolute = (href: string) => (href.startsWith('http') ? href : `${SITE_URL}${href}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${absolute(opts.pageUrl)}#collection`,
    name: opts.name,
    description: opts.description,
    url: absolute(opts.pageUrl),
    inLanguage: 'ko-KR',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListUnordered',
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: absolute(item.url),
        name: item.name,
      })),
    },
  };
}
