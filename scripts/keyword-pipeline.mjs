#!/usr/bin/env node
/**
 * keyword-pipeline — 매일 후보(신규·갱신)를 점수·근거와 함께 큐에 적재하고 운영자 보고문을 만든다.
 *
 * 목적은 하나다. 포스팅이 네이버 최상단에 올라 트래픽을 모으고 애드센스 수익을 최대화한다.
 * 이 스크립트는 **후보를 보고만 한다.** 어떤 경우에도 글을 만들거나 발행하지 않는다
 * (운영자 결정 2026-09-10 #12 "키워드 찾은 건 알려줘. 내가 확인해서 그날그날 수동 포스팅 지시할 거야").
 * 0400 자동 발행(.github/workflows/auto-publish-0400.yml)은 그대로 매일 1건 나간다(결정 #11) — 여기서
 * 건드리지 않는다.
 *
 * 사용:
 *   node scripts/keyword-pipeline.mjs                 # 큐·보고문 생성(docs/ops/pipeline-queue.json, DAILY-KEYWORDS.md)
 *   node scripts/keyword-pipeline.mjs --dry-run       # 파일을 쓰지 않고 stdout만
 *   node scripts/keyword-pipeline.mjs --serp          # SERP 실측(naver-rank-check --mode=scout) 일 25건 안에서
 *   node scripts/keyword-pipeline.mjs --serp --serp-budget=8   # 정찰 상한 조정(검증용)
 *   node scripts/keyword-pipeline.mjs --serp-replay   # 같은 날 큐에 저장된 scout 결과 재사용(실측 없이 재생성)
 *   node scripts/keyword-pipeline.mjs --today=2026-09-13       # 날짜 고정(재현·검증용)
 *
 * 입력(전부 읽기만):
 *   docs/ops/cluster-intents.json         지자체×패밀리 잠금 레지스트리 — 판정은 build-cluster-intents.mjs --check CLI로
 *   src/data/naver-ranks.json             순위 이력(track). 기본은 이 최근 측정을 재사용하고 --serp일 때만 새로 잰다
 *   src/data/keyword-radar.json           candidates(born·fromAnalytics). 비어 있으면 애널리틱스 JSON에서 같은 규칙으로 대체
 *   src/data/analytics/*.json             실유입 검색어(주 1회 적재본)
 *   docs/ops/volume-scale.json            클래스×순위버킷 계수(perPoint) · 쿼리별 recent7 · 지역 유입
 *   docs/ops/big-keywords.json            T2 대형 세부 롱테일 입력(aliases)
 *   docs/ops/landgrab-calendar.json       T3 선점 캘린더 입력(writeBy)
 *   docs/ops/sister-sites.json            자매 호스트
 *   docs/ops/rank-targets.json            등록 쿼리(롤업 자리 등)
 *   src/data/issues/**                    기존 글의 coreFacts.deadline·updates[] — 갱신 후보 대조
 *   docs/ops/0400-queue.json              0400 지정 큐(읽기만 — 갱신 후보와 겹치면 표기)
 *
 * 산출:
 *   docs/ops/pipeline-queue.json          큐. 항목 {id, track, query, family?, region?, evidence[], expectedInbound?,
 *                                         condition?, score, status, createdAt}. 이전 큐의 status(approved/rejected/
 *                                         published/hold)는 id 기준으로 유지·병합한다.
 *   docs/ops/DAILY-KEYWORDS.md            운영자 보고문(한국어). stdout에도 같은 내용.
 *
 * 트랙(계획 docs/ops/KEYWORD-PLAN-2026-09-10.md §3·§4):
 *   T1 물결 버스트   WAVE_WATCH(계획 §5 표) — 개시일 D-7~D+8 안이면 우선. naver-ranks에서 지역 쿼리 rank ≥4 또는
 *                    null(aboveIsWholeBlock)은 '패밀리B 트리거'. 레이더 born·fromAnalytics 중 지역 패턴.
 *                    cluster-intents --check 결과 PASS만 남기고 VETO/FIX는 사유와 함께 제외.
 *   T2 대형 롱테일   레이더 candidates ∩ big-keywords aliases, recent7 ≥1.5, 제목 기준 패밀리 잠금, openSlots ≥2 + 자매 0.
 *   T3 선점 캘린더   landgrab-calendar writeBy가 30일 안(status scheduled).
 *   갱신             기존 글 중 마감·지급일이 지났거나 3일 안인 것(coreFacts.deadline의 날짜 + 계획 §5 이정표).
 *                    결정 #2: 사실·날짜 정정·updates[]·dateModified만. 제목·slug·구조 불변.
 *
 * 점수 = recent7(없으면 proxy) × min(openSlots, 4) × volume-scale 계수(없으면 1). T1은 개시일 임박순이 점수보다 우선.
 * SERP 예산(--serp): 일 25 = T1 15 / T2 5 / 재측정 5(결정 #7). 기본은 naver-ranks 최근 측정 재사용.
 *
 * 데이터랩 주의: 검색 0인 날은 응답에서 빠진다(keyword-volume 묶음 실측). recent7는 '마지막 7개 응답점' 평균일 수
 * 있어 희소 시계열(window<29)은 과대일 수 있다 — 정렬 지표로만 쓴다(계획 §0 "데이터랩은 게이트가 아니라 정렬 지표").
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = {
  clusterIntents: join(ROOT, 'docs', 'ops', 'cluster-intents.json'),
  clusterScript: join(ROOT, 'scripts', 'build-cluster-intents.mjs'),
  rankScript: join(ROOT, 'scripts', 'naver-rank-check.mjs'),
  ranks: join(ROOT, 'src', 'data', 'naver-ranks.json'),
  radar: join(ROOT, 'src', 'data', 'keyword-radar.json'),
  analyticsDir: join(ROOT, 'src', 'data', 'analytics'),
  volumeScale: join(ROOT, 'docs', 'ops', 'volume-scale.json'),
  bigKeywords: join(ROOT, 'docs', 'ops', 'big-keywords.json'),
  landgrab: join(ROOT, 'docs', 'ops', 'landgrab-calendar.json'),
  sisters: join(ROOT, 'docs', 'ops', 'sister-sites.json'),
  rankTargets: join(ROOT, 'docs', 'ops', 'rank-targets.json'),
  regions: join(ROOT, 'src', 'data', 'regions.json'),
  issuesDir: join(ROOT, 'src', 'data', 'issues'),
  queue0400: join(ROOT, 'docs', 'ops', '0400-queue.json'),
  outQueue: join(ROOT, 'docs', 'ops', 'pipeline-queue.json'),
  outReport: join(ROOT, 'docs', 'ops', 'DAILY-KEYWORDS.md'),
  biomeBin: join(ROOT, 'node_modules', '@biomejs', 'biome', 'bin', 'biome'),
};

// ── CLI ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argValue = (k) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
if (args.includes('--help')) {
  console.log(
    [
      'keyword-pipeline — 매일 후보(신규·갱신)를 큐에 적재하고 운영자 보고문을 만든다. 발행은 하지 않는다.',
      '  --dry-run            파일을 쓰지 않고 stdout만',
      '  --serp               SERP 실측(naver-rank-check --mode=scout). 기본은 naver-ranks 재사용',
      '  --serp-budget=N      정찰 상한(기본 25 = T1 15 / T2 5 / 재측정 5)',
      '  --serp-replay        같은 날 pipeline-queue.json에 저장된 scout 결과를 재사용(실측 없이 재생성)',
      '  --today=YYYY-MM-DD   날짜 고정',
    ].join('\n'),
  );
  process.exit(0);
}
const DRY_RUN = args.includes('--dry-run');
const SERP = args.includes('--serp') || args.includes('--serp-replay');
const SERP_REPLAY = args.includes('--serp-replay');
const SERP_TOTAL = Math.max(1, Math.min(25, Number(argValue('--serp-budget')) || 25));
const SERP_BUDGET = {
  total: SERP_TOTAL,
  T1: Math.min(15, Math.ceil(SERP_TOTAL * 0.6)),
  T2: Math.min(5, Math.ceil(SERP_TOTAL * 0.2)),
};
SERP_BUDGET.remeasure = Math.max(0, SERP_TOTAL - SERP_BUDGET.T1 - SERP_BUDGET.T2);

const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
const TODAY = argValue('--today') ?? kstNow().toISOString().slice(0, 10);
const NOW_ISO = new Date().toISOString();

// 물결 창(계획 §2·§3): 개시일 D-7 ~ D+8
const WAVE_BEFORE = 7;
const WAVE_AFTER = 8;
// 갱신 후보 창: 마감·지급일이 지난 지 14일 안이거나 3일 안에 온다
const UPDATE_PAST_DAYS = 7;
const REPORT_MAX_T2 = 5; // 보고문 T2 표시 상한(결정 #10: 창 안 주 1~2건) — 나머지는 큐 JSON에만
const REPORT_MAX_UPDATES = 20;
const UPDATE_AHEAD_DAYS = 3;
const T3_AHEAD_DAYS = 30;
const T2_RECENT7_FLOOR = 1.5;
const OFFSET_CLOSED = 30;
const OFFSET_WARN = 15;
const T2_UNMEASURED_COND = 'SERP 미측정 — --serp로 openSlots ≥2·자매 0 확인';

// ── 상수: 다음 물결(계획 §5, 2026-09-10 확인) + 첫 주 후보(계획 §6) ──
// 개시(start)·마감(end)·이정표(milestones)는 계획 표 그대로다. 확인 못 한 URL은 null로 두고 condition에 적는다.
// action.type: new(신규 후보) · remeasure(재측정만) · watch(판단 대기) · hold(조건부 보류 — 제외에 사유) · none(신규 없음)
const WAVE_WATCH = [
  {
    region: '완주',
    kind: '군',
    system: '민생안정지원금 30만원(선불카드)',
    start: '2026-09-08',
    end: '2026-10-30',
    noticeUrl: null,
    ourPosts: ['wanju-livelihood-stability-grant-2026-08-12'],
    milestones: [
      { date: '2026-09-14', label: '위임장 대리신청 9/14 이후(9/2 위임장 공고)' },
      { date: '2026-10-30', label: '신청·지급 마감 10/30 카운트다운 정정(계획 §7-2)' },
      { date: '2026-12-31', label: '선불카드 사용기한 12/31' },
    ],
    action: {
      type: 'new',
      family: 'B',
      query: '완주군 민생안정지원금 위임장 대리신청',
      variant: '완주군 민생안정지원금 9월 14일 이후 신청',
      expectedInbound: '150~350',
      condition: null,
      evidence:
        '지역 합 905/주(9/2~9/8), 접미형 rank null 512 — 개시일 언론 벽으로 831 증발. 9/2 위임장 공고가 A글에 없는 새 키(계획 §6 #1)',
    },
  },
  {
    region: '부안',
    kind: '군',
    system: '민생안정지원금 30만원',
    start: '2026-09-16',
    end: '2026-11-30',
    noticeUrl: null,
    ourPosts: ['buan-livelihood-stability-grant-2026-08-19'],
    milestones: [
      { date: '2026-09-16', label: '출장 지급 9/16~18 개시' },
      { date: '2026-11-30', label: '신청 마감 11/30' },
    ],
    action: {
      type: 'new',
      family: 'B',
      query: '부안군 민생안정지원금 못 받았으면',
      variant: '부안군 민생안정지원금 9월 16일 출장 지급 이후',
      writeBy: '2026-09-13',
      expectedInbound: '100~300',
      condition: '공고에서 B키 2개(출장 일정표·미수령자 창구·11/30) 확정',
      evidence: '401/주, 접미형 r2. 개시일 언론 벽 방어용 D-3 = 9/13(계획 §5·§6 #2)',
    },
  },
  {
    region: '나주',
    kind: '시',
    system: '20만원, 9/14~10/16 5부제',
    start: '2026-09-14',
    end: '2026-10-16',
    noticeUrl: null,
    ourPosts: [
      'naju-livelihood-recovery-grant-2026-08-07',
      'naju-livelihood-grant-rotation-days-2026-09-03',
    ],
    milestones: [
      { date: '2026-09-30', label: '계획 §7-2 기재 카운트다운 날짜(9/30 — 세부 내용 확인 불가)' },
      { date: '2026-10-16', label: '신청 마감 10/16 카운트다운 정정(계획 §7-2)' },
    ],
    action: {
      type: 'remeasure',
      queries: ['나주 민생회복지원금 5부제', '나주시 민생지원금'],
      note: '신규 없음. D-1·D+1 재측정, 4위 이하면 B(계획 §5)',
    },
  },
  {
    region: '고흥',
    kind: '군',
    system: '30만원 상품권, 9/14~18 마을 지급',
    start: '2026-09-14',
    end: '2026-09-18',
    noticeUrl: null,
    ourPosts: [
      'goheung-livelihood-recovery-grant-2026-08-17',
      'goheung-livelihood-grant-2026-08-19',
    ],
    milestones: [{ date: '2026-09-14', label: '마을 지급 9/14~18 개시' }],
    action: { type: 'none', note: '신규 없음(knownPair A+V, 계획 §5)' },
  },
  {
    region: '문경',
    kind: '시',
    system: '25만원 선불카드, 9/14~10/23',
    start: '2026-09-14',
    end: '2026-10-23',
    noticeUrl: null,
    ourPosts: ['mungyeong A 08-16', 'mungyeong V 08-27'],
    milestones: [{ date: '2026-10-23', label: '신청 마감 10/23' }],
    action: {
      type: 'watch',
      family: 'B',
      decideOn: '2026-09-16',
      note: '신규 없음. 9/16 B 필요 여부 판단(계획 §5)',
    },
  },
  {
    region: '고창',
    kind: '군',
    system: '군민활력지원금 30만원, 9/1~',
    start: '2026-09-01',
    end: null,
    noticeUrl: null,
    ourPosts: ['gochang A 08-09'],
    milestones: [],
    action: { type: 'none', note: '창 닫힘(D+9). 교훈: 사용자 언어 선두(계획 §5)' },
  },
  {
    region: '영동',
    kind: '군',
    system: '30만원 영동페이, ~10/2',
    start: '2026-08-31',
    end: '2026-10-02',
    noticeUrl: null,
    ourPosts: ['yeongdong 07-15', 'yeongdong 08-18'],
    milestones: [{ date: '2026-10-02', label: '영동페이 신청 마감 10/2' }],
    action: { type: 'none', note: '신규 없음. knownPair(진짜 중복 쌍), 3건째 금지(계획 §5)' },
  },
  {
    region: '의령',
    kind: '군',
    system: '50만원, ~9/11 마감',
    start: '2026-08-10',
    end: '2026-09-11',
    noticeUrl: null,
    ourPosts: ['uiryeong-livelihood-stability-grant-2026-08-12'],
    milestones: [{ date: '2026-09-11', label: '신청 마감 9/11' }],
    action: { type: 'none', note: '"2위여도 유입 0" 사례 — 계수에 적재(계획 §5)' },
  },
  {
    region: '김해',
    kind: '시',
    system: '9/17 지급 예정, 공고 게시 0건(9/10)',
    start: '2026-09-17',
    end: null,
    noticeUrl: null,
    ourPosts: ['gimhae-livelihood-grant-2026-08-12'],
    milestones: [{ date: '2026-09-17', label: '지급 예정일 9/17' }],
    action: {
      type: 'hold',
      family: 'B',
      condition: '김해시 공고 게시 후 B키 2개 확정 시만(결정 #5)',
      note: 'A글 coreFacts에 상품권 키 이미 있음, 공고 0건(9/10). 언론은 "신청 없이 순차 지급" — A글 본문 수정 금지',
    },
  },
  {
    region: '강릉',
    kind: '시',
    system: '가결 전',
    start: null,
    end: null,
    noticeUrl: 'https://gncl.go.kr:8080/assembly/bill.do',
    ourPosts: ['gangneung-livelihood-grant-resubmission'],
    milestones: [],
    action: { type: 'hold', note: 'V글 보유. 신규 금지, bill.do 새 uid 감시(결정 #6)' },
  },
  {
    region: '당진',
    kind: '시',
    system: '가결 전',
    start: null,
    end: null,
    noticeUrl: null,
    ourPosts: ['dangjin V'],
    milestones: [],
    action: { type: 'hold', note: 'V글 보유. 신규 금지, 가결 감시(결정 #6)' },
  },
  {
    region: '울진',
    kind: '군',
    system: '민생안정지원금 30만원 — 9/7 예결위 4:3 부결',
    start: null,
    end: null,
    noticeUrl: null,
    ourPosts: [],
    milestones: [],
    action: {
      type: 'new',
      family: 'V',
      query: '울진군 민생안정지원금 30만원 부결',
      variant: '울진군 민생지원금 재상정 여부',
      expectedInbound: '40~120',
      condition: null,
      evidence: '경북일보 9/8 부결 보도, 8/20 언론 롤업 표에 있었는데 자사 글 0(계획 §6 #5)',
    },
  },
  {
    region: '광양',
    kind: '시',
    system: '30만원 추석 전 지급 무산·연내 재검토',
    start: null,
    end: null,
    noticeUrl: null,
    ourPosts: [],
    milestones: [],
    action: {
      type: 'new',
      family: 'V',
      query: '광양 민생지원금 30만원 지급하나요',
      variant: '광양시 민생지원금 추석 전 지급 무산',
      expectedInbound: '50~150',
      condition: '광양시 보도자료 URL 확보',
      evidence: '언론 7곳 9/7~8. V 실증 창원 r1 80·당진 r2 125(계획 §6 #4)',
    },
  },
  {
    region: '영암',
    kind: '군',
    system: '농촌기본수당 10만원 하반기(월출페이), 9/7 앱·9/14 방문, ~10/30',
    start: '2026-09-07',
    end: '2026-10-30',
    noticeUrl: null,
    ourPosts: [],
    milestones: [
      { date: '2026-09-14', label: '방문 신청 개시 9/14' },
      { date: '2026-10-30', label: '신청 마감 10/30' },
    ],
    action: {
      type: 'new',
      family: 'A',
      query: '영암군 농촌기본수당 10만원 하반기 신청',
      variant: '영암 농촌기본수당 월출페이 9월 7일',
      expectedInbound: '100~300',
      condition: 'yeongam.go.kr 고시공고 URL 확보(결정 #8)',
      evidence: '언론 8곳 9/3~4, 인구 5.2만 군(계획 §6 #6)',
    },
  },
  {
    region: '대구',
    kind: '광역',
    system: '데이터랩 10.44, 공고 부재 미확인',
    start: null,
    end: null,
    noticeUrl: null,
    ourPosts: [],
    milestones: [],
    action: { type: 'hold', family: 'V', note: '확인 불가 — 첫 주 제외(계획 §5)' },
  },
  {
    region: '경기',
    kind: '도',
    system: '데이터랩 6.83, 공고 부재 미확인',
    start: null,
    end: null,
    noticeUrl: null,
    ourPosts: ['gyeonggi-high-oil-price-relief-2nd'],
    milestones: [],
    action: { type: 'hold', family: 'V', note: '확인 불가 — 첫 주 제외(계획 §5)' },
  },
];

// 롤업 자리(계획 §2 롤업: 어휘 축 × 패밀리당 1건, 두 번째 롤업 금지)
const ROLLUP_WATCH = [
  {
    axis: '4차',
    family: 'A',
    query: '4차 민생지원금 지역별 지급 현황',
    variants: ['4차 민생지원금 9월 신청 지역', '4차 민생지원금 개시일'],
    expectedInbound: '50~500',
    condition: '변형 2개 webDocOffset <30%(결정 #4). 07-30 추석 롤업 잠식 시 noindex',
    evidence:
      'recent7 455·trend 2.46(volume-scale volumesUsed). rank-targets 2026-09-10: 자사 미노출·web4·본청 0',
    existingRollups: ['chuseok-livelihood-recovery-region-check-2026-07-30(추석 축)'],
  },
];

// 쿼리 어휘로 패밀리를 추정한다(계획 §2 패밀리 정의)
const FAMILY_B_RE = /사용처|잔액|사용기한|미수령|못\s?받|위임장|대리\s?신청|이후/;
const FAMILY_V_RE = /지급하나요|주나요|부결|유예|무산|미확정|재상정|언제\s?주|나오나/;
const GRANT_RE = /지원금|쿠폰|상품권|수당|기본소득|페이/;
const PRESS_RE =
  /news|ilbo|times|press|newsis|yna\.co|kbs\.co|mbc\.co|sbs\.co|jtbc|ytn\.co|kukinews|nocutnews|inews24|edaily|hani\.co|joongang|chosun|donga\.com|khan\.co|mk\.co|hankyung|kyeongin|kwnews|kjbn|newsro|jjilnews|smgnews|wanjutimes|jeollailbo|gukjenews|mt\.co\.kr/;
const CENTRAL_GOV_RE =
  /^(www\.)?(gov\.kr|law\.go\.kr|moel\.go\.kr|molit\.go\.kr|nts\.go\.kr|korea\.kr|mohw\.go\.kr|bokjiro\.go\.kr|work24\.go\.kr|hometax\.go\.kr|kosaf\.go\.kr|mois\.go\.kr)$/;

// ── 유틸 ─────────────────────────────────────────────────────
const norm = (s) => String(s ?? '').replace(/\s+/g, '');
const dayMs = 86400_000;
const toUtc = (d) =>
  Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const daysFrom = (from, to) => Math.round((toUtc(to) - toUtc(from)) / dayMs);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const r2 = (n) => Math.round(n * 100) / 100;
const fmtD = (n) => (n === 0 ? 'D-day' : n > 0 ? `D+${n}` : `D${n}`);
const median = (xs) => {
  const a = xs.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const uniq = (xs) => [...new Set(xs.filter(Boolean))];

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

// ── 지역 사전 ────────────────────────────────────────────────
function buildRegionDict(regions) {
  const dict = new Map(); // token → {name, kind}
  const kindOfFull = (full) => {
    const f = String(full ?? '');
    if (/특별시|광역시|특별자치시/.test(f)) return '광역';
    if (/도$/.test(f)) return '도';
    if (/구$/.test(f)) return '구';
    if (/군$/.test(f)) return '군';
    if (/시$/.test(f)) return '시';
    return null;
  };
  for (const r of regions) {
    const kind = kindOfFull(r.full);
    for (const t of uniq([r.name, ...(r.aliases ?? []), r.full])) {
      dict.set(t, { name: r.name, kind });
    }
  }
  for (const w of WAVE_WATCH) {
    dict.set(w.region, { name: w.region, kind: w.kind });
    if (w.kind === '군' || w.kind === '시')
      dict.set(`${w.region}${w.kind}`, { name: w.region, kind: w.kind });
  }
  return dict;
}

/** 쿼리에서 지역과 종류(군·시·구·도·광역)를 찾는다. 사전 → 접미 정규식 순. */
function regionOf(query, dict) {
  const q = String(query ?? '');
  const tokens = q.split(/\s+/);
  // 시·군·구를 도·광역보다 우선한다 — "경남 김해 민생지원금"은 경남이 아니라 김해다
  const prio = (kind) => (kind === '도' || kind === '광역' ? 1 : 0);
  let best = null;
  for (const [tok, info] of dict) {
    if (tok.length < 2) continue;
    const hit = tokens.some(
      (t) => t === tok || t.startsWith(tok) || t.replace(/^\d{4}/, '') === tok,
    );
    if (!hit) continue;
    if (
      !best ||
      prio(info.kind) < prio(best.kind) ||
      (prio(info.kind) === prio(best.kind) && tok.length > best.tok.length)
    )
      best = { tok, ...info };
  }
  if (best) {
    // 쿼리 자체에 접미가 있으면 그것이 종류다("완주군 민생지원금")
    const suf = tokens.find((t) => t.startsWith(best.name) && /^(.{2,4})(군|시|구)$/.test(t));
    const kind = suf ? suf.slice(-1) : best.kind;
    return { name: best.name, kind };
  }
  const m = q.match(/(?:^|\s)(\d{4}\s*)?([가-힣]{2,3})(군|시)(?=\s|민생|지원금|추석|$)/);
  if (m && !/동시|당시|임시|역시|혹시|잠시|다시|도시/.test(m[2] + m[3])) {
    return { name: m[2], kind: m[3] };
  }
  return null;
}

const classOfKind = (kind) =>
  ({ 군: 'gun', 시: 'si', 구: 'si', 도: 'do', 광역: 'do' })[kind] ?? null;
const bucketOfRank = (rank) =>
  rank == null ? 'null' : rank <= 2 ? 'r1-2' : rank <= 5 ? 'r3-5' : 'r6+';
const familyOfQuery = (q) => (FAMILY_V_RE.test(q) ? 'V' : FAMILY_B_RE.test(q) ? 'B' : 'A');

// ── 잠금 레지스트리 --check (CLI 계약) ─────────────────────────
const checkCache = new Map();
function clusterCheck(region, family) {
  const key = `${region}|${family}`;
  if (checkCache.has(key)) return checkCache.get(key);
  let out;
  try {
    const stdout = execFileSync(process.execPath, [P.clusterScript, '--check', region, family], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    out = JSON.parse(stdout.trim().split('\n').pop());
  } catch (e) {
    out = { verdict: 'ERROR', reason: `--check 실패: ${e.message.split('\n')[0]}`, existing: [] };
  }
  checkCache.set(key, out);
  return out;
}

// ── SERP 측정값(naver-ranks 재사용 · 근사 verdict) ─────────────
function approxSerp(latest, sisterHosts) {
  if (!latest) return null;
  const above = latest.above ?? [];
  const kindOf = (d) => {
    const host = String(d.host ?? '')
      .toLowerCase()
      .replace(/^www\./, '');
    if (sisterHosts.has(host)) return 'sister';
    return d.kind ?? 'commercial';
  };
  const hasNew = latest.openSlots != null && latest.verdictT1 != null;
  const openSlots =
    latest.openSlots ??
    above.filter((d) => !['naver', 'institutional', 'sister'].includes(kindOf(d))).length;
  const mainGovAbove =
    latest.mainGovAbove ??
    above.filter(
      (d) =>
        d.mainGov ||
        (d.kind === 'institutional' &&
          /\.go\.kr$/.test(d.host ?? '') &&
          !CENTRAL_GOV_RE.test(d.host)),
    ).length;
  const pressAbove =
    latest.pressAbove ??
    above.filter((d) => d.kind === 'press' || PRESS_RE.test(d.host ?? '')).length;
  const sisterAbove = latest.sisterAbove ?? above.filter((d) => kindOf(d) === 'sister').length;
  const rank = latest.rank ?? null;
  const off = latest.webDocOffset ?? null;
  const reason = [];
  let verdictT1 = latest.verdictT1 ?? 'open';
  let verdictT2 = latest.verdictT2 ?? 'open';
  if (!hasNew) {
    if (mainGovAbove > 1) {
      verdictT1 = 'closed';
      reason.push(`본청 ${mainGovAbove}>1`);
    }
    if (pressAbove > 3) {
      verdictT1 = 'closed';
      reason.push(`언론 ${pressAbove}>3`);
    }
    if (rank != null && rank <= 3) {
      verdictT1 = 'closed';
      reason.push(`자사 이미 ${rank}위`);
    }
    if (openSlots < 2) {
      verdictT2 = 'closed';
      reason.push(`openSlots ${openSlots}<2`);
    }
    if (off != null && off >= OFFSET_CLOSED) {
      verdictT1 = 'closed';
      verdictT2 = 'closed';
      reason.push(`offset ${off}%≥${OFFSET_CLOSED}`);
    }
    if (sisterAbove > 0) reason.push(`자매 ${sisterAbove}`);
  }
  return {
    query: latest.query,
    rank,
    webDocCount: latest.webDocCount ?? null,
    aboveIsWholeBlock: latest.aboveIsWholeBlock ?? null,
    openSlots,
    mainGovAbove,
    pressAbove,
    sisterAbove,
    webDocOffset: off,
    verdictT1,
    verdictT2,
    reason: latest.reason ?? reason,
    source: `naver-ranks ${latest.date ?? '?'}${hasNew ? '' : '(근사)'}`,
    approx: !hasNew,
  };
}

/** naver-ranks에서 쿼리(정확 → 공백 무시 → 포함 순)를 찾는다 */
function findRank(byQuery, query) {
  if (byQuery[query]) return { key: query, rec: byQuery[query] };
  const nq = norm(query);
  for (const [k, rec] of Object.entries(byQuery)) if (norm(k) === nq) return { key: k, rec };
  return null;
}

// ── scout 실행(--serp) ────────────────────────────────────────
async function runScout(queries) {
  if (!queries.length) return { results: [], error: null };
  const dir = await mkdtemp(join(tmpdir(), 'kw-pipeline-'));
  const file = join(dir, 'scout-queries.json');
  await writeFile(file, JSON.stringify(queries), 'utf8');
  try {
    const stdout = execFileSync(
      process.execPath,
      [P.rankScript, '--mode=scout', `--file=${file}`],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
        timeout: 10 * 60_000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    const text = stdout.trim();
    const jsonStart = text.search(/[[{]/);
    const parsed = JSON.parse(text.slice(jsonStart));
    const results = Array.isArray(parsed) ? parsed : [parsed];
    return {
      results: results.map((r) => ({ ...r, source: `scout ${TODAY}`, approx: false })),
      error: null,
    };
  } catch (e) {
    return { results: [], error: e.message.split('\n')[0] };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── 점수 ─────────────────────────────────────────────────────
function coefficientFor(coefficients, cls, bucket) {
  if (!cls) return { perPoint: 1, note: '계수 없음(1)' };
  const exact = coefficients.find(
    (c) => c.class === cls && c.rankBucket === bucket && c.perPoint != null,
  );
  if (exact)
    return {
      perPoint: exact.perPoint,
      note: `계수 ${cls}/${bucket} ${exact.perPoint}(n=${exact.n})`,
    };
  const any = median(coefficients.filter((c) => c.class === cls).map((c) => c.perPoint));
  if (any != null) return { perPoint: any, note: `계수 ${cls}/버킷 중앙값 ${r2(any)}` };
  return { perPoint: 1, note: '계수 없음(1)' };
}

function score(recent7, openSlots, perPoint) {
  const v = (recent7 ?? 0) * Math.min(openSlots ?? 0, 4) * (perPoint ?? 1);
  return Math.round(v * 10) / 10;
}

function expectedRange(recent7, perPoint) {
  if (recent7 == null || perPoint == null || perPoint === 1) return null;
  const x = recent7 * perPoint;
  return `${Math.round(x * 0.6)}~${Math.round(x * 1.4)}`;
}

// ── 날짜 추출(coreFacts.deadline) ─────────────────────────────
function extractDates(text, baseDate) {
  let s = String(text ?? '');
  const out = [];
  const baseYear = Number(String(baseDate ?? TODAY).slice(0, 4));
  const push = (y, m, d) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return;
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!out.includes(iso)) out.push(iso);
  };
  const withYear = (m, d) => {
    let y = baseYear;
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (isDate(baseDate) && /^\d{4}-\d{2}-\d{2}$/.test(iso) && daysFrom(baseDate, iso) < -60)
      y += 1;
    push(y, m, d);
  };
  s = s.replace(
    /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?(?:\s*~\s*(\d{1,2})\s*일?(?![.\d/월]))?/g,
    (_, y, m, d, d2) => {
      push(Number(y), Number(m), Number(d));
      if (d2) push(Number(y), Number(m), Number(d2));
      return ' ';
    },
  );
  s = s.replace(/(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*~\s*(\d{1,2})\s*일)?/g, (_, m, d, d2) => {
    withYear(Number(m), Number(d));
    if (d2) withYear(Number(m), Number(d2));
    return ' ';
  });
  s = s.replace(
    /(?<![\d.])(\d{1,2})[./](\d{1,2})(?![\d./])(?:\s*~\s*(\d{1,2})(?![\d./월]))?/g,
    (_, m, d, d2) => {
      withYear(Number(m), Number(d));
      if (d2) withYear(Number(m), Number(d2));
      return ' ';
    },
  );
  return out;
}

async function scanIssues(dir) {
  const posts = [];
  async function walk(d) {
    let entries = [];
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('_')) continue;
        await walk(p);
      } else if (e.name.endsWith('.json')) {
        try {
          const j = JSON.parse(await readFile(p, 'utf8'));
          if (!j.slug || !j.date) continue;
          posts.push({
            path: p.slice(ROOT.length + 1).replace(/\\/g, '/'),
            slug: j.slug,
            date: j.date,
            title: j.title ?? '',
            tags: j.tags ?? [],
            targetQuery: j.targetQuery ?? null,
            deadline: j.coreFacts?.deadline ?? '',
            updates: j.updates ?? [],
            dateModified: j.dateModified ?? null,
          });
        } catch {
          /* 깨진 파일은 건너뛴다 */
        }
      }
    }
  }
  await walk(dir);
  return posts;
}

// ── 큐 병합 ──────────────────────────────────────────────────
const KEEP_STATUS = new Set(['approved', 'rejected', 'published', 'hold']);
const idOf = (track, key) => `${track}:${norm(key).replace(/[^가-힣a-zA-Z0-9-]/g, '')}`;

function mergeQueue(prevItems, items) {
  const prev = new Map((prevItems ?? []).map((p) => [p.id, p]));
  const merged = items.map((it) => {
    const old = prev.get(it.id);
    if (!old) return { ...it, status: 'proposed', createdAt: NOW_ISO };
    const keep = KEEP_STATUS.has(old.status) ? old.status : 'proposed';
    return {
      ...it,
      status: keep,
      createdAt: old.createdAt ?? NOW_ISO,
      ...(old.statusAt ? { statusAt: old.statusAt } : {}),
      ...(old.operatorNote ? { operatorNote: old.operatorNote } : {}),
    };
  });
  const seen = new Set(merged.map((m) => m.id));
  for (const old of prev.values()) {
    if (seen.has(old.id)) continue;
    if (KEEP_STATUS.has(old.status))
      merged.push({ ...old, lastSeenAt: old.lastSeenAt ?? old.createdAt });
  }
  return merged;
}

// ── main ─────────────────────────────────────────────────────
async function main() {
  const [
    registry,
    ranksStore,
    radar,
    volumeScale,
    bigKeywords,
    landgrab,
    sisters,
    rankTargets,
    regions,
    queue0400,
    prevQueue,
  ] = await Promise.all([
    readJson(P.clusterIntents, { meta: {}, entries: [] }),
    readJson(P.ranks, { updatedAt: null, byQuery: {} }),
    readJson(P.radar, {}),
    readJson(P.volumeScale, { coefficients: [], queryMap: [], volumesUsed: [], regions: [] }),
    readJson(P.bigKeywords, { keywords: [] }),
    readJson(P.landgrab, { items: [] }),
    readJson(P.sisters, { hosts: [] }),
    readJson(P.rankTargets, { targets: [] }),
    readJson(P.regions, []),
    readJson(P.queue0400, {}),
    readJson(P.outQueue, { items: [] }),
  ]);
  const posts = await scanIssues(P.issuesDir);
  const dict = buildRegionDict(regions);
  const sisterHosts = new Set(
    (sisters.hosts ?? []).map((h) =>
      String(h)
        .toLowerCase()
        .replace(/^www\./, ''),
    ),
  );
  const byQuery = ranksStore.byQuery ?? {};
  const coefficients = volumeScale.coefficients ?? [];

  // 검색량 사전: volumesUsed → queryMap(recent7) → 레이더 candidates.signals.volume.recent7
  const recent7Of = new Map();
  for (const v of volumeScale.volumesUsed ?? [])
    if (v.measured && v.recent7 != null)
      recent7Of.set(norm(v.term), { v: v.recent7, src: 'volume-scale', born: !!v.born });
  for (const q of volumeScale.queryMap ?? [])
    if (q.recent7 != null && !recent7Of.has(norm(q.query)))
      recent7Of.set(norm(q.query), { v: q.recent7, src: 'volume-scale', born: !!q.born });
  const radarCandidates = Array.isArray(radar.candidates) ? radar.candidates : [];
  for (const c of radarCandidates) {
    const v = c.signals?.volume;
    if (v?.recent7 != null && !recent7Of.has(norm(c.term)))
      recent7Of.set(norm(c.term), { v: v.recent7, src: 'radar', born: !!v.born });
  }
  const lookupRecent7 = (q) => recent7Of.get(norm(q)) ?? null;
  // proxy: 같은 클래스 접미형 쿼리 recent7 중앙값
  const classProxy = (cls) => {
    const vals = [];
    for (const q of volumeScale.queryMap ?? [])
      if (q.class === cls && q.recent7 != null) vals.push(q.recent7);
    const m = median(vals);
    return m == null ? null : r2(m);
  };

  // 애널리틱스 대체(레이더 candidates가 비어 있을 때 같은 규칙으로 만든다)
  let analyticsFile = null;
  let analyticsRows = [];
  try {
    const files = (await readdir(P.analyticsDir))
      .filter((f) => /^naver-analytics-search-.*\.json$/.test(f))
      .sort();
    analyticsFile = files.at(-1) ?? null;
    if (analyticsFile)
      analyticsRows = (await readJson(join(P.analyticsDir, analyticsFile), {})).keywords ?? [];
  } catch {
    /* 없으면 비운다 */
  }
  let candidateSource = 'radar.candidates';
  let regionCandidates = radarCandidates.filter(
    (c) => (c.born || c.fromAnalytics) && (c.regionPattern || regionOf(c.term, dict)),
  );
  if (!regionCandidates.length) {
    candidateSource = analyticsFile
      ? `애널리틱스 ${analyticsFile}(레이더 candidates 비어 있음 → 같은 규칙으로 대체)`
      : '없음';
    regionCandidates = analyticsRows
      .filter(
        (k) =>
          k.query &&
          k.query !== '(검색어 없음)' &&
          GRANT_RE.test(k.query) &&
          regionOf(k.query, dict),
      )
      .map((k) => {
        const f = findRank(byQuery, k.query);
        const ourRank = f ? (f.rec.latest?.rank ?? null) : null;
        return {
          term: k.query,
          inbound7d: Number(k.visits) || 0,
          fromAnalytics: true,
          born: !!lookupRecent7(k.query)?.born,
          ourRank,
          rankMeasured: !!f,
          signals: {
            volume: lookupRecent7(k.query) ? { recent7: lookupRecent7(k.query).v } : null,
          },
        };
      })
      .filter((c) => !c.rankMeasured || c.ourRank == null || c.ourRank >= 4)
      .slice(0, 40);
  }

  const items = [];
  const excluded = [];
  const watch = [];
  const scoutPlan = { T1: [], T2: [], remeasure: [] };
  const seenT1 = new Map(); // region|family → item

  const addExcluded = (track, query, reason, extra = {}) =>
    excluded.push({ track, query, reason, ...extra });

  // ── T1: 물결 감시표 ──
  for (const w of WAVE_WATCH) {
    const dStart = isDate(w.start) ? daysFrom(w.start, TODAY) : null; // 오늘 - 개시일 (D+N)
    const inWindow = dStart != null && dStart >= -WAVE_BEFORE && dStart <= WAVE_AFTER;
    const a = w.action;
    const phase =
      dStart == null ? '개시일 미정' : `개시 ${w.start.slice(5).replace('-', '/')} ${fmtD(dStart)}`;
    if (a.type === 'new') {
      const chk = clusterCheck(w.region, a.family);
      const suffixQuery = `${w.region}${w.kind === '군' || w.kind === '시' ? w.kind : ''} 민생지원금`;
      const vol = lookupRecent7(suffixQuery) ?? lookupRecent7(`${w.region} 민생지원금`);
      const cls = classOfKind(w.kind);
      const proxy = vol ? null : classProxy(cls);
      const recent7 = vol ? vol.v : proxy;
      // SERP는 타깃 쿼리 문자열 그대로만 쓴다 — 접미형(A 헤드)의 SERP를 B·V 후보의 verdict로 읽으면 틀린다
      const found = findRank(byQuery, a.query);
      const serp = found ? approxSerp(found.rec.latest, sisterHosts) : null;
      const headFound =
        findRank(byQuery, suffixQuery) ?? findRank(byQuery, `${w.region} 민생지원금`);
      const headRank = headFound?.rec.latest?.rank;
      const bucket = bucketOfRank(found?.rec.latest?.rank ?? null);
      const coef = coefficientFor(coefficients, cls, bucket);
      const evidence = [
        phase,
        `--check ${w.region}×${a.family} ${chk.verdict}${chk.existing?.length ? `(기존 ${chk.existing.map((e) => `${e.family} ${e.date?.slice(5) ?? ''}`).join('·')})` : ''}`,
        a.evidence,
        vol
          ? `recent7 ${vol.v}(${suffixQuery}, ${vol.src})`
          : `recent7 미측정 → proxy ${recent7 ?? '없음'}(${cls} 접미형 중앙값)`,
        headFound
          ? `지역 헤드 "${headFound.key}" ${headRank == null ? '자사 미노출(통블록)' : `r${headRank}`}(${headFound.rec.latest?.date ?? '?'})`
          : null,
        serp
          ? `${serp.source}: ${serp.rank == null ? '자사 미노출' : `r${serp.rank}`} · 본청 ${serp.mainGovAbove} · 언론 ${serp.pressAbove} · openSlots ${serp.openSlots}${serp.webDocOffset != null ? ` · offset ${serp.webDocOffset}%` : ''} · T1 ${serp.verdictT1}`
          : 'SERP 미측정(타깃 쿼리 이력 없음 — --serp)',
        coef.note,
      ].filter(Boolean);
      const conds = [
        a.condition,
        w.noticeUrl ? null : '공고 go.kr URL 미확보(fact-checker 대조 필요)',
        a.writeBy ? `작성 기한 ${a.writeBy}(${fmtD(daysFrom(a.writeBy, TODAY))})` : null,
      ].filter(Boolean);
      if (chk.verdict !== 'PASS') {
        addExcluded('T1', a.query, `cluster-intents ${chk.verdict}: ${chk.reason}`, {
          region: w.region,
          family: a.family,
        });
        continue;
      }
      if (serp && serp.verdictT1 === 'closed' && !serp.approx) {
        addExcluded(
          'T1',
          a.query,
          `SERP verdictT1 closed(${(serp.reason ?? []).join(', ')}) — D-1 재측정`,
          { region: w.region, family: a.family },
        );
        continue;
      }
      const item = {
        id: idOf('T1', a.query),
        track: 'T1',
        query: a.query,
        variant: a.variant ?? null,
        family: a.family,
        region: w.region,
        regionKind: w.kind,
        start: w.start ?? null,
        dStart,
        inWindow,
        evidence,
        expectedInbound: a.expectedInbound ?? expectedRange(recent7, coef.perPoint) ?? '확인 불가',
        condition: conds.length ? conds.join(' · ') : null,
        recent7: recent7 ?? null,
        recent7Source: vol ? vol.src : proxy != null ? 'proxy' : null,
        existingPosts: chk.existing ?? [],
        serp,
        score: score(recent7, serp?.openSlots ?? 2, coef.perPoint),
        scoreNote: `${recent7 ?? 0} × min(openSlots ${serp?.openSlots ?? '미측정→2'},4) × ${coef.perPoint}`,
      };
      items.push(item);
      seenT1.set(`${w.region}|${a.family}`, item);
      scoutPlan.T1.push(a.query);
      if (a.variant) scoutPlan.T1.push(a.variant);
    } else if (a.type === 'remeasure') {
      // 개시일 D-1·D+1에만 재측정 예산을 쓴다(계획 §4-8)
      const due = dStart != null && dStart >= -1 && dStart <= 1;
      if (due) for (const q of a.queries ?? []) scoutPlan.remeasure.push(q);
      watch.push({
        kind: 'wave',
        region: w.region,
        text: `${w.region} — ${phase} · ${a.note}${due ? ' · 오늘 재측정 대상' : ''}`,
      });
    } else if (a.type === 'watch') {
      watch.push({
        kind: 'wave',
        region: w.region,
        text: `${w.region} — ${phase} · ${a.note}${a.decideOn ? ` (판단일 ${a.decideOn})` : ''}`,
      });
    } else if (a.type === 'hold') {
      addExcluded(
        'T1',
        `${w.region} ${a.family ?? ''}`.trim(),
        `보류: ${a.condition ?? a.note}${a.condition && a.note ? ` — ${a.note}` : ''}`,
        { region: w.region, family: a.family ?? null },
      );
      watch.push({
        kind: 'wave',
        region: w.region,
        text: `${w.region} — ${phase} · ${a.condition ?? a.note}${w.noticeUrl ? ` · ${w.noticeUrl}` : ''}`,
      });
    } else {
      addExcluded('T1', `${w.region} 신규`, a.note, { region: w.region });
    }
  }

  // ── T1: 패밀리B 트리거(naver-ranks 지역 쿼리 rank ≥4 또는 null·통블록) ──
  for (const [q, rec] of Object.entries(byQuery)) {
    const reg = regionOf(q, dict);
    if (!reg || !GRANT_RE.test(q)) continue;
    const latest = rec.latest ?? {};
    const rank = latest.rank ?? null;
    const trig = rank == null ? !!latest.aboveIsWholeBlock : rank >= 4;
    if (!trig) continue;
    const w = WAVE_WATCH.find((x) => x.region === reg.name);
    const trigText = `B 트리거: "${q}" ${rank == null ? 'rank null(통블록)' : `r${rank}`}(${latest.date ?? '?'})`;
    const key = `${reg.name}|B`;
    if (seenT1.has(key)) {
      seenT1.get(key).evidence.push(trigText);
      continue;
    }
    if (w && w.action.type !== 'new') {
      // 보류·재측정·신규없음 지역 — 트리거가 울렸다는 사실만 제외 사유에 덧붙인다
      const ex = excluded.find((e) => e.region === reg.name && e.track === 'T1');
      if (ex) ex.reason += ` · ${trigText}`;
      else
        watch.push({
          kind: 'trigger',
          region: reg.name,
          text: `${reg.name} — ${trigText} · ${w.action.note ?? ''}`,
        });
      continue;
    }
    if (reg.kind === '도' || reg.kind === '광역') {
      addExcluded('T1', q, `${trigText} — 광역 단위는 공고 확인 전 제외(계획 §5)`, {
        region: reg.name,
        family: 'B',
      });
      continue;
    }
    const chk = clusterCheck(reg.name, 'B');
    if (chk.verdict !== 'PASS') {
      addExcluded(
        'T1',
        `${reg.name} B`,
        `${trigText} → cluster-intents ${chk.verdict}: ${chk.reason}`,
        { region: reg.name, family: 'B' },
      );
      continue;
    }
    // 지급 후 글(B)은 지급이 확정된 지역(정규본 A 보유)에서만 성립한다. V(부결·무산·미확정)만 있는
    // 지역에 "사용처·잔액·사용기한"을 제안하면 존재하지 않는 지급을 안내하는 글이 된다(2026-09-11 울진·광양 오탐).
    const hasA = (chk.existing ?? []).some((e) => e.family === 'A');
    if (!hasA) {
      addExcluded(
        'T1',
        `${reg.name} B`,
        `${trigText} → 지급 확정 글(A) 없음 — 부결·미확정 지역엔 지급 후 글이 성립하지 않음(기존: ${(chk.existing ?? []).map((e) => e.family).join('·') || '없음'})`,
        { region: reg.name, family: 'B' },
      );
      continue;
    }
    const serp = approxSerp(latest, sisterHosts);
    const vol = lookupRecent7(q);
    const cls = classOfKind(reg.kind);
    const recent7 = vol ? vol.v : classProxy(cls);
    const coef = coefficientFor(coefficients, cls, bucketOfRank(rank));
    const query = `${reg.name}${reg.kind === '군' || reg.kind === '시' ? reg.kind : ''} 민생지원금 사용처 잔액 사용기한`;
    const item = {
      id: idOf('T1', query),
      track: 'T1',
      query,
      variant: null,
      family: 'B',
      region: reg.name,
      regionKind: reg.kind,
      start: null,
      dStart: null,
      inWindow: false,
      evidence: [
        trigText,
        `--check ${reg.name}×B PASS(${chk.existing?.map((e) => `${e.family} ${e.date?.slice(5) ?? ''}`).join('·') || '기존 없음'})`,
        vol ? `recent7 ${vol.v}(${vol.src})` : `recent7 미측정 → proxy ${recent7 ?? '없음'}`,
        `${serp.source}: 본청 ${serp.mainGovAbove} · 언론 ${serp.pressAbove} · openSlots ${serp.openSlots}`,
        coef.note,
      ],
      expectedInbound: expectedRange(recent7, coef.perPoint) ?? '확인 불가',
      condition:
        '결정 #2: 새 쿼리 형태(사용처·잔액·미수령 등 B키)가 유입 상위에 나타날 때만 B 신규 — 아니면 갱신 트랙',
      recent7: recent7 ?? null,
      recent7Source: vol ? vol.src : 'proxy',
      existingPosts: chk.existing ?? [],
      serp,
      score: score(recent7, serp.openSlots, coef.perPoint),
      scoreNote: `${recent7 ?? 0} × min(${serp.openSlots},4) × ${coef.perPoint}`,
    };
    items.push(item);
    seenT1.set(key, item);
    scoutPlan.T1.push(query);
  }

  // ── T1: 레이더 born·fromAnalytics 지역 패턴 ──
  for (const c of regionCandidates) {
    const reg = regionOf(c.term, dict);
    if (!reg) continue;
    const family = familyOfQuery(c.term);
    const key = `${reg.name}|${family}`;
    const sig =
      `${c.born ? 'born' : '실유입'} "${c.term}" ${c.inbound7d != null ? `${c.inbound7d}/주` : ''} ${c.rankMeasured ? (c.ourRank == null ? '자사 미노출' : `r${c.ourRank}`) : '순위 미측정'}`.trim();
    if (seenT1.has(key)) {
      seenT1.get(key).evidence.push(sig);
      continue;
    }
    const w = WAVE_WATCH.find((x) => x.region === reg.name);
    if (w && ['hold', 'none', 'watch', 'remeasure'].includes(w.action.type)) {
      const ex = excluded.find((e) => e.region === reg.name && e.track === 'T1');
      if (ex && !ex.reason.includes(c.term)) ex.reason += ` · ${sig}`;
      if (!c.rankMeasured) scoutPlan.remeasure.push(c.term);
      continue;
    }
    const chk = clusterCheck(reg.name, family);
    if (chk.verdict !== 'PASS') {
      addExcluded(
        'T1',
        c.term,
        `${sig} → cluster-intents ${chk.verdict}: ${chk.reason}${c.rankMeasured ? '' : ' — 기존 글 순위 재측정 대상'}`,
        { region: reg.name, family },
      );
      if (!c.rankMeasured) scoutPlan.remeasure.push(c.term);
      continue;
    }
    const f = findRank(byQuery, c.term);
    const serp = f ? approxSerp(f.rec.latest, sisterHosts) : null;
    const vol = lookupRecent7(c.term);
    const cls = classOfKind(reg.kind);
    const recent7 = vol ? vol.v : classProxy(cls);
    const coef = coefficientFor(coefficients, cls, bucketOfRank(f?.rec.latest?.rank ?? null));
    // 지역 헤드의 자사 순위 — A 후보인데 V글이 이미 헤드 1위면 잠식 위험을 운영자가 봐야 한다
    const headKey = Object.keys(byQuery).find(
      (q) => q !== c.term && regionOf(q, dict)?.name === reg.name && /민생지원금$/.test(q),
    );
    const headRank = headKey ? byQuery[headKey].latest?.rank : undefined;
    const item = {
      id: idOf('T1', c.term),
      track: 'T1',
      query: c.term,
      variant: null,
      family,
      region: reg.name,
      regionKind: reg.kind,
      start: w?.start ?? null,
      dStart: w && isDate(w.start) ? daysFrom(w.start, TODAY) : null,
      inWindow: false,
      evidence: [
        sig,
        `--check ${reg.name}×${family} PASS${chk.existing?.length ? `(기존 ${chk.existing.map((e) => `${e.family} ${e.date?.slice(5) ?? ''}`).join('·')} — 같은 지역 다른 패밀리, 잠식 여부 확인)` : '(기존 글 없음)'}`,
        headKey
          ? `지역 헤드 "${headKey}" ${headRank == null ? '자사 미노출' : `r${headRank}`}`
          : null,
        vol ? `recent7 ${vol.v}(${vol.src})` : `recent7 미측정 → proxy ${recent7 ?? '없음'}`,
        serp
          ? `${serp.source}: 본청 ${serp.mainGovAbove} · 언론 ${serp.pressAbove} · openSlots ${serp.openSlots}`
          : 'SERP 미측정',
        coef.note,
      ],
      expectedInbound: c.inbound7d
        ? `현재 ${c.inbound7d}/주(자사 미노출·미측정분 회수)`
        : (expectedRange(recent7, coef.perPoint) ?? '확인 불가'),
      condition: '공고 go.kr URL 확보 + 접미형·변형 SERP 실측',
      recent7: recent7 ?? null,
      recent7Source: vol ? vol.src : 'proxy',
      existingPosts: chk.existing ?? [],
      serp,
      score: score(recent7, serp?.openSlots ?? 2, coef.perPoint),
      scoreNote: `${recent7 ?? 0} × min(${serp?.openSlots ?? '미측정→2'},4) × ${coef.perPoint}`,
    };
    items.push(item);
    seenT1.set(key, item);
    scoutPlan.T1.push(c.term);
  }

  // ── T1 롤업 자리 ──
  for (const rw of ROLLUP_WATCH) {
    const f = findRank(byQuery, rw.query);
    const serp = f ? approxSerp(f.rec.latest, sisterHosts) : null;
    const vol = lookupRecent7(rw.axis === '4차' ? '4차 민생지원금' : rw.query);
    const coef = coefficientFor(coefficients, 'rollup', 'null');
    const tgt = (rankTargets.targets ?? []).find((t) => t.query === rw.query);
    const evidence = [
      `롤업 축 "${rw.axis}" × ${rw.family} — 기존 롤업 ${rw.existingRollups.join(', ')}`,
      rw.evidence,
      tgt?.note ? `rank-targets: ${tgt.note}` : null,
      vol ? `recent7 ${vol.v}(${vol.src})` : 'recent7 미측정',
      serp
        ? `${serp.source}: 본청 ${serp.mainGovAbove} · 언론 ${serp.pressAbove} · openSlots ${serp.openSlots}${serp.webDocOffset != null ? ` · offset ${serp.webDocOffset}%` : ''}`
        : 'SERP 이력 없음(--serp로 실측 필요)',
      coef.note,
    ].filter(Boolean);
    if (serp && serp.webDocOffset != null && serp.webDocOffset >= OFFSET_CLOSED) {
      addExcluded(
        'T1',
        rw.query,
        `webDocOffset ${serp.webDocOffset}% ≥ ${OFFSET_CLOSED}(${serp.source}) — 결정 #4 미달`,
      );
      continue;
    }
    items.push({
      id: idOf('T1', rw.query),
      track: 'T1',
      query: rw.query,
      variant: rw.variants.join(' / '),
      family: rw.family,
      region: null,
      rollup: rw.axis,
      start: null,
      dStart: null,
      inWindow: false,
      evidence,
      expectedInbound: rw.expectedInbound,
      condition: rw.condition,
      recent7: vol?.v ?? null,
      recent7Source: vol?.src ?? null,
      serp,
      score: score(vol?.v, serp?.openSlots ?? 2, coef.perPoint),
      scoreNote: `${vol?.v ?? 0} × min(${serp?.openSlots ?? '미측정→2'},4) × ${coef.perPoint}`,
    });
    scoutPlan.T1.push(rw.query, ...rw.variants);
  }

  // ── T2: big-keywords aliases ──
  const normTitle = (p) => norm(`${p.title} ${p.targetQuery ?? ''}`);
  for (const kw of bigKeywords.keywords ?? []) {
    const head = kw.term;
    if (kw.mode === 'update-only') {
      addExcluded('T2', head, `mode update-only — 갱신 트랙 전용(${kw.note?.slice(0, 60) ?? ''})`);
      continue;
    }
    const datalabAliases = kw.evidence?.datalab?.aliases ?? {};
    for (const alias of kw.aliases ?? []) {
      const na = norm(alias);
      const query = na.includes(norm(head)) || norm(head).includes(na) ? alias : `${head} ${alias}`;
      const tokens = alias.split(/\s+/).map(norm).filter(Boolean);
      // 제목 기준 패밀리 잠금: 헤드(또는 클러스터)와 alias 토큰이 모두 제목에 있는 글.
      // alias가 그 자체로 제도명(띄어쓰기 없는 5자 이상: 자녀장려금·조기재취업수당·이직확인서)이면
      // 헤드 없이도 잠근다. '신청 대상'·'가구원수' 같은 일반어는 헤드가 같이 있어야 잠근다.
      const standalone = !/\s/.test(alias.trim()) && na.length >= 5;
      const lock = posts.find((p) => {
        const t = normTitle(p);
        return (
          (standalone || t.includes(norm(head)) || t.includes(norm(kw.cluster))) &&
          tokens.every((tk) => t.includes(tk))
        );
      });
      if (lock) {
        addExcluded(
          'T2',
          query,
          `축 잠금 — ${lock.slug}(${lock.date}) 제목이 "${alias}" 축을 이미 잡고 있다`,
        );
        continue;
      }
      // 검색량: 레이더/volume-scale recent7 → datalab.aliases(rel30 proxy)
      let recent7 = null;
      let recentSrc = null;
      const rc = radarCandidates.find(
        (c) => norm(c.term).includes(na) && (norm(c.term).includes(norm(head)) || na.length >= 4),
      );
      if (rc?.signals?.volume?.recent7 != null) {
        recent7 = rc.signals.volume.recent7;
        recentSrc = 'radar';
      } else {
        for (const [k, v] of recent7Of) {
          if (k.includes(na) && (k.includes(norm(head)) || na.length >= 4)) {
            recent7 = v.v;
            recentSrc = v.src;
            break;
          }
        }
      }
      if (recent7 == null) {
        const dk = Object.keys(datalabAliases).find((k) => norm(k).includes(na));
        if (dk && datalabAliases[dk] != null) {
          recent7 = datalabAliases[dk];
          recentSrc = 'big-keywords datalab rel30(proxy)';
        } else if (dk) {
          addExcluded(
            'T2',
            query,
            'datalab 무응답(null = 미측정, 0 아님) — keyword-volume으로 측정 후 재판정',
          );
          continue;
        }
      }
      if (recent7 == null) {
        addExcluded('T2', query, '검색량 미측정 — keyword-volume/레이더 측정 전');
        continue;
      }
      if (recent7 < T2_RECENT7_FLOOR) {
        addExcluded('T2', query, `recent7 ${recent7} < ${T2_RECENT7_FLOOR}(${recentSrc})`);
        continue;
      }
      // SERP: naver-ranks에서 alias를 포함하는 쿼리
      let f = findRank(byQuery, query);
      if (!f) {
        const k = Object.keys(byQuery).find(
          (q) =>
            norm(q).includes(na) &&
            (norm(q).includes(norm(head)) || norm(q).includes(norm(kw.cluster))),
        );
        if (k) f = { key: k, rec: byQuery[k] };
      }
      const serp = f ? approxSerp(f.rec.latest, sisterHosts) : null;
      if (serp && serp.rank != null && serp.rank <= 3) {
        addExcluded('T2', query, `자사 이미 r${serp.rank}("${f.key}", ${serp.source})`);
        continue;
      }
      if (serp && serp.verdictT2 === 'closed') {
        addExcluded(
          'T2',
          query,
          `verdictT2 closed(${(serp.reason ?? []).join(', ')}) — "${f.key}" ${serp.source}`,
        );
        continue;
      }
      if (serp && serp.sisterAbove > 0) {
        addExcluded('T2', query, `자매 ${serp.sisterAbove}건 노출 — 자기잠식(계획 §3 T2 게이트)`);
        continue;
      }
      const coef = coefficientFor(coefficients, 'national', bucketOfRank(serp?.rank ?? null));
      // 인접 글: 헤드 + alias 토큰 일부, 또는 alias 토큰 전부(헤드 없이)가 제목에 있는 글 — 각도 분리 참고용
      const near = posts
        .filter((p) => {
          const t = normTitle(p);
          return (
            (t.includes(norm(head)) && tokens.some((tk) => tk.length >= 2 && t.includes(tk))) ||
            tokens.every((tk) => tk.length >= 2 && t.includes(tk))
          );
        })
        .slice(0, 2);
      const conds = [
        serp ? null : T2_UNMEASURED_COND,
        kw.existingDrafts?.length
          ? `초안 있음(_drafts/${kw.existingDrafts.join(', ')}) — 신규 대신 초안 완성 여부 먼저`
          : null,
        kw.sisterCaution ? `자매 주의: ${kw.sisterCaution.slice(0, 70)}` : null,
        near.length ? `인접 글 ${near.map((p) => p.slug).join(', ')} — 각도 분리` : null,
      ].filter(Boolean);
      items.push({
        id: idOf('T2', query),
        track: 'T2',
        query,
        family: null,
        region: null,
        cluster: kw.cluster,
        evidence: [
          `big-keywords "${head}" alias "${alias}"`,
          `recent7 ${recent7}(${recentSrc})`,
          serp
            ? `"${f.key}" ${serp.source}: ${serp.rank == null ? '자사 미노출' : `r${serp.rank}`} · openSlots ${serp.openSlots} · 자매 ${serp.sisterAbove} · T2 ${serp.verdictT2}`
            : 'SERP 이력 없음',
          kw.evidence?.inbound7 ? `클러스터 실유입 ${kw.evidence.inbound7}/주` : null,
          coef.note,
        ].filter(Boolean),
        expectedInbound: expectedRange(recent7, coef.perPoint) ?? '확인 불가',
        condition: conds.join(' · ') || null,
        recent7,
        recent7Source: recentSrc,
        serp,
        score: score(recent7, serp?.openSlots ?? 2, coef.perPoint),
        scoreNote: `${recent7} × min(${serp?.openSlots ?? '미측정→2'},4) × ${coef.perPoint}`,
      });
      if (!serp) scoutPlan.T2.push(query);
    }
  }

  // ── T3: 선점 캘린더 ──
  for (const it of landgrab.items ?? []) {
    if (it.status === 'migrated') continue;
    if (!isDate(it.writeBy)) {
      watch.push({
        kind: 'landgrab',
        text: `${it.topic} — ${it.status}${it.watchFrom ? ` · 감시 시작 ${it.watchFrom}` : ''}${it.trigger ? ` · ${it.trigger}` : ''}`,
      });
      continue;
    }
    const d = daysFrom(TODAY, it.writeBy); // writeBy까지 남은 일수
    if (it.status === 'hold') {
      addExcluded('T3', it.topic, `hold: ${it.gate ?? ''}`.trim());
      continue;
    }
    if (d > T3_AHEAD_DAYS) {
      watch.push({
        kind: 'landgrab',
        text: `${it.topic} — writeBy ${it.writeBy}(D-${d}) · 피크 ${it.peakMonth}월 ${it.peakRelative}`,
      });
      continue;
    }
    items.push({
      id: idOf('T3', it.topic),
      track: 'T3',
      query: it.topic,
      family: null,
      region: null,
      evidence: [
        `writeBy ${it.writeBy}(${d >= 0 ? `D-${d}` : `D+${-d}`})`,
        `피크 ${it.peakMonth}월 ${it.peakRelative}(실업급여=100)`,
        it.note?.slice(0, 90),
      ].filter(Boolean),
      expectedInbound: '확인 불가(계절 피크 전)',
      condition: it.gate ?? null,
      recent7: null,
      recent7Source: null,
      serp: null,
      score: r2((it.peakRelative ?? 0) * 2),
      scoreNote: `peakRelative × 2(openSlots 미측정) — T3는 점수 경쟁에 넣지 않는다`,
    });
  }

  // ── 갱신 후보 ──
  const updateItems = [];
  const updateSeen = new Set();
  const pushUpdate = (u) => {
    if (updateSeen.has(u.id)) return;
    updateSeen.add(u.id);
    updateItems.push(u);
  };
  const inUpdateWindow = (date) => {
    const d = daysFrom(TODAY, date); // 남은 일수(음수 = 지남)
    return d <= UPDATE_AHEAD_DAYS && d >= -UPDATE_PAST_DAYS ? d : null;
  };
  // 이미 손본 글: updates[]에 그 날짜 이후 항목이 있거나 dateModified가 그 날짜 이후다
  const handled = (p, date) =>
    (p.updates ?? []).some((u) => isDate(u.date) && u.date >= date) ||
    (isDate(p.dateModified) && p.dateModified >= date);
  const q0400Targets = new Map(
    Object.entries(queue0400)
      .filter(([k, v]) => isDate(k) && v && v.mode === 'update' && v.target)
      .map(([k, v]) => [String(v.target).replace(/\\/g, '/'), k]),
  );
  for (const p of posts) {
    // 글 하나에 창 안 날짜가 여럿이면 한 행으로 — 가장 가까운 날짜를 대표로, 나머지는 근거에 병기
    const hits = extractDates(p.deadline, p.date)
      .map((date) => ({ date, d: inUpdateWindow(date) }))
      .filter((h) => h.d != null && !handled(p, h.date))
      .sort((a, b) => Math.abs(a.d) - Math.abs(b.d) || (a.d > b.d ? -1 : 1));
    if (!hits.length) continue;
    const [main, ...rest] = hits;
    const q0400 = q0400Targets.get(p.path);
    pushUpdate({
      id: `갱신:${p.slug}:${main.date}`,
      track: '갱신',
      query: p.title,
      slug: p.slug,
      path: p.path,
      region: regionOf(p.title, dict)?.name ?? null,
      dueDate: main.date,
      daysLeft: main.d,
      evidence: [
        `coreFacts.deadline "${String(p.deadline).slice(0, 80)}"`,
        `날짜 ${main.date} ${fmtD(-main.d)}${rest.length ? ` (+ ${rest.map((h) => `${h.date} ${fmtD(-h.d)}`).join(', ')})` : ''}`,
        p.dateModified ? `dateModified ${p.dateModified}` : '갱신 이력 없음',
        q0400 ? `0400-queue ${q0400} update 지정과 겹침` : null,
      ].filter(Boolean),
      condition:
        '결정 #2: 사실·날짜 정정·updates[]·dateModified만. 제목·slug·구조 불변. 본문 변경 없이 dateModified만 올리기 금지',
      score: Math.max(0, UPDATE_PAST_DAYS + UPDATE_AHEAD_DAYS - Math.abs(main.d)),
      status: 'proposed',
    });
  }
  for (const w of WAVE_WATCH) {
    for (const m of w.milestones ?? []) {
      const d = inUpdateWindow(m.date);
      const related = posts.filter(
        (p) => regionOf(p.title, dict)?.name === w.region && GRANT_RE.test(p.title),
      );
      if (d == null) {
        const ahead = daysFrom(TODAY, m.date);
        if (ahead > UPDATE_AHEAD_DAYS && ahead <= 45)
          watch.push({
            kind: 'milestone',
            region: w.region,
            text: `${w.region} ${m.label} — ${m.date}(D-${ahead}) 갱신 예정${related.length ? ` · ${related.map((p) => p.slug).join(', ')}` : ''}`,
          });
        continue;
      }
      for (const p of related.length ? related : [null]) {
        if (p && handled(p, m.date)) continue;
        // 같은 글이 coreFacts 날짜로 이미 올라와 있으면 이정표 설명만 덧붙인다
        const dup = p && updateItems.find((u) => u.slug === p.slug);
        if (dup) {
          dup.evidence.push(`계획 §5 이정표: ${m.label}(${m.date})`);
          continue;
        }
        pushUpdate({
          id: `갱신:${p ? p.slug : w.region}:${m.date}`,
          track: '갱신',
          query: p ? p.title : `${w.region} — 대응 글 없음`,
          slug: p?.slug ?? null,
          path: p?.path ?? null,
          region: w.region,
          dueDate: m.date,
          daysLeft: d,
          evidence: [
            `계획 §5 이정표: ${m.label}`,
            `날짜 ${m.date} ${fmtD(-d)}`,
            p?.dateModified ? `dateModified ${p.dateModified}` : '갱신 이력 없음',
          ],
          condition: '결정 #2: 사실·날짜 정정·updates[]·dateModified만. 제목·slug·구조 불변',
          score: Math.max(0, UPDATE_PAST_DAYS + UPDATE_AHEAD_DAYS - Math.abs(d)),
          status: 'proposed',
        });
      }
    }
  }
  // ── SERP 실측(--serp) ──
  const serpMeta = {
    enabled: SERP,
    budget: SERP ? SERP_BUDGET : null,
    used: 0,
    error: null,
    queries: [],
  };
  if (SERP) {
    const pick = (xs, n) => uniq(xs).slice(0, n);
    const t1 = pick(scoutPlan.T1, SERP_BUDGET.T1);
    // T2는 점수 높은 순으로 예산을 쓴다(입력 파일 순서가 아니라)
    const t2Order = items
      .filter((it) => it.track === 'T2' && scoutPlan.T2.includes(it.query))
      .sort((a, b) => b.score - a.score)
      .map((it) => it.query);
    scoutPlan.T2 = uniq([...t2Order, ...scoutPlan.T2]);
    const t2 = pick(scoutPlan.T2, SERP_BUDGET.T2);
    const rm = pick(
      scoutPlan.remeasure.filter((q) => !t1.includes(q)),
      SERP_BUDGET.remeasure,
    );
    const queries = uniq([...t1, ...t2, ...rm]).slice(0, SERP_BUDGET.total);
    serpMeta.queries = queries;
    console.error(
      `[pipeline] SERP 정찰 ${queries.length}건(T1 ${t1.length} / T2 ${t2.length} / 재측정 ${rm.length})`,
    );
    // --serp-replay: 같은 날 큐에 저장된 scout 결과를 다시 쓴다(재실행·검증 시 정찰 예산을 태우지 않는다)
    const replay = SERP_REPLAY ? (prevQueue.meta?.serp?.results ?? []) : [];
    const canReplay = SERP_REPLAY && prevQueue.meta?.today === TODAY && replay.length > 0;
    if (SERP_REPLAY && !canReplay)
      console.error('[pipeline] --serp-replay: 오늘 저장된 scout 결과가 없어 실측으로 진행');
    const { results, error } = canReplay
      ? { results: replay.map((r) => ({ ...r, source: `scout ${TODAY}(replay)` })), error: null }
      : await runScout(queries);
    serpMeta.replay = canReplay;
    serpMeta.used = results.length;
    serpMeta.error = error;
    const byQ = new Map(results.filter((r) => r && !r.error).map((r) => [r.query, r]));
    serpMeta.results = results.map((r) =>
      r.error
        ? { query: r.query, error: r.error }
        : {
            query: r.query,
            rank: r.rank,
            openSlots: r.openSlots,
            mainGovAbove: r.mainGovAbove,
            pressAbove: r.pressAbove,
            sisterAbove: r.sisterAbove,
            webDocOffset: r.webDocOffset,
            verdictT1: r.verdictT1,
            verdictT2: r.verdictT2,
            reason: r.reason ?? [],
          },
    );
    const postBySlug = new Map(posts.map((p) => [p.slug, p]));
    const line = (x, label) =>
      `${label}${x.rank == null ? '자사 미노출' : `r${x.rank}`} · 본청 ${x.mainGovAbove} · 언론 ${x.pressAbove} · 자매 ${x.sisterAbove} · openSlots ${x.openSlots} · offset ${x.webDocOffset ?? '-'}% · T1 ${x.verdictT1} · T2 ${x.verdictT2}`;
    const closedWhy = (x) =>
      (x.reason ?? []).join(', ') ||
      (x.webDocOffset != null && x.webDocOffset >= OFFSET_CLOSED
        ? `offset ${x.webDocOffset}%`
        : 'closed');
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const r = byQ.get(it.query);
      const rv = it.variant
        ? it.variant
            .split(' / ')
            .map((v) => byQ.get(v))
            .filter(Boolean)
        : [];
      const measured = [r, ...rv].filter(Boolean);
      if (!measured.length) continue;
      const isT2 = it.track === 'T2';
      // 본 쿼리·변형 중 하나라도 열려 있으면 그 문자열을 타깃으로 남긴다(계획 §3 T1: 접미형 1 + 변형 1 실측)
      const okOf = (x) =>
        (isT2 ? x.verdictT2 : x.verdictT1) === 'open' &&
        !(x.webDocOffset != null && x.webDocOffset >= OFFSET_CLOSED) &&
        !(isT2 && x.sisterAbove > 0);
      const open = measured.filter(okOf);
      it.evidence = it.evidence.filter((e) => !/^naver-ranks|^SERP 미측정|^SERP 이력 없음/.test(e));
      if (r) it.evidence.push(line(r, `scout ${TODAY}: `));
      for (const v of rv) it.evidence.push(line(v, `변형 "${v.query}": `));
      // 자사 글이 이미 상위(≤3)인 쿼리 — B·V 후보면 신규가 아니라 기존 글 갱신 신호다(결정 #2)
      const ours = measured.filter((x) => x.rank != null && x.rank <= 3);
      const bestOurs = ours.length ? Math.min(...ours.map((x) => x.rank)) : null;
      if (!open.length) {
        const why = measured.map((x) => `"${x.query}" ${closedWhy(x)}`).join(' / ');
        let advice = '재측정 후 재판정';
        // 갱신 대상은 롤업·spoke가 아닌 그 지역의 A글(없으면 비롤업 아무 글)
        const exPosts = it.existingPosts ?? [];
        const ex =
          exPosts.find((e) => e.family === 'A' && !e.rollup && !e.spoke) ??
          exPosts.find((e) => !e.rollup && !e.spoke) ??
          exPosts[0];
        if (bestOurs != null && ['B', 'V'].includes(it.family) && ex) {
          advice = `자사 ${ex.family}글(${ex.slug})이 이미 r${bestOurs} — 신규 대신 그 글 갱신(결정 #2, 갱신 후보에 올림)`;
          const p = postBySlug.get(ex.slug);
          updateItems.push({
            id: `갱신:${ex.slug}:serp-${TODAY}`,
            track: '갱신',
            query: p?.title ?? ex.slug,
            slug: ex.slug,
            path: p?.path ?? null,
            region: it.region,
            dueDate: TODAY,
            daysLeft: 0,
            evidence: [
              `scout ${TODAY}: ${ours.map((x) => `"${x.query}" r${x.rank}`).join(', ')} — ${it.family} 쿼리를 기존 ${ex.family}글이 받는다`,
              `${it.family}키 사실("${it.query}")을 기존 글에 updates[]·표 행으로 추가`,
            ],
            condition: '결정 #2: 사실·날짜 정정·updates[]·dateModified만. 제목·slug·구조 불변',
            score: UPDATE_PAST_DAYS + UPDATE_AHEAD_DAYS,
            status: 'proposed',
          });
        } else if (bestOurs != null) {
          advice = `자사 이미 r${bestOurs} — 신규 불필요`;
        }
        addExcluded(
          it.track,
          it.query,
          `scout ${TODAY} ${isT2 ? 'verdictT2' : 'verdictT1'} closed: ${why} — ${advice}`,
          { region: it.region, family: it.family },
        );
        items.splice(i, 1);
        continue;
      }
      const chosen = open.includes(r) ? r : open[0];
      it.serp = { ...chosen, source: `scout ${TODAY}`, approx: false };
      const perPoint = Number(it.scoreNote.split('×').pop()) || 1;
      it.score = score(it.recent7, chosen.openSlots, perPoint);
      it.scoreNote = `${it.recent7 ?? 0} × min(${chosen.openSlots},4) × ${perPoint}`;
      const conds = [
        (it.condition ?? '')
          .split(' · ')
          .filter((c) => c && c !== T2_UNMEASURED_COND)
          .join(' · ') || null,
      ];
      if (chosen !== r)
        conds.push(
          `타깃(제목 선두)을 변형으로: "${chosen.query}" — 본 쿼리 "${it.query}"는 ${r ? closedWhy(r) : '미측정'}`,
        );
      if (bestOurs != null)
        conds.push(
          `자사 글이 이미 ${ours.map((x) => `"${x.query}" r${x.rank}`).join(', ')} — 그 글을 잠식하지 않는 각도(${it.family ?? ''}키 선두)로만`,
        );
      if (chosen.webDocOffset != null && chosen.webDocOffset >= OFFSET_WARN)
        conds.push(`webDocOffset ${chosen.webDocOffset}% 경고(${OFFSET_WARN}~${OFFSET_CLOSED}%)`);
      it.condition = conds.filter(Boolean).join(' · ') || null;
    }
    for (const q of rm) {
      const r = byQ.get(q);
      if (r)
        watch.push({
          kind: 'remeasure',
          text: `재측정 "${q}": ${r.rank == null ? '자사 미노출' : `r${r.rank}`} · 본청 ${r.mainGovAbove} · 언론 ${r.pressAbove} · openSlots ${r.openSlots} · offset ${r.webDocOffset ?? '-'}%`,
        });
    }
  }

  // 갱신: 다가오는 날짜(D-3~D-day) 먼저, 그다음 지난 날짜를 최근 순으로
  updateItems.sort(
    (a, b) =>
      (a.daysLeft >= 0 ? 0 : 1) - (b.daysLeft >= 0 ? 0 : 1) ||
      Math.abs(a.daysLeft) - Math.abs(b.daysLeft) ||
      (a.slug ?? '').localeCompare(b.slug ?? ''),
  );

  // ── 정렬: T1 개시일 임박순 → 점수, T2/T3 점수 ──
  const t1Key = (it) => {
    if (it.dStart == null) return [2, 0, -it.score];
    if (it.dStart < 0) return [0, -it.dStart, -it.score]; // 개시 전: 가까운 순
    return [1, it.dStart, -it.score]; // 개시 후: 최근 순
  };
  const cmpArr = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  };
  const trackOrder = { T1: 0, T2: 1, T3: 2 };
  items.sort((a, b) => {
    if (a.track !== b.track) return trackOrder[a.track] - trackOrder[b.track];
    if (a.track === 'T1') return cmpArr(t1Key(a), t1Key(b));
    return b.score - a.score;
  });

  // ── 큐 병합(이전 status 유지) ──
  const merged = mergeQueue(prevQueue.items, [...items, ...updateItems]);
  const statusOf = new Map(merged.map((m) => [m.id, m]));
  const todayItems = items.map((it) => statusOf.get(it.id) ?? it);
  const todayUpdates = updateItems.map((it) => statusOf.get(it.id) ?? it);
  // 발행된 글은 자동으로 published — 후보 쿼리(또는 변형)와 글의 targetQuery가 같으면.
  // 어제 낸 글이 오늘 보고에 "지시 대기"로 남는 혼동을 막는다(2026-09-11).
  const postByQ = new Map();
  for (const p of posts) if (p.targetQuery) postByQ.set(norm(p.targetQuery), p);
  for (const it of todayItems) {
    if (it.status === 'published') continue;
    const keys = [it.query, ...String(it.variant ?? '').split(' / ')].map(norm).filter(Boolean);
    const hit = keys.map((k) => postByQ.get(k)).find(Boolean);
    if (hit) {
      it.status = 'published';
      it.statusAt = hit.date;
      it.publishedSlug = hit.slug;
      addExcluded(it.track, it.query, `발행됨 ${hit.date} — ${hit.slug}`);
    }
  }
  const activeNew = todayItems.filter((it) => !['rejected', 'published'].includes(it.status));
  const activeUpd = todayUpdates.filter((it) => !['rejected', 'published'].includes(it.status));
  for (const it of [...todayItems, ...todayUpdates]) {
    if (it.status === 'rejected')
      addExcluded(
        it.track,
        it.query,
        `운영자 반려(${it.statusAt ?? it.createdAt?.slice(0, 10) ?? ''})${it.operatorNote ? ` — ${it.operatorNote}` : ''}`,
      );
    if (it.status === 'published') addExcluded(it.track, it.query, `발행됨(${it.statusAt ?? ''})`);
  }
  const carried = merged.filter((m) => m.lastSeenAt && KEEP_STATUS.has(m.status));

  const counts = {
    T1: activeNew.filter((i) => i.track === 'T1').length,
    T2: activeNew.filter((i) => i.track === 'T2').length,
    T3: activeNew.filter((i) => i.track === 'T3').length,
    갱신: activeUpd.length,
    제외: excluded.length,
    감시: watch.length,
  };

  const queue = {
    _readme: [
      '키워드 파이프라인 큐. scripts/keyword-pipeline.mjs가 매일 다시 만든다(오늘 후보는 재생성, 운영자 status는 id 기준 유지).',
      'status: proposed(기본) · approved(운영자 승인 — 발행 대기) · rejected(반려) · published(발행됨) · hold(보류). 운영자가 이 파일에서 status·statusAt·operatorNote를 직접 바꾼다.',
      '발행은 이 스크립트가 하지 않는다. 0400 자동 발행은 별도로 매일 1건(결정 #11). 후보는 DAILY-KEYWORDS.md로 보고하고 운영자가 /post·/naver로 수동 지시한다(결정 #12).',
      'score = recent7(없으면 proxy) × min(openSlots,4) × volume-scale 계수. T1은 개시일 임박순이 점수보다 우선. serp.approx=true는 naver-ranks 옛 항목에서 근사한 verdict — --serp 실측이 아니다.',
    ],
    meta: {
      generatedAt: NOW_ISO,
      today: TODAY,
      dryRun: DRY_RUN,
      serp: serpMeta,
      counts,
      sources: {
        clusterIntents: {
          entries: registry.entries?.length ?? 0,
          regions: registry.meta?.regionCount ?? null,
        },
        naverRanks: {
          queries: Object.keys(byQuery).length,
          updatedAt: ranksStore.updatedAt ?? null,
        },
        radarCandidates: radarCandidates.length,
        regionCandidateSource: candidateSource,
        analyticsFile,
        volumeScale: {
          coefficients: coefficients.length,
          volumesUsed: (volumeScale.volumesUsed ?? []).length,
          generatedAt: volumeScale.meta?.generatedAt ?? null,
        },
        bigKeywords: (bigKeywords.keywords ?? []).length,
        landgrab: (landgrab.items ?? []).length,
        posts: posts.length,
      },
      scoutPlan: {
        T1: uniq(scoutPlan.T1),
        T2: uniq(scoutPlan.T2),
        remeasure: uniq(scoutPlan.remeasure),
      },
    },
    items: merged,
    excluded,
    watch,
  };

  const report = renderReport({
    queue,
    todayItems: activeNew,
    todayUpdates: activeUpd,
    carried,
    candidateSource,
    serpMeta,
    ranksStore,
  });

  if (!DRY_RUN) {
    await writeFile(P.outQueue, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
    await writeFile(P.outReport, report, 'utf8');
    formatWithBiome(P.outQueue);
    console.error(`[pipeline] 적재: ${P.outQueue}, ${P.outReport}`);
  } else {
    console.error('[pipeline] --dry-run — 파일 쓰기 생략');
  }
  console.log(report);
}

/** biome가 있으면 큐 JSON을 저장소 규칙대로 정돈한다(CI `biome check .`가 docs/ops/*.json도 본다). 없으면 그대로 둔다. */
function formatWithBiome(file) {
  if (!existsSync(P.biomeBin)) return;
  try {
    execFileSync(process.execPath, [P.biomeBin, 'format', '--write', file], {
      stdio: 'ignore',
      timeout: 60_000,
    });
  } catch {
    /* 포맷 실패는 치명적이지 않다 — 커밋 전 npx biome format으로 잡는다 */
  }
}

// ── 보고문 ───────────────────────────────────────────────────
const cell = (s) =>
  String(s ?? '—')
    .replace(/\|/g, '／')
    .replace(/\n/g, ' ');
function renderReport({
  queue,
  todayItems,
  todayUpdates,
  carried,
  candidateSource,
  serpMeta,
  ranksStore,
}) {
  const L = [];
  const m = queue.meta;
  L.push(`# 키워드 후보 보고 — ${m.today} (KST)`);
  L.push('');
  L.push(
    `생성 ${m.generatedAt.slice(0, 16).replace('T', ' ')}Z · scripts/keyword-pipeline.mjs${m.dryRun ? ' · --dry-run' : ''}`,
  );
  L.push(
    `SERP 실측: ${serpMeta.enabled ? `scout ${serpMeta.used}/${serpMeta.budget.total}건(T1 ${serpMeta.budget.T1}·T2 ${serpMeta.budget.T2}·재측정 ${serpMeta.budget.remeasure})${serpMeta.replay ? ' · 같은 날 저장분 재사용(--serp-replay)' : ''}${serpMeta.error ? ` · 오류 ${serpMeta.error}` : ''}` : `사용 안 함 — naver-ranks 최근 측정 재사용(${(ranksStore.updatedAt ?? '?').slice(0, 10)}). 실측은 --serp`}`,
  );
  L.push(
    `입력: cluster-intents ${m.sources.clusterIntents.entries}건 · naver-ranks ${m.sources.naverRanks.queries}쿼리 · 레이더 candidates ${m.sources.radarCandidates}건(지역 후보 소스: ${candidateSource}) · volume-scale 계수 ${m.sources.volumeScale.coefficients} · big-keywords ${m.sources.bigKeywords} · landgrab ${m.sources.landgrab} · 글 ${m.sources.posts}건`,
  );
  L.push(
    `후보: T1 ${m.counts.T1} · T2 ${m.counts.T2} · T3 ${m.counts.T3} · 갱신 ${m.counts.갱신} · 제외 ${m.counts.제외}`,
  );
  L.push('');
  L.push('## 오늘 후보');
  L.push('');
  L.push(
    'T1은 개시일 임박순(점수보다 우선), T2·T3는 점수순. 창 안 발행 상한 없음, 1지자체 1패밀리 1건(결정 #1). T2는 창 안 주 1~2건(결정 #10).',
  );
  L.push('');
  L.push('| # | 트랙 | 쿼리 | 근거 | 예상 유입/주 | 조건 |');
  L.push('|---|---|---|---|---|---|');
  if (!todayItems.length) L.push('| — | — | 오늘 신규 후보 없음 | — | — | — |');
  const t2All = todayItems.filter((it) => it.track === 'T2');
  const shown = todayItems.filter((it) => it.track !== 'T2' || t2All.indexOf(it) < REPORT_MAX_T2);
  shown.forEach((it, i) => {
    const track = `${it.track}${it.family ? ` ${it.family}` : ''}${it.rollup ? ' 롤업' : ''}`;
    const q = `${it.query}${it.variant ? ` · 변형: ${it.variant}` : ''}${it.region ? ` (${it.region})` : ''}`;
    const ev = `${it.evidence.join(' · ')} · 점수 ${it.score}`;
    const cond = `${it.status === 'approved' ? '[승인됨] ' : it.status === 'hold' ? '[보류] ' : ''}${it.condition ?? '—'}`;
    L.push(
      `| ${i + 1} | ${cell(track)} | ${cell(q)} | ${cell(ev)} | ${cell(it.expectedInbound)} | ${cell(cond)} |`,
    );
  });
  if (t2All.length > REPORT_MAX_T2) {
    L.push('');
    L.push(
      `T2 나머지 ${t2All.length - REPORT_MAX_T2}건(점수순, 큐 JSON에 있음): ${t2All
        .slice(REPORT_MAX_T2)
        .map((it) => `${it.query}(${it.score})`)
        .join(', ')}`,
    );
  }
  L.push('');
  L.push('## 갱신 후보');
  L.push('');
  L.push(
    '결정 #2: 틀린 정보·바뀐 날짜만 고친다(사실 정정·updates[]·dateModified·표 행). 제목·slug·구조·전면 재작성 금지.',
  );
  L.push('');
  L.push('| # | 글 | 날짜 | 고칠 것 | 근거 |');
  L.push('|---|---|---|---|---|');
  if (!todayUpdates.length) L.push('| — | 오늘 갱신 후보 없음 | — | — | — |');
  todayUpdates.slice(0, REPORT_MAX_UPDATES).forEach((it, i) => {
    const what =
      it.daysLeft < 0
        ? `마감·지급일 ${-it.daysLeft}일 지남 — 종료 표기·다음 절차로 정정`
        : it.daysLeft === 0
          ? '오늘 마감·지급일 — 당일 표기'
          : `${it.daysLeft}일 뒤 마감·지급일 — 카운트다운·마감 안내 정정`;
    L.push(
      `| ${i + 1} | ${cell(`${it.query}${it.path ? ` (${it.path})` : ''}`)} | ${cell(`${it.dueDate} ${fmtD(-it.daysLeft)}`)} | ${cell(`${it.status === 'approved' ? '[승인됨] ' : ''}${what}`)} | ${cell(it.evidence.join(' · '))} |`,
    );
  });
  if (todayUpdates.length > REPORT_MAX_UPDATES) {
    L.push('');
    L.push(
      `갱신 나머지 ${todayUpdates.length - REPORT_MAX_UPDATES}건은 큐 JSON(track "갱신")에 있음.`,
    );
  }
  L.push('');
  L.push('## 제외(사유)');
  L.push('');
  if (!queue.excluded.length) L.push('- 없음');
  // 검색량 미측정 T2는 한 줄로 묶는다 — 판정이 아니라 "아직 못 쟀다"라서 줄줄이 늘어놓을 이유가 없다
  const unmeasured = queue.excluded.filter(
    (e) => e.track === 'T2' && /^검색량 미측정/.test(e.reason),
  );
  for (const e of queue.excluded) {
    if (unmeasured.includes(e)) continue;
    L.push(`- [${e.track}] ${cell(e.query)} — ${cell(e.reason)}`);
  }
  if (unmeasured.length)
    L.push(
      `- [T2] 검색량 미측정 ${unmeasured.length}건(keyword-volume·레이더 측정 전 — 0이 아니라 "못 쟀다"): ${unmeasured.map((e) => e.query).join(', ')}`,
    );
  if (carried.length) {
    L.push('');
    L.push('이전 큐에서 status가 남아 있는 항목(오늘 재생성되지 않음):');
    for (const c of carried)
      L.push(`- [${c.track}] ${cell(c.query)} — ${c.status}${c.statusAt ? ` ${c.statusAt}` : ''}`);
  }
  L.push('');
  L.push('## 다음 물결 감시');
  L.push('');
  if (!queue.watch.length) L.push('- 없음');
  for (const w of queue.watch) L.push(`- ${cell(w.text)}`);
  const sp = m.scoutPlan;
  L.push('');
  L.push(
    `SERP 정찰 계획(--serp 시 일 25 = T1 15 / T2 5 / 재측정 5): T1 ${sp.T1.length}건 · T2 ${sp.T2.length}건 · 재측정 ${sp.remeasure.length}건${sp.remeasure.length ? ` — 재측정: ${sp.remeasure.slice(0, 8).join(', ')}${sp.remeasure.length > 8 ? ' …' : ''}` : ''}`,
  );
  L.push('');
  L.push('0400 자동 발행은 그대로 1건 나갑니다. 위 후보 중 쓸 것을 지시해 주세요.');
  L.push('');
  return L.join('\n');
}

main().catch((e) => {
  console.error(`[pipeline] 실패: ${e.stack ?? e.message}`);
  process.exit(1);
});
