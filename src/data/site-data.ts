/**
 * 사이트 전역 상수 — 빠르게 참조 가능한 데이터
 * 페르소나·지원금·이슈는 Astro Content Collections로 관리되지만,
 * 카테고리·중위소득·오늘의 이슈처럼 단일 객체는 여기에.
 */

// 2026년 기준 중위소득 (만원/월) — 보건복지부 고시
export const MEDIAN_INCOME: Record<number, number> = {
  1: 239,
  2: 393,
  3: 502,
  4: 609,
  5: 711,
  6: 808,
};

export interface IncomeThreshold {
  pct: number;
  name: string;
  color: string;
  desc: string;
}

export const INCOME_THRESHOLDS: IncomeThreshold[] = [
  { pct: 30, name: '생계급여', color: '#dc2626', desc: '기초생활보장 생계급여 수급권' },
  { pct: 40, name: '의료급여', color: '#ea580c', desc: '기초생활보장 의료급여 수급권' },
  { pct: 47, name: '주거급여', color: '#d97706', desc: '기초생활보장 주거급여 수급권' },
  {
    pct: 50,
    name: '교육급여 · 차상위',
    color: '#ca8a04',
    desc: '교육급여 + 차상위계층 (각종 감면·지원 대상)',
  },
  {
    pct: 60,
    name: '청년월세지원·근로장려금',
    color: '#16a34a',
    desc: '청년 월세, EITC, 일부 복지 지원',
  },
  {
    pct: 75,
    name: '청년도약계좌·반값등록금',
    color: '#0891b2',
    desc: '청년 자산형성, 국가장학금 II유형',
  },
  { pct: 100, name: '중위소득 100%', color: '#2563eb', desc: '신혼부부 특공 (소득기준 100%)' },
  { pct: 150, name: '중위소득 150%', color: '#7c3aed', desc: '신혼부부 특공 맞벌이 등 일부' },
];

export interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export const CATEGORIES: Category[] = [
  { id: 'all', name: '전체', icon: 'sparkles', count: 10 },
  { id: '주거', name: '주거 (월세·전세·분양)', icon: 'cat-housing', count: 2 },
  { id: '취업', name: '취업·재취업', icon: 'cat-employment', count: 1 },
  { id: '창업', name: '창업·소상공인', icon: 'cat-startup', count: 3 },
  { id: '교육', name: '교육·훈련', icon: 'cat-education', count: 1 },
  { id: '자산', name: '자산 형성', icon: 'cat-wealth', count: 1 },
  { id: '복지', name: '복지·돌봄', icon: 'cat-welfare', count: 2 },
];

// 오늘의 이슈 (메인 헤드라인)
export interface PersonaImpact {
  personaId: string;
  verdict: 'eligible' | 'partial' | 'ineligible';
  label: string;
  detail: string;
}

export interface TrendingItem {
  rank: number;
  title: string;
  delta: string;
  hot?: boolean;
  related?: string;
}

export interface PublicStat {
  label: string;
  value: string;
  tone: 'accent' | 'positive' | 'default' | 'warning';
  sub: string;
}

export const TODAY_NEWS = {
  badge: '오늘의 이슈',
  date: '2026.04.28',
  source: '국토교통부 발표 · 보도 23건',
  headline: '청년 월세 지원, 5월부터 월 30만원으로 인상',
  subhead: '소득 요건도 중위 60% → 70%로 완화. 5월 1일부터 신규 신청 시작.',
  why: '월세 부담이 역대 최고치를 기록하면서 정부가 청년 주거 지원을 대폭 확대했어요. 기존 수혜자도 자동 증액되며, 신규 신청도 5월 1일부터 받습니다.',
  bigNumber: '30만원',
  bigLabel: '월 최대 지원금',
  prevValue: '20만원',
  deltaPct: '+50%',
  trend: [12, 13, 14, 13, 15, 17, 18, 19, 20, 21, 22, 23],
  trendLabel: '월별 신청자 추이 (단위: 만명)',
  related: ['housing-monthly'],
  personaImpact: [
    {
      personaId: 'office-rookie',
      verdict: 'eligible',
      label: '거의 확정',
      detail: '월 30만 12개월 = 360만원 수령',
    },
    {
      personaId: 'self-employed',
      verdict: 'partial',
      label: '조건부',
      detail: '만 34세 이하 1인 사업자만 해당',
    },
    {
      personaId: 'newlywed-family',
      verdict: 'ineligible',
      label: '미해당',
      detail: '신혼·육아 가구는 별도 주거 지원 이용',
    },
    {
      personaId: 'senior',
      verdict: 'ineligible',
      label: '미해당',
      detail: '연령 기준 초과 — 주거급여 검토',
    },
    {
      personaId: 'low-income',
      verdict: 'partial',
      label: '연계 가능',
      detail: '주거급여와 중복 수급 불가, 유리한 쪽 선택',
    },
    {
      personaId: 'farmer',
      verdict: 'ineligible',
      label: '미해당',
      detail: '농어촌 청년은 귀농 정착지원금 우선',
    },
  ] satisfies PersonaImpact[],
  trending: [
    {
      rank: 1,
      title: '청년 월세 특별지원 인상',
      delta: '+340%',
      hot: true,
      related: 'housing-monthly',
    },
    { rank: 2, title: '부모급여 0세 월 100만원', delta: '+180%', related: 'maternity-grant' },
    { rank: 3, title: '소상공인 정책자금 한도 확대', delta: '+95%', related: 'small-biz-loan' },
    { rank: 4, title: '청년도약계좌 만기 도래', delta: '+72%', related: 'savings-account' },
    { rank: 5, title: '예비창업패키지 5월 공모', delta: '+45%', related: 'startup-grant' },
  ] satisfies TrendingItem[],
  publicStats: [
    { label: '예상 수혜자', value: '23만명', tone: 'accent', sub: '기존 15만명 → +53%' },
    { label: '월 인상폭', value: '+10만원', tone: 'positive', sub: '20만 → 30만' },
    { label: '소득 기준', value: '70%', tone: 'default', sub: '중위소득 (완화)' },
    { label: '시행일', value: '5/1', tone: 'warning', sub: '2026년 5월 1일' },
  ] satisfies PublicStat[],
} as const;

// 통화 포맷
export const formatWon = (n: number): string => {
  if (n >= 100_000_000) {
    const eok = n / 100_000_000;
    return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억원`;
  }
  if (n >= 10_000) {
    const man = Math.round(n / 10_000);
    return `${man.toLocaleString('ko-KR')}만원`;
  }
  return `${n.toLocaleString('ko-KR')}원`;
};
