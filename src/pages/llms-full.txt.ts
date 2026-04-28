import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import {
  CATEGORIES,
  formatWon,
  INCOME_THRESHOLDS,
  MEDIAN_INCOME,
  TODAY_NEWS,
} from '@/data/site-data';

export const prerender = true;

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

  // 오늘의 이슈
  lines.push(`## 오늘의 이슈 — ${TODAY_NEWS.headline}`);
  lines.push('');
  lines.push(`발표일: ${TODAY_NEWS.date} · 출처: ${TODAY_NEWS.source}`);
  lines.push('');
  lines.push(TODAY_NEWS.subhead);
  lines.push('');
  lines.push(
    `**핵심 수치**: ${TODAY_NEWS.bigLabel} ${TODAY_NEWS.prevValue} → ${TODAY_NEWS.bigNumber} (${TODAY_NEWS.deltaPct})`,
  );
  lines.push('');
  lines.push(TODAY_NEWS.why);
  lines.push('');
  lines.push('### 페르소나별 적합도');
  lines.push('');
  for (const pi of TODAY_NEWS.personaImpact) {
    const p = personas.find((x) => x.data.id === pi.personaId);
    if (!p) continue;
    lines.push(`- **${p.data.label}** — ${pi.label}: ${pi.detail}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

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

  // 카테고리
  lines.push('## 분야 카테고리');
  lines.push('');
  for (const c of CATEGORIES) {
    if (c.id === 'all') continue;
    lines.push(`- **${c.name}** (${c.count}개)`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 추가 이슈
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
