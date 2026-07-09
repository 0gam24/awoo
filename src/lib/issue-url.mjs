// 이슈 포스트 URL 단일 헬퍼 (2026-07-09 운영자 지시 — 구글 SEO).
// 정책: 2026-07-10 발행분부터 URL에서 날짜를 제거해 /issues/{slug}/ 로 발행.
//       그 이전 발행분은 기존 /issues/{date}/{slug}/ 를 그대로 유지(색인 보존).
// 데이터 파일 경로·slug(-YYYY-MM-DD 접미사)·lint 4중 일치는 변경하지 않는다 — URL만 파생.
// 앱(.astro/.ts)과 스크립트(.mjs) 모두 이 파일 하나를 import 한다(중복 금지).

/** 이 날짜(포함) 이후 발행분부터 날짜 없는 URL */
export const DATELESS_CUTOFF = '2026-07-10';

/**
 * date-less URL 금지 slug — /issues/ 하위 정적·동적 라우트(all/main/topics/index 등)와
 * 충돌하면 빌드가 깨지므로 예약. 신규 포스트 파일 slug가 이 값이면 lint가 차단한다.
 */
export const RESERVED_ISSUE_SLUGS = new Set([
  'all',
  'main',
  'new',
  'topics',
  'index',
  'archived',
  'feed',
  'rss',
]);

/** 파일 slug에서 -YYYY-MM-DD 접미사 제거 → URL slug. 접미사 없으면 그대로. */
export function toUrlSlug(slug) {
  return String(slug).replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

/** 해당 발행일이 날짜 없는 URL 대상인지 */
export function isDateless(date) {
  return typeof date === 'string' && date >= DATELESS_CUTOFF;
}

/**
 * 이슈 포스트의 사이트 상대 경로. 트레일링 슬래시 포함.
 * @param {string} date  발행일 YYYY-MM-DD (데이터 디렉토리명)
 * @param {string} slug  파일 slug (-YYYY-MM-DD 접미사 포함)
 * @returns {string} 예) /issues/oil-relief-usage-period-merchants/  또는  /issues/2026-07-08/oil-relief-...-2026-07-08/
 */
export function issueUrlPath(date, slug) {
  return isDateless(date) ? `/issues/${toUrlSlug(slug)}/` : `/issues/${date}/${slug}/`;
}

/**
 * catch-all 라우트 [...path] 의 param 값(선행/후행 슬래시 없음).
 * @returns {string} 예) 'oil-relief-usage-period-merchants'  또는  '2026-07-08/oil-relief-...-2026-07-08'
 */
export function issuePathParam(date, slug) {
  return isDateless(date) ? toUrlSlug(slug) : `${date}/${slug}`;
}

/** 절대 URL */
export function issueUrl(date, slug, site = 'https://awoo.or.kr') {
  return `${site}${issueUrlPath(date, slug)}`;
}
