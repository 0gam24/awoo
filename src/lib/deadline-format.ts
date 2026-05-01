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
  const matches = [
    ...deadline.matchAll(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/g),
  ];
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
