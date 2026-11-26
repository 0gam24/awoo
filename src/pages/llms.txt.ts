import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import noindexPaths from '@/data/noindex-paths.json';
import { CATEGORIES } from '@/data/site-data';
import situationsData from '@/data/situations.json';
import { passesIssueGate } from '@/lib/issue-gate.mjs';
import { compareIssuesByLatest, issueModifiedDate } from '@/lib/issue-modified.mjs';
import { issueUrlPath } from '@/lib/issue-url.mjs';
import {
  formatDateKR,
  lastBatchAtISO,
  NEW_WINDOW_DAYS,
  recentlyAddedSlugs,
} from '@/lib/subsidies-meta';

interface SituationLite {
  id: string;
  label: string;
  sub: string;
}

export const prerender = true;

const noindexSet = new Set<string>([
  ...noindexPaths.paths,
  ...noindexPaths.rework,
  ...(noindexPaths.manual as string[]),
]);

function isLocalAgency(agency: string): boolean {
  return /(시|군|구|시청|군청|구청)$/.test(agency.trim());
}

export const GET: APIRoute = async () => {
  const personas = await getCollection('personas');
  const subsidies = await getCollection('subsidies');
  const glossary = await getCollection('glossary');
  const topics = await getCollection('topics');
  const guides = await getCollection('guides');
  const bySlug = new Map(subsidies.map((s) => [s.data.id, s.data]));
  const recent = recentlyAddedSlugs(10)
    .map(({ slug }) => bySlug.get(slug))
    .filter(Boolean);
  const situations = situationsData as SituationLite[];

  const lines: string[] = [];
  lines.push('# 지원금가이드');
  lines.push('');
  lines.push('> 전 국민 대상 정부 지원금을 페르소나(생애·상황) 단위로 정리한 정보 안내 사이트.');
  lines.push('> 신청 대행 없이 정부 공식 사이트로 안내합니다.');
  lines.push('');
  lines.push(
    '청년 월세부터 신혼 특공, 청년미래적금, 소상공인 정책자금, 부모급여, 기초생활보장까지',
  );
  lines.push(
    '— 본인에게 맞는 지원금을 사회초년생·자영업·신혼육아·중장년·저소득·농업 6개 페르소나로',
  );
  lines.push('분류해 매칭하고, 무료 계산기와 심층 가이드로 자격과 예상 금액을 안내합니다.');
  lines.push('');

  lines.push('## 핵심 진입점');
  lines.push('');
  lines.push('- [홈](https://awoo.or.kr/): 페르소나·상황·이슈 종합 안내');
  lines.push(
    '- [무료 지원금 계산기 모음](https://awoo.or.kr/calculators/): 근로장려금·중위소득·실업급여·청년미래적금 계산',
  );
  lines.push('- [5분 지원금 진단](https://awoo.or.kr/quick/): 4질문 맞춤형 지원금 매칭');
  lines.push(
    '- [심층 대표 가이드](https://awoo.or.kr/guides/): 주요 정부 지원금 마스터 가이드 모음',
  );
  lines.push('- [오늘의 이슈](https://awoo.or.kr/issues/): 정책 변경·신청 방법 심층 분석');
  lines.push('- [전체 분석 포스트](https://awoo.or.kr/issues/all/): 분석 포스트 전체 아카이브');
  lines.push('- [전체 지원금](https://awoo.or.kr/subsidies/): 카테고리·소득·신청기한 필터');
  lines.push('- [신규 지원금](https://awoo.or.kr/subsidies/new/): 최근 등록 지원금');
  lines.push('- [신청 가이드](https://awoo.or.kr/guide/): 신청 흐름·서류·FAQ');
  lines.push(
    '- [용어 사전](https://awoo.or.kr/glossary/): 기준중위소득·소득인정액 등 정책 용어 해설',
  );
  lines.push('');

  lines.push('## 무료 계산기');
  lines.push('');
  lines.push(
    '- [근로장려금 계산기](https://awoo.or.kr/calculators/eitc/): 가구 유형·연 총급여별 예상 수령액(최대 330만원)',
  );
  lines.push(
    '- [기준중위소득 % 계산기](https://awoo.or.kr/calculators/median-income/): 2026년 가구원 수별 중위소득 비율 및 복지 자격선 판별',
  );
  lines.push(
    '- [실업급여 모의계산기](https://awoo.or.kr/calculators/unemployment/): 2026년 1일 상·하한액(66,048원~68,100원)과 가입기간별 예상 총액',
  );
  lines.push(
    '- [청년미래적금 만기 계산기](https://awoo.or.kr/calculators/youth-savings/): 일반형(6%)·우대형(12%) 정부기여금과 비과세 이자 합산 수령액',
  );
  lines.push('');

  if (guides.length > 0) {
    const sortedGuides = [...guides].sort((a, b) => {
      const ad = a.data.updatedAt ?? a.data.publishedAt;
      const bd = b.data.updatedAt ?? b.data.publishedAt;
      return ad < bd ? 1 : -1;
    });
    lines.push(`## 심층 대표 가이드 (${guides.length}건)`);
    lines.push('');
    for (const g of sortedGuides) {
      lines.push(
        `- [${g.data.title}](https://awoo.or.kr/guides/${g.id}/): ${g.data.description.slice(0, 110)}`,
      );
    }
    lines.push('');
  }

  lines.push('## 페르소나별 지원금');
  lines.push('');
  for (const p of personas) {
    lines.push(`- [${p.data.label}](https://awoo.or.kr/personas/${p.data.id}/): ${p.data.sub}`);
  }
  lines.push('');

  lines.push('## 분야별 카테고리');
  lines.push('');
  for (const c of CATEGORIES) {
    if (c.id === 'all') continue;
    lines.push(
      `- [${c.name}](https://awoo.or.kr/categories/${encodeURIComponent(c.id)}/): ${c.description ?? c.name}`,
    );
  }
  lines.push('');

  lines.push('## 상황별 (라이프 이벤트)');
  lines.push('');
  for (const s of situations) {
    lines.push(`- [${s.label}](https://awoo.or.kr/situations/${s.id}/): ${s.sub}`);
  }
  lines.push('');

  lines.push('## 주제별 종합');
  lines.push('');
  for (const t of topics) {
    lines.push(
      `- [${t.data.title}](https://awoo.or.kr/topics/${t.data.id}/): ${t.data.shortDef.slice(0, 80)}`,
    );
  }
  lines.push('');

  // 핵심 중앙부처·큐레이션 대표 지원금만 수록 (소규모 지자체 단건은 /subsidies/에서 검색)
  const coreSubsidies = subsidies.filter(
    (s) => s.id.startsWith('_curated/') || (!isLocalAgency(s.data.agency) && s.data.amount > 0),
  );
  lines.push(
    `## 대표 중앙부처·주요 지원금 (${coreSubsidies.length}건 / 전체 ${subsidies.length}건은 지원금 목록 참고)`,
  );
  lines.push('');
  for (const s of coreSubsidies.slice(0, 40)) {
    lines.push(
      `- [${s.data.title}](https://awoo.or.kr/subsidies/${s.data.id}/): ${s.data.agency} · ${s.data.summary.slice(0, 70)}`,
    );
  }
  lines.push('');

  if (recent.length > 0) {
    const dateLabel = formatDateKR(lastBatchAtISO);
    lines.push(
      `## 최근 등록 지원금 (최근 ${NEW_WINDOW_DAYS}일${dateLabel ? `, 동기화 ${dateLabel}` : ''})`,
    );
    lines.push('');
    for (const s of recent) {
      if (!s) continue;
      lines.push(
        `- [${s.title}](https://awoo.or.kr/subsidies/${s.id}/): ${s.agency} · ${s.summary.slice(0, 60)}`,
      );
    }
    lines.push('');
  }

  // 색인 허용 중인 영구 분석 포스트 (noindex 제외, 최신 수정·발행순 상위 60건)
  const issueModules = import.meta.glob<{
    default: {
      title: string;
      slug: string;
      metaDescription: string;
      date: string;
      publishedAt?: string;
      dateModified?: string;
      updates?: Array<{ date: string; note?: string }>;
      sections?: unknown[];
      faq?: unknown[];
    };
  }>('/src/data/issues/*/*.json', { eager: true });

  const issuePosts: Array<{
    date: string;
    slug: string;
    data: {
      title: string;
      metaDescription: string;
      dateModified?: string;
      updates?: Array<{ date: string; note?: string }>;
    };
    modified: string | null;
  }> = [];

  for (const [filePath, mod] of Object.entries(issueModules)) {
    const m = filePath.match(/\/issues\/(\d{4}-\d{2}-\d{2})\/([^/]+)\.json$/);
    if (!m) continue;
    const date = m[1];
    const slug = m[2];
    if (!date || !slug || slug.startsWith('_')) continue;
    if (!passesIssueGate(date, slug, mod.default)) continue;
    const urlPath = issueUrlPath(date, slug);
    if (noindexSet.has(urlPath)) continue;
    issuePosts.push({
      date,
      slug,
      data: mod.default,
      modified: issueModifiedDate(date, mod.default),
    });
  }
  issuePosts.sort(compareIssuesByLatest);

  if (issuePosts.length > 0) {
    lines.push(`## 주요 정책 분석 포스트 (최신·핵심 60건 / 전체 색인 ${issuePosts.length}건)`);
    lines.push('');
    for (const p of issuePosts.slice(0, 60)) {
      lines.push(
        `- [${p.data.title}](https://awoo.or.kr${issueUrlPath(p.date, p.slug)}): ${p.data.metaDescription.slice(0, 100)}`,
      );
    }
    lines.push('');
  }

  // 주요 제도별 토픽 허브 (curatedHubs + history.byTerm, URL 인코딩 적용으로 깨진 링크 방지)
  const historyModules = import.meta.glob<{
    default: { byTerm?: Record<string, { totalCount: number; daysActive: number }> };
  }>('/src/data/issues/_history.json', { eager: true });
  const history = Object.values(historyModules)[0]?.default ?? { byTerm: {} };

  const hubCfgModules = import.meta.glob<{ default: { hubs?: { term: string }[] } }>(
    '/docs/ops/topic-hubs.json',
    { eager: true },
  );
  const curatedTerms = (Object.values(hubCfgModules)[0]?.default?.hubs ?? [])
    .map((h) => h.term)
    .filter((t) => t && /[가-힣]/.test(t));

  const seenTerms = new Set<string>();
  const hubLines: string[] = [];
  for (const term of curatedTerms) {
    seenTerms.add(term);
    hubLines.push(
      `- [${term}](https://awoo.or.kr/issues/topics/${encodeURIComponent(term)}/): ${term} 핵심 분석 모음`,
    );
  }
  const activeTopics = Object.entries(history.byTerm ?? {})
    .filter(([t, e]) => e.totalCount >= 1 && /[가-힣]/.test(t) && !seenTerms.has(t))
    .sort((a, b) => b[1].totalCount - a[1].totalCount)
    .slice(0, 20);
  for (const [term, e] of activeTopics) {
    hubLines.push(
      `- [${term}](https://awoo.or.kr/issues/topics/${encodeURIComponent(term)}/): 누적 ${e.totalCount}회 언급`,
    );
  }
  if (hubLines.length > 0) {
    lines.push('## 주요 제도별 토픽 허브');
    lines.push('');
    lines.push(...hubLines);
    lines.push('');
  }

  lines.push('## 핵심 정책 용어');
  lines.push('');
  for (const g of glossary.slice(0, 15)) {
    lines.push(
      `- [${g.data.term}](https://awoo.or.kr/glossary/${g.data.id}/): ${g.data.shortDef.slice(0, 80)}`,
    );
  }
  lines.push('');

  lines.push('## 정책 및 운영');
  lines.push('');
  lines.push('- [사이트 소개](https://awoo.or.kr/about/): 운영 주체·편집 원칙');
  lines.push(
    '- [편집책임자 프로필](https://awoo.or.kr/editor/jjh/): 김준혁 편집책임자 약력·검수 절차',
  );
  lines.push('- [편집 정책](https://awoo.or.kr/editorial-policy/): 1차 자료 대조·정정 기준');
  lines.push('- [개인정보처리방침](https://awoo.or.kr/privacy/)');
  lines.push('- [이용약관](https://awoo.or.kr/terms/)');
  lines.push('- [문의](https://awoo.or.kr/contact/)');
  lines.push('');
  lines.push('## 전체 본문 합본');
  lines.push('');
  lines.push('- [전체 마크다운 합본](https://awoo.or.kr/llms-full.txt)');
  lines.push('');
  lines.push('## 운영 주체');
  lines.push('');
  lines.push(
    '스마트데이터샵 (대표 김준혁) · 사업자등록 406-06-34485 · 인천광역시 계양구 새벌로 88, 효성동 · smartdatashop@gmail.com · 공식 블로그: https://blog.naver.com/aidatashop',
  );

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
