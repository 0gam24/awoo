import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { CATEGORIES } from '@/data/site-data';
import situationsData from '@/data/situations.json';
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

export const GET: APIRoute = async () => {
  const personas = await getCollection('personas');
  const subsidies = await getCollection('subsidies');
  const glossary = await getCollection('glossary');
  const topics = await getCollection('topics');
  // Cycle #40: flagship guides 인덱스
  const guides = await getCollection('guides');
  const bySlug = new Map(subsidies.map((s) => [s.data.id, s.data]));
  const recent = recentlyAddedSlugs(15)
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
    '청년 월세부터 신혼 특공, 청년도약계좌, 소상공인 정책자금, 부모급여, 기초생활보장까지',
  );
  lines.push(
    '— 본인에게 맞는 지원금을 사회초년생·자영업·신혼육아·중장년·저소득·농업 6개 페르소나로',
  );
  lines.push('분류해 매칭합니다.');
  lines.push('');

  // Cycle #13 P0-2: 핵심 인덱스 페이지 사이트맵 (AI 크롤러 site-wide 진입점)
  lines.push('## 핵심 진입점');
  lines.push('');
  lines.push('- [홈](https://awoo.or.kr/): 페르소나·상황·이슈 종합 hub');
  lines.push('- [5분 진단](https://awoo.or.kr/quick/): 4질문 매칭 도구');
  lines.push('- [전체 지원금](https://awoo.or.kr/subsidies/): 카테고리·소득·신청기한 필터');
  lines.push('- [신규 지원금](https://awoo.or.kr/subsidies/new/): 최근 등록');
  lines.push('- [페르소나 인덱스](https://awoo.or.kr/personas/): 6개 생애 단계');
  lines.push('- [상황별 인덱스](https://awoo.or.kr/situations/): 출산·이사·실직 등 라이프 이벤트');
  lines.push('- [분야별 인덱스](https://awoo.or.kr/categories/): 7개 카테고리');
  lines.push('- [주제별 인덱스](https://awoo.or.kr/topics/): 종합 주제 hub');
  lines.push('- [용어 사전 인덱스](https://awoo.or.kr/glossary/): 정책 용어 해설');
  lines.push('- [오늘의 이슈](https://awoo.or.kr/issues/): 트렌딩 정책 + 매주 화제');
  lines.push('- [전체 분석 포스트](https://awoo.or.kr/issues/all/): 영구 포스트 아카이브');
  lines.push('- [신청 가이드](https://awoo.or.kr/guide/): 신청 흐름·FAQ');
  lines.push('');

  lines.push('## 페르소나');
  lines.push('');
  for (const p of personas) {
    lines.push(`- [${p.data.label}](https://awoo.or.kr/personas/${p.data.id}/): ${p.data.sub}`);
  }
  lines.push('');

  // Cycle #5 P0-4 / Cycle #13 P0-1: 카테고리 — 한글 raw URL (sitemap 정합)
  lines.push('## 카테고리 (분야별)');
  lines.push('');
  for (const c of CATEGORIES) {
    if (c.id === 'all') continue;
    lines.push(`- [${c.name}](https://awoo.or.kr/categories/${c.id}/): ${c.description ?? c.name}`);
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

  // Cycle #40: flagship 가이드 인덱스 (있을 때만)
  if (guides.length > 0) {
    const sortedGuides = [...guides].sort((a, b) => {
      const ad = a.data.updatedAt ?? a.data.publishedAt;
      const bd = b.data.updatedAt ?? b.data.publishedAt;
      return ad < bd ? 1 : -1;
    });
    lines.push(`## 심층 가이드 (${guides.length}건)`);
    lines.push('');
    for (const g of sortedGuides) {
      lines.push(
        `- [${g.data.title}](https://awoo.or.kr/guides/${g.id}/): ${g.data.description.slice(0, 100)}`,
      );
    }
    lines.push('');
  }

  lines.push('## 용어 사전');
  lines.push('');
  for (const g of glossary) {
    lines.push(
      `- [${g.data.term}](https://awoo.or.kr/glossary/${g.data.id}/): ${g.data.shortDef.slice(0, 80)}`,
    );
  }
  lines.push('');
  // 최근 등록 (NEW_WINDOW_DAYS 일 이내) — AI agent / 크롤러 신선도 신호
  if (recent.length > 0) {
    const dateLabel = formatDateKR(lastBatchAtISO);
    lines.push(
      `## 신규 등록 (최근 ${NEW_WINDOW_DAYS}일${dateLabel ? `, 마지막 동기화 ${dateLabel}` : ''})`,
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

  lines.push('## 지원금');
  lines.push('');
  for (const s of subsidies) {
    lines.push(
      `- [${s.data.title}](https://awoo.or.kr/subsidies/${s.data.id}/): ${s.data.agency} · ${s.data.summary.slice(0, 60)}`,
    );
  }
  lines.push('');
  // Cycle #13 P0-2: 영구 분석 포스트 + 토픽 hub (이미 핵심 진입점에 인덱스 있음, 여기선 개별)
  const issueModules = import.meta.glob<{
    default: { title: string; slug: string; metaDescription: string; date: string };
  }>('/src/data/issues/*/*.json', { eager: true });
  type IssuePost = { date: string; slug: string; title: string; metaDescription: string };
  const issuePosts: IssuePost[] = [];
  for (const [path, mod] of Object.entries(issueModules)) {
    const m = path.match(/\/issues\/(\d{4}-\d{2}-\d{2})\/([^/]+)\.json$/);
    if (!m) continue;
    const date = m[1];
    const slug = m[2];
    if (!date || !slug || slug.startsWith('_')) continue;
    issuePosts.push({
      date,
      slug,
      title: mod.default.title,
      metaDescription: mod.default.metaDescription,
    });
  }
  issuePosts.sort((a, b) => (a.date < b.date ? 1 : -1));

  if (issuePosts.length > 0) {
    lines.push('## 오늘의 이슈 — 분석 포스트');
    lines.push('');
    for (const p of issuePosts.slice(0, 30)) {
      lines.push(
        `- [${p.title}](https://awoo.or.kr/issues/${p.date}/${p.slug}/): ${p.metaDescription.slice(0, 100)}`,
      );
    }
    lines.push('');
  }

  // 토픽 hub (history.byTerm totalCount ≥ 1)
  const historyModules = import.meta.glob<{
    default: { byTerm?: Record<string, { totalCount: number; daysActive: number }> };
  }>('/src/data/issues/_history.json', { eager: true });
  const history = Object.values(historyModules)[0]?.default ?? { byTerm: {} };
  const activeTopics = Object.entries(history.byTerm ?? {})
    .filter(([, e]) => e.totalCount >= 1)
    .sort((a, b) => b[1].totalCount - a[1].totalCount);
  if (activeTopics.length > 0) {
    lines.push('## 트렌딩 토픽 hub');
    lines.push('');
    for (const [term, e] of activeTopics) {
      lines.push(
        `- [${term}](https://awoo.or.kr/issues/topics/${term}/): ${e.totalCount}건 보도, ${e.daysActive}일 화제`,
      );
    }
    lines.push('');
  }

  lines.push('## 가이드');
  lines.push('');
  lines.push('- [신청 흐름·공식 사이트·FAQ](https://awoo.or.kr/guide/)');
  lines.push('- [전체 지원금 둘러보기](https://awoo.or.kr/subsidies/)');
  lines.push('- [오늘의 이슈](https://awoo.or.kr/issues/)');
  lines.push('');
  lines.push('## 정책 및 운영');
  lines.push('');
  lines.push('- [사이트 소개](https://awoo.or.kr/about/)');
  lines.push('- [편집 정책](https://awoo.or.kr/editorial-policy/)');
  lines.push('- [개인정보처리방침](https://awoo.or.kr/privacy/)');
  lines.push('- [이용약관](https://awoo.or.kr/terms/)');
  lines.push('- [문의](https://awoo.or.kr/contact/)');
  lines.push('');
  lines.push('## 선택');
  lines.push('');
  lines.push('- [전체 마크다운 합본](https://awoo.or.kr/llms-full.txt)');
  lines.push('');
  lines.push('## 운영 주체');
  lines.push('');
  lines.push(
    '스마트데이터샵 (대표 김준혁) · 사업자등록 406-06-34485 · 인천광역시 계양구 새벌로 88, 효성동',
  );

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
