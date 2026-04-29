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
  description?: string;
  commonEligibility?: string[];
}

export const CATEGORIES: Category[] = [
  { id: 'all', name: '전체', icon: 'sparkles', count: 0 },
  {
    id: '주거',
    name: '주거 (월세·전세·분양)',
    icon: 'cat-housing',
    count: 0,
    description:
      '월세·전세·분양·임대 등 주거 안정을 위한 정부·지자체 지원금. 청년 월세 특별지원, 신혼부부 특별공급, 공공임대주택 우선공급, 전세자금 대출이자 보전 등이 핵심.',
    commonEligibility: [
      '본인·가구 무주택자 요건이 가장 흔함',
      '소득 기준: 중위소득 60~100% 이하 (지원금별 상이)',
      '연령 기준: 청년 19~34세 / 신혼 결혼 7년 이내',
      '지역 거주 요건: 일부 지자체는 1년 이상 거주 필수',
    ],
  },
  {
    id: '취업',
    name: '취업·재취업',
    icon: 'cat-employment',
    count: 0,
    description:
      '구직자·미취업자·재취업 희망자를 위한 취업 지원. 국민취업지원제도 1·2유형, 청년도약장려금, 내일배움카드 훈련비, 중장년 일자리 등.',
    commonEligibility: [
      '실업·미취업 상태이거나 비정규직',
      '구직활동 의무 (취업 활동 계획 제출)',
      '소득 기준 (1유형: 중위 60% 이하)',
      '연령 무관하나 청년·중장년 우대 별도',
    ],
  },
  {
    id: '창업',
    name: '창업·소상공인',
    icon: 'cat-startup',
    count: 0,
    description:
      '예비창업자·초기 창업자·소상공인을 위한 자금·교육·공간 지원. 예비창업패키지, 청년창업사관학교, 정책자금 융자, 소상공인 경영컨설팅 등.',
    commonEligibility: [
      '사업자등록 전·후 단계별 별도 (예비/초기/성장)',
      '청년 창업: 만 39세 이하 우대',
      '업종 제한: 일부 사행성·부동산 임대업 제외',
      '대표자 신용·재무 요건 (정책자금 융자 시)',
    ],
  },
  {
    id: '교육',
    name: '교육·훈련',
    icon: 'cat-education',
    count: 0,
    description:
      '학생·학부모·재직자를 위한 교육비·훈련비·장학금 지원. 국가장학금 I·II·다자녀, 학자금 대출, 평생교육 바우처, 직업훈련생계비 대부 등.',
    commonEligibility: [
      '소득 분위 기준 (한국장학재단 8구간 이내 등)',
      '학적 요건 (재학·휴학·졸업 후 6개월 이내 등)',
      '성적 요건 (일부 장학금)',
      '훈련 출석률 80% 이상 (직업훈련 한정)',
    ],
  },
  {
    id: '자산',
    name: '자산 형성',
    icon: 'cat-wealth',
    count: 0,
    description:
      '저축·자산형성·금융 부담 경감을 위한 지원. 청년도약계좌·청년내일저축계좌 정부매칭, 근로·자녀장려금 환급, 햇살론 등 서민금융, 유류세 인하 등.',
    commonEligibility: [
      '연령·소득 기준이 가장 엄격 (특히 청년 자산형성)',
      '근로·사업·종교인 소득 (금융소득 제외)',
      '재산 기준 추가 (일부 자산형성 상품 1.5~3억 이하)',
      '가구 합산 소득 (가구원 수에 따라 한도 상이)',
    ],
  },
  {
    id: '복지',
    name: '복지·돌봄',
    icon: 'cat-welfare',
    count: 0,
    description:
      '저소득·노인·장애인·아동·한부모 등 사회적 배려 대상자를 위한 직접 지원. 기초생활보장, 부모급여, 아동수당, 첫만남이용권, 기초연금, 의료급여 등.',
    commonEligibility: [
      '소득·재산 기준 (중위 30~50% 이하 다수)',
      '가구 단위 평가 (개별 신청 X)',
      '연령·장애·임신 등 인구학적 요건',
      '거주지 주민센터 방문 신청이 일반적',
    ],
  },
  {
    id: '농업',
    name: '농업·귀농',
    icon: 'cat-farm',
    count: 0,
    description:
      '농어업인·귀농귀촌인을 위한 정착·영농비·소득안정 지원. 청년농업인 정착지원, 귀농귀촌 농업창업 자금, 농어민 공익직불, 농촌체류형 쉼터 등.',
    commonEligibility: [
      '농업경영체 등록 또는 등록 예정',
      '일정 면적 이상 영농 (지원금별 상이)',
      '귀농의 경우 도시 거주 1년 이상 후 이주',
      '청년농: 만 18~39세, 영농경력 3년 이하',
    ],
  },
];

// 오늘의 이슈는 자동 큐레이션 (src/data/today-issue.json) 으로 단일화.
// 레거시 TODAY_NEWS 하드코드는 제거됨 — NewsHero·llms-full 모두 today-issue.json 사용.
export interface PublicStat {
  label: string;
  value: string;
  tone: 'accent' | 'positive' | 'default' | 'warning';
  sub: string;
}

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
