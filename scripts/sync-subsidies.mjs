#!/usr/bin/env node
/**
 * 정부 지원금 동기화 — data.go.kr 보조금24 (gov24/v3/serviceList)
 *
 * 사용:
 *   npm run sync:subsidies
 *
 * 동작:
 *   1. .env / .env.local 의 DATA_GO_KR_KEY 로 API 인증
 *   2. 전체 서비스 목록 페이지네이션 fetch (perPage 500, ~22회)
 *   3. 조회수 desc 정렬 → 상위 100건 선별
 *   4. Zod 스키마(content.config.ts subsidies)에 맞게 매핑
 *   5. src/data/subsidies/api-{서비스ID}.json 으로 저장
 *
 * 큐레이션 10개(housing-monthly.json 등)는 건드리지 않음 — 파일명 prefix로 분리.
 *
 * PSI 100 호환: 빌드타임 fetch만 사용. 런타임 API 호출 없음.
 */

import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'src', 'data', 'subsidies');

const TOP_N = 100;
const PER_PAGE = 500;
const API_BASE = 'https://api.odcloud.kr/api/gov24/v3/serviceList';

// ─────────────────────────────────────────────────────────────
// .env / .env.local 파싱 (dotenv 의존성 없이)
// ─────────────────────────────────────────────────────────────
async function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    try {
      const text = await readFile(join(ROOT, file), 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
      }
    } catch {
      // 파일 없으면 패스
    }
  }
  return env;
}

// ─────────────────────────────────────────────────────────────
// 카테고리 매핑: API 서비스분야 → 사이트 카테고리(주거/자산/창업/교육/복지/취업/농업)
// ─────────────────────────────────────────────────────────────
const CATEGORY_MAP = {
  '주거': '주거', '주거·자립': '주거',
  '서민금융': '자산', '금융': '자산', '서민·소상공인': '자산',
  '교육': '교육', '보육·교육': '교육', '문화': '교육',
  '창업': '창업', '취업·창업': '창업', '소상공인': '창업',
  '취업': '취업', '고용': '취업',
  '복지': '복지', '보건·의료': '복지', '아동·청소년': '복지',
  '서민': '복지', '저소득': '복지', '장애인': '복지', '노인': '복지',
  '농업': '농업', '농림축산식품': '농업', '농림': '농업', '귀농': '농업',
};

const CATEGORY_BG = {
  '주거': 'bg-1', '자산': 'bg-2', '창업': 'bg-3',
  '교육': 'bg-4', '복지': 'bg-5', '취업': 'bg-6', '농업': 'bg-7',
};

const CATEGORY_ICON = {
  '주거': 'cat-housing', '자산': 'cat-wealth', '창업': 'cat-startup',
  '교육': 'cat-education', '복지': 'cat-welfare', '취업': 'cat-employment',
  '농업': 'cat-farm',
};

function mapCategory(field) {
  if (!field) return '복지';
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (field.includes(key)) return val;
  }
  return '복지';
}

// ─────────────────────────────────────────────────────────────
// 텍스트 정리: \r\n으로 분리된 라인을 배열로 변환
// ─────────────────────────────────────────────────────────────
function splitLines(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[○\-●•·•▶■]\s*/, ''))
    .filter((l) => l.length > 0 && l.length < 240);
}

// ─────────────────────────────────────────────────────────────
// 금액 추출: 지원내용 텍스트에서 첫 "N원" 패턴 추출
// ─────────────────────────────────────────────────────────────
function extractAmount(text) {
  if (!text) return { amount: 0, label: '지원금' };
  // "30만원", "100만원", "1,000,000원" 등
  const manMatch = text.match(/([0-9,]+)\s*만\s*원/);
  if (manMatch) {
    const n = parseInt(manMatch[1].replace(/,/g, ''), 10);
    if (!Number.isNaN(n)) return { amount: n * 10000, label: '월 지원' };
  }
  const wonMatch = text.match(/([0-9,]+)\s*원/);
  if (wonMatch) {
    const n = parseInt(wonMatch[1].replace(/,/g, ''), 10);
    if (!Number.isNaN(n) && n >= 1000) return { amount: n, label: '지원금' };
  }
  return { amount: 0, label: '지원금' };
}

// ─────────────────────────────────────────────────────────────
// 신청 상태 도출
// ─────────────────────────────────────────────────────────────
function deriveStatus(deadline) {
  if (!deadline || typeof deadline !== 'string') return '신청 가능';
  if (deadline.includes('상시')) return '신청 가능';
  // "2026.05.31 까지" 같은 패턴
  const m = deadline.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) {
    const target = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    const now = Date.now();
    const diffDays = (target - now) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return '마감';
    if (diffDays < 30) return '곧 마감';
    return '신청 가능';
  }
  return '신청 가능';
}

// ─────────────────────────────────────────────────────────────
// 태그 도출
// ─────────────────────────────────────────────────────────────
function deriveTags(item, category) {
  const tags = new Set([category]);
  if (item['사용자구분']) {
    const u = item['사용자구분'];
    if (u.includes('개인')) tags.add('개인');
    if (u.includes('가구')) tags.add('가구');
    if (u.includes('소상공인')) tags.add('소상공인');
    if (u.includes('기업')) tags.add('기업');
  }
  if (item['지원유형']) {
    const t = item['지원유형'];
    if (t.includes('현금')) tags.add('현금지원');
    if (t.includes('감면')) tags.add('감면');
    if (t.includes('대출')) tags.add('대출');
    if (t.includes('이용권')) tags.add('이용권');
  }
  return Array.from(tags).slice(0, 6);
}

// ─────────────────────────────────────────────────────────────
// API 항목 → Zod 스키마 매핑
// ─────────────────────────────────────────────────────────────
function mapToSchema(item) {
  const id = `api-${item['서비스ID']}`;
  const category = mapCategory(item['서비스분야']);
  const eligibility = splitLines(item['지원대상']).slice(0, 6);
  const benefits = splitLines(item['지원내용']).slice(0, 6);
  const { amount, label: amountLabel } = extractAmount(item['지원내용']);
  const status = deriveStatus(item['신청기한']);
  const tags = deriveTags(item, category);

  return {
    id,
    applyUrl: item['상세조회URL'] || 'https://www.gov.kr',
    title: (item['서비스명'] || '제목 미정').slice(0, 80),
    agency: item['소관기관명'] || '미상',
    category,
    icon: CATEGORY_ICON[category] || 'cat-welfare',
    bg: CATEGORY_BG[category] || 'bg-5',
    amount,
    amountLabel,
    period: '',
    deadline: (item['신청기한'] || '상시신청').slice(0, 40),
    summary: (item['서비스목적요약'] || item['서비스명'] || '').slice(0, 280),
    eligibility: eligibility.length > 0 ? eligibility : [item['지원대상']?.slice(0, 200) || '대상 확인 필요'],
    benefits: benefits.length > 0 ? benefits : [item['지원내용']?.slice(0, 200) || '내용 확인 필요'],
    documents: [],
    status,
    tags,
    targetPersonas: [],
  };
}

// ─────────────────────────────────────────────────────────────
// API 페이지네이션 fetch
// ─────────────────────────────────────────────────────────────
async function fetchAllServices(key) {
  const all = [];
  let page = 1;
  let total = Infinity;
  while ((page - 1) * PER_PAGE < total) {
    const url = `${API_BASE}?page=${page}&perPage=${PER_PAGE}&serviceKey=${encodeURIComponent(key)}`;
    process.stdout.write(`\rFetching page ${page}...`);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`API ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    if (!Array.isArray(json.data)) throw new Error('Unexpected response shape');
    all.push(...json.data);
    total = json.totalCount ?? all.length;
    if (json.data.length < PER_PAGE) break;
    page++;
  }
  process.stdout.write('\n');
  return { items: all, total };
}

// ─────────────────────────────────────────────────────────────
// 기존 api-*.json 정리 (재실행 시 stale 제거)
// ─────────────────────────────────────────────────────────────
async function cleanOldApiFiles() {
  let removed = 0;
  try {
    const files = await readdir(OUT_DIR);
    for (const f of files) {
      if (f.startsWith('api-') && f.endsWith('.json')) {
        await unlink(join(OUT_DIR, f));
        removed++;
      }
    }
  } catch {
    // ignore
  }
  return removed;
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────
async function main() {
  const env = await loadEnv();
  const key = env.DATA_GO_KR_KEY;
  if (!key) {
    console.error('❌ DATA_GO_KR_KEY 가 .env / .env.local 에 없습니다.');
    process.exit(1);
  }

  console.log(`🔑 API 키 로드 (length=${key.length})`);

  const { items, total } = await fetchAllServices(key);
  console.log(`📦 전체 ${total}건 / 수신 ${items.length}건`);

  // 조회수 desc 정렬
  const sorted = [...items].sort((a, b) => (b['조회수'] || 0) - (a['조회수'] || 0));
  const top = sorted.slice(0, TOP_N);
  console.log(`🏆 상위 ${TOP_N}건 선별 (조회수 desc)`);

  await mkdir(OUT_DIR, { recursive: true });
  const removed = await cleanOldApiFiles();
  if (removed > 0) console.log(`🧹 기존 api-*.json ${removed}개 정리`);

  let written = 0;
  let skipped = 0;
  for (const item of top) {
    try {
      const mapped = mapToSchema(item);
      const filename = `${mapped.id}.json`;
      await writeFile(join(OUT_DIR, filename), JSON.stringify(mapped, null, 2) + '\n', 'utf8');
      written++;
    } catch (e) {
      skipped++;
      console.warn(`⚠️ skip ${item['서비스ID']}: ${e.message}`);
    }
  }

  console.log(`✅ ${written}개 파일 생성 (스킵 ${skipped})`);
  console.log(`📂 ${OUT_DIR}`);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
