/**
 * Schema.org JSON-LD 헬퍼 — 모든 페이지에서 일관 사용.
 *
 * 정책:
 *   - @id 절대 URL 명시 (Google rich result 안정성)
 *   - inLanguage: 'ko-KR' 일괄
 *   - publisher 단일 Organization 참조 (상호 링크)
 */

const SITE_URL = 'https://awoo.or.kr';

/**
 * 운영 주체 — 푸터·about·schema에서 일관 사용 (코드 변경 시 단일 진실 소스).
 * 메모리: project_entity (스마트데이터샵 / 김준혁 / 등록번호 / 동 단위 소재지)
 */
export const ORG = {
  legalName: '스마트데이터샵',
  founder: '김준혁',
  taxID: '406-06-34485',
  address: '인천광역시 계양구 새벌로 88, 효성동',
  email: 'contact@awoo.or.kr',
  url: SITE_URL,
} as const;

/**
 * 사이트와이드 Organization JSON-LD — 모든 페이지에 1회 노출 (BaseLayout).
 * AI 인용·지식 그래프·E-E-A-T 신호의 단일 entity 소스.
 *
 * @id 앵커로 다른 schema(GovernmentService.provider, NewsArticle.publisher 등)에서
 * `{"@id": "https://awoo.or.kr/#organization"}` 참조하여 entity 일관성 유지.
 */
export function buildOrganization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: '지원금가이드',
    legalName: ORG.legalName,
    url: SITE_URL,
    logo: `${SITE_URL}/og-default.png`,
    email: ORG.email,
    taxID: ORG.taxID,
    founder: { '@type': 'Person', name: ORG.founder },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
      addressLocality: '인천광역시 계양구',
      streetAddress: '새벌로 88',
    },
    inLanguage: 'ko-KR',
    description: '정부 지원금을 페르소나·상황 단위로 정리한 비영리 정보 안내 사이트.',
  };
}

/**
 * 사이트와이드 WebSite JSON-LD — sitelinks·entity 신호.
 * SearchAction은 사이트 내 검색 라우트 부재로 생략 (가짜 신호 X).
 */
export function buildWebSite() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: '지원금가이드',
    url: SITE_URL,
    inLanguage: 'ko-KR',
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

export interface BreadcrumbItem {
  name: string;
  /** 절대 또는 상대 경로 ('/' 시작) */
  href: string;
}

/**
 * BreadcrumbList JSON-LD 생성.
 *
 * @param items 브레드크럼 항목
 * @param pageUrl 옵셔널 — 지정 시 `${pageUrl}#breadcrumb` @id 부여 (entity 그래프 강화, Cycle #4 P0-5)
 *
 * @example
 *   buildBreadcrumb([
 *     { name: '홈', href: '/' },
 *     { name: '지원금', href: '/subsidies/' },
 *   ], '/subsidies/')
 */
export function buildBreadcrumb(items: BreadcrumbItem[], pageUrl?: string) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.href.startsWith('http') ? item.href : `${SITE_URL}${item.href}`,
    })),
  };
  if (pageUrl) {
    const absolute = pageUrl.startsWith('http') ? pageUrl : `${SITE_URL}${pageUrl}`;
    base['@id'] = `${absolute}#breadcrumb`;
  }
  return base;
}

/**
 * HowTo schema — 단계별 가이드 (Cycle #5 P0-3)
 * Google rich result: 검색 결과에 단계 carousel 노출 가능.
 *
 * @example
 *   buildHowTo({
 *     name: '정부 지원금 신청하는 방법',
 *     totalTime: 'PT5M',
 *     steps: [{ name: '...', text: '...', url: '/guide/#step-1' }],
 *     tools: [{ name: '정부24', sameAs: 'https://www.gov.kr' }],
 *   })
 */
export function buildHowTo(opts: {
  name: string;
  description?: string;
  totalTime?: string;
  pageUrl: string;
  steps: Array<{ name: string; text: string; url?: string }>;
  tools?: Array<{ name: string; sameAs?: string }>;
}) {
  const absolute = (href: string) => (href.startsWith('http') ? href : `${SITE_URL}${href}`);
  const result: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${absolute(opts.pageUrl)}#howto`,
    name: opts.name,
    inLanguage: 'ko-KR',
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.url ? { url: absolute(s.url) } : {}),
    })),
  };
  if (opts.description) result.description = opts.description;
  if (opts.totalTime) result.totalTime = opts.totalTime;
  if (opts.tools && opts.tools.length > 0) {
    result.tool = opts.tools.map((t) => ({
      '@type': 'HowToTool',
      name: t.name,
      ...(t.sameAs ? { sameAs: t.sameAs } : {}),
    }));
  }
  return result;
}

/**
 * WebApplication schema — 인터랙티브 도구 (Cycle #5 P0-3)
 * /quick 5분 진단처럼 클라이언트 계산 도구를 entity로 명시.
 */
export function buildWebApplication(opts: {
  name: string;
  description: string;
  pageUrl: string;
  applicationCategory?: string;
  featureList?: string[];
}) {
  const absolute = (href: string) => (href.startsWith('http') ? href : `${SITE_URL}${href}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${absolute(opts.pageUrl)}#webapp`,
    name: opts.name,
    description: opts.description,
    url: absolute(opts.pageUrl),
    inLanguage: 'ko-KR',
    // Schema.org ApplicationCategory 표준 enum (Cycle #6 P0-8 회귀 차단)
    // 'GovernmentApplication'은 비표준 → 'BusinessApplication' + additionalType
    applicationCategory: opts.applicationCategory ?? 'BusinessApplication',
    additionalType: 'https://schema.org/GovernmentService',
    operatingSystem: 'Web',
    browserRequirements: 'JavaScript',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'KRW' },
    publisher: { '@id': `${SITE_URL}/#organization` },
    ...(opts.featureList && opts.featureList.length > 0
      ? { featureList: opts.featureList.join(', ') }
      : {}),
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
  // 빈 ItemList는 Google rich-result 가이드라인 위반 가능 — null 반환으로 호출부 분기
  if (opts.items.length === 0) return null;
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
