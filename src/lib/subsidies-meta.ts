/**
 * 지원금 메타데이터 — _gov24/_manifest.json 기반
 *
 * 큐레이션 항목(_curated/)은 manifest에 없으므로 isNew = false.
 * API 항목(_gov24/)만 등록일시 기준으로 NEW 판정.
 */

import manifest from '@/data/subsidies/_gov24/_manifest.json';

interface ManifestEntry {
  slug: string;
  regDate: string;
  modDate: string;
  lastVerifiedAt?: string;
  archivedAt?: string;
}

interface Manifest {
  lastSync: string;
  mode?: string;
  items: Record<string, ManifestEntry>;
  lastBatch?: {
    runAt: string;
    slugs: string[];
  };
}

const m = manifest as Manifest;

/** 'YYYYMMDDHHmmss' (또는 'YYYYMMDD') → ms timestamp */
export function parseGovDate(s: string): number {
  if (!s) return 0;
  const match = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match || !match[1] || !match[2] || !match[3]) return 0;
  return new Date(+match[1], +match[2] - 1, +match[3]).getTime();
}

/** slug → regDate(ms) 맵 (빌드타임 1회 계산) */
const slugToReg = new Map<string, number>();
for (const entry of Object.values(m.items ?? {})) {
  const ts = parseGovDate(entry.regDate);
  if (ts) slugToReg.set(entry.slug, ts);
}

export const NEW_WINDOW_DAYS = 14;
const NEW_CUTOFF = Date.now() - NEW_WINDOW_DAYS * 24 * 3600 * 1000;

/** 등록 N일 이내인 API 지원금인지 (큐레이션은 false) */
export function isNew(slug: string): boolean {
  const ts = slugToReg.get(slug);
  return ts !== undefined && ts >= NEW_CUTOFF;
}

/** 등록일 ms (없으면 undefined) */
export function getRegDate(slug: string): number | undefined {
  return slugToReg.get(slug);
}

/** 최근 등록 N건 — slug + regDate(ms) 페어, 등록일 desc */
export function recentlyAddedSlugs(limit = 12): Array<{ slug: string; regDate: number }> {
  return [...slugToReg.entries()]
    .map(([slug, regDate]) => ({ slug, regDate }))
    .sort((a, b) => b.regDate - a.regDate)
    .slice(0, limit);
}

/** ISO 형식 등록일 (RSS·sitemap·JSON-LD용) */
export function getRegDateISO(slug: string): string | undefined {
  const ts = slugToReg.get(slug);
  return ts ? new Date(ts).toISOString() : undefined;
}

/** slug → lastVerifiedAt(ms) 맵 (sync 회차에서 갱신됨) */
const slugToVerified = new Map<string, number>();
for (const entry of Object.values(m.items ?? {})) {
  if (entry.lastVerifiedAt) {
    const ts = Date.parse(entry.lastVerifiedAt);
    if (!Number.isNaN(ts)) slugToVerified.set(entry.slug, ts);
  }
}

export const STALE_THRESHOLD_DAYS = 90;
const STALE_CUTOFF = Date.now() - STALE_THRESHOLD_DAYS * 24 * 3600 * 1000;

/** 마지막 검증이 N일 이상 지난 항목인지 */
export function isStale(slug: string): boolean {
  const ts = slugToVerified.get(slug);
  // verifiedAt 필드 자체가 없는 항목은 큐레이션·구버전 → stale 판정 X
  if (ts === undefined) return false;
  return ts < STALE_CUTOFF;
}

/** 마지막 검증일 ISO (없으면 undefined — 큐레이션 항목) */
export function getLastVerifiedISO(slug: string): string | undefined {
  const ts = slugToVerified.get(slug);
  return ts ? new Date(ts).toISOString() : undefined;
}

/** 한국어 짧은 형식 (YYYY.MM.DD) — 마지막 검증일 표시용 */
export function getLastVerifiedKR(slug: string): string | undefined {
  const ts = slugToVerified.get(slug);
  if (!ts) return undefined;
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 가장 최근 sync 회차에서 추가된 slug 목록 */
export const lastBatchSlugs: string[] = m.lastBatch?.slugs ?? [];

/** 가장 최근 sync 실행 시각 (ISO) */
export const lastSyncISO: string = m.lastSync ?? new Date(0).toISOString();

/** 가장 최근 sync 회차 실행 시각 (ISO) — UI에 "YYYY.MM.DD 동기화" 표시용 */
export const lastBatchAtISO: string | undefined = m.lastBatch?.runAt;

/** 한국어 짧은 날짜 (YYYY.MM.DD) */
export function formatDateKR(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
