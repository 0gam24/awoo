#!/usr/bin/env node
/**
 * 정부 지원금 동기화 — data.go.kr 보조금24 (gov24/v3/serviceList)
 *
 * 두 가지 모드:
 *
 *   1) bootstrap (1회 시드)
 *      npm run sync:subsidies bootstrap
 *      - 전체 fetch → 조회수 desc 상위 100건 선별
 *      - _gov24/ 와이프 후 재생성 + manifest 생성
 *      - 처음 1회 또는 전체 리셋이 필요할 때만 사용
 *
 *   2) new (주기 cron)
 *      npm run sync:subsidies          (default)
 *      npm run sync:subsidies new
 *      - 전체 fetch → manifest 와 비교
 *      - "새로 등록된" 항목만 추가 (등록일시 ≤ 30일 + manifest에 없음)
 *      - 기존 파일은 절대 건드리지 않음
 *      - manifest 갱신
 *
 * Manifest: src/data/subsidies/_gov24/_manifest.json
 *      { "lastSync": ISO, "items": { "<서비스ID>": { slug, regDate, modDate } } }
 *
 * 큐레이션은 src/data/subsidies/_curated/ 에 보존 — 본 스크립트가 건드리지 않음.
 *
 * PSI 100 호환: 빌드타임 fetch만 사용. 런타임 API 호출 없음.
 *
 * 보안: API 키는 .env / .env.local 의 DATA_GO_KR_KEY 또는 환경변수로만 받음.
 *      스크립트는 키 값을 절대 출력하지 않음.
 */

import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'src', 'data', 'subsidies', '_gov24');
const MANIFEST_PATH = join(OUT_DIR, '_manifest.json');

const TOP_N = 100;
const PER_PAGE = 500;
const NEW_WINDOW_DAYS = 30;
const API_BASE = 'https://api.odcloud.kr/api/gov24/v3/serviceList';

// ─────────────────────────────────────────────────────────────
// .env / .env.local 파싱 (dotenv 의존성 없이, 키 값은 출력 안 함)
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
// 카테고리 매핑
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
// SEO 슬러그 — 한국어 정부 용어 → 영문 키워드
// ─────────────────────────────────────────────────────────────
const TERM_MAP = {
  '청년': 'youth', '신혼부부': 'newlywed-couple', '신혼': 'newlywed', '부부': 'couple',
  '아동': 'child', '영유아': 'infant', '유아': 'preschool', '영아': 'infant',
  '청소년': 'teen', '학생': 'student', '대학생': 'undergrad',
  '노인': 'senior', '고령자': 'elderly', '중장년': 'midlife',
  '장애인': 'disability', '장애아동': 'disabled-child',
  '한부모': 'single-parent', '다문화': 'multicultural', '여성': 'women',
  '저소득': 'low-income', '기초': 'basic', '차상위': 'near-poor',
  '소상공인': 'smb', '자영업': 'self-employed', '기업': 'enterprise',
  '근로자': 'worker', '농어민': 'farmer-fisher', '농민': 'farmer', '어민': 'fisher',
  '국민': 'national',
  '주거': 'housing', '주택': 'housing', '임대': 'rental', '월세': 'rent',
  '전세': 'jeonse', '분양': 'sale', '특별공급': 'special-supply', '특공': 'special-supply',
  '보육': 'childcare', '양육': 'parenting', '육아': 'parenting', '출산': 'maternity',
  '교육': 'education', '학비': 'tuition', '장학': 'scholarship', '훈련': 'training',
  '직업': 'vocational', '내일배움': 'work-training',
  '취업': 'employment', '고용': 'employment', '구직': 'job-seeker', '근로': 'work',
  '창업': 'startup', '사업': 'business', '예비창업': 'pre-startup',
  '대출': 'loan', '융자': 'loan', '자금': 'funds',
  '저축': 'savings', '계좌': 'account', '자산': 'assets', '도약': 'leap',
  '복지': 'welfare', '돌봄': 'care', '보건': 'health', '의료': 'medical', '건강': 'health',
  '연금': 'pension', '생계': 'livelihood',
  '농업': 'agriculture', '농어촌': 'rural', '귀농': 'returning-farm', '영농': 'farming',
  '에너지': 'energy', '난방': 'heating', '환경': 'environment',
  '문화': 'culture', '관광': 'tourism', '체육': 'sports',
  '안전': 'safety', '재난': 'disaster',
  '지원금': 'grant', '보조금': 'subsidy', '장려금': 'incentive', '위문금': 'comfort-payment',
  '급여': 'allowance', '수당': 'allowance', '바우처': 'voucher', '이용권': 'voucher',
  '감면': 'reduction', '면제': 'exemption', '할인': 'discount',
  '정착': 'settlement', '특별': 'special', '맞춤': 'customized', '통합': 'integrated',
  '특별지원': 'special-support', '확대': 'expansion', '인상': 'increase',
  '지원': 'support',
  '국가': 'national', '정부': 'gov', '지방': 'local', '지역': 'regional',
  '도시': 'urban', '시도': 'province', '시군구': 'city',
};

const TERM_KEYS = Object.keys(TERM_MAP).sort((a, b) => b.length - a.length);

function makeSlug(title, srcId) {
  const seen = new Set();
  const matches = [];
  let remaining = title;
  for (const ko of TERM_KEYS) {
    if (remaining.includes(ko)) {
      const en = TERM_MAP[ko];
      if (!seen.has(en)) {
        seen.add(en);
        matches.push(en);
      }
      remaining = remaining.split(ko).join(' ');
    }
  }
  const idShort = String(srcId).toLowerCase().replace(/[^a-z0-9]/g, '').slice(-6) || 'unknown';
  if (matches.length === 0) return `subsidy-${idShort}`;
  return `${matches.slice(0, 6).join('-')}-${idShort}`;
}

// ─────────────────────────────────────────────────────────────
// 텍스트·금액·상태·태그 도출 (기존과 동일)
// ─────────────────────────────────────────────────────────────
function splitLines(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[○\-●•·•▶■]\s*/, ''))
    .filter((l) => l.length > 0 && l.length < 240);
}

function extractAmount(text) {
  if (!text) return { amount: 0, label: '지원금' };
  const candidates = [];
  for (const m of text.matchAll(/([0-9,]+(?:\.[0-9]+)?)\s*억\s*원?/g)) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (!Number.isNaN(n) && n > 0 && n < 10000) candidates.push(Math.round(n * 100_000_000));
  }
  for (const m of text.matchAll(/([0-9,]+)\s*백\s*만\s*원/g)) {
    const n = parseInt(m[1].replace(/,/g, ''), 10);
    if (!Number.isNaN(n) && n > 0 && n < 10000) candidates.push(n * 1_000_000);
  }
  for (const m of text.matchAll(/([0-9,]+)\s*천\s*만\s*원/g)) {
    const n = parseInt(m[1].replace(/,/g, ''), 10);
    if (!Number.isNaN(n) && n > 0 && n < 1000) candidates.push(n * 10_000_000);
  }
  for (const m of text.matchAll(/(?<![백천])\s*([0-9,]+)\s*만\s*원/g)) {
    const n = parseInt(m[1].replace(/,/g, ''), 10);
    if (!Number.isNaN(n) && n >= 1 && n < 100_000) candidates.push(n * 10_000);
  }
  for (const m of text.matchAll(/(?<![만억백천])\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/g)) {
    const n = parseInt(m[1].replace(/,/g, ''), 10);
    if (!Number.isNaN(n) && n >= 10_000) candidates.push(n);
  }
  if (candidates.length === 0) return { amount: 0, label: '지원금' };
  const max = Math.max(...candidates);
  let label = '지원금';
  if (/월\s*[0-9]/.test(text) || /월\s*최대/.test(text)) label = '월 지원';
  else if (/연\s*[0-9]/.test(text) || /연\s*최대/.test(text)) label = '연 지원';
  else if (/최대/.test(text)) label = '최대';
  else if (/한도/.test(text)) label = '한도';
  return { amount: max, label };
}

function deriveStatus(deadline) {
  if (!deadline || typeof deadline !== 'string') return '신청 가능';
  if (deadline.includes('상시')) return '신청 가능';
  const m = deadline.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) {
    const target = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    const diffDays = (target - Date.now()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return '마감';
    if (diffDays < 30) return '곧 마감';
    return '신청 가능';
  }
  return '신청 가능';
}

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

function mapToSchema(item, slug) {
  const category = mapCategory(item['서비스분야']);
  const eligibility = splitLines(item['지원대상']).slice(0, 6);
  const benefits = splitLines(item['지원내용']).slice(0, 6);
  const { amount, label: amountLabel } = extractAmount(item['지원내용']);
  const status = deriveStatus(item['신청기한']);
  const tags = deriveTags(item, category);
  return {
    id: slug,
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
      // 응답 본문에서 키가 echo 되지 않도록 키 마스킹
      let body = await res.text().catch(() => '');
      body = body.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
      body = body.replace(new RegExp(encodeURIComponent(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
      throw new Error(`API ${res.status} (page=${page}, keyLen=${key.length}): ${body.slice(0, 300)}`);
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
// Manifest I/O
// ─────────────────────────────────────────────────────────────
async function readManifest() {
  try {
    const text = await readFile(MANIFEST_PATH, 'utf8');
    return JSON.parse(text);
  } catch {
    return { lastSync: null, items: {} };
  }
}

async function writeManifest(manifest) {
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

// 등록일시 / 수정일시 ('YYYYMMDDHHmmss') → ms timestamp
function parseGovDate(s) {
  if (!s || typeof s !== 'string') return 0;
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return 0;
  return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
}

// ─────────────────────────────────────────────────────────────
// _gov24/ wipe (bootstrap 모드용)
// ─────────────────────────────────────────────────────────────
async function wipeGov24Dir() {
  let removed = 0;
  try {
    const files = await readdir(OUT_DIR);
    for (const f of files) {
      if (f.endsWith('.json')) {
        await unlink(join(OUT_DIR, f));
        removed++;
      }
    }
  } catch {}
  return removed;
}

// 구버전 호환: 루트의 api-*.json 정리
async function cleanLegacyApiFiles() {
  const root = join(ROOT, 'src', 'data', 'subsidies');
  let removed = 0;
  try {
    const files = await readdir(root);
    for (const f of files) {
      if (f.startsWith('api-') && f.endsWith('.json')) {
        await unlink(join(root, f));
        removed++;
      }
    }
  } catch {}
  return removed;
}

// ─────────────────────────────────────────────────────────────
// 슬러그 충돌 회피
// ─────────────────────────────────────────────────────────────
function uniqueSlug(title, srcId, used) {
  let slug = makeSlug(title, srcId);
  if (used.has(slug)) {
    slug = `subsidy-${String(srcId).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }
  used.add(slug);
  return slug;
}

// ─────────────────────────────────────────────────────────────
// Bootstrap 모드: 상위 100건 시드 + manifest 생성
// ─────────────────────────────────────────────────────────────
async function runBootstrap(items) {
  console.log(`🚀 Bootstrap 모드 — 상위 ${TOP_N}건 시드`);

  await mkdir(OUT_DIR, { recursive: true });
  const removed = await wipeGov24Dir();
  if (removed > 0) console.log(`🧹 _gov24/ 기존 ${removed}개 정리`);
  const legacy = await cleanLegacyApiFiles();
  if (legacy > 0) console.log(`🧹 (legacy) api-*.json ${legacy}개 정리`);

  const sorted = [...items].sort((a, b) => (b['조회수'] || 0) - (a['조회수'] || 0));
  const top = sorted.slice(0, TOP_N);

  const used = new Set();
  const manifestItems = {};
  let written = 0;
  let skipped = 0;

  for (const item of top) {
    try {
      const srcId = item['서비스ID'];
      const slug = uniqueSlug(item['서비스명'] || '', srcId, used);
      const mapped = mapToSchema(item, slug);
      await writeFile(join(OUT_DIR, `${slug}.json`), JSON.stringify(mapped, null, 2) + '\n', 'utf8');
      manifestItems[srcId] = {
        slug,
        regDate: item['등록일시'] || '',
        modDate: item['수정일시'] || '',
      };
      written++;
    } catch (e) {
      skipped++;
      console.warn(`⚠️ skip: ${e.message}`);
    }
  }

  await writeManifest({
    lastSync: new Date().toISOString(),
    mode: 'bootstrap',
    items: manifestItems,
  });

  console.log(`✅ ${written}개 시드 (스킵 ${skipped}) — manifest ${Object.keys(manifestItems).length}건`);
}

// ─────────────────────────────────────────────────────────────
// New 모드: 신규 등록만 추가 (등록일시 ≤ 30일 + manifest 미존재)
// ─────────────────────────────────────────────────────────────
async function runNew(items) {
  console.log(`📥 New 모드 — 최근 ${NEW_WINDOW_DAYS}일 내 신규 등록만 추가`);

  const manifest = await readManifest();
  const seenIds = new Set(Object.keys(manifest.items || {}));
  const cutoff = Date.now() - NEW_WINDOW_DAYS * 24 * 3600 * 1000;

  const candidates = items.filter((item) => {
    const id = item['서비스ID'];
    if (!id || seenIds.has(id)) return false;
    const regTs = parseGovDate(item['등록일시']);
    return regTs && regTs >= cutoff;
  });

  console.log(`🔍 후보: 신규 ${candidates.length}건 (총 ${items.length} 중)`);

  if (candidates.length === 0) {
    console.log('✨ 추가할 신규 지원금 없음');
    await writeManifest({
      ...manifest,
      lastSync: new Date().toISOString(),
      mode: 'new',
    });
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  // 기존 슬러그 모음 (충돌 방지)
  const used = new Set(Object.values(manifest.items || {}).map((v) => v.slug));

  const updatedItems = { ...(manifest.items || {}) };
  let written = 0;
  let skipped = 0;

  for (const item of candidates) {
    try {
      const srcId = item['서비스ID'];
      const slug = uniqueSlug(item['서비스명'] || '', srcId, used);
      const mapped = mapToSchema(item, slug);
      await writeFile(join(OUT_DIR, `${slug}.json`), JSON.stringify(mapped, null, 2) + '\n', 'utf8');
      updatedItems[srcId] = {
        slug,
        regDate: item['등록일시'] || '',
        modDate: item['수정일시'] || '',
      };
      written++;
    } catch (e) {
      skipped++;
      console.warn(`⚠️ skip: ${e.message}`);
    }
  }

  await writeManifest({
    lastSync: new Date().toISOString(),
    mode: 'new',
    items: updatedItems,
  });

  console.log(`✅ +${written}건 추가 (스킵 ${skipped}) — manifest ${Object.keys(updatedItems).length}건`);
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────
async function main() {
  const env = await loadEnv();
  const key = env.DATA_GO_KR_KEY;
  if (!key) {
    console.error('❌ DATA_GO_KR_KEY 미설정 (.env / .env.local 또는 환경변수)');
    process.exit(1);
  }
  console.log('🔑 API 키 로드 완료');

  // 모드 선택
  const arg = (process.argv[2] || '').toLowerCase();
  const manifestExists = existsSync(MANIFEST_PATH);
  const mode = arg === 'bootstrap' ? 'bootstrap' : arg === 'new' ? 'new' : manifestExists ? 'new' : 'bootstrap';
  console.log(`▶ 모드: ${mode}${arg ? '' : ' (자동 감지)'}`);

  const { items, total } = await fetchAllServices(key);
  console.log(`📦 전체 ${total}건 / 수신 ${items.length}건`);

  if (mode === 'bootstrap') {
    await runBootstrap(items);
  } else {
    await runNew(items);
  }

  console.log(`📂 ${OUT_DIR}`);
}

main().catch((e) => {
  console.error('💥', e?.message ?? e);
  process.exit(1);
});
