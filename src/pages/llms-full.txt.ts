import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import {
  CATEGORIES,
  formatWon,
  INCOME_THRESHOLDS,
  MEDIAN_INCOME,
} from '@/data/site-data';
import todayIssue from '@/data/today-issue.json';

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
  tldr?: string[];
  category?: string;
  tags?: string[];
  coreFacts?: { who?: string; amount?: string; deadline?: string; where?: string };
  sections?: IssuePostSection[];
  faq?: IssuePostFAQ[];
}

// 빌드타임 issues/{date}/{slug}.json 본문 합본 — Claude 생성 SEO/GEO 포스트.
// import.meta.glob로 Vite 정적 import (Cloudflare prerender 환경 호환 — node:fs 미사용).
// AI 답변 엔진(GPTBot/ClaudeBot/PerplexityBot)이 본문 청크 단위로 정확 인용 가능.
const issuePostModules = import.meta.glob<{ default: IssuePostFile }>(
  '/src/data/issues/*/*.json',
  { eager: true },
);

function loadRecentIssuePosts(maxDays = 30): Array<{ date: string; slug: string; data: IssuePostFile }> {
  const out: Array<{ date: string; slug: string; data: IssuePostFile }> = [];
  const cutoffMs = Date.now() - maxDays * 24 * 60 * 60 * 1000;

  for (const [filePath, mod] of Object.entries(issuePostModules)) {
    const m = filePath.match(/\/issues\/(\d{4}-\d{2}-\d{2})\/([^/]+)\.json$/);
    if (!m) continue;
    const date = m[1];
    const slug = m[2];
    if (slug.startsWith('_')) continue;
    const dateMs = new Date(date).getTime();
    if (Number.isNaN(dateMs) || dateMs < cutoffMs) continue;
    out.push({ date, slug, data: mod.default });
  }

  return out.sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
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

export const GET: APIRoute = async () => {
  const personas = await getCollection('personas');
  const subsidies = await getCollection('subsidies');
  const issues = await getCollection('issues');

  const lines: string[] = [];

  lines.push('# 지원금가이드 — 정부 지원금 가이드 (전체 콘텐츠)');
  lines.push('');
  lines.push('> 전 국민 대상 정부 지원금을 페르소나(생애·상황) 단위로 정리한 정보 안내 사이트.');
  lines.push('> 신청 대행 없음, 정부 공식 사이트로 안내. 운영: 스마트데이터샵 (대표 김준혁).');
  lines.push('');
  lines.push('이 파일은 AI 답변 엔진(ChatGPT, Claude, Perplexity, Gemini)이 본 사이트의 정보를');
  lines.push('정확히 인용할 수 있도록 콘텐츠를 마크다운으로 합본한 것입니다.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // 오늘의 이슈 (자동 큐레이션 today-issue.json 기반)
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

  // 페르소나
  lines.push('## 페르소나 (6개 유형)');
  lines.push('');
  for (const p of personas) {
    const matched = subsidies.filter((s) => s.data.targetPersonas.includes(p.data.id));
    lines.push(`### ${p.data.label} — ${p.data.sub}`);
    lines.push('');
    lines.push(`- 연령대: ${p.data.age}`);
    lines.push(`- 평균 소득: ${p.data.income}`);
    lines.push(`- 주거: ${p.data.living}`);
    lines.push(`- 주요 고민: ${p.data.pains.join(', ')}`);
    lines.push(`- 매칭 지원금 ${matched.length}개: ${matched.map((s) => s.data.title).join(', ')}`);
    lines.push(`- 상세: https://awoo.or.kr/personas/${p.data.id}/`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // 중위소득 기준
  lines.push('## 2026년 기준 중위소득 (보건복지부 고시)');
  lines.push('');
  lines.push('| 가구원 수 | 월 (만원) |');
  lines.push('|---|---|');
  for (const [size, value] of Object.entries(MEDIAN_INCOME)) {
    lines.push(`| ${size}인 | ${value}만원 |`);
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

  // 지원금
  lines.push(`## 지원금 ${subsidies.length}종 상세`);
  lines.push('');
  for (const s of subsidies) {
    lines.push(`### ${s.data.title} (${s.data.agency})`);
    lines.push('');
    lines.push(`- 분야: ${s.data.category}`);
    lines.push(
      `- 지원 금액: ${formatWon(s.data.amount)} ${s.data.amountLabel}` +
        (s.data.monthly ? ` / ${s.data.monthly}` : ''),
    );
    lines.push(`- 지원 기간: ${s.data.period}`);
    lines.push(`- 마감: ${s.data.deadline} · 상태: ${s.data.status}`);
    lines.push(`- 요약: ${s.data.summary}`);
    lines.push('');
    // Cycle #4 P0-3: coreFacts 키-값 블록 — issuePosts와 일치 포맷, AI 인용 일관성
    lines.push('**핵심 사실 (Core Facts)**');
    lines.push(`- 대상: ${s.data.eligibility[0] ?? '확인 필요'}`);
    lines.push(`- 금액: ${formatWon(s.data.amount)} ${s.data.amountLabel}`);
    lines.push(`- 마감: ${s.data.deadline}`);
    lines.push(`- 신청처: ${s.data.applyUrl}`);
    lines.push('');
    lines.push('**지원 대상**');
    for (const e of s.data.eligibility) lines.push(`- ${e}`);
    lines.push('');
    lines.push('**혜택**');
    for (const b of s.data.benefits) lines.push(`- ${b}`);
    lines.push('');
    lines.push('**필요 서류**');
    for (const d of s.data.documents) lines.push(`- ${d}`);
    lines.push('');
    if (s.data.fitNotes) {
      lines.push('**페르소나별 비고**');
      for (const [pid, note] of Object.entries(s.data.fitNotes)) {
        const p = personas.find((x) => x.data.id === pid);
        if (p) lines.push(`- ${p.data.label}: ${note}`);
      }
      lines.push('');
    }
    lines.push(`- 공식 신청처: ${s.data.applyUrl}`);
    lines.push(`- 본 사이트 상세: https://awoo.or.kr/subsidies/${s.data.id}/`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // Cycle #6 P0-4: 카테고리 섹션 확장 — commonEligibility + 매칭 subsidy 수 + 대표 3건
  lines.push('## 분야 카테고리 7종');
  lines.push('');
  for (const c of CATEGORIES) {
    if (c.id === 'all') continue;
    const inCat = subsidies.filter((s) => s.data.category === c.id);
    const top3 = [...inCat]
      .sort((a, b) => (b.data.amount ?? 0) - (a.data.amount ?? 0))
      .slice(0, 3);
    lines.push(`### ${c.name} (${inCat.length}건)`);
    lines.push('');
    if (c.description) {
      lines.push(c.description);
      lines.push('');
    }
    if (c.commonEligibility && c.commonEligibility.length > 0) {
      lines.push('**일반 자격 요건**');
      for (const e of c.commonEligibility) lines.push(`- ${e}`);
      lines.push('');
    }
    if (top3.length > 0) {
      lines.push('**대표 지원금**');
      for (const s of top3) {
        lines.push(`- [${s.data.title}](https://awoo.or.kr/subsidies/${s.data.id}/) · ${s.data.agency}`);
      }
      lines.push('');
    }
    lines.push(`- 분야 hub: https://awoo.or.kr/categories/${encodeURIComponent(c.id)}/`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // 추가 이슈 (큐레이션 단신)
  lines.push('## 이번 주 이슈 (추가)');
  lines.push('');
  for (const iss of issues) {
    lines.push(`### ${iss.data.headline}`);
    lines.push(`- 분류: ${iss.data.badge} · 발표일: ${iss.data.date}`);
    lines.push(`- 요약: ${iss.data.summary}`);
    if (iss.data.related)
      lines.push(`- 관련 지원금: https://awoo.or.kr/subsidies/${iss.data.related}/`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // Claude 생성 SEO/GEO 포스트 본문 (최근 30일) — AI 답변 엔진 인용 청크
  const issuePosts = loadRecentIssuePosts(30);
  if (issuePosts.length > 0) {
    lines.push(`## 트렌딩 이슈 SEO/GEO 포스트 — 최근 30일 (${issuePosts.length}건)`);
    lines.push('');
    lines.push('각 포스트는 BLUF·답변형 H2·table·FAQ 청크로 구성. 본문 단위로 정확 인용 가능.');
    lines.push('');
    for (const post of issuePosts) {
      const d = post.data;
      const url = `https://awoo.or.kr/issues/${post.date}/${post.slug}/`;
      lines.push(`### [${post.date}] ${d.title ?? post.slug}`);
      lines.push('');
      if (d.metaDescription) {
        lines.push(`> ${d.metaDescription}`);
        lines.push('');
      }
      lines.push(`- 분류: ${d.category ?? '-'} · 본문: ${url}`);
      if (d.tags && d.tags.length > 0) {
        lines.push(`- 태그: ${d.tags.join(', ')}`);
      }
      lines.push('');

      if (d.tldr && d.tldr.length > 0) {
        lines.push('**TL;DR**');
        for (const t of d.tldr) lines.push(`- ${t}`);
        lines.push('');
      }

      if (d.coreFacts) {
        lines.push('**핵심 사실 (Core Facts)**');
        if (d.coreFacts.who) lines.push(`- 대상: ${d.coreFacts.who}`);
        if (d.coreFacts.amount) lines.push(`- 금액: ${d.coreFacts.amount}`);
        if (d.coreFacts.deadline) lines.push(`- 마감: ${d.coreFacts.deadline}`);
        if (d.coreFacts.where) lines.push(`- 신청처: ${d.coreFacts.where}`);
        lines.push('');
      }

      if (d.sections && d.sections.length > 0) {
        for (const sec of d.sections) {
          lines.push(`#### ${sec.heading}`);
          lines.push('');
          if (sec.lead) {
            lines.push(`**${sec.lead}**`);
            lines.push('');
          }
          if (sec.body) {
            // 빈 줄 보존하면서 본문 정리 (AI 인용 시 청크 경계)
            lines.push(sec.body.trim());
            lines.push('');
          }
        }
      }

      if (d.faq && d.faq.length > 0) {
        lines.push('**자주 묻는 질문**');
        for (const f of d.faq) {
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

  // 운영 주체
  lines.push('## 운영 주체 / 편집 정책');
  lines.push('');
  lines.push('- 운영 법인: 스마트데이터샵 (개인사업자, 간이과세)');
  lines.push('- 사업자등록번호: 406-06-34485');
  lines.push('- 대표자: 김준혁 (편집책임자)');
  lines.push('- 소재지: 인천광역시 계양구 새벌로 88, 효성동');
  lines.push('- 이메일: contact@awoo.or.kr');
  lines.push('- 본 사이트는 정보 안내 사이트로 신청 대행은 하지 않습니다.');
  lines.push('- 정부 부처 공식 발표를 1차 자료로 작성하며 분기마다 전체 재검토합니다.');
  lines.push('- AI 단독 생성 후 무편집 발행은 금지합니다 (AI 보조는 사람의 사실 확인 후 사용).');
  lines.push('- 편집 정책: https://awoo.or.kr/editorial-policy/');
  lines.push('- 개인정보처리방침: https://awoo.or.kr/privacy/');
  lines.push('');
  lines.push(`마지막 갱신: ${new Date().toISOString().slice(0, 10)}`);

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
