#!/usr/bin/env node
/**
 * eye-offset — 운영자가 네이버 통합검색을 눈으로 보고 누른 웹문서 블록 위치를 기록한다.
 *
 * 목록 위젯의 [첫 화면][한 번 스크롤][그 아래] 버튼이 채팅에 `눈확인: "<쿼리>" = <값>`을 넣으면
 * 이 스크립트로 적고, `keyword-pipeline.mjs --serp-replay`로 큐를 다시 만든다(추가 실측 없음).
 * 배경·규칙은 scripts/lib/eye-offset.mjs.
 *
 * 사용:
 *   node scripts/eye-offset.mjs --query="완주군 민생지원금" --value=1   # 1 첫 화면 · 2 한 번 스크롤 · 3 그 아래
 *   node scripts/eye-offset.mjs --query="..." --value="그 아래"
 *   node scripts/eye-offset.mjs --query="..." --clear
 *   node scripts/eye-offset.mjs --list
 */
import {
  EYE_LABEL,
  EYE_TTL_DAYS,
  eyeFor,
  loadEyeStore,
  parseEyeValue,
  saveEyeStore,
} from './lib/eye-offset.mjs';

const args = process.argv.slice(2);
const val = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

async function main() {
  const store = await loadEyeStore();
  if (args.includes('--list')) {
    const rows = Object.entries(store.byQuery);
    if (!rows.length) return console.log('[eye] 기록 없음');
    for (const [q, r] of rows) {
      const live = eyeFor(store, q) != null;
      console.log(
        `${r.date} ${EYE_LABEL[r.value] ?? r.value} — ${q}${live ? '' : ` (${EYE_TTL_DAYS}일 지나 무시)`}`,
      );
    }
    return;
  }
  const query = val('query')?.trim();
  if (!query) {
    console.error('사용법: --query="<쿼리>" --value=1|2|3  또는 --clear  또는 --list');
    process.exit(2);
  }
  if (args.includes('--clear')) {
    delete store.byQuery[query];
    await saveEyeStore(store);
    return console.log(`[eye] 지움 — ${query}`);
  }
  const value = parseEyeValue(val('value'));
  if (value == null) {
    console.error(
      `[eye] --value는 1(첫 화면)·2(한 번 스크롤)·3(그 아래) 중 하나: ${val('value') ?? '(없음)'}`,
    );
    process.exit(2);
  }
  store.byQuery[query] = { value, date: kstDate() };
  await saveEyeStore(store);
  console.log(`[eye] ${EYE_LABEL[value]} — ${query}${value === 3 ? ' → 신규 닫힘' : ''}`);
}

main().catch((e) => {
  console.error('[eye] 실패:', e.message);
  process.exit(1);
});
