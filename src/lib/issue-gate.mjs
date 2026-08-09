// 이슈 포스트 발행 게이트 — 단일 진실 소스 (SEO 감사 2026-08-09 W5).
//
// 상세 페이지([...path].astro)가 path 생성을 skip하는 조건과, 포스트를 나열하는
// 모든 소비처(/issues/ 인덱스, /issues/all/ 아카이브, sitemap-news.xml)가
// 반드시 같은 판정을 써야 한다 — 게이트에 걸린 포스트가 목록·뉴스 sitemap에는
// 실리는데 상세 페이지는 404가 되는 불일치 방지.
//
// 앱(.astro/.ts)과 스크립트(.mjs) 모두 이 파일 하나를 import 한다(issue-url.mjs와 동일 원칙).

import { isDateless, RESERVED_ISSUE_SLUGS, toUrlSlug } from './issue-url.mjs';

/**
 * 게이트 불통과 사유. 통과면 null.
 * @param {string} date  발행일 YYYY-MM-DD (데이터 디렉토리명)
 * @param {string} slug  파일 slug (-YYYY-MM-DD 접미사 포함)
 * @param {any} data     포스트 JSON
 * @returns {string | null}
 */
export function issueGateReason(date, slug, data) {
  // 본문 콘텐츠 누락 방어 — Claude max_tokens truncate 등으로 sections/faq/sources 손실 시
  const sections = Array.isArray(data?.sections) ? data.sections.length : 0;
  const faq = Array.isArray(data?.faq) ? data.faq.length : 0;
  const sources = Array.isArray(data?.sources) ? data.sources.length : 0;
  if (sections < 3 || faq < 1 || sources < 1) {
    return `본문 콘텐츠 누락 (sections=${sections}, faq=${faq}, sources=${sources})`;
  }
  // 날짜 없는 URL 대상(2026-07-10+)인데 URL slug가 예약어면 /issues/all 등과 충돌
  if (isDateless(date) && RESERVED_ISSUE_SLUGS.has(toUrlSlug(slug))) {
    return `예약어 URL slug 충돌: /issues/${toUrlSlug(slug)}/`;
  }
  return null;
}

/** 게이트 통과 여부 */
export function passesIssueGate(date, slug, data) {
  return issueGateReason(date, slug, data) === null;
}
