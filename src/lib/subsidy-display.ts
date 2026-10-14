// 지원금 화면 문구 도우미 — 조사(이/가·은/는…)와 금액 표기.
// 2026-10-14: 템플릿 문자열을 그대로 이어 붙여 "미추홀구이 제공하는", "신혼·육아 가구이 받을 수 있는",
// 금액 칸이 0인 사업(요금 감면·약제비 실비·서비스)에서 "0원 지원금"이 찍히던 문제를 바로잡는다.
import { formatWon } from '@/data/site-data';

type JosaPair = '이/가' | '은/는' | '을/를' | '과/와' | '으로/로' | '이고/고' | '이에요/예요';

// 숫자를 한국어로 읽었을 때 받침 — 0 영, 1 일(ㄹ), 3 삼, 6 육, 7 칠(ㄹ), 8 팔(ㄹ)
const DIGIT_JONG: Record<string, number> = {
  '0': 21,
  '1': 8,
  '2': 0,
  '3': 16,
  '4': 0,
  '5': 0,
  '6': 1,
  '7': 8,
  '8': 8,
  '9': 0,
};

/** 끝 글자의 받침 번호(0 = 받침 없음, 8 = ㄹ). 판단할 수 없으면 null */
function lastJong(word: string): number | null {
  // 끝의 괄호 설명은 조사와 상관없다: "체육시설 감면(옹암체육센터)" → "…센터"를 본다
  const w = word
    .trim()
    .replace(/\s*[([{][^)\]}]*[)\]}]\s*$/, '')
    .replace(/[\s.,·!?'"’”]+$/, '');
  const ch = w.at(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  if (ch in DIGIT_JONG) return DIGIT_JONG[ch] ?? null;
  if (/[a-z]/i.test(ch)) return /[lmnr]/i.test(ch) ? 8 : 0;
  return null;
}

/** 단어 뒤에 붙일 조사만 돌려준다. 받침을 모르면 앞쪽 형태(이/은/을…)로 둔다 */
export function josa(word: string, pair: JosaPair): string {
  const [withJong, withoutJong] = pair.split('/') as [string, string];
  const jong = lastJong(word);
  if (jong === null) return withJong;
  if (pair === '으로/로') return jong === 0 || jong === 8 ? withoutJong : withJong;
  return jong === 0 ? withoutJong : withJong;
}

/** 단어 + 조사 */
export const withJosa = (word: string, pair: JosaPair): string => `${word}${josa(word, pair)}`;

interface AmountSource {
  amount: number;
  amountLabel?: string | undefined;
  monthly?: string | undefined;
  summary?: string | undefined;
  benefits?: string[] | undefined;
  title?: string | undefined;
}

export interface AmountDisplay {
  /** 크게 보여 줄 값: "35만원", "50%", "이용료 감면" */
  value: string;
  /** 값 옆의 작은 꼬리표: "지원금", "감면", "" */
  unit: string;
  /** 실제 금액(원)이 있는가 */
  isMoney: boolean;
}

/**
 * 금액 칸이 0인 사업은 혜택 문구에서 비율을 찾거나, 혜택 종류로 바꿔 부른다.
 * 숫자를 지어내지 않는다 — 문구에 없는 금액은 만들지 않는다.
 */
export function amountDisplay(s: AmountSource): AmountDisplay {
  if (s.amount > 0)
    return { value: formatWon(s.amount), unit: (s.amountLabel ?? '').trim(), isMoney: true };
  const text = [s.monthly, s.summary, ...(s.benefits ?? []), s.title].filter(Boolean).join(' ');
  const pct = text.match(/(\d{1,3})\s*%\s*(감면|할인|면제|환급|캐시백|지원)/);
  if (pct) return { value: `${pct[1]}%`, unit: pct[2] ?? '', isMoney: false };
  if (/전액\s*(감면|면제)|면제/.test(text))
    return { value: '이용료 면제', unit: '', isMoney: false };
  if (/감면|할인/.test(text)) return { value: '이용료 감면', unit: '', isMoney: false };
  if (/바우처|이용권|쿠폰/.test(text)) return { value: '바우처 지원', unit: '', isMoney: false };
  if (/약제비|의료비|시술비|진료비|실비|검사비/.test(text))
    return { value: '실비 지원', unit: '', isMoney: false };
  if (/융자|대출|대부/.test(text)) return { value: '융자 지원', unit: '', isMoney: false };
  if (/현물|물품|용품|기저귀|식품|꾸러미/.test(text))
    return { value: '현물 지원', unit: '', isMoney: false };
  return { value: '서비스 지원', unit: '', isMoney: false };
}

/** 한 줄 문자열: "35만원 지원금", "50% 감면", "이용료 감면" */
export function amountText(s: AmountSource): string {
  const d = amountDisplay(s);
  return d.unit ? `${d.value} ${d.unit}` : d.value;
}

/** 문장 속 표기 — 꼬리표를 앞에: "최대 7천만원", "월 지원 30만원", "50% 감면" */
export function amountPhrase(s: AmountSource): string {
  const d = amountDisplay(s);
  if (!d.isMoney) return d.unit ? `${d.value} ${d.unit}` : d.value;
  return d.unit ? `${d.unit} ${d.value}` : d.value;
}

/**
 * 주관 기관 이름에서 지자체를 뽑는다(구조화 데이터 areaServed·확인 목록용).
 * "인천광역시 미추홀구" → "인천광역시 미추홀구", "인천광역시연수구시설안전관리공단" → "인천광역시 연수구",
 * 중앙부처·공공기관이면 null.
 */
// 흔한 제출 서류의 발급처 — 서류 이름에 들어 있는 낱말로만 고른다. 모르는 서류는 비워 둔다(지어내지 않음)
const DOC_SOURCES: [RegExp, string][] = [
  [/주민등록\s*(등본|초본)|등본|초본/, '정부24·무인민원발급기·행정복지센터'],
  [/가족관계|기본증명|혼인관계|입양관계/, '정부24·전자가족관계등록시스템'],
  [/건강보험|보험료\s*납부|자격득실/, '국민건강보험공단 누리집·정부24'],
  [/소득금액증명|사업자등록증명|부가가치세|과세표준|납세증명/, '홈택스·정부24'],
  [/사업자등록증/, '홈택스(사업자등록증명)'],
  [/수급자\s*증명|차상위/, '정부24·행정복지센터'],
  [/장애인\s*증명/, '정부24·행정복지센터'],
  [/통장\s*사본|계좌/, '거래 은행 앱·지점'],
  [/재직증명|근로계약/, '다니는 회사'],
  [/진단서|소견서|진료비|영수증/, '진료받은 병원'],
  [/임대차\s*계약/, '본인 보관 계약서'],
];

/** 서류 이름으로 발급처를 찾는다. 모르면 null */
export function docSourceOf(doc: string): string | null {
  for (const [re, where] of DOC_SOURCES) if (re.test(doc)) return where;
  return null;
}

const SIDO =
  '서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도';
// 시·군·구 이름은 가장 짧게 잡는다 — 붙여 쓴 "연수구시설안전관리공단"에서 "연수구시"가 아니라 "연수구"
const SIDO_RE = new RegExp(`^(${SIDO})\\s*([가-힣]{1,4}?(?:시|군|구))?`);

export function localAreaOf(agency: string): string | null {
  const t = agency.trim();
  const m = t.match(SIDO_RE);
  if (m) return [m[1], m[2]].filter(Boolean).join(' ');
  // 시·도 없이 "화성시", "화성시 복지정책과"처럼 시·군·구로 시작하는 경우만. "주택도시보증공사"는 첫 낱말이 통째로라 걸리지 않는다
  const first = t.split(/\s+/)[0] ?? '';
  return /^[가-힣]{1,4}(?:시|군|구)$/.test(first) ? first : null;
}
