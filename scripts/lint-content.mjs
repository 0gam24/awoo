#!/usr/bin/env node
// 빌드 타임 콘텐츠 lint
// - 슬러그 충돌 (NFC/NFD 정규화 후 중복 검사)
// - relatedSubsidies / relatedPersonas / targetPersonas 참조 무결성
// - 이슈 포스트 schema shape (필수 필드)
// - 한글·이모지 등 URL-unsafe 슬러그 감지
//
// 종료 코드: 0 (통과) / 1 (실패) — CI 게이트로 사용

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SUBSIDIES_DIR = path.join(ROOT, 'src/data/subsidies');
const ISSUES_DIR = path.join(ROOT, 'src/data/issues');
const PERSONAS_FILE = path.join(ROOT, 'src/data/personas.json');

const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function walkSubsidies(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
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
        if (
          inner.isFile() &&
          inner.name.endsWith('.json') &&
          !inner.name.startsWith('_')
        ) {
          out.push({ date: dateName, slug: inner.name.replace(/\.json$/, ''), file: path.join(full, inner.name) });
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
  if (/<script|javascript:/i.test(bodyAll)) {
    err(`이슈 본문에 script/javascript: 패턴 감지: ${date}/${slug}`);
  }
  for (const src of post.sources ?? []) {
    if (src.url && !/^https?:\/\//.test(src.url)) {
      err(`이슈 sources url 형식 오류 (${src.url}): ${date}/${slug}`);
    }
  }
}

// --- 출력
console.log('');
if (warnings.length > 0) {
  console.log(`[lint] 경고 ${warnings.length}건:`);
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}
if (errors.length > 0) {
  console.log('');
  console.log(`[lint] 에러 ${errors.length}건:`);
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  console.log('');
  console.log('[lint] 빌드를 차단합니다.');
  process.exit(1);
}

console.log(`[lint] 통과 — 지원금 ${subsidyFiles.length}개 / 이슈 ${issueFiles.length}개 / 페르소나 ${personaIds.size}개`);
process.exit(0);
