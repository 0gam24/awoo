/**
 * 옛 도메인 주인(워드프레스 블로그)이 남긴 주소에 410 Gone으로 답한다.
 *
 * 2026-10-27부터 네이버가 이 옛 주소들을 다시 훑으면서 서치어드바이저 "소프트 404"가
 * 1개 → 86개(10/29)로 뛰었다. 우리는 404로 답했지만, 404 안내 페이지가 메뉴·추천이 가득한
 * 67KB 페이지라 "없는 주소인데 내용 있는 페이지"로 분류된 것으로 본다.
 * 그래서 옛 형식 주소만 골라 메뉴 없는 짧은 페이지 + 410(영구 삭제)으로 돌려준다.
 *
 * 우리 라우트와 겹치지 않는 형식만 잡는다 — 우리 분류는 /categories/, 저자는 /editor/,
 * 목록 쪽수는 /issues/all/2/ 처럼 하위 경로라 아래 패턴에 걸리지 않는다.
 * 정적 파일(dist/client)은 Worker보다 먼저 응답하므로 실제 파일이 있는 주소는 여기 오지 않는다.
 */

const LEGACY_PATTERNS: RegExp[] = [
  // 워드프레스 태그·분류·저자·쪽수 목록
  /^\/(tag|category|author|page)(\/|$)/i,
  // 워드프레스 내부 경로
  /^\/(wp-[^/]*|xmlrpc\.php)(\/|$)/i,
  /^\/comments\/feed(\/|$)/i,
  // 날짜 보관함 /2024/05/…
  /^\/(19|20)\d{2}\/\d{1,2}(\/|$)/,
  // 맨 앞 조각이 한글인 글 주소(퍼센트 인코딩된 한글 음절은 %EA~%ED로 시작)
  /^\/%E[A-D]/i,
];

export function isLegacyPath(pathname: string): boolean {
  return LEGACY_PATTERNS.some((re) => re.test(pathname));
}

// 첫 화면에 붙던 워드프레스 쿼리(/?p=123 등). 첫 화면이 그대로 200으로 열려 소프트 404·중복으로 잡혔다.
const LEGACY_HOME_PARAMS = [
  'p',
  'page_id',
  'cat',
  'tag',
  'm',
  'author',
  'feed',
  'attachment_id',
  's',
  'preview',
];

export function isLegacyHomeQuery(url: URL): boolean {
  return url.pathname === '/' && LEGACY_HOME_PARAMS.some((k) => url.searchParams.has(k));
}

const GONE_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>삭제된 주소 (410)</title>
</head>
<body>
<p>이 주소의 페이지는 영구 삭제됐습니다. <a href="https://awoo.or.kr/">지원금가이드 첫 화면으로 가기</a></p>
</body>
</html>
`;

/** 옛 주소면 410 응답, 아니면 null. */
export function legacyGoneResponse(url: URL): Response | null {
  if (!isLegacyPath(url.pathname) && !isLegacyHomeQuery(url)) return null;
  return new Response(GONE_HTML, {
    status: 410,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex',
      'cache-control': 'public, max-age=3600',
    },
  });
}
