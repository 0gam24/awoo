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
  loader: glob({ pattern: ['**/*.json', '!**/_*.json'], base: 'src/data/subsidies' }),
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

export const collections = { personas, subsidies, issues };
