#!/usr/bin/env node
// build-entity-graph.mjs — 4축 entity 정적 인덱서 (Cycle #5 P0-1)
//
// 4사이클 누적 보류 끝, 본격 도입.
// 입력: src/data/{glossary,topics,personas,situations}.json + subsidies/*/*.json
// 출력: src/data/entity-graph.json (각 entity의 @id + 역참조 그래프)
//
// 활용:
//   - schema-validate.mjs dangling @id 가드 (graph에 없는 @id 참조 시 fail)
//   - inline-glossary 자동 anchor (subsidy/topic 본문에서 glossary term 매칭)
//   - CrossRefRail 자동 주입 (P1, 향후 사이클)
//   - llms-full.txt 섹션 헤더 graph 활용

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://awoo.or.kr';

function readJson(p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function walkSubsidies(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_archived')) continue;
      out.push(...walkSubsidies(full));
    } else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.startsWith('_')) {
      out.push(full);
    }
  }
  return out;
}

const personas = readJson(path.join(ROOT, 'src/data/personas.json')) || [];
const situations = readJson(path.join(ROOT, 'src/data/situations.json')) || [];
const glossary = readJson(path.join(ROOT, 'src/data/glossary.json')) || [];
const topics = readJson(path.join(ROOT, 'src/data/topics.json')) || [];

const subsidyFiles = walkSubsidies(path.join(ROOT, 'src/data/subsidies'));
const subsidies = [];
for (const f of subsidyFiles) {
  const data = readJson(f);
  if (data?.id) subsidies.push(data);
}

// @id 헬퍼
const personaId = (id) => `${SITE_URL}/personas/${id}/`;
const situationId = (id) => `${SITE_URL}/situations/${id}/`;
const glossaryId = (id) => `${SITE_URL}/glossary/${id}/`;
const topicId = (id) => `${SITE_URL}/topics/${id}/`;
const subsidyId = (id) => `${SITE_URL}/subsidies/${id}/`;
const categoryId = (cat) => `${SITE_URL}/categories/${encodeURIComponent(cat)}/`;

// ─────────────────────────────────────────────────────────────
// graph 빌드

// Cycle #6 P0-8: generated_at 제거 — git diff 노이즈 차단 (매 빌드 변경분 1줄 발생)
const graph = {
  '@context': 'https://schema.org',
  '@type': 'Graph',
  source: {
    personas: personas.length,
    situations: situations.length,
    glossary: glossary.length,
    topics: topics.length,
    subsidies: subsidies.length,
  },
  entities: {
    personas: {},
    situations: {},
    glossary: {},
    topics: {},
    subsidies: {},
  },
};

// personas
for (const p of personas) {
  const matchedSubsidies = subsidies.filter((s) => (s.targetPersonas ?? []).includes(p.id));
  graph.entities.personas[p.id] = {
    '@id': personaId(p.id),
    label: p.label,
    sub: p.sub,
    subsidies: matchedSubsidies.map((s) => subsidyId(s.id)),
    subsidiesCount: matchedSubsidies.length,
  };
}

// situations
for (const s of situations) {
  graph.entities.situations[s.id] = {
    '@id': situationId(s.id),
    label: s.label,
    sub: s.sub,
    matchedPersonas: (s.matchedPersonas ?? []).map(personaId),
    primaryCategories: (s.primaryCategories ?? []).map(categoryId),
  };
}

// glossary
for (const g of glossary) {
  // related @id 검증 — 존재하지 않는 id는 dangling으로 표시
  const relatedIds = [];
  const relatedDangling = [];
  for (const rid of g.related ?? []) {
    if (glossary.some((x) => x.id === rid)) {
      relatedIds.push(glossaryId(rid));
    } else {
      relatedDangling.push(rid);
    }
  }
  graph.entities.glossary[g.id] = {
    '@id': glossaryId(g.id),
    term: g.term,
    synonyms: g.synonyms ?? [],
    related: relatedIds,
    related_dangling: relatedDangling,
    category: g.category,
  };
}

// topics
for (const t of topics) {
  // relatedGlossary @id 검증
  const relatedGlossaryIds = [];
  const relatedGlossaryDangling = [];
  for (const gid of t.relatedGlossary ?? []) {
    if (glossary.some((x) => x.id === gid)) {
      relatedGlossaryIds.push(glossaryId(gid));
    } else {
      relatedGlossaryDangling.push(gid);
    }
  }
  // relatedSubsidyKeywords → 매칭되는 subsidy @id 추론 (제목/태그/요약 검색)
  const matchedSubsidyIds = [];
  for (const kw of t.relatedSubsidyKeywords ?? []) {
    for (const s of subsidies) {
      const text = `${s.title ?? ''} ${s.summary ?? ''} ${(s.tags ?? []).join(' ')}`;
      if (text.includes(kw)) {
        matchedSubsidyIds.push(subsidyId(s.id));
      }
    }
  }
  graph.entities.topics[t.id] = {
    '@id': topicId(t.id),
    title: t.title,
    category: t.category,
    relatedGlossary: relatedGlossaryIds,
    relatedGlossary_dangling: relatedGlossaryDangling,
    matchedSubsidies: [...new Set(matchedSubsidyIds)],
    mainPersonas: (t.mainPersonas ?? []).map(personaId),
    mainSituations: (t.mainSituations ?? []).map(situationId),
  };
}

// subsidies
for (const s of subsidies) {
  // 본 subsidy를 mention하는 topics
  const mentionedInTopicIds = [];
  for (const t of topics) {
    for (const kw of t.relatedSubsidyKeywords ?? []) {
      const text = `${s.title ?? ''} ${s.summary ?? ''} ${(s.tags ?? []).join(' ')}`;
      if (text.includes(kw)) {
        mentionedInTopicIds.push(topicId(t.id));
        break;
      }
    }
  }
  // 본 subsidy 본문에서 등장하는 glossary term
  const mentionedGlossaryIds = [];
  const subsidyText = `${s.title ?? ''} ${s.summary ?? ''} ${(s.eligibility ?? []).join(' ')} ${(s.benefits ?? []).join(' ')}`;
  for (const g of glossary) {
    const tokens = [g.term, ...(g.synonyms ?? [])];
    if (tokens.some((tok) => tok && subsidyText.includes(tok))) {
      mentionedGlossaryIds.push(glossaryId(g.id));
    }
  }
  graph.entities.subsidies[s.id] = {
    '@id': subsidyId(s.id),
    title: s.title,
    category: s.category,
    targetPersonas: (s.targetPersonas ?? []).map(personaId),
    mentionedInTopics: [...new Set(mentionedInTopicIds)],
    mentionedGlossary: mentionedGlossaryIds,
  };
}

// 통계 요약
graph.stats = {
  glossary_dangling_count: Object.values(graph.entities.glossary).reduce(
    (s, g) => s + (g.related_dangling?.length ?? 0),
    0,
  ),
  topics_glossary_dangling_count: Object.values(graph.entities.topics).reduce(
    (s, t) => s + (t.relatedGlossary_dangling?.length ?? 0),
    0,
  ),
  subsidies_with_glossary_mentions: Object.values(graph.entities.subsidies).filter(
    (s) => (s.mentionedGlossary?.length ?? 0) > 0,
  ).length,
  topics_with_subsidy_matches: Object.values(graph.entities.topics).filter(
    (t) => (t.matchedSubsidies?.length ?? 0) > 0,
  ).length,
};

const outPath = path.join(ROOT, 'src/data/entity-graph.json');
writeFileSync(outPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');

console.log(`[entity-graph] 산출: ${outPath}`);
console.log(
  `[entity-graph] entities: ${personas.length} personas / ${situations.length} situations / ${glossary.length} glossary / ${topics.length} topics / ${subsidies.length} subsidies`,
);
console.log(`[entity-graph] stats:`, graph.stats);

// dangling이 있어도 빌드는 통과 (정보성). schema-validate가 별도 가드.
process.exit(0);
