// 이슈 포스트 실제 수정일 — 단일 진실 소스 (2026-11-18).
//
// 상세 페이지([...path].astro)의 dateModified·"업데이트" 표시와, 글을 나열하는
// 목록(홈 최근 포스트, /issues/, /issues/all/)이 같은 날짜를 쓰게 한다.
// 목록은 이 날짜로 정렬해 고친 글이 위로 올라오게 한다.
//
// 실제로 고친 기록만 쓴다 — JSON dateModified와 updates[]의 가장 늦은 날짜.
// 트렌딩 재등장(lastSeen) 같은 "고치지 않은 신호"는 쓰지 않는다(2026-10-30 결정).
// 발행일(date)은 주소와 datePublished에 묶여 있으므로 절대 바꾸지 않는다.

/**
 * 발행일 이후의 실제 수정일(YYYY-MM-DD). 고친 적 없으면 null.
 * @param {string} date  발행일 YYYY-MM-DD (데이터 디렉토리명)
 * @param {{ dateModified?: string, updates?: Array<{ date: string }> } | undefined} data  포스트 JSON
 * @returns {string | null}
 */
export function issueModifiedDate(date, data) {
  const jsonModified =
    typeof data?.dateModified === 'string' ? data.dateModified.slice(0, 10) : null;
  const updateDates = Array.isArray(data?.updates)
    ? data.updates.map((u) => u?.date).filter((d) => typeof d === 'string')
    : [];
  const candidates = [jsonModified, ...updateDates].filter((d) => Boolean(d) && d > date).sort();
  return candidates.at(-1) ?? null;
}

/**
 * 목록 정렬 비교 함수 — 수정일(없으면 발행일) 최신순, 같으면 발행일 최신순.
 * @param {{ date: string, data: any }} a
 * @param {{ date: string, data: any }} b
 * @returns {number}
 */
export function compareIssuesByLatest(a, b) {
  const ka = issueModifiedDate(a.date, a.data) ?? a.date;
  const kb = issueModifiedDate(b.date, b.data) ?? b.date;
  if (ka !== kb) return ka < kb ? 1 : -1;
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return 0;
}
