import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import noindexPaths from '@/data/noindex-paths.json';
import { CATEGORIES, formatMedianWon, INCOME_THRESHOLDS, MEDIAN_INCOME } from '@/data/site-data';
import todayIssue from '@/data/today-issue.json';
import { passesIssueGate } from '@/lib/issue-gate.mjs';
import { compareIssuesByLatest, issueModifiedDate } from '@/lib/issue-modified.mjs';
import { issueUrlPath } from '@/lib/issue-url.mjs';
import { amountText } from '@/lib/subsidy-display';

interface IssuePostSection {
  heading: string;
  lead?: string;
  body?: string;
}
interface IssuePostFAQ {
  q: string;
  a: string;
}
interface IssuePostFile {
  title?: string;
  slug?: string;
  metaDescription?: string;
  answer?: string;
  definitions?: Array<{ term?: string; definition?: string; glossarySlug?: string }>;
  tldr?: string[];
  category?: string;
  tags?: string[];
  coreFacts?: { who?: string; amount?: string; deadline?: string; where?: string };
  sections?: IssuePostSection[];
  faq?: IssuePostFAQ[];
  reportType?: string;
  sourceConfidence?: 'high' | 'medium' | 'low';
  sourcePublisherCount?: number;
  sources?: Array<{ title?: string; url?: string; publisher?: string; pubDate?: string }>;
  factCheckScore?: number;
  dateModified?: string;
  updates?: Array<{ date: string; note?: string }>;
}

const issuePostModules = import.meta.glob<{ default: IssuePostFile }>('/src/data/issues/*/*.json', {
  eager: true,
});

const noindexSet = new Set<string>([
  ...noindexPaths.paths,
  ...noindexPaths.rework,
  ...(noindexPaths.manual as string[]),
]);

function loadIndexableIssuePosts(): Array<{
  date: string;
  slug: string;
  data: IssuePostFile;
  modified: string | null;
}> {
  const out: Array<{
    date: string;
    slug: string;
    data: IssuePostFile;
    modified: string | null;
  }> = [];

  for (const [filePath, mod] of Object.entries(issuePostModules)) {
    const m = filePath.match(/\/issues\/(\d{4}-\d{2}-\d{2})\/([^/]+)\.json$/);
    if (!m) continue;
    const date = m[1];
    const slug = m[2];
    if (!date || !slug || slug.startsWith('_')) continue;
    if (!passesIssueGate(date, slug, mod.default)) continue;
    const urlPath = issueUrlPath(date, slug);
    if (noindexSet.has(urlPath)) continue;
    out.push({
      date,
      slug,
      data: mod.default,
      modified: issueModifiedDate(date, mod.default),
    });
  }

  return out.sort(compareIssuesByLatest);
}

export const prerender = true;

interface AutoSummary {
  headline?: string;
  subhead?: string;
  hookCopy?: string;
}
interface AutoTodayIssue {
  syncedAt?: string;
  headline?: string;
  description?: string;
  pubDateKR?: string;
  source?: string;
  category?: string;
  summary?: AutoSummary;
}
const auto = todayIssue as AutoTodayIssue;

function isLocalAgency(agency: string): boolean {
  return /(시|군|구|시청|군청|구청)$/.test(agency.trim());
}

export const GET: APIRoute = async () => {
  const personas = await getCollection('personas');
  const subsidies = await getCollection('subsidies');
  const glossary = await getCollection('glossary');
  const topics = await getCollection('topics');
  const guides = await getCollection('guides');

  const lines: string[] = [];

  lines.push('# 지원금가이드 — 정부 지원금 가이드 (전체 핵심 콘텐츠 합본)');
  lines.push('');
  lines.push('> 전 국민 대상 정부 지원금을 페르소나(생애·상황) 단위로 정리한 정보 안내 사이트.');
  lines.push('> 신청 대행 없음, 정부 공식 사이트로 안내. 운영: 스마트데이터샵 (대표 김준혁).');
  lines.push('');
  lines.push('---');
  lines.push('');

  // 무료 계산기 도구 요약
  lines.push('## 무료 지원금 계산기 (4종)');
  lines.push('');
  lines.push(
    '- [근로장려금 계산기](https://awoo.or.kr/calculators/eitc/): 조세특례제한법 제100조의5 기준 단독(최대 165만원)·홑벌이(최대 285만원)·맞벌이(최대 330만원) 예상 수령액 및 재산 1.7억~2.4억 50% 감액 반영.',
  );
  lines.push(
    '- [기준중위소득 % 계산기](https://awoo.or.kr/calculators/median-income/): 2026년 보건복지부 고시 기준 가구원 수별 중위소득 비율 및 생계·의료·주거·교육·청년월세 자격선 확인.',
  );
  lines.push(
    '- [실업급여 모의계산기](https://awoo.or.kr/calculators/unemployment/): 2026년 구직급여 1일 하한액(66,048원)·상한액(68,100원)과 연령·고용보험 가입기간별 소정급여일수(120~270일) 계산.',
  );
  lines.push(
    '- [청년미래적금 만기 계산기](https://awoo.or.kr/calculators/youth-savings/): 월 납입액(최대 50만원)·3년 만기 기준 일반형(기여금 6%)·우대형(기여금 12%)과 금리별 만기 수령액 시뮬레이션.',
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // 심층 대표 가이드 (최상위 권위 콘텐츠)
  if (guides.length > 0) {
    lines.push(`## 심층 대표 가이드 (${guides.length}건)`);
    lines.push('');
    const sortedGuides = [...guides].sort((a, b) => {
      const ad = a.data.updatedAt ?? a.data.publishedAt;
      const bd = b.data.updatedAt ?? b.data.publishedAt;
      return ad < bd ? 1 : -1;
    });
    for (const g of sortedGuides) {
      const url = `https://awoo.or.kr/guides/${g.id}/`;
      lines.push(`### ${g.data.title}`);
      lines.push('');
      lines.push(`- 분야: ${g.data.category}`);
      lines.push(
        `- 발행: ${g.data.publishedAt}${g.data.updatedAt ? ` (수정 ${g.data.updatedAt})` : ''}`,
      );
      lines.push(`- 출처: ${url}`);
      lines.push('');
      lines.push(`> ${g.data.description}`);
      lines.push('');
      if (g.data.tldr.length > 0) {
        lines.push('**핵심 요약**');
        for (const t of g.data.tldr) lines.push(`- ${t}`);
        lines.push('');
      }
      if (g.body) {
        lines.push(g.body.trim());
        lines.push('');
      }
      if (g.data.faq && g.data.faq.length > 0) {
        lines.push('**자주 묻는 질문**');
        for (const f of g.data.faq) {
          lines.push('');
          lines.push(`**Q. ${f.q}**`);
          lines.push(`A. ${f.a}`);
        }
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }
  }

  // 오늘의 이슈 요약
  const autoHeadline = auto?.summary?.headline ?? auto?.headline;
  const autoSubhead = auto?.summary?.subhead ?? auto?.description;
  if (autoHeadline) {
    lines.push(`## 오늘의 이슈 — ${autoHeadline}`);
    lines.push('');
    if (auto?.pubDateKR || auto?.source) {
      lines.push(`발표일: ${auto?.pubDateKR ?? '-'} · 출처: ${auto?.source ?? '뉴스 매체'}`);
      lines.push('');
    }
    if (autoSubhead) {
      lines.push(autoSubhead);
      lines.push('');
    }
    if (auto?.summary?.hookCopy) {
      lines.push(`**핵심**: ${auto.summary.hookCopy}`);
      lines.push('');
    }
    lines.push('상세 포스트: https://awoo.or.kr/issues/');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // 2026년 기준 중위소득
  lines.push('## 2026년 기준 중위소득 (보건복지부 고시)');
  lines.push('');
  lines.push('| 가구원 수 | 월 |');
  lines.push('|---|---|');
  for (const [size, value] of Object.entries(MEDIAN_INCOME)) {
    lines.push(`| ${size}인 | ${formatMedianWon(value)} |`);
  }
  lines.push('');
  lines.push('### 자격 기준선 (% of 중위소득)');
  lines.push('');
  for (const t of INCOME_THRESHOLDS) {
    lines.push(`- **${t.pct}% — ${t.name}**: ${t.desc}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 영구 분석 포스트 — 실제 5종 reportType + fallback 전부 수록 (이전 버그: 실제 enum 누락으로 0건 출력되던 문제 해결)
  const issuePosts = loadIndexableIssuePosts();
  if (issuePosts.length > 0) {
    const groups: Record<string, typeof issuePosts> = {
      'weekly-essentials': [],
      'issue-followup': [],
      'new-subsidies-detail': [],
      'deadline-imminent-weekly': [],
      'new-subsidies-weekly': [],
      other: [],
    };
    for (const post of issuePosts) {
      const rt = post.data.reportType ?? 'other';
      const bucket = groups[rt] ?? groups.other;
      bucket?.push(post);
    }

    const sectionMeta: Array<{ key: string; title: string; intro: string }> = [
      {
        key: 'weekly-essentials',
        title: '핵심 정부 지원금 제도 종합 분석',
        intro:
          '실업급여·근로장려금·기초연금·청년미래적금·에너지바우처 등 상시 핵심 제도별 자격·금액·계산 분석.',
      },
      {
        key: 'issue-followup',
        title: '정책 변경·신청 절차 심층 분석',
        intro: '제도 개편, 소득 구간 변경, 탈락 사유, 신청 창구 및 기한별 실무 정리.',
      },
      {
        key: 'new-subsidies-detail',
        title: '개별 지원금 상세 가이드',
        intro: '개별 정부·지자체 지원사업별 대상·금액·제출서류·주의사항 상세.',
      },
      {
        key: 'deadline-imminent-weekly',
        title: '마감 임박·시기별 지원금 안내',
        intro: '신청 기한과 회차가 정해진 지원금의 일정 및 준비 사항 정리.',
      },
      {
        key: 'new-subsidies-weekly',
        title: '신규 등록 지원금 비교 정리',
        intro: '새로 신설·개편된 정부 지원사업 핵심 비교.',
      },
      {
        key: 'other',
        title: '기타 정책 분석',
        intro: '분류 외 정책 분석 포스트.',
      },
    ];

    lines.push(`## 정책 분석 포스트 전체 (${issuePosts.length}건)`);
    lines.push('');

    for (const meta of sectionMeta) {
      const posts = groups[meta.key];
      if (!posts || posts.length === 0) continue;

      lines.push(`### ${meta.title} (${posts.length}건)`);
      lines.push('');
      lines.push(`> ${meta.intro}`);
      lines.push('');

      for (const post of posts) {
        const d = post.data;
        const url = `https://awoo.or.kr${issueUrlPath(post.date, post.slug)}`;
        const dateLabel = post.modified ? `${post.date}, 수정 ${post.modified}` : post.date;
        lines.push(`#### [${dateLabel}] ${d.title ?? post.slug}`);
        lines.push('');
        lines.push(`- 분류: ${d.category ?? '-'} · URL: ${url}`);
        if (d.tags && d.tags.length > 0) {
          lines.push(`- 키워드: ${d.tags.slice(0, 8).join(', ')}`);
        }
        if (d.answer) {
          lines.push(`- **핵심 답변**: ${d.answer}`);
        } else if (d.metaDescription) {
          lines.push(`- **요약**: ${d.metaDescription}`);
        }
        if (d.coreFacts) {
          const facts = [
            d.coreFacts.who ? `대상: ${d.coreFacts.who}` : '',
            d.coreFacts.amount ? `금액: ${d.coreFacts.amount}` : '',
            d.coreFacts.deadline ? `기한: ${d.coreFacts.deadline}` : '',
            d.coreFacts.where ? `신청처: ${d.coreFacts.where}` : '',
          ].filter(Boolean);
          if (facts.length > 0) lines.push(`- **핵심 사실**: ${facts.join(' | ')}`);
        }
        if (d.tldr && d.tldr.length > 0) {
          lines.push('- **요점**:');
          for (const t of d.tldr) lines.push(`  - ${t}`);
        }
        if (d.sections && d.sections.length > 0) {
          for (const sec of d.sections) {
            if (sec.heading && sec.lead) {
              lines.push(`  - **${sec.heading}** ${sec.lead}`);
            }
          }
        }
        if (d.faq && d.faq.length > 0) {
          for (const f of d.faq.slice(0, 3)) {
            lines.push(`  - Q. ${f.q} → ${f.a}`);
          }
        }
        if (Array.isArray(d.sources) && d.sources.length > 0) {
          const cites = d.sources
            .slice(0, 4)
            .map((s) => {
              const name = s.publisher ?? s.title ?? '출처';
              return s.url ? `[${name}](${s.url})` : name;
            })
            .join(', ');
          const fcPart =
            typeof d.factCheckScore === 'number'
              ? ` (사실대조 ${Math.round(d.factCheckScore * 100)}%)`
              : '';
          lines.push(`- **출처**: ${cites}${fcPart}`);
        }
        lines.push('');
      }
    }
    lines.push('---');
    lines.push('');
  }

  // 페르소나
  lines.push('## 페르소나 (6개 유형)');
  lines.push('');
  for (const p of personas) {
    const matched = subsidies.filter((s) => s.data.targetPersonas.includes(p.data.id));
    lines.push(`### ${p.data.label} — ${p.data.sub}`);
    lines.push(`- 연령대: ${p.data.age} · 평균 소득: ${p.data.income} · 주거: ${p.data.living}`);
    lines.push(
      `- 매칭 지원금 ${matched.length}개 · 상세: https://awoo.or.kr/personas/${p.data.id}/`,
    );
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // 대표 지원금 (큐레이션 + 중앙부처 핵심 사업)
  const coreSubsidies = subsidies.filter(
    (s) => s.id.startsWith('_curated/') || (!isLocalAgency(s.data.agency) && s.data.amount > 0),
  );
  lines.push(`## 대표 중앙부처·주요 지원금 (${coreSubsidies.length}종)`);
  lines.push('');
  for (const s of coreSubsidies) {
    lines.push(`### ${s.data.title} (${s.data.agency})`);
    lines.push(
      `- 분야: ${s.data.category} · 금액: ${amountText(s.data)}${s.data.monthly ? ` (${s.data.monthly})` : ''} · 마감: ${s.data.deadline} (${s.data.status})`,
    );
    lines.push(`- 요약: ${s.data.summary}`);
    lines.push(`- 대상: ${s.data.eligibility.slice(0, 3).join(' / ')}`);
    lines.push(`- 공식 신청처: ${s.data.applyUrl}`);
    lines.push(`- 본 사이트 상세: https://awoo.or.kr/subsidies/${s.data.id}/`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // 카테고리 7종
  lines.push('## 분야 카테고리 7종');
  lines.push('');
  for (const c of CATEGORIES) {
    if (c.id === 'all') continue;
    const inCat = subsidies.filter((s) => s.data.category === c.id);
    lines.push(
      `- **${c.name} (${inCat.length}건)**: ${c.description ?? ''} (https://awoo.or.kr/categories/${encodeURIComponent(c.id)}/)`,
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 주제별 종합
  if (topics.length > 0) {
    lines.push(`## 주제별 종합 (${topics.length}건)`);
    lines.push('');
    for (const t of topics) {
      lines.push(`### ${t.data.title}`);
      lines.push(`- URL: https://awoo.or.kr/topics/${t.data.id}/`);
      lines.push(t.data.shortDef);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  // 용어 사전
  if (glossary.length > 0) {
    lines.push(`## 정책 용어 사전 (${glossary.length}건)`);
    lines.push('');
    for (const g of glossary) {
      lines.push(
        `- **${g.data.term}**: ${g.data.shortDef} (https://awoo.or.kr/glossary/${g.data.id}/)`,
      );
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // 운영 주체
  lines.push('## 운영 주체 / 편집 정책');
  lines.push('');
  lines.push('- 운영 법인: 스마트데이터샵 (개인사업자, 간이과세)');
  lines.push('- 사업자등록번호: 406-06-34485');
  lines.push('- 대표자: 김준혁 (편집책임자, https://awoo.or.kr/editor/jjh/)');
  lines.push('- 소재지: 인천광역시 계양구 새벌로 88, 효성동');
  lines.push('- 이메일: smartdatashop@gmail.com');
  lines.push('- 공식 네이버 블로그: https://blog.naver.com/aidatashop');
  lines.push('- 공식 카카오톡 채널: https://pf.kakao.com/_WSWnG');
  lines.push('- 공식 유튜브: https://www.youtube.com/@awoo_or_kr');
  lines.push('- 공식 인스타그램: https://www.instagram.com/smartdatashop_79/');
  lines.push('- 공식 스레드: https://www.threads.com/@smartdatashop_79');
  lines.push('- 공식 X (트위터): https://x.com/awoo_or_kr');
  lines.push(
    '- 편집책임자 LinkedIn: https://www.linkedin.com/in/%EC%A4%80%ED%98%81-%EA%B9%80-b89336197/',
  );
  lines.push('- 본 사이트는 정보 안내 사이트로 신청 대행은 하지 않습니다.');
  lines.push('- 정부 부처 공식 발표를 1차 자료로 작성하며 변경 시 정정·갱신합니다.');
  lines.push('- 편집 정책: https://awoo.or.kr/editorial-policy/');
  lines.push('');
  lines.push(`마지막 갱신: ${new Date().toISOString().slice(0, 10)}`);

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
