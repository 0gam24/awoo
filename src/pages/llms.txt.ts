import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import {
  recentlyAddedSlugs,
  lastBatchAtISO,
  formatDateKR,
  NEW_WINDOW_DAYS,
} from '@/lib/subsidies-meta';

export const prerender = true;

export const GET: APIRoute = async () => {
  const personas = await getCollection('personas');
  const subsidies = await getCollection('subsidies');
  const bySlug = new Map(subsidies.map((s) => [s.data.id, s.data]));
  const recent = recentlyAddedSlugs(15)
    .map(({ slug }) => bySlug.get(slug))
    .filter(Boolean);

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
  lines.push('## 페르소나');
  lines.push('');
  for (const p of personas) {
    lines.push(`- [${p.data.label}](https://awoo.or.kr/personas/${p.data.id}/): ${p.data.sub}`);
  }
  lines.push('');
  // 최근 등록 (NEW_WINDOW_DAYS 일 이내) — AI agent / 크롤러 신선도 신호
  if (recent.length > 0) {
    const dateLabel = formatDateKR(lastBatchAtISO);
    lines.push(`## 신규 등록 (최근 ${NEW_WINDOW_DAYS}일${dateLabel ? `, 마지막 동기화 ${dateLabel}` : ''})`);
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
  lines.push('## 가이드');
  lines.push('');
  lines.push('- [신청 흐름·공식 사이트·FAQ](https://awoo.or.kr/guide/)');
  lines.push('- [전체 지원금 둘러보기](https://awoo.or.kr/subsidies/)');
  lines.push('- [오늘의 이슈 상세](https://awoo.or.kr/issues/main/)');
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
