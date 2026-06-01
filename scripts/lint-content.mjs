#!/usr/bin/env node
// 빌드 타임 콘텐츠 lint
// - 슬러그 충돌 (NFC/NFD 정규화 후 중복 검사)
// - relatedSubsidies / relatedPersonas / targetPersonas 참조 무결성
// - 이슈 포스트 schema shape (필수 필드)
// - 한글·이모지 등 URL-unsafe 슬러그 감지
//
// 종료 코드: 0 (통과) / 1 (실패) — CI 게이트로 사용

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SUBSIDIES_DIR = path.join(ROOT, 'src/data/subsidies');
const ISSUES_DIR = path.join(ROOT, 'src/data/issues');
const PERSONAS_FILE = path.join(ROOT, 'src/data/personas.json');

const errors = [];
const warnings = [];

function err(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function walkSubsidies(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // _archived/ 등 underscore-prefix 디렉토리는 lint 제외 (collection에서도 제외됨)
      if (entry.name.startsWith('_archived')) continue;
      out.push(...walkSubsidies(full));
    } else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.startsWith('_')) {
      out.push(full);
    }
  }
  return out;
}

function walkIssues(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const dateName = entry.name;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateName)) continue;
      for (const inner of readdirSync(full, { withFileTypes: true })) {
        if (inner.isFile() && inner.name.endsWith('.json') && !inner.name.startsWith('_')) {
          out.push({
            date: dateName,
            slug: inner.name.replace(/\.json$/, ''),
            file: path.join(full, inner.name),
          });
        }
      }
    }
  }
  return out;
}

// --- 1. 페르소나 로드
const personasData = readJson(PERSONAS_FILE);
const personaIds = new Set(personasData.map((p) => p.id));
console.log(`[lint] 페르소나 ${personaIds.size}개 로드`);

// --- 2. 지원금 로드 + 슬러그 충돌 검사
const subsidyFiles = walkSubsidies(SUBSIDIES_DIR);
console.log(`[lint] 지원금 ${subsidyFiles.length}개 발견`);

const subsidyById = new Map();
const slugMap = new Map(); // NFC normalized slug → file

for (const file of subsidyFiles) {
  let data;
  try {
    data = readJson(file);
  } catch (e) {
    err(`JSON parse 실패: ${path.relative(ROOT, file)} — ${e.message}`);
    continue;
  }

  // 필수 필드
  for (const key of ['id', 'title', 'agency', 'category', 'amount', 'targetPersonas']) {
    if (data[key] === undefined || data[key] === null) {
      err(`필수 필드 누락 (${key}): ${path.relative(ROOT, file)}`);
    }
  }

  if (data.id) subsidyById.set(data.id, data);

  // 슬러그 = 파일명
  const base = path.basename(file, '.json');
  const nfc = base.normalize('NFC');
  if (slugMap.has(nfc)) {
    err(`슬러그 충돌 (NFC 정규화 후 동일): ${slugMap.get(nfc)} ↔ ${path.relative(ROOT, file)}`);
  } else {
    slugMap.set(nfc, path.relative(ROOT, file));
  }

  // URL-unsafe 슬러그 (한글·이모지·공백)
  if (/[^a-zA-Z0-9\-_]/.test(base)) {
    warn(`URL-unsafe 슬러그 (영숫자·하이픈·언더스코어 외 문자): ${base}`);
  }

  // targetPersonas 무결성
  if (Array.isArray(data.targetPersonas)) {
    for (const pid of data.targetPersonas) {
      if (!personaIds.has(pid)) {
        err(`존재하지 않는 페르소나 ID 참조 (${pid}) in ${path.relative(ROOT, file)}`);
      }
    }
  }

  // applyUrl 검증 (Zod에서도 하지만 lint 게이트 차원)
  if (data.applyUrl && !/^https?:\/\//.test(data.applyUrl)) {
    err(`applyUrl 형식 오류 (http(s):// 필요): ${data.applyUrl} in ${path.relative(ROOT, file)}`);
  }

  // status enum
  if (data.status && !['신청 가능', '곧 마감', '마감'].includes(data.status)) {
    err(`status enum 위반 (${data.status}) in ${path.relative(ROOT, file)}`);
  }
}

console.log(`[lint] 지원금 ID ${subsidyById.size}개 인덱싱`);

// --- 3. 이슈 포스트 검증
const issueFiles = walkIssues(ISSUES_DIR);
console.log(`[lint] 이슈 포스트 ${issueFiles.length}개 발견`);

const REQUIRED_POST_FIELDS = [
  'title',
  'slug',
  'metaDescription',
  'tldr',
  'category',
  'tags',
  'coreFacts',
  'sections',
  'faq',
  'relatedSubsidies',
  'relatedPersonas',
  'sources',
  'publishedAt',
  'date',
];

// JSON-LD shape 검증용 — 본 사이트가 출력하는 schema의 필수 필드 체크
const ALLOWED_CATEGORIES = ['주거', '취업', '창업', '교육', '자산', '복지', '농업'];

// 정식 reportType enum (실사용 5종). 레거시 포스트는 reportType 자체가 없을 수 있으므로
// '존재하는데 enum 밖일 때만' err — 누락은 검사하지 않는다(회귀 안전).
const REPORT_TYPES = [
  'weekly-essentials',
  'issue-followup',
  'new-subsidies-weekly',
  'new-subsidies-detail',
  'deadline-imminent-weekly',
];
const SOURCE_CONFIDENCE = ['high', 'medium', 'low'];

// metaDescription 전역 중복 검사용 (이슈 간 동일 문자열 → warn)
const metaDescSeen = new Map(); // metaDescription → "date/slug"

// 헤드라인 클릭베이트·과장 패턴 — Google Discover 정책 준수용
// 발견 시 warn (포스트별 사람 검토 신호)
const CLICKBAIT_PATTERNS = [
  /놀라운|충격적인|믿을 수 없는|소름|미친|역대급|화제폭발/,
  /\?\?|!!|\.\.\.\.\./,
  /숨겨진|아무도 모르는|99%가 모르는|단독|특종/,
  /당신만|꼭 봐야|반드시 봐야|이거 모르면 손해/,
  /이렇게만 하면|단 N분만|한 번에 끝|초간단/,
];

// 본문보다 헤드라인이 과장된지 — 의문형·숫자·연도는 허용
function checkClickbait(title) {
  for (const pattern of CLICKBAIT_PATTERNS) {
    if (pattern.test(title)) {
      return pattern.source;
    }
  }
  return null;
}

for (const { date, slug, file } of issueFiles) {
  let post;
  try {
    post = readJson(file);
  } catch (e) {
    err(`이슈 JSON parse 실패: ${path.relative(ROOT, file)} — ${e.message}`);
    continue;
  }

  for (const field of REQUIRED_POST_FIELDS) {
    if (post[field] === undefined || post[field] === null) {
      err(`이슈 필수 필드 누락 (${field}): ${date}/${slug}`);
    }
  }

  // coreFacts 4 필드
  if (post.coreFacts) {
    for (const k of ['who', 'amount', 'deadline', 'where']) {
      if (post.coreFacts[k] === undefined) {
        err(`이슈 coreFacts.${k} 누락: ${date}/${slug}`);
      }
    }
  }

  // sections 최소 1개 + heading/lead/body
  if (Array.isArray(post.sections)) {
    if (post.sections.length === 0) {
      warn(`이슈 sections 비어있음: ${date}/${slug}`);
    }
    post.sections.forEach((s, i) => {
      if (!s.heading || !s.lead || !s.body) {
        err(`이슈 sections[${i}] 필드 누락 (heading/lead/body): ${date}/${slug}`);
      }
    });
  }

  // relatedSubsidies 무결성
  if (Array.isArray(post.relatedSubsidies)) {
    for (const sid of post.relatedSubsidies) {
      if (!subsidyById.has(sid)) {
        warn(`이슈 relatedSubsidies 미존재 (${sid}) in ${date}/${slug}`);
      }
    }
  }

  // relatedPersonas 무결성
  if (Array.isArray(post.relatedPersonas)) {
    for (const pid of post.relatedPersonas) {
      if (!personaIds.has(pid)) {
        err(`이슈 relatedPersonas 미존재 페르소나 (${pid}) in ${date}/${slug}`);
      }
    }
  }

  // sources XSS 의심 검사 — 본문에 <script 또는 javascript: URL
  const bodyAll = (post.sections ?? []).map((s) => s.body ?? '').join('\n');
  if (/<script|javascript:|data:text\/html/i.test(bodyAll)) {
    err(`이슈 본문에 script/javascript:/data: 패턴 감지: ${date}/${slug}`);
  }
  // 본문 또는 lead/heading에 HTML 태그가 들어있으면 경고 — 인라인 markdown은 허용
  for (const s of post.sections ?? []) {
    for (const field of ['heading', 'lead']) {
      const v = s[field];
      if (typeof v === 'string' && /<[a-z][^>]*>/i.test(v)) {
        warn(`이슈 sections.${field}에 HTML 태그 감지: ${date}/${slug}`);
      }
    }
  }

  // sources url + publisher 형식 검증
  for (const src of post.sources ?? []) {
    if (src.url && !/^https?:\/\//.test(src.url)) {
      err(`이슈 sources url 형식 오류 (${src.url}): ${date}/${slug}`);
    }
    if (src.publisher && typeof src.publisher !== 'string') {
      err(`이슈 sources.publisher 타입 오류: ${date}/${slug}`);
    }
  }

  // sources 최소 3건 — Discover·E-E-A-T 신호 (warn — 기존 포스트는 점진 보완)
  if (Array.isArray(post.sources) && post.sources.length < 3) {
    warn(`이슈 sources ${post.sources.length}건 (권장 3건+): ${date}/${slug}`);
  }

  // category 화이트리스트
  if (post.category && !ALLOWED_CATEGORIES.includes(post.category)) {
    warn(`이슈 category 화이트리스트 외 (${post.category}): ${date}/${slug}`);
  }

  // 헤드라인 클릭베이트 패턴 (Google Discover 정책 준수)
  if (typeof post.title === 'string') {
    const hit = checkClickbait(post.title);
    if (hit) {
      warn(`이슈 title 클릭베이트 패턴 (${hit}): ${date}/${slug} — "${post.title.slice(0, 60)}"`);
    }
  }
  // metaDescription에도 동일 적용
  if (typeof post.metaDescription === 'string') {
    const hit = checkClickbait(post.metaDescription);
    if (hit) {
      warn(`이슈 metaDescription 클릭베이트 패턴 (${hit}): ${date}/${slug}`);
    }
  }

  // publishedAt ISO 형식
  if (post.publishedAt && Number.isNaN(Date.parse(post.publishedAt))) {
    err(`이슈 publishedAt ISO 파싱 실패 (${post.publishedAt}): ${date}/${slug}`);
  }

  // date YYYY-MM-DD 형식 + 디렉토리와 일치
  if (post.date && !/^\d{4}-\d{2}-\d{2}$/.test(post.date)) {
    err(`이슈 date 형식 오류 (${post.date}): ${date}/${slug}`);
  }
  if (post.date && post.date !== date) {
    err(`이슈 date 디렉토리 불일치 (필드: ${post.date} / 디렉토리: ${date}): ${date}/${slug}`);
  }

  // --- P0: reportType enum (존재할 때만 검사 / 누락은 무시 — 레거시 안전) ---
  if (post.reportType !== undefined && post.reportType !== null) {
    if (!REPORT_TYPES.includes(post.reportType)) {
      err(
        `이슈 reportType enum 위반 (${post.reportType}, 허용: ${REPORT_TYPES.join('|')}): ${date}/${slug}`,
      );
    }
  }

  // --- P0: 결정적 계산값 (값이 있을 때만 검사) ---
  // factCheckScore: 0~1 숫자
  if (post.factCheckScore !== undefined && post.factCheckScore !== null) {
    if (
      typeof post.factCheckScore !== 'number' ||
      post.factCheckScore < 0 ||
      post.factCheckScore > 1
    ) {
      err(`이슈 factCheckScore 0~1 숫자 아님 (${post.factCheckScore}): ${date}/${slug}`);
    }
  }
  // sourceConfidence: high/medium/low
  if (post.sourceConfidence !== undefined && post.sourceConfidence !== null) {
    if (!SOURCE_CONFIDENCE.includes(post.sourceConfidence)) {
      err(
        `이슈 sourceConfidence enum 위반 (${post.sourceConfidence}, 허용: ${SOURCE_CONFIDENCE.join('|')}): ${date}/${slug}`,
      );
    }
  }
  // sourcePublisherCount: sources 있을 때 고유 publisher 수와 일치
  if (
    post.sourcePublisherCount !== undefined &&
    post.sourcePublisherCount !== null &&
    Array.isArray(post.sources)
  ) {
    const uniquePublishers = new Set(post.sources.map((s) => s.publisher).filter(Boolean)).size;
    if (post.sourcePublisherCount !== uniquePublishers) {
      // 파생/표시용 필드 — 배포 차단(err) 대상 아님. 불일치는 warn으로 표면화만.
      warn(
        `이슈 sourcePublisherCount 불일치 (필드: ${post.sourcePublisherCount} / 실제 고유 publisher: ${uniquePublishers}): ${date}/${slug}`,
      );
    }
  }

  // --- P0: table 셀 수 (table 있을 때만) ---
  if (post.table && typeof post.table === 'object') {
    const headers = post.table.headers;
    const rows = post.table.rows;
    if (Array.isArray(headers)) {
      const n = headers.length;
      if (Array.isArray(rows)) {
        rows.forEach((row, i) => {
          if (Array.isArray(row) && row.length !== n) {
            err(
              `이슈 table rows[${i}] 셀 수 불일치 (${row.length} ≠ headers ${n}): ${date}/${slug}`,
            );
          }
        });
      }
      // headers 2~5 범위 권장 (warn)
      if (n < 2 || n > 5) {
        warn(`이슈 table headers 권장 범위(2~5) 밖 (${n}): ${date}/${slug}`);
      }
    }
    // rows 3행 미만 권장 (warn)
    if (Array.isArray(rows) && rows.length < 3) {
      warn(`이슈 table rows 권장(3행+) 미만 (${rows.length}): ${date}/${slug}`);
    }
  }

  // --- P0: AEO/길이 warn (전부 warn — 빌드 안 막음) ---
  // tldr
  if (Array.isArray(post.tldr)) {
    if (post.tldr.length < 3 || post.tldr.length > 6) {
      warn(`이슈 tldr 개수 권장(3~6) 밖 (${post.tldr.length}): ${date}/${slug}`);
    }
    if (typeof post.tldr[0] === 'string' && !/[0-9０-９]|만원|원|일|%|건|명/.test(post.tldr[0])) {
      warn(`이슈 tldr[0]에 수치/날짜 토큰 없음: ${date}/${slug}`);
    }
  }
  // faq
  if (Array.isArray(post.faq)) {
    if (post.faq.length < 3 || post.faq.length > 7) {
      warn(`이슈 faq 개수 권장(3~7) 밖 (${post.faq.length}): ${date}/${slug}`);
    }
    post.faq.forEach((f, i) => {
      if (f && typeof f.a === 'string' && /^\s*(네|예)[,，]/.test(f.a)) {
        warn(`이슈 faq[${i}].a "네,"/"예," 시작 (단독 완결 권장): ${date}/${slug}`);
      }
    });
  }
  // title 길이
  if (typeof post.title === 'string' && post.title.length > 40) {
    warn(`이슈 title 40자 초과 (${post.title.length}자): ${date}/${slug}`);
  }
  // metaDescription 길이 + 전역 중복
  if (typeof post.metaDescription === 'string') {
    const len = post.metaDescription.length;
    if (len < 60 || len > 110) {
      warn(`이슈 metaDescription 권장 길이(60~110) 밖 (${len}자): ${date}/${slug}`);
    }
    if (metaDescSeen.has(post.metaDescription)) {
      warn(
        `이슈 metaDescription 전역 중복 (${metaDescSeen.get(post.metaDescription)} 와 동일): ${date}/${slug}`,
      );
    } else {
      metaDescSeen.set(post.metaDescription, `${date}/${slug}`);
    }
  }
}

// --- 4. _history.json 트렌딩 매핑 무결성 (재발 방지)
// 메인 트렌딩 카드/토픽 hub의 'term→포스트' 링크는 _history.json byTerm[term]의
// {postDate ?? firstSeen}/{postSlug} 로 URL을 만든다. 이 매핑이 실제 존재하는 포스트를
// 가리키지 않으면 '한 달 전 무관 글/404' 류 드리프트가 배포된다 → 빌드 차단.
const HISTORY_FILE = path.join(ISSUES_DIR, '_history.json');
if (existsSync(HISTORY_FILE)) {
  const issueKeySet = new Set(issueFiles.map(({ date, slug }) => `${date}/${slug}`));
  let history = null;
  try {
    history = readJson(HISTORY_FILE);
  } catch (e) {
    err(`_history.json parse 실패 — ${e.message}`);
  }
  if (history?.byTerm) {
    for (const [term, entry] of Object.entries(history.byTerm)) {
      if (!entry?.postSlug) continue;
      const postDate = entry.postDate ?? entry.firstSeen;
      const key = `${postDate}/${entry.postSlug}`;
      if (!issueKeySet.has(key)) {
        err(
          `_history 트렌딩 매핑이 존재하지 않는 포스트를 가리킴 (term "${term}" → ${key}.json). ` +
            `postDate/postSlug 정정 또는 npm run sync:history 필요`,
        );
      }
    }
  }
}

// --- 출력
console.log('');
if (warnings.length > 0) {
  console.log(`[lint] 경고 ${warnings.length}건:`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}
if (errors.length > 0) {
  console.log('');
  console.log(`[lint] 에러 ${errors.length}건:`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log('');
  console.log('[lint] 빌드를 차단합니다.');
  process.exit(1);
}

console.log(
  `[lint] 통과 — 지원금 ${subsidyFiles.length}개 / 이슈 ${issueFiles.length}개 / 페르소나 ${personaIds.size}개`,
);
process.exit(0);
