// 노출 가능성 점수 — keyword-pipeline(매일 큐)과 wave-split(다음 물결 선점)이 같은 자로 매긴다.

/**
 * 노출 가능성(0~100) — "이 키워드로 새 글을 내면 네이버 웹문서 상단에 들어갈 수 있나".
 * 운영자 지시(2026-09-11): "빈틈 네이버 상위노출 가능성 높은 순서대로 정리해서 보여줘".
 *
 * 자리(최대 70) + 수요(최대 25) + 시기(5) − 조건 미충족(10).
 * 실측(serp)이 없으면 null — 점수를 지어내지 않고 '실측 대기'로 따로 모은다.
 */
export function exposureOf(item) {
  const s = item.serp;
  if (!s) return { score: null, label: '미측정', reasons: ['검색 결과 실측 전'] };
  const reasons = [];
  // 이미 1~3위면 그 자리는 우리 것이다 — 새 글의 값이 0
  if (s.rank != null && s.rank <= 3 && !item.phaseB) {
    return { score: 0, label: '이미 노출', reasons: [`자사 ${s.rank}위`] };
  }
  let v = 0;
  if (item.phaseB) {
    // 지급 후 단계: 신청 글과 찾는 말이 다르다. 관공서가 둘 이상 막고 있지 않으면 자리로 본다.
    v += 10;
    reasons.push('신청 끝나고 사용 단계');
    if ((item.regionInbound ?? 0) >= 100) {
      v += 10;
      reasons.push(`지역 유입 주 ${item.regionInbound}명`);
    } else if ((item.regionInbound ?? 0) >= 30) v += 5;
  }
  const open = item.phaseB
    ? (s.mainGovAbove ?? 0) <= 1 && !(s.sisterAbove > 0)
    : item.track === 'T1'
      ? s.verdictT1 === 'open'
      : s.verdictT2 === 'open';
  if (open) {
    v += 40;
    reasons.push('자리 열림');
  }
  const slots = s.openSlots ?? 0;
  if (slots >= 4) {
    v += 15;
    reasons.push(`빈자리 ${slots}`);
  } else if (slots >= 2) v += 10;
  else if (slots >= 1) v += 5;
  if (s.mainGovAbove === 0) {
    v += 10;
    reasons.push('위에 관공서 없음');
  } else if (s.mainGovAbove === 1) v += 5;
  // 언론: API 측정은 pressAbove가 null이다. null <= 3이 참이 되는 JS 함정을 막으려고 먼저 null을 거른다.
  // 뉴스 벽(newsWall·newsSameTitle)은 2026-09-29까지 기록만 — 점수에 넣지 않는다(운영자 결정 2026-09-15).
  if (s.pressAbove != null) {
    if (s.pressAbove === 0) {
      v += 10;
      reasons.push('위에 언론 없음');
    } else if (s.pressAbove <= 3) v += 5;
  }
  // 블록 위치: 운영자 눈 확인이 있으면 그것, 없으면 옛 HTML 측정 offset. 둘 다 없으면 0점(감점 없음).
  if (s.eyeOffset === 1) {
    v += 10;
    reasons.push('첫 화면(눈 확인)');
  } else if (s.eyeOffset === 2) {
    v += 5;
  } else if (s.eyeOffset == null && s.webDocOffset != null) {
    if (s.webDocOffset < 15) {
      v += 10;
      reasons.push('웹문서 블록 상단');
    } else if (s.webDocOffset < 30) v += 5;
  }
  if (s.rank != null && s.rank >= 4 && s.rank <= 10) {
    v += 5;
    reasons.push(`자사 ${s.rank}위 — 다른 의도로 재진입`);
  }
  const inb = Number(
    String(item.expectedInbound ?? '')
      .match(/(\d[\d,]*)/)?.[1]
      ?.replace(/,/g, ''),
  );
  const inbound = item.inbound7d ?? (Number.isFinite(inb) ? inb : null);
  if (inbound != null && inbound >= 100) {
    v += 10;
    // 실유입(inbound7d)과 추정치(expectedInbound)를 섞어 부르지 않는다 — 09-17 출산휴가급여 오표기
    reasons.push(item.inbound7d != null ? `주 ${inbound}명 유입` : `예상 주 ${inbound}명`);
  } else if (inbound != null && inbound >= 30) v += 5;
  if ((item.recent7 ?? 0) >= 3) v += 5;
  if (item.born) {
    v += 5;
    reasons.push('신생');
  }
  if (item.dStart != null && item.dStart >= -8 && item.dStart <= 7) {
    v += 5;
    reasons.push('개시 창 안');
  }
  if (/확보/.test(String(item.condition ?? ''))) {
    v -= 10;
    reasons.push('공고 URL 필요');
  }
  const scoreV = Math.max(0, Math.min(100, v));
  const label = scoreV >= 70 ? '높음' : scoreV >= 45 ? '중간' : '낮음';
  return { score: scoreV, label, reasons: reasons.slice(0, 3) };
}
