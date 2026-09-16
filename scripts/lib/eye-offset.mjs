// 눈 확인 오프셋(eyeOffset) — 통합검색에서 웹문서 블록이 어디쯤 있는지 운영자가 눈으로 본 값.
//
// 2026-09-15 순위 측정을 공식 웹문서 검색 API로 바꾸면서 webDocOffset(HTML 속 블록 시작 %)을
// 더는 잴 수 없게 됐다. 운영자 결정(2026-09-15): 대시보드·목록 위젯 상위 5건에만
// [첫 화면][한 번 스크롤][그 아래] 버튼을 두고, 운영자가 본인 브라우저로 검색해 본 뒤 누른다.
//   1 = 첫 화면 · 2 = 한 번 스크롤 · 3 = 그 아래(닫힘 — 종전 webDocOffset ≥30%에 해당)
// 안 누르면 null — 감점도 닫힘도 없다. Claude가 자동화 브라우저로 대신 보지 않는다(수집과 같다).
//
// 저장: docs/ops/eye-offset.json { updatedAt, byQuery: { "<쿼리>": { value, date } } }
// 레이아웃은 바뀌므로 EYE_TTL_DAYS가 지난 값은 없는 것으로 본다.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EYE_FILE = join(ROOT, 'docs', 'ops', 'eye-offset.json');
export const EYE_TTL_DAYS = 7;
export const EYE_CLOSED = 3;
export const EYE_LABEL = { 1: '첫 화면', 2: '한 번 스크롤', 3: '그 아래' };

const norm = (s) => String(s ?? '').replace(/\s+/g, '');
const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const daysBetween = (a, b) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);

/** 라벨·숫자 입력을 1|2|3으로. 모르면 null. */
export function parseEyeValue(v) {
  const s = String(v ?? '').replace(/\s+/g, '');
  if (['1', '첫화면'].includes(s)) return 1;
  if (['2', '한번스크롤', '스크롤'].includes(s)) return 2;
  if (['3', '그아래', '아래'].includes(s)) return 3;
  return null;
}

export async function loadEyeStore() {
  try {
    const j = JSON.parse(await readFile(EYE_FILE, 'utf8'));
    return { updatedAt: j.updatedAt ?? null, byQuery: j.byQuery ?? {} };
  } catch {
    return { updatedAt: null, byQuery: {} };
  }
}

export async function saveEyeStore(store) {
  const out = {
    _comment:
      '운영자가 네이버 통합검색을 눈으로 보고 누른 웹문서 블록 위치. 1 첫 화면 · 2 한 번 스크롤 · 3 그 아래(닫힘). scripts/lib/eye-offset.mjs 참고. 7일 지나면 무시한다.',
    updatedAt: new Date().toISOString(),
    byQuery: store.byQuery,
  };
  await writeFile(EYE_FILE, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
}

/** 쿼리의 유효한 눈 확인 값(정확 → 공백 무시). 없거나 TTL 지났으면 null. */
export function eyeFor(store, query, today = kstDate()) {
  const by = store?.byQuery ?? {};
  let rec = by[query];
  if (!rec) {
    const nq = norm(query);
    rec = Object.entries(by).find(([k]) => norm(k) === nq)?.[1];
  }
  if (!rec || ![1, 2, 3].includes(rec.value) || !rec.date) return null;
  if (daysBetween(rec.date, today) > EYE_TTL_DAYS) return null;
  return rec.value;
}
