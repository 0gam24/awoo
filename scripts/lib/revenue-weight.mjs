// 주제별 광고 수익성 — 같은 조회수라도 주제마다 애드센스 수익이 8~10배 다르다.
// 운영자 결정(2026-10-06): "빈틈 목록 순서에 수익성 반영". 자리가 열린 글감 중에서 돈 되는 주제를 위로 올린다.
//
// 배수의 근거: 애드센스 페이지별 자료 2026-09-13~19·09-27~10-03(운영자 제공, 로컬 docs/ops/adsense-private/ — 공개 저장소라 금액은 여기 쓰지 않는다).
// 묶음별 1000회당 수익을 사이트 평균 근처(연금·복지 자격 묶음)=1로 나눈 상대값이다. 표본이 두 주라 0.4~2.0으로 자른다.
// 두 주 비교에서 글별 수익은 그대로였고(같은 비중으로 다시 계산하면 1000회당 차이 1%) 독자가 읽는 주제만 바뀌었다 — 배수는 주제의 성질이다.
// 새 주간 자료가 오면 배수를 다시 맞춘다. 고칠 때는 .claude/commands/목록.md "정렬"도 같이.

/** 위에서부터 처음 맞는 묶음을 쓴다 — 혼인'지원금'·출산'지원금'이 지역 지원금으로 새지 않게 값싼 묶음을 먼저 본다 */
export const REVENUE_GROUPS = [
  // 연말정산 — 애드센스 실측 전이라 1배(중립). 1~3월 실측이 나오면 맞춘다. '세금 신고·납부'(0.4, 부가세 독자)와 독자층이 달라 따로 둔다
  {
    key: 'year-end-tax',
    label: '연말정산',
    weight: 1.0,
    re: /연말정산|간소화 ?서비스|환급금 ?조회|경정청구/,
  },
  {
    key: 'holiday',
    label: '공휴일',
    weight: 0.4,
    re: /공휴일|대체휴일|임시공휴일|연휴|휴무일|쉬나요/,
  },
  {
    key: 'tax',
    label: '세금 신고·납부',
    weight: 0.4,
    re: /부가세|부가가치세|예정고지|종합소득세|종소세|양도세|취득세/,
  },
  { key: 'travel', label: '여행·숙박', weight: 0.8, re: /반값여행|숙박|여행|페스타|관광/ },
  {
    key: 'family-youth',
    label: '출산·혼인·청년',
    weight: 0.4,
    re: /혼인|결혼|출산|아이맞이|부모급여|아동수당|첫만남|육아|청년도약|청년미래|도약계좌|청년적금|청년월세|K-?패스|모두의카드/i,
  },
  {
    key: 'work',
    label: '일·실업급여',
    weight: 0.4,
    re: /실업급여|구직급여|주휴|조기재취업|조기취업|퇴직금|알바|최저임금|육아휴직|출산휴가|고용보험|일자리|직업훈련|내일배움/,
  },
  {
    key: 'small-biz',
    label: '소상공인·바우처',
    weight: 2.0,
    re: /소상공인|자영업|노란우산|경영안정|정책자금|바우처|난방비/,
  },
  {
    key: 'housing',
    label: '주거·대출',
    weight: 0.85,
    re: /전세|월세|보금자리|디딤돌|버팀목|임대주택|행복주택|대출/,
  },
  {
    key: 'welfare',
    label: '연금·복지 자격',
    weight: 1.0,
    re: /기초연금|국민연금|노령연금|기초생활|생계급여|의료급여|중위소득|소득인정액|긴급복지|장려금|보훈|차상위|장애/,
  },
  {
    key: 'local-grant',
    label: '지역 지원금',
    weight: 2.0,
    re: /민생|회복지원금|생활안정|상품권|지역화폐|고유가|피해지원|기본소득|농촌|군민|도민|재난지원/,
  },
];

const NEUTRAL = { key: 'other', label: '기타', weight: 1.0 };

/**
 * @param {{query?: string, variant?: string, region?: string|null}} item
 * @returns {{key: string, label: string, weight: number, tag: string}}
 *   tag = 목록에 붙일 한 마디(돈 되는 주제 / 광고 수익 적음 / '')
 */
export function revenueOf(item) {
  const text = `${item?.query ?? ''} ${item?.variant ?? ''}`;
  let g = REVENUE_GROUPS.find((x) => x.re.test(text));
  // 지역 이름이 붙은 지원금 글감은 지역 지원금 — 김해 민생 1000회당이 사이트 평균의 2~4배였다
  if (!g && item?.region) g = REVENUE_GROUPS.find((x) => x.key === 'local-grant');
  if (!g) g = NEUTRAL;
  const tag = g.weight >= 1.5 ? '돈 되는 주제' : g.weight <= 0.5 ? '광고 수익 적음' : '';
  return { key: g.key, label: g.label, weight: g.weight, tag };
}

/** 노출 가능성이 '중간'(45) 이상이면 실제로 자리를 잡을 수 있는 글감으로 본다 */
const CAN_RANK = 45;

/**
 * 목록 정렬 — ① 자리 잡을 수 있는 글감(노출 가능성 45↑)이 먼저 ② 그 안에서 노출 가능성 × 수익 배수 큰 순.
 * 자리가 막힌 글감은 돈 되는 주제여도 아래로 — 1위를 못 하면 수익도 0이다.
 * 실측 전(점수 없음)은 맨 뒤.
 */
export function valueOrder(a, b) {
  const sa = a.exposure?.score;
  const sb = b.exposure?.score;
  if (sa == null && sb != null) return 1;
  if (sb == null && sa != null) return -1;
  if (sa == null && sb == null) return 0;
  const ta = sa >= CAN_RANK ? 0 : 1;
  const tb = sb >= CAN_RANK ? 0 : 1;
  if (ta !== tb) return ta - tb;
  const va = sa * revenueOf(a).weight;
  const vb = sb * revenueOf(b).weight;
  if (va !== vb) return vb - va;
  return sb - sa;
}
