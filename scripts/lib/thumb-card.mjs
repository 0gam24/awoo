/**
 * 이슈 글 상단 "정보 카드" 썸네일 (1200×630) — generate-og-images.mjs에서 satori 노드로 렌더.
 *
 * 제목 카드(OG PNG)와 달리 제목 문장을 넣지 않는다. 대신
 *   분야·주제 색  +  주제 아이콘(div 도형으로 그린 평면 벡터)  +  지역·제도 / 금액 / 대상 / 상태 토큰
 * 으로 구성해 글마다 다른 카드가 되게 한다. 저장소 데이터만 사용 — 외부 API·크레딧 없음.
 *
 * 아이콘·색은 THEME_RULES(키워드 정규식, 위에서부터 첫 매치)로 고르고, 매치가 없으면 category 기본값.
 * 디자인을 바꾸면 THUMB_VERSION을 올려 전체 재생성.
 */

export const THUMB_VERSION = 'v4';

const INK = '#161a23';
const MUTED = '#6b7280';
const IVORY = '#f8f6f1';
const BRAND = '#0071e3';
const SKIN = '#f6cdb8';
const WHITE = '#ffffff';

const RT_LABELS = {
  'new-subsidies-weekly': '신규 비교',
  'new-subsidies-detail': '신규 심층',
  'deadline-imminent-weekly': '마감 임박',
  'weekly-essentials': '핵심 정리',
  'issue-followup': '후속',
};

/** 주제 테마 — primary(큰 금액·바), dark(분야 배지 글자), soft(배지·아이콘 배경), accent(상태 점·포인트) */
const THEMES = {
  localpay: { primary: '#0071e3', dark: '#003875', soft: '#e3eefc', accent: '#e8746a' },
  baby: { primary: '#e8746a', dark: '#8f3a32', soft: '#fbe6e1', accent: '#2f7d5b' },
  youth: { primary: '#2f7d5b', dark: '#1d4f3a', soft: '#e3f2ea', accent: '#f4b942' },
  house: { primary: '#0f8b8d', dark: '#0a5c5d', soft: '#e0f3f3', accent: '#e8746a' },
  job: { primary: '#3b4a8f', dark: '#25305c', soft: '#e6e9f6', accent: '#f2994a' },
  store: { primary: '#e07b39', dark: '#8f4a1c', soft: '#fbe9dc', accent: '#2f7d5b' },
  farm: { primary: '#5a9e3a', dark: '#376322', soft: '#e8f3e1', accent: '#c98a12' },
  senior: { primary: '#7c5cbf', dark: '#4d3a7a', soft: '#ece6f8', accent: '#f4b942' },
  medical: { primary: '#d6455d', dark: '#8a2b3b', soft: '#fbe3e7', accent: '#0f8b8d' },
  tax: { primary: '#4059ad', dark: '#28376c', soft: '#e4e8f7', accent: '#f4b942' },
  energy: { primary: '#f28c28', dark: '#9a5514', soft: '#fdebd9', accent: '#3b4a8f' },
  fuel: { primary: '#d9822b', dark: '#7d4713', soft: '#fbeadb', accent: '#1f4e79' },
  education: { primary: '#2b6cb0', dark: '#1a4470', soft: '#e1ecf8', accent: '#f4b942' },
  relief: { primary: '#556577', dark: '#34404d', soft: '#e6eaee', accent: '#f4b942' },
  loan: { primary: '#1f4e79', dark: '#12304b', soft: '#e0eaf3', accent: '#f4b942' },
  savings: { primary: '#c2417b', dark: '#7a2650', soft: '#f9e3ee', accent: '#f4b942' },
  welfare: { primary: '#0071e3', dark: '#003875', soft: '#e3eefc', accent: '#e8746a' },
};

/** 키워드 → 테마. 위에서부터 첫 매치. (장려금은 아동 키워드보다 먼저 — 자녀장려금은 세금 주제) */
const THEME_RULES = [
  ['savings', /저축|적금|자산형성|내일저축|희망저축|통장|연금저축|목돈|청년도약계좌|미래적금/],
  // 기초생활보장 제도 자체를 다루는 글 — 개별 급여명(주거급여·교육급여)에 끌려가지 않게 먼저 잡는다
  ['welfare', /기준\s*중위소득|생계급여 선정|기초생활보장|수급자 선정|복지급여 지급일/],
  [
    'tax',
    /근로장려금|자녀장려금|장려금|연말정산|세액공제|소득공제|세금|국세|홈택스|종합소득|종부세|재산세/,
  ],
  ['fuel', /고유가|유가|기름값|주유|유류|면세유|경유|휘발유/],
  [
    'medical',
    /장애|장기요양|간병|의료비|본인부담|건강보험|병원비|진료비|치료비|입원|약값|의료급여 부양|산정특례|암환자/,
  ],
  [
    'baby',
    // "출생연도 끝자리(요일제)"는 아동 주제가 아니므로 제외
    /출생(?!연도|년도)|출산|아동|아기|육아|보육|임신|부모급여|아이맞이|어린이|첫만남|영아|유아|신생아|산후|난임|다자녀/,
  ],
  [
    'localpay',
    /지역화폐|상품권|페이\b|페이로|페이 |민생(?:회복|안정)?\s*지원금|소비쿠폰|위문금|위로금|긴급생활|생활안정지원금|재난지원금|경제회복지원금/,
  ],
  ['education', /교육|학자금|장학|등록금|학교|수업|학습|돌봄교실|늘봄|입학/],
  ['youth', /청년|대학생|취준|졸업|청년월세|청년수당|학생/],
  ['house', /주거|전세|월세|임대|주택|청약|이사|보증금|LH|SH공사|공공임대/],
  [
    'job',
    /취업|구직|일자리|실업|고용|인턴|채용|근로자|퇴직|구직급여|실업급여|커리업|출산휴가|육아휴직|유산|사산휴가|휴가/,
  ],
  ['store', /창업|소상공인|자영업|가게|점포|매출|폐업|상가|상인|사장님|노란우산|배달/],
  ['farm', /농업|농민|농가|어업|어민|축산|귀농|농지|공익직불|수산|임업|농촌|농기계|비료/],
  ['senior', /노인|고령|어르신|기초연금|은퇴|65세|노령|경로|시니어|노후/],
  // 넓은 의료·에너지 폴백 (구체 규칙은 위쪽 medical·fuel이 먼저 잡는다)
  ['medical', /돌봄|요양|의료|건강|병원|진료|치료|정신|재활/],
  ['energy', /에너지|전기|가스|난방|연료|냉방|폭염|한파|전력/],
  ['relief', /재난|피해|복구|수해|산불|태풍|호우|지진(?!흥)|침수|재해|풍수해/],
  ['loan', /대출|융자|금리|보증|신용|채무|부채|햇살론|정책자금|이자/],
];

const CATEGORY_DEFAULT = {
  주거: 'house',
  취업: 'job',
  창업: 'store',
  교육: 'education',
  자산: 'savings',
  복지: 'welfare',
  농업: 'farm',
};

// ─────────────────────────────────────────────────────────────
// satori 노드 헬퍼
// ─────────────────────────────────────────────────────────────
function h(type, style, ...children) {
  const kids = children.filter((c) => c !== null && c !== undefined && c !== false);
  const finalStyle = kids.length > 1 && !style.display ? { display: 'flex', ...style } : style;
  const props = { style: finalStyle };
  if (kids.length === 1) props.children = kids[0];
  else if (kids.length > 1) props.children = kids;
  return { type, props };
}
/** 절대 배치 도형 단축 */
const box = (left, top, width, height, extra = {}) =>
  h('div', { position: 'absolute', left, top, width, height, ...extra });
const circle = (left, top, size, backgroundColor, extra = {}) =>
  box(left, top, size, size, { borderRadius: 999, backgroundColor, ...extra });
const heart = (left, top, s, color) =>
  h(
    'div',
    { position: 'absolute', left, top, width: s * 2, height: s * 2 },
    circle(0, 0, s, color),
    circle(s * 0.7, 0, s, color),
    box(s * 0.35, s * 0.28, s, s, { backgroundColor: color, transform: 'rotate(45deg)' }),
  );
const coin = (left, top, size, fill, rim) =>
  box(
    left,
    top,
    size,
    size,
    {
      borderRadius: 999,
      backgroundColor: fill,
      border: `${Math.round(size * 0.085)}px solid ${rim}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(size * 0.44),
      fontWeight: 700,
      color: rim,
    },
    '₩',
  );
const COIN = '#f4b942';
const COIN_RIM = '#c98a12';

/** 아이콘 공통 틀 — 420×420, 뒤에 soft 원 */
function frame(t, ...shapes) {
  return h(
    'div',
    { position: 'relative', width: 420, height: 420 },
    circle(30, 30, 360, t.soft),
    ...shapes,
  );
}

// ─────────────────────────────────────────────────────────────
// 주제 아이콘 16종
// ─────────────────────────────────────────────────────────────
const ICONS = {
  localpay: (t, x) =>
    frame(
      t,
      h(
        'div',
        {
          position: 'absolute',
          left: 92,
          top: 96,
          width: 300,
          height: 190,
          borderRadius: 26,
          backgroundColor: t.primary,
          transform: 'rotate(-8deg)',
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 26px',
          justifyContent: 'space-between',
        },
        box(0, 0, 58, 42, { borderRadius: 10, backgroundColor: COIN }),
        h(
          'div',
          { fontSize: x.cardLabel.length > 5 ? 26 : 32, fontWeight: 700, color: WHITE },
          x.cardLabel,
        ),
      ),
      coin(48, 262, 92, COIN, COIN_RIM),
      coin(112, 290, 92, COIN, COIN_RIM),
      coin(176, 262, 92, COIN, COIN_RIM),
      circle(318, 24, 70, t.accent, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }),
      circle(340, 46, 26, WHITE),
      box(336, 80, 34, 34, { backgroundColor: t.accent, transform: 'rotate(45deg)' }),
    ),
  baby: (t, x) =>
    frame(
      t,
      circle(96, 92, 120, SKIN),
      box(126, 84, 60, 26, { borderRadius: 999, backgroundColor: '#5b3a2e' }),
      circle(132, 146, 14, INK),
      circle(168, 146, 14, INK),
      box(70, 204, 172, 150, { borderRadius: 60, backgroundColor: t.primary }),
      box(104, 262, 104, 24, { borderRadius: 999, backgroundColor: WHITE }),
      heart(236, 60, 46, t.accent),
      h(
        'div',
        {
          position: 'absolute',
          left: 248,
          top: 176,
          width: 150,
          height: 160,
          borderRadius: 22,
          backgroundColor: WHITE,
          border: `6px solid ${t.primary}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        },
        box(0, 0, 138, 44, { backgroundColor: t.primary, borderRadius: 12 }),
        h('div', { fontSize: 44, fontWeight: 700, color: t.primary, marginTop: 56 }, x.year),
      ),
    ),
  youth: (t) =>
    frame(
      t,
      // 학사모: 판 + 캡 + 술, 졸업장
      box(80, 120, 260, 44, {
        borderRadius: 14,
        backgroundColor: t.primary,
        transform: 'rotate(-6deg)',
      }),
      box(140, 158, 140, 80, {
        borderTopLeftRadius: 70,
        borderTopRightRadius: 70,
        backgroundColor: t.dark,
      }),
      box(300, 150, 8, 90, { borderRadius: 4, backgroundColor: t.accent }),
      circle(292, 232, 24, t.accent),
      box(96, 262, 200, 70, {
        borderRadius: 35,
        backgroundColor: WHITE,
        border: `6px solid ${t.primary}`,
      }),
      box(176, 288, 40, 18, { borderRadius: 9, backgroundColor: t.accent }),
    ),
  house: (t) =>
    frame(
      t,
      box(126, 60, 170, 170, {
        backgroundColor: t.dark,
        transform: 'rotate(45deg)',
        borderRadius: 18,
      }),
      box(80, 168, 262, 178, { borderRadius: 14, backgroundColor: t.primary }),
      box(262, 96, 34, 60, { backgroundColor: t.dark, borderRadius: 6 }),
      box(178, 240, 66, 106, {
        borderTopLeftRadius: 33,
        borderTopRightRadius: 33,
        backgroundColor: WHITE,
      }),
      circle(104, 200, 44, WHITE),
      circle(274, 200, 44, WHITE),
      circle(30, 40, 60, t.accent),
    ),
  job: (t) =>
    frame(
      t,
      box(120, 78, 180, 60, { borderRadius: 16, border: `14px solid ${t.dark}` }),
      box(66, 130, 288, 200, { borderRadius: 24, backgroundColor: t.primary }),
      box(66, 200, 288, 14, { backgroundColor: t.dark }),
      box(180, 186, 60, 44, { borderRadius: 10, backgroundColor: t.accent }),
      circle(304, 44, 64, t.accent),
      box(322, 66, 28, 6, { backgroundColor: WHITE, borderRadius: 3 }),
      box(322, 80, 28, 6, { backgroundColor: WHITE, borderRadius: 3 }),
    ),
  store: (t) =>
    frame(
      t,
      box(60, 96, 300, 70, { borderRadius: 18, backgroundColor: t.primary }),
      box(96, 96, 40, 70, { backgroundColor: WHITE, opacity: 0.55 }),
      box(176, 96, 40, 70, { backgroundColor: WHITE, opacity: 0.55 }),
      box(256, 96, 40, 70, { backgroundColor: WHITE, opacity: 0.55 }),
      box(80, 160, 260, 180, {
        borderRadius: 16,
        backgroundColor: WHITE,
        border: `8px solid ${t.dark}`,
      }),
      box(118, 210, 70, 130, {
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        backgroundColor: t.dark,
      }),
      box(214, 210, 90, 70, {
        borderRadius: 10,
        backgroundColor: t.soft,
        border: `6px solid ${t.dark}`,
      }),
      circle(302, 40, 64, t.accent),
    ),
  farm: (t) =>
    frame(
      t,
      circle(290, 48, 80, COIN),
      box(140, 248, 140, 100, {
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        backgroundColor: t.accent,
      }),
      box(126, 232, 168, 30, { borderRadius: 10, backgroundColor: t.dark }),
      box(204, 110, 12, 130, { borderRadius: 6, backgroundColor: t.dark }),
      box(120, 120, 96, 54, {
        borderRadius: 48,
        backgroundColor: t.primary,
        transform: 'rotate(-30deg)',
      }),
      box(206, 88, 96, 54, {
        borderRadius: 48,
        backgroundColor: t.primary,
        transform: 'rotate(30deg)',
      }),
    ),
  senior: (t) =>
    frame(
      t,
      circle(120, 74, 120, SKIN),
      box(124, 60, 112, 50, {
        borderTopLeftRadius: 56,
        borderTopRightRadius: 56,
        backgroundColor: '#d9d9de',
      }),
      circle(158, 128, 12, INK),
      circle(192, 128, 12, INK),
      box(96, 200, 168, 160, {
        borderTopLeftRadius: 84,
        borderTopRightRadius: 84,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        backgroundColor: t.primary,
      }),
      box(296, 190, 12, 160, {
        borderRadius: 6,
        backgroundColor: t.dark,
        transform: 'rotate(8deg)',
      }),
      box(284, 176, 44, 14, { borderRadius: 7, backgroundColor: t.dark }),
      heart(262, 56, 40, t.accent),
    ),
  medical: (t) =>
    frame(
      t,
      circle(78, 78, 220, WHITE),
      box(158, 118, 60, 140, { borderRadius: 14, backgroundColor: t.primary }),
      box(118, 158, 140, 60, { borderRadius: 14, backgroundColor: t.primary }),
      box(246, 262, 130, 56, {
        borderRadius: 28,
        backgroundColor: WHITE,
        border: `6px solid ${t.accent}`,
        transform: 'rotate(-25deg)',
      }),
      box(246, 262, 65, 56, {
        borderTopLeftRadius: 28,
        borderBottomLeftRadius: 28,
        backgroundColor: t.accent,
        transform: 'rotate(-25deg)',
      }),
    ),
  tax: (t) =>
    frame(
      t,
      box(96, 70, 200, 250, {
        borderRadius: 18,
        backgroundColor: WHITE,
        border: `6px solid ${t.dark}`,
      }),
      box(130, 112, 130, 12, { borderRadius: 6, backgroundColor: t.soft }),
      box(130, 142, 100, 12, { borderRadius: 6, backgroundColor: t.soft }),
      box(130, 172, 120, 12, { borderRadius: 6, backgroundColor: t.soft }),
      box(130, 202, 80, 12, { borderRadius: 6, backgroundColor: t.soft }),
      coin(236, 220, 120, COIN, COIN_RIM),
      circle(70, 244, 72, t.primary),
      box(92, 276, 30, 10, { backgroundColor: WHITE, borderRadius: 5, transform: 'rotate(45deg)' }),
      box(104, 262, 10, 36, {
        backgroundColor: WHITE,
        borderRadius: 5,
        transform: 'rotate(45deg)',
      }),
    ),
  energy: (t) =>
    frame(
      t,
      circle(120, 76, 180, t.primary),
      box(170, 250, 80, 46, { borderRadius: 10, backgroundColor: t.dark }),
      box(184, 296, 52, 20, { borderRadius: 8, backgroundColor: t.dark }),
      box(196, 118, 28, 74, {
        borderRadius: 8,
        backgroundColor: WHITE,
        transform: 'rotate(20deg)',
      }),
      box(196, 170, 28, 60, {
        borderRadius: 8,
        backgroundColor: WHITE,
        transform: 'rotate(-20deg)',
      }),
      box(60, 150, 34, 10, {
        borderRadius: 5,
        backgroundColor: t.accent,
        transform: 'rotate(-30deg)',
      }),
      box(326, 150, 34, 10, {
        borderRadius: 5,
        backgroundColor: t.accent,
        transform: 'rotate(30deg)',
      }),
      box(194, 40, 34, 10, {
        borderRadius: 5,
        backgroundColor: t.accent,
        transform: 'rotate(90deg)',
      }),
    ),
  fuel: (t) =>
    frame(
      t,
      // 주유기: 본체 + 창 + 노즐·호스 + 기름방울
      box(110, 80, 170, 260, { borderRadius: 22, backgroundColor: t.primary }),
      box(134, 106, 122, 70, { borderRadius: 12, backgroundColor: WHITE }),
      box(150, 124, 90, 12, { borderRadius: 6, backgroundColor: t.soft }),
      box(150, 148, 60, 12, { borderRadius: 6, backgroundColor: t.soft }),
      box(96, 320, 198, 30, { borderRadius: 10, backgroundColor: t.dark }),
      box(296, 120, 14, 150, { borderRadius: 7, backgroundColor: t.dark }),
      box(296, 262, 60, 14, { borderRadius: 7, backgroundColor: t.dark }),
      box(342, 232, 30, 44, { borderRadius: 8, backgroundColor: t.accent }),
      circle(304, 44, 56, t.accent),
      box(318, 26, 28, 28, {
        backgroundColor: t.accent,
        transform: 'rotate(45deg)',
        borderRadius: 4,
      }),
    ),
  education: (t) =>
    frame(
      t,
      box(70, 110, 140, 200, {
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
        backgroundColor: WHITE,
        border: `6px solid ${t.dark}`,
      }),
      box(210, 110, 140, 200, {
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        backgroundColor: WHITE,
        border: `6px solid ${t.dark}`,
      }),
      box(100, 150, 80, 10, { borderRadius: 5, backgroundColor: t.soft }),
      box(100, 178, 60, 10, { borderRadius: 5, backgroundColor: t.soft }),
      box(240, 150, 80, 10, { borderRadius: 5, backgroundColor: t.soft }),
      box(240, 178, 60, 10, { borderRadius: 5, backgroundColor: t.soft }),
      box(204, 104, 12, 212, { backgroundColor: t.dark }),
      box(280, 40, 26, 150, {
        borderRadius: 8,
        backgroundColor: t.accent,
        transform: 'rotate(35deg)',
      }),
      circle(60, 60, 50, t.primary),
    ),
  relief: (t) =>
    frame(
      t,
      box(70, 90, 280, 140, {
        borderTopLeftRadius: 140,
        borderTopRightRadius: 140,
        backgroundColor: t.primary,
      }),
      box(204, 220, 12, 130, { borderRadius: 6, backgroundColor: t.dark }),
      box(170, 316, 46, 34, {
        borderBottomLeftRadius: 23,
        borderTopLeftRadius: 23,
        border: `10px solid ${t.dark}`,
        borderRight: 'none',
        borderTop: 'none',
      }),
      circle(64, 260, 26, t.accent),
      circle(320, 250, 26, t.accent),
      circle(296, 300, 20, t.accent),
    ),
  loan: (t) =>
    frame(
      t,
      box(148, 44, 124, 124, {
        backgroundColor: t.dark,
        transform: 'rotate(45deg)',
        borderRadius: 12,
      }),
      box(70, 106, 280, 34, { borderRadius: 8, backgroundColor: t.dark }),
      box(96, 150, 40, 130, { backgroundColor: t.primary, borderRadius: 6 }),
      box(190, 150, 40, 130, { backgroundColor: t.primary, borderRadius: 6 }),
      box(284, 150, 40, 130, { backgroundColor: t.primary, borderRadius: 6 }),
      box(70, 286, 280, 34, { borderRadius: 8, backgroundColor: t.dark }),
      coin(292, 250, 96, COIN, COIN_RIM),
    ),
  savings: (t) =>
    frame(
      t,
      box(80, 150, 260, 170, { borderRadius: 80, backgroundColor: t.primary }),
      box(96, 110, 50, 50, {
        backgroundColor: t.primary,
        transform: 'rotate(45deg)',
        borderRadius: 8,
      }),
      box(190, 132, 70, 16, { borderRadius: 8, backgroundColor: t.dark }),
      circle(308, 196, 60, t.dark),
      circle(320, 212, 12, WHITE),
      circle(338, 212, 12, WHITE),
      box(120, 300, 40, 40, {
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        backgroundColor: t.dark,
      }),
      box(260, 300, 40, 40, {
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        backgroundColor: t.dark,
      }),
      coin(196, 40, 84, COIN, COIN_RIM),
    ),
  welfare: (t) =>
    frame(
      t,
      heart(146, 60, 64, t.accent),
      box(60, 230, 150, 70, {
        borderRadius: 35,
        backgroundColor: SKIN,
        transform: 'rotate(22deg)',
      }),
      box(210, 230, 150, 70, {
        borderRadius: 35,
        backgroundColor: SKIN,
        transform: 'rotate(-22deg)',
      }),
      box(150, 268, 120, 70, { borderRadius: 35, backgroundColor: t.primary }),
    ),
};

// ─────────────────────────────────────────────────────────────
// 토큰 추출 (coreFacts·tags·title → 카드 문구)
// ─────────────────────────────────────────────────────────────
/** n자 초과 시 잘라 "…" — 가능하면 마지막 공백·구두점에서 끊어 단어 중간 절단을 피한다 */
const cut = (s, n) => {
  if (s.length <= n) return s;
  const head = s.slice(0, n - 1);
  const at = Math.max(
    head.lastIndexOf(' '),
    head.lastIndexOf('·'),
    head.lastIndexOf(','),
    head.lastIndexOf('('),
  );
  return `${(at >= Math.floor(n * 0.6) ? head.slice(0, at) : head).trimEnd()}…`;
};
const hasKo = (s) => /[가-힣]/.test(s);

export function pickTheme(post) {
  const text = [post.freshness?.trendingTerm, ...(post.tags ?? []), post.title]
    .filter(Boolean)
    .join(' ');
  for (const [name, re] of THEME_RULES) if (re.test(text)) return name;
  return CATEGORY_DEFAULT[post.category] ?? 'welfare';
}

const MONEY_RE =
  /(?:(1인당|최대|월|연|총|가구당|1회|하루|최소|기본|1인|한도)\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(억\s*원|억원|억|천만\s*원|천만원|천만|백만\s*원|백만원|만\s*원|만원|만(?![가-힣])|천\s*원|천원|원(?![가-힣]))/g;

function findMoney(text) {
  const found = [];
  for (const m of (text ?? '').matchAll(MONEY_RE)) {
    let unit = m[3].replace(/\s+/g, '');
    if (!unit.endsWith('원')) unit += '원';
    found.push({ prefix: m[1] ?? '', num: m[2], unit });
  }
  const pick =
    found.find((f) => f.prefix === '최대') ??
    found.find((f) => f.prefix === '1인당' || f.prefix === '1인') ??
    found.find((f) => f.prefix === '월') ??
    found[0];
  return pick ? `${pick.prefix ? `${pick.prefix} ` : ''}${pick.num}${pick.unit}` : null;
}

function extractAmount(post) {
  const src = post.coreFacts?.amount ?? '';
  // 1) 금액 설명의 금액 → 2) 제목·태그의 금액 → 3) 비율(소수 포함, 앞말이 명사면 붙임) → 4) 금액 설명 첫 구절 → 5) 분야 라벨
  const inAmount = findMoney(src);
  if (inAmount) return inAmount;
  const inTitle = findMoney([post.title, ...(post.tags ?? [])].join(' '));
  if (inTitle) return inTitle;
  const pct = src.match(/(?:([가-힣]{2,6})\s+)?(\d{1,3}(?:\.\d+)?)\s*%/);
  if (pct) {
    const ctx = pct[1] && !/[은는이가을를의로부터에서]$/.test(pct[1]) ? `${pct[1]} ` : '';
    return cut(`${ctx}${pct[2]}%`, 12);
  }
  const clause = firstClause(src, 14);
  if (clause.length >= 4) return clause;
  return `${post.category ?? ''} 지원`.trim();
}

/** 첫 구절 — 괄호·마침표·", "·" · "에서 끊고(숫자 사이 ·는 유지), 너무 짧으면 원문을 그대로 자른다 */
function firstClause(s, n) {
  const raw = (s ?? '').trim();
  const c = raw.split(/\(|\.\s|,\s|\s-\s|\s·\s|\s—\s/)[0].trim();
  return cut(c.length >= 4 ? c : raw, n);
}

function statusLine(post) {
  const raw = post.coreFacts?.deadline ?? '';
  const sentences = raw
    .split(/\.\s+|\.$/)
    .map((x) => x.trim())
    .filter(Boolean);
  let s = sentences[0] ?? '';
  if (s.length < 14 && sentences[1]) s = `${s} · ${sentences[1]}`;
  return cut(s, 30);
}

/** 지역·제도 줄 — 가장 구체적인 한글 태그(보통 지역+제도) → 트렌딩 term → 제목 */
function programLine(post) {
  const koTag = (post.tags ?? []).find((t) => hasKo(t));
  return cut(koTag ?? post.freshness?.trendingTerm ?? post.title, 22);
}

export function thumbTokens(post, dateStr) {
  const theme = pickTheme(post);
  const text = [post.title, ...(post.tags ?? []), post.coreFacts?.amount ?? ''].join(' ');
  const year = (text.match(/20\d\d/) ?? [String(new Date().getFullYear())])[0];
  // 지역화폐 카드 라벨 — 제목·태그·금액에 없으면 용어 정의·핵심정보(where/deadline)까지 훑는다
  const payText = [
    text,
    ...(post.definitions ?? []).map((d) => d.term ?? ''),
    post.coreFacts?.where ?? '',
    post.coreFacts?.deadline ?? '',
  ].join(' ');
  const payMatch = payText.match(/[가-힣]{1,4}(?:페이|사랑상품권|상품권)/);
  return {
    theme,
    date: dateStr.replaceAll('-', '.'),
    category: `${post.category ?? '지원금'} 이슈`,
    kind: RT_LABELS[post.reportType] ?? '이슈',
    program: programLine(post),
    amount: extractAmount(post),
    who: firstClause(post.coreFacts?.who, 24),
    status: statusLine(post),
    year,
    cardLabel: payMatch ? payMatch[0].slice(0, 8) : '지역화폐',
  };
}

export function thumbHash(post, dateStr) {
  return JSON.stringify([
    THUMB_VERSION,
    dateStr,
    post.title,
    post.category,
    post.reportType,
    post.tags,
    post.freshness?.trendingTerm,
    post.coreFacts,
  ]);
}

// ─────────────────────────────────────────────────────────────
// 카드 노드
// ─────────────────────────────────────────────────────────────
export function buildThumbCard(post, dateStr) {
  const x = thumbTokens(post, dateStr);
  const t = THEMES[x.theme];
  const icon = ICONS[x.theme](t, x);
  const amountSize = x.amount.length <= 8 ? 92 : x.amount.length <= 11 ? 76 : 62;
  const pill = (text, bg, fg) =>
    h(
      'div',
      {
        display: 'flex',
        padding: '8px 22px',
        borderRadius: 999,
        backgroundColor: bg,
        color: fg,
        fontSize: 26,
        fontWeight: 700,
      },
      text,
    );

  return h(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'row',
      backgroundColor: IVORY,
      fontFamily: 'Pretendard',
      position: 'relative',
    },
    h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        padding: '56px 0 56px 72px',
        justifyContent: 'space-between',
        width: 720,
      },
      h(
        'div',
        { display: 'flex', alignItems: 'center', gap: 14 },
        h(
          'div',
          {
            width: 44,
            height: 44,
            borderRadius: 11,
            backgroundColor: BRAND,
            color: WHITE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 700,
          },
          '지',
        ),
        h('div', { fontSize: 28, fontWeight: 700, color: INK }, '지원금가이드'),
        h('div', { fontSize: 24, color: MUTED, marginLeft: 12 }, x.date),
      ),
      h(
        'div',
        { display: 'flex', flexDirection: 'column', gap: 18 },
        h(
          'div',
          { display: 'flex', gap: 10 },
          pill(x.category, t.soft, t.dark),
          pill(x.kind, '#eceae4', MUTED),
        ),
        h(
          'div',
          { fontSize: 40, fontWeight: 700, color: INK, letterSpacing: '-0.01em' },
          x.program,
        ),
        h(
          'div',
          {
            fontSize: amountSize,
            fontWeight: 700,
            color: t.primary,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
          },
          x.amount,
        ),
        h('div', { fontSize: 32, color: INK }, x.who),
        h(
          'div',
          { display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 },
          h('div', { width: 16, height: 16, borderRadius: 999, backgroundColor: t.accent }),
          h('div', { fontSize: 26, color: MUTED }, x.status),
        ),
      ),
      h('div', { fontSize: 24, color: MUTED }, 'awoo.or.kr'),
    ),
    h(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 480,
        height: '100%',
      },
      icon,
    ),
    box(0, 616, 1200, 14, { backgroundColor: t.primary }),
  );
}
