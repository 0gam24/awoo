/**
 * 익명 사용자 설정 — localStorage 한정, 서버 전송 X.
 *
 * 정체성 정합:
 *   - PII 저장 X — 페르소나·관심분야 등 비식별 환경설정만
 *   - 서버 전송 X — 모든 호출은 클라이언트 사이드
 *   - 사용자가 언제든 전체 삭제 가능 (Footer 링크)
 *   - 자동 만료 — 365일 미사용 시 자동 삭제 (zombie prefs 방지)
 *
 * 스키마 v1:
 *   {
 *     v: 1,                    // 스키마 버전
 *     persona: string?,        // 'office-rookie' 등 (선택)
 *     interests: string[],     // 관심 분야 ['주거', '자산'] (선택)
 *     lastUsedAt: number,      // unix ms (자동 갱신)
 *     createdAt: number,       // unix ms
 *   }
 */

const KEY = 'awoo:prefs:v1';
const EXPIRY_MS = 365 * 24 * 3600 * 1000;

export interface AnonPrefs {
  v: 1;
  persona?: string;
  interests?: string[];
  lastUsedAt: number;
  createdAt: number;
}

function isValid(raw: unknown): raw is AnonPrefs {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return false;
  if (typeof r.lastUsedAt !== 'number') return false;
  if (typeof r.createdAt !== 'number') return false;
  if (r.persona !== undefined && typeof r.persona !== 'string') return false;
  if (r.interests !== undefined && !Array.isArray(r.interests)) return false;
  return true;
}

export function readPrefs(): AnonPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValid(parsed)) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    // 자동 만료
    if (Date.now() - parsed.lastUsedAt > EXPIRY_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePrefs(patch: Partial<Omit<AnonPrefs, 'v' | 'createdAt' | 'lastUsedAt'>>): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const current = readPrefs() ?? { v: 1 as const, lastUsedAt: now, createdAt: now };
    const next: AnonPrefs = {
      ...current,
      ...patch,
      v: 1,
      lastUsedAt: now,
      createdAt: current.createdAt,
    };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage quota·privacy 모드 등 실패 무시
  }
}

export function clearPrefs(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}

/** 만료까지 남은 일수 (UI 표시용) */
export function daysUntilExpiry(prefs: AnonPrefs): number {
  const elapsed = Date.now() - prefs.lastUsedAt;
  return Math.max(0, Math.ceil((EXPIRY_MS - elapsed) / (24 * 3600 * 1000)));
}
