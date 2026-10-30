/**
 * Cycle #49: deadline 문자열 → 마감 배지 정보 파싱
 *
 * 데이터의 deadline 형식이 매우 다양:
 *   - "상시 신청" / "상시신청" / "신청 불필요"        → 항상 신청 가능
 *   - "2026.07.31" / "2026-07-31"                      → 단일 날짜 마감
 *   - "2026.04.27~2026.05.08"                          → 범위, 종료일이 마감
 *   - "2026. 4.14 .(화) 10:00 ~ 4. 27.(월) 17:00"      → 정부24 raw, 종료일 추출
 *   - "예산 소진 시까지" / "접수기관 별 상이"           → 알 수 없음, 원본 그대로
 *
 * 카드 표면에서 사용자가 한눈에 "지금 신청 가능한가? 며칠 남았나?"를 알게 하는 게 목표.
 */

export type DeadlineTone = 'urgent' | 'soon' | 'normal' | 'open' | 'unknown';

export interface DeadlineBadge {
  tone: DeadlineTone;
  label: string; // 짧은 표기 ("D-7", "상시", "예산 소진 시까지")
  dDay?: number; // 양수: 남은 일수, 0: 오늘, 음수: 지난 마감
}

const ALWAYS_PATTERNS = [/상시/, /신청\s*불필요/, /연중/];
const UNKNOWN_PATTERNS = [/예산\s*소진/, /접수기관\s*별/, /명절기간/, /자세한/, /기관\s*문의/];

/**
 * deadline 문자열에서 마지막 날짜(=마감일)를 추출. 실패 시 null.
 */
function extractEndDate(deadline: string): Date | null {
  // 모든 YYYY.M.D 또는 YYYY-M-D 또는 YYYY/M/D 패턴 (구분자, 공백 허용)
  const matches = [...deadline.matchAll(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/g)];
  // 연도 없이 M.D 또는 M/D만 있는 경우 (정부24 raw "4. 27.(월)" 등)
  // 마지막 날짜 사용
  const last = matches[matches.length - 1];
  if (!last) return null;
  const [, y, m, d] = last;
  if (!y || !m || !d) return null;
  const yy = Number.parseInt(y, 10);
  const mm = Number.parseInt(m, 10);
  const dd = Number.parseInt(d, 10);
  if (!yy || !mm || !dd) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  // KST 자정 기준 (UTC+9 → UTC 15:00 of prev day, but we just need calendar diff)
  return new Date(Date.UTC(yy, mm - 1, dd));
}

function todayKST(): Date {
  const now = new Date();
  // KST = UTC+9, but for D-day we just need YYYY-MM-DD in KST → UTC midnight of that date
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const k = new Date(kstMs);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
}

// 반복·상대 기한은 날짜가 지나도 "끝났다"고 볼 수 없다(매년 다시 열리거나 개인별로 다름)
const RECURRING_OR_RELATIVE = [
  /상시|수시|연중|매년|매월|매주|정기|분기별|이내|따름|상이|문의|참고|확인필요|불필요|소진/,
];

/**
 * 신청 기한이 확실히 지났는지(2026-10-30, 네이버 스팸 정책 '사용자 혼동' 대응).
 * 보조금24 동기화가 멈춰 마감 사업이 '신청 가능'으로 남는 것을 빌드 시점에 바로잡는 데 쓴다.
 *
 * 보수적으로 판단한다 — 연도가 적힌 날짜만 보고, 반복·상대 기한은 false.
 * 날짜 여럿이면 가장 늦은 날(마감일). 연도 없는 날짜는 앞에 나온 연도를 따른다.
 * 일(日) 없이 월만 있으면 그 달 말일. "예정"이 붙은 올해 이후 일정은 아직 안 지난 것으로 본다.
 */
export function isDeadlinePast(
  deadline: string | undefined | null,
  today: Date = todayKST(),
): boolean {
  const s = (deadline ?? '').trim();
  if (!s) return false;

  // 연도 위치 — 4자리, 또는 2자리+'년'
  const years = [...s.matchAll(/((?:19|20)\d{2})|(\d{2})\s*년/g)].map((m) => ({
    index: m.index ?? 0,
    year: m[1] ? Number(m[1]) : 2000 + Number(m[2]),
  }));
  if (years.length === 0) return false;
  // 적힌 연도가 모두 지난해 이전이면(예: "24년 5월 모집 예정, 주민센터 문의") 반복 문구가 아닌 한 지난 일정
  if (!/매년|매월|매주/.test(s) && Math.max(...years.map((y) => y.year)) < today.getUTCFullYear())
    return true;
  if (RECURRING_OR_RELATIVE.some((re) => re.test(s))) return false;
  const yearBefore = (idx: number) => years.filter((y) => y.index <= idx).at(-1)?.year ?? null;

  let latest: number | null = null;
  // [연도 구분자] 월 구분자 [일] — 시각(10:00)은 ':'라 걸리지 않는다
  const re =
    /(?:((?:19|20)\d{2}|\d{2}(?=\s*년))\s*[년.\-/]\s*)?(\d{1,2})\s*[월.\-/]\s*(?:(\d{1,2})(?!\s*[:\d])\s*(?:일|\.)?)?/g;
  for (const m of s.matchAll(re)) {
    const y = m[1]
      ? m[1].length === 2
        ? 2000 + Number(m[1])
        : Number(m[1])
      : yearBefore(m.index ?? 0);
    const mo = Number(m[2]);
    if (!y || mo < 1 || mo > 12) continue;
    const day = m[3] ? Number(m[3]) : null;
    if (day !== null && (day < 1 || day > 31)) continue;
    // 일이 없으면 그 달 말일
    const t = day ? Date.UTC(y, mo - 1, day) : Date.UTC(y, mo, 0);
    if (latest === null || t > latest) latest = t;
  }
  if (latest === null) return false;
  if (/예정/.test(s) && latest >= Date.UTC(today.getUTCFullYear(), 0, 1)) return false;
  return latest < today.getTime();
}

export function getDeadlineBadge(deadline: string | undefined | null): DeadlineBadge {
  if (!deadline || !deadline.trim()) {
    return { tone: 'unknown', label: '확인 필요' };
  }
  const s = deadline.trim();

  if (ALWAYS_PATTERNS.some((re) => re.test(s))) {
    return { tone: 'open', label: '상시 신청' };
  }
  if (UNKNOWN_PATTERNS.some((re) => re.test(s))) {
    return { tone: 'unknown', label: s.length > 14 ? `${s.slice(0, 14)}…` : s };
  }

  const end = extractEndDate(s);
  if (!end) {
    return { tone: 'unknown', label: s.length > 14 ? `${s.slice(0, 14)}…` : s };
  }

  const today = todayKST();
  const diffMs = end.getTime() - today.getTime();
  const dDay = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (dDay < 0) return { tone: 'unknown', label: '마감', dDay };
  if (dDay === 0) return { tone: 'urgent', label: 'D-day', dDay };
  if (dDay <= 7) return { tone: 'urgent', label: `D-${dDay}`, dDay };
  if (dDay <= 30) return { tone: 'soon', label: `D-${dDay}`, dDay };
  return { tone: 'normal', label: `D-${dDay}`, dDay };
}
