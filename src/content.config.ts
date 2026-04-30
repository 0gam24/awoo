import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

const personas = defineCollection({
  loader: file('src/data/personas.json'),
  schema: z.object({
    id: z.string(),
    label: z.string(),
    sub: z.string(),
    icon: z.string(),
    age: z.string(),
    income: z.string(),
    living: z.string(),
    bg: z.string(),
    pains: z.array(z.string()),
  }),
});

const subsidies = defineCollection({
  // _manifest.json 등 underscore-prefixed 메타 파일 제외
  loader: glob({
    pattern: [
      '**/*.json',
      '!**/_*.json', // _manifest, _history 등 메타 파일 제외
      '!_archived/**', // 마감 후 sweep 된 항목은 collection에서 제외 (410 처리)
    ],
    base: 'src/data/subsidies',
  }),
  schema: z.object({
    id: z.string(),
    applyUrl: z.string().url(),
    title: z.string(),
    agency: z.string(),
    category: z.string(),
    icon: z.string(),
    bg: z.string(),
    amount: z.number(),
    amountLabel: z.string(),
    monthly: z.string().optional(),
    period: z.string(),
    deadline: z.string(),
    summary: z.string(),
    eligibility: z.array(z.string()),
    benefits: z.array(z.string()),
    documents: z.array(z.string()),
    status: z.enum(['신청 가능', '곧 마감', '마감']),
    tags: z.array(z.string()),
    targetPersonas: z.array(z.string()),
    fitNotes: z.record(z.string(), z.string()).optional(),
    isHot: z.boolean().optional(),
  }),
});

const issues = defineCollection({
  loader: file('src/data/issues.json'),
  schema: z.object({
    id: z.string(),
    badge: z.string(),
    date: z.string(),
    headline: z.string(),
    summary: z.string(),
    icon: z.string(),
    related: z.string().optional(),
    affectedPersonas: z.array(z.string()),
  }),
});

const glossary = defineCollection({
  loader: file('src/data/glossary.json'),
  schema: z.object({
    id: z.string(),
    term: z.string(),
    shortDef: z.string(),
    longDef: z.string(),
    category: z.string(),
    related: z.array(z.string()).optional(),
    synonyms: z.array(z.string()).optional(),
  }),
});

const topics = defineCollection({
  loader: file('src/data/topics.json'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    shortDef: z.string(),
    longDef: z.string(),
    category: z.string(),
    icon: z.string(),
    bg: z.string(),
    mainPersonas: z.array(z.string()),
    mainSituations: z.array(z.string()),
    decisionTree: z.array(
      z.object({
        q: z.string(),
        a: z.string(),
        linkSlug: z.string().optional(),
      }),
    ),
    comparison: z
      .object({
        title: z.string(),
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
      })
      .optional(),
    timeline: z
      .object({
        title: z.string(),
        steps: z.array(
          z.object({
            when: z.string(),
            what: z.string(),
            detail: z.string(),
          }),
        ),
      })
      .optional(),
    rejectionReasons: z
      .array(
        z.object({
          cause: z.string(),
          fix: z.string(),
        }),
      )
      .optional(),
    relatedSubsidyKeywords: z.array(z.string()).optional(),
    relatedGlossary: z.array(z.string()).optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })),
  }),
});

// Cycle #39: flagship guides — markdown 본문 + 자동 라우트·schema·llms 포함
// 사용자가 src/content/guides/{slug}.md 작성 → 즉시 발행
const guides = defineCollection({
  // _template.md, _draft.md 등 underscore prefix 명시적 제외
  loader: glob({ pattern: ['**/*.md', '!_*.md', '!**/_*.md'], base: 'src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['주거', '취업', '창업', '교육', '복지', '자산', '농업', '범용']),
    persona: z.array(z.string()).optional(), // office-rookie, self-employed 등
    relatedSubsidies: z.array(z.string()).optional(),
    relatedTopics: z.array(z.string()).optional(),
    publishedAt: z.string(),
    updatedAt: z.string().optional(),
    author: z.string().default('김준혁'),
    tldr: z.array(z.string()).min(1).max(7),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    isFlagship: z.boolean().default(false), // 심층 가이드 표시
  }),
});

export const collections = { personas, subsidies, issues, glossary, topics, guides };
