/**
 * inline-glossary anchor — 빌드타임 string replace로 glossary term 자동 링크.
 *
 * Cycle #6 P0-1 (4사이클 보류 청산): entity-graph.json 첫 활용 후속.
 *
 * 알고리즘:
 *   - term + synonyms를 길이 desc 정렬 (긴 토큰 우선, 부분 매칭 회피)
 *   - 페이지당 term별 첫 등장 1회만 anchor
 *   - 페이지당 anchor 총 cap (오탐 방지)
 *   - HTML 안전: 이미 escape된 텍스트 입력만 허용 (호출부 책임)
 *   - 외부 의존 0, 런타임 JS 0 (빌드타임 변환)
 *
 * @example
 *   const anchored = injectGlossaryAnchors(html, glossaryMap);
 */

export interface GlossaryEntry {
  id: string;
  term: string;
  shortDef: string;
  synonyms?: string[];
}

const SITE_URL = 'https://awoo.or.kr';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * HTML 텍스트(이미 escape됨)에서 glossary term을 발견 시 첫 등장 1회만 anchor 치환.
 *
 * @param html      HTML 문자열 (이미 sanitize 된 입력)
 * @param entries   매칭 후보 glossary entry 배열 (entity-graph.json mentionedGlossary 기반 필터링 권장)
 * @param maxAnchorsPerPage 페이지당 anchor 총 cap (기본 5)
 */
export function injectGlossaryAnchors(
  html: string,
  entries: GlossaryEntry[],
  maxAnchorsPerPage = 5,
): string {
  if (!html || entries.length === 0) return html;

  // term + synonyms 합치고 길이 desc 정렬 — 긴 토큰 우선 (부분 매칭 회피)
  const tokens: Array<{ token: string; entry: GlossaryEntry }> = [];
  for (const entry of entries) {
    tokens.push({ token: entry.term, entry });
    for (const syn of entry.synonyms ?? []) {
      tokens.push({ token: syn, entry });
    }
  }
  tokens.sort((a, b) => b.token.length - a.token.length);

  const usedIds = new Set<string>();
  let anchorCount = 0;
  let result = html;

  for (const { token, entry } of tokens) {
    if (usedIds.has(entry.id)) continue;
    if (anchorCount >= maxAnchorsPerPage) break;
    if (token.length < 2) continue;

    // 안전한 매칭: 이미 anchor 안에 있는 토큰은 회피
    // <a ...>...</a> 안에 들어간 토큰은 매칭 X
    // 1) 첫 등장 위치 찾되, anchor 태그 안인지 검사
    const escaped = escapeRegex(token);
    const re = new RegExp(escaped);
    const match = re.exec(result);
    if (!match) continue;

    const start = match.index;
    // anchor 태그 안 검사 — 이전 <a 태그가 close 전인지
    const before = result.slice(0, start);
    const lastOpenA = before.lastIndexOf('<a ');
    const lastCloseA = before.lastIndexOf('</a>');
    if (lastOpenA > lastCloseA) continue; // <a> 안 → skip

    // HTML 태그 속성 안인지 (예: title="...token..." 또는 <... attr="token">) 검사
    const lastLt = before.lastIndexOf('<');
    const lastGt = before.lastIndexOf('>');
    if (lastLt > lastGt) continue; // 태그 열린 상태 → skip

    // 치환
    const anchor = `<a href="${SITE_URL}/glossary/${entry.id}/" class="gloss-link" title="${escapeAttr(entry.shortDef)}">${token}</a>`;
    result = result.slice(0, start) + anchor + result.slice(start + token.length);
    usedIds.add(entry.id);
    anchorCount++;
  }

  return result;
}
