#!/usr/bin/env node
/**
 * 지원금 → 페르소나 자동 태깅 (휴리스틱 backfill)
 *
 * 동작:
 *   1. _gov24/{slug}.json 의 빈 targetPersonas 를 텍스트 매칭으로 추론
 *   2. title + eligibility + summary + tags 의 키워드 → 페르소나
 *   3. 카테고리 기반 fallback (창업 → self-employed 등)
 *   4. 기존 비어있지 않은 항목은 보존
 *
 * 사용:
 *   npm run tag:personas              # dry-run
 *   npm run tag:personas:apply        # 실제 적용
 *
 * Idempotent.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GOV24_DIR = join(ROOT, 'src', 'data', 'subsidies', '_gov24');
const APPLY = process.argv.includes('--apply');

// ─────────────────────────────────────────────────────────────
// 페르소나 키워드 → 매칭 점수 (단순 binary; 점수 누적은 잡음)
// ─────────────────────────────────────────────────────────────
const PERSONA_KEYWORDS = {
  'office-rookie': [
    '청년', '만 19', '만19', '만 24', '만24', '만 34', '만34', '19~34', '19∼34',
    '대학생', '취업준비', '구직', '신입', '직장인', '근로자', '신규채용',
  ],
  'self-employed': [
    '소상공인', '자영업', '예비창업', '창업기업', '창업자', '사업자', '중소기업',
    '벤처', '스타트업', '1인 사업', '사업장',
  ],
  'newlywed-family': [
    '신혼', '결혼 7년', '결혼7년', '예비부부',
    '출산', '임산부', '임신', '난임', '산모',
    '육아', '영유아', '아동', '아이', '자녀', '다자녀', '미성년',
    '키움', '꿈 수당', // 육아·아동수당 패턴
  ],
  'senior': [
    '65세', '70세', '60세', '노인', '어르신', '고령', '기초연금', '장년',
    '경로', '시니어', '중장년',
  ],
  'low-income': [
    '기초생활', '수급자', '차상위', '저소득', '중위소득 50', '중위소득50',
    '중위소득 60', '중위소득60', '생계급여', '의료급여', '주거급여', '교육급여',
    '취약계층', '한부모',
  ],
  'farmer': [
    '농업인', '농어민', '귀농', '귀촌', '영농', '농촌', '어민', '어업',
    '청년농', '귀농귀촌', '농지', '축산', '임업',
  ],
};

const CATEGORY_FALLBACK = {
  '창업': ['self-employed'],
  '농업': ['farmer'],
  '취업': ['office-rookie'],
  '주거': ['office-rookie', 'newlywed-family'],
  '교육': ['office-rookie', 'newlywed-family'],
  '자산': ['office-rookie', 'self-employed'],
  '복지': [], // text-based only — 너무 광범위
};

// ─────────────────────────────────────────────────────────────
// 추론
// ─────────────────────────────────────────────────────────────
function inferPersonas(data) {
  const corpus = [
    data.title ?? '',
    data.summary ?? '',
    data.monthly ?? '',
    ...(data.eligibility ?? []),
    ...(data.benefits ?? []),
    ...(data.tags ?? []),
  ].join(' ').toLowerCase();

  const matched = new Set();
  for (const [pid, kws] of Object.entries(PERSONA_KEYWORDS)) {
    for (const kw of kws) {
      if (corpus.includes(kw.toLowerCase())) {
        matched.add(pid);
        break;
      }
    }
  }

  // 텍스트 매치가 0이면 카테고리 fallback
  if (matched.size === 0) {
    const cat = data.category;
    if (cat && CATEGORY_FALLBACK[cat]) {
      for (const p of CATEGORY_FALLBACK[cat]) matched.add(p);
    }
  }

  return [...matched];
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(GOV24_DIR)) {
    console.log('[tag] _gov24/ 디렉토리 없음 — 스킵');
    return;
  }

  const files = (await readdir(GOV24_DIR)).filter(
    (f) => f.endsWith('.json') && !f.startsWith('_'),
  );

  let scanned = 0;
  let alreadyTagged = 0;
  let updated = 0;
  let stillEmpty = 0;
  const distribution = {};
  const samples = [];

  for (const file of files) {
    const fp = join(GOV24_DIR, file);
    let data;
    try {
      data = JSON.parse(await readFile(fp, 'utf-8'));
    } catch {
      continue;
    }
    scanned++;

    const existing = data.targetPersonas ?? [];
    if (existing.length > 0) {
      alreadyTagged++;
      continue;
    }

    const inferred = inferPersonas(data);
    if (inferred.length === 0) {
      stillEmpty++;
      continue;
    }

    for (const p of inferred) {
      distribution[p] = (distribution[p] ?? 0) + 1;
    }

    if (samples.length < 5) {
      samples.push({
        id: data.id,
        title: data.title,
        category: data.category,
        inferred,
      });
    }

    if (APPLY) {
      data.targetPersonas = inferred;
      await writeFile(fp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    }
    updated++;
  }

  console.log(`[tag] 검사 ${scanned} / 기존 태깅 ${alreadyTagged} / 추론 성공 ${updated} / 추론 불가 ${stillEmpty}`);
  console.log('[tag] 페르소나별 추가 분포:', JSON.stringify(distribution));
  console.log('');
  console.log('[tag] 샘플 (최대 5건):');
  for (const s of samples) {
    console.log(`  · ${s.id} [${s.category}] "${s.title.slice(0, 40)}…" → ${s.inferred.join(', ')}`);
  }

  if (!APPLY) {
    console.log('');
    console.log('[tag] DRY-RUN — --apply 추가 시 실제 파일 수정');
  }
}

main().catch((e) => {
  console.error('💥', e?.message ?? e);
  process.exit(1);
});
