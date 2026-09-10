#!/usr/bin/env node
/**
 * build-cluster-intents — 지자체 × 패밀리 잠금 레지스트리(docs/ops/cluster-intents.json).
 *
 * 왜 필요한가: 지자체 민생지원금 클러스터가 실유입의 81%다(계획 §0). 그런데 같은 지자체를
 * 같은 의도로 두 번 쓰면 두 글이 서로를 잡아먹는다(영동 07-15/08-18). 잠금 단위는
 * 클러스터가 아니라 **지자체 × 패밀리**이고, 패밀리는 coreFacts·제목 단서로 정한다(계획 §2).
 *   A 정규본   신청·대상·금액·지급일 — "받기 전"
 *   B 지급 후  사용처·잔액·사용기한·미수령자 창구·위임장 대리신청
 *   V 검증형   "지급하나요" — 부결·유예·미확정
 * SERP를 재기 전에 이 레지스트리로 **공짜 검사**를 먼저 한다(계획 §4-3).
 *
 * 사용:
 *   node scripts/build-cluster-intents.mjs                       # 전체 재생성(결정적, 정렬됨)
 *   node scripts/build-cluster-intents.mjs --check "완주" B       # 잠금 판정 → stdout JSON, exit 0
 *   node scripts/build-cluster-intents.mjs --check "완주" B --who="..." --amount="30만원" --deadline="9/14"
 *   node scripts/build-cluster-intents.mjs --check "완주" B --facts=draft.json   # 초안 JSON의 coreFacts로 FIX 검사
 *   node scripts/build-cluster-intents.mjs --check "경기도" V --allow-stale [--stale-days=60] [--today=YYYY-MM-DD]
 *   node scripts/build-cluster-intents.mjs --append src/data/issues/2026-09-11/xxx.json [--family=B] [--spoke] [--region=합천] [--cluster=minsaeng]
 *   node scripts/build-cluster-intents.mjs --help
 *
 * --check 출력: {verdict:"PASS"|"VETO"|"FIX", reason, existing:[{slug,family,date,...}]}
 *   FIX   who·amount·deadline 중 2개 이상이 기존 글과 같다 — 새 글이 아니라 기존 글 갱신으로 처리.
 *         후보의 coreFacts를 --who/--amount/--deadline 또는 --facts로 줘야 검사된다. 없으면 생략.
 *         비교 대상은 그 지역의 rollup=false 항목 **전부**(클러스터 무관 — 서울 기후동행카드와
 *         커리어업처럼 제도가 다르면 키가 안 겹쳐 오탐이 없다). 같은 지자체×같은 패밀리 잠금이 있어도
 *         사실이 2/3 겹치면 FIX가 먼저다 — "새 글 금지"에 "어느 글을 고칠지"까지 얹은 판정이라 더 구체적이다.
 *   VETO  같은 지자체 × 같은 패밀리가 이미 있다(knownPair면 reason에 표기). 또는 A가 있는
 *         지자체에 V를 더하려 한다(V 먼저 → A 허용, A 뒤에 V 금지 — 확정된 제도를 "지급하나요"로
 *         다시 쓰면 검증형이 정규본을 잠식한다).
 *   PASS  위 어디에도 걸리지 않는다.
 *
 *   오래된 잠금(stale): 막는 글의 deadline 키가 오늘보다 --stale-days(기본 60)일 이상 과거면
 *   "끝난 제도"일 수 있다(경기도 05-26 고유가 2차가 7/3에 끝났는데 설 2027 V를 막는 식).
 *   기본은 그대로 VETO이되 reason에 경과 일수와 "별개 제도일 수 있음 — 운영자 판단"을 덧붙이고
 *   출력에 `stale:true`를 얹는다. 운영자가 별개 제도라고 판단했을 때만 `--allow-stale`로
 *   PASS(+`warning`)를 받는다. 자동 파이프라인은 이 플래그를 스스로 켜지 않는다.
 *
 * 잠금 범위: 지자체×패밀리 잠금(VETO)은 T1 글에만 건다. T1 = 지자체가 주민에게 주는 현금성
 * 지원 — 민생·명절·재난지원금뿐 아니라 농민수당·농어민 공익수당·농촌기본수당·군민활력지원금까지
 * (계획 §5·§6 #6은 영암 농촌기본수당을 T1 A 후보로 둔다). 값은 호환을 위해 `cluster:"minsaeng"`
 * 그대로 둔다. 같은 지역이라도 다른 제도(서울커리업, 인천 난임지원, 대구 장애인 평생교육이용권)는
 * `cluster:"other"`로 등록만 하고 잠그지 않는다 — 대구 이용권 A글 때문에 "대구 민생지원금
 * 지급하나요" V가 막히면 안 되기 때문이다. 단 FIX(coreFacts 2/3 일치) 검사는 클러스터와 무관하게
 * 그 지역 전부를 본다. `--append`가 T1 어휘를 못 잡아 other로 떨어지면 stderr로 경고하고,
 * 운영자가 `--cluster=minsaeng`으로 바로잡으면 `clusterOverride:true`로 재생성에도 보존된다.
 * 롤업(지역별·받는 지역·다지역 비교)도 `rollup:true`로 등록만 한다 — 롤업 잠금은 지역이 아니라
 * 어휘 축 × 패밀리 단위라 이 레지스트리의 몫이 아니다(계획 §2 롤업).
 *
 * 지역 판정: 제목 → targetQuery → tags → slug 순. 제목·targetQuery·slug에 지역이 하나라도 있으면
 * tags에만 나온 지역은 잠금 지역(region)이 아니라 언급(regionContext)으로 내린다 — 07-15 영동 글이
 * tags '고성군 민생활력지원금'만으로 고성×A를 잠그면 안 된다. 제목에 지역이 없는 롤업(주간 신규 5건)은
 * tags 지역을 그대로 쓴다.
 *
 * coreFacts 매핑: 이 저장소의 글은 전부 coreFacts.{who,amount,deadline,where}를 가진다.
 * 그대로 who·amount·deadline을 기록하고, 비교용으로 `coreFactsKeys`를 뽑는다.
 *   who=YYYY-MM-DD       who 문장의 첫 날짜(대상 기준일). 날짜가 없으면 키 없음
 *   amount=N만원         "1인당 N만원"이 있으면 그것, 없으면 첫 "N만원"
 *   deadline=YYYY-MM-DD  deadline 문장의 첫 날짜(신청·지급 개시일)
 * 날짜는 '2026년 7월 31일'·'2026.7.31'·'2026-07-31'(post-writer 지시 형식)·'2026/7/31'·'7월 31일'·'7/31'·
 * '9.16'(기존 글 deadline의 '9.16~18' 표기) 전부 읽는다. 연도가 없는 형식은 글의 date 연도(CLI는 올해)를 붙인다.
 * FIX 판정은 이 키의 일치 개수로 센다. 산문을 통째로 비교하면 표현 차이로 한 번도 안 걸린다
 * (계획 §1 표 15: 제목 토큰 겹침 관문은 16쌍 전부 0%였다).
 *
 * 수동 지정 보존: `--append --region=합천`처럼 사전 밖 지역·패밀리·spoke·클러스터를 손으로 준 항목은
 * `regionOverride`/`familyOverride`/`spokeOverride`/`clusterOverride:true`로 표시하고, 전체 재생성이 기존 레지스트리에서
 * 그 표시를 읽어 같은 slug에 다시 적용한다(meta.manualOverrides에 목록). 재생성이 잠금을 잊으면
 * 같은 지자체×A 두 번째 글이 나가는데, 그게 이 레지스트리가 막으려던 자기잠식이다.
 * 결정성: 같은 글 집합 + 같은 수동 지정 → 같은 출력. 수동 지정은 CLI로만 들어오고 재생성은 만들지 않는다.
 * 수동 지정을 지우려면 해당 항목의 *Override 플래그를 JSON에서 지우고 재생성하거나, 파일을 지우고 재생성한다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ISSUES_DIR = join(ROOT, 'src', 'data', 'issues');
const REGIONS_FILE = join(ROOT, 'src', 'data', 'regions.json');
const OUT_FILE = join(ROOT, 'docs', 'ops', 'cluster-intents.json');
const BIOME_BIN = join(ROOT, 'node_modules', '@biomejs', 'biome', 'bin', 'biome');
const OUT_REL = 'docs/ops/cluster-intents.json';
const DEFAULT_STALE_DAYS = 60;

/**
 * src/data/regions.json에 없는 지자체 중 별칭이 특별한 것(광역·특례시·구). 계획 §5·§8-10에 나오거나
 * 기존 글 제목·tags에 있는 것. 같은 이름이 regions.json에 있으면 그쪽이 우선한다.
 */
const EXTRA_REGIONS = [
  { id: 'gangneung', name: '강릉', aliases: ['강릉시'] },
  { id: 'changwon', name: '창원', aliases: ['창원시', '창원특례시'] },
  { id: 'jangheung', name: '장흥', aliases: ['장흥군'] },
  { id: 'uljin', name: '울진', aliases: ['울진군'] },
  { id: 'gwangyang', name: '광양', aliases: ['광양시'] },
  { id: 'yeongam', name: '영암', aliases: ['영암군'] },
  { id: 'daegu', name: '대구', aliases: ['대구광역시', '대구시'] },
  { id: 'cheongju', name: '청주', aliases: ['청주시'] },
  { id: 'yangyang', name: '양양', aliases: ['양양군'] },
  { id: 'geochang', name: '거창', aliases: ['거창군'] },
  { id: 'cheongyang', name: '청양', aliases: ['청양군'] },
  { id: 'yeongcheon', name: '영천', aliases: ['영천시'] },
  { id: 'yeongdeok', name: '영덕', aliases: ['영덕군'] },
  { id: 'haenam', name: '해남', aliases: ['해남군'] },
  { id: 'jindo', name: '진도', aliases: ['진도군'] },
  { id: 'michuhol', name: '미추홀구', aliases: ['인천 미추홀구', '인천미추홀구'] },
  { id: 'yeonsu', name: '연수구', aliases: ['인천 연수구', '인천연수구'] },
  { id: 'gangbuk', name: '강북구', aliases: [] },
  { id: 'dongjak', name: '동작구', aliases: [] },
  { id: 'daejeon', name: '대전', aliases: ['대전광역시', '대전시'] },
  { id: 'busan', name: '부산', aliases: ['부산광역시', '부산시'] },
  { id: 'ulsan', name: '울산', aliases: ['울산광역시', '울산시'] },
  { id: 'gwangju', name: '광주', aliases: ['광주광역시'] },
  // 경기 광주시는 광주광역시와 다른 지자체 — 별도 항목. '광주시'만 있으면 어느 쪽인지 모르므로
  // 광역시 별칭에서 뺐고, 경기 광주는 도 이름이 붙은 형태로만 잡는다(STRICT '광주'와 같은 취지).
  {
    id: 'gwangju-gg',
    name: '경기 광주',
    aliases: [
      '경기 광주시',
      '경기광주',
      '경기광주시',
      '경기도 광주시',
      '경기도 광주',
      '광주시(경기)',
    ],
  },
  // 광역시 산하 군 — 전국 사전(NATIONWIDE)은 8도+제주만 담아 이 4곳이 빠져 있었다.
  { id: 'ongjin', name: '옹진', aliases: ['옹진군', '인천 옹진군', '인천옹진군'] },
  { id: 'gijang', name: '기장', aliases: ['기장군', '부산 기장군', '부산기장군'] },
  { id: 'ulju', name: '울주', aliases: ['울주군', '울산 울주군', '울산울주군'] },
  { id: 'dalseong', name: '달성', aliases: ['달성군', '대구 달성군', '대구달성군'] },
  { id: 'jeju', name: '제주', aliases: ['제주도', '제주특별자치도', '제주시'] },
  { id: 'gyeongbuk', name: '경북', aliases: ['경상북도'] },
  { id: 'jeonnam', name: '전남', aliases: ['전라남도'] },
  { id: 'jeonbuk', name: '전북', aliases: ['전북특별자치도', '전라북도'] },
  { id: 'chungbuk', name: '충북', aliases: ['충청북도'] },
  { id: 'chungnam', name: '충남', aliases: ['충청남도'] },
  { id: 'gangwon', name: '강원', aliases: ['강원특별자치도', '강원도'] },
];

/**
 * 전국 시·군(8도 + 제주). T1은 "방금 가결된 지자체"가 매일 새로 생기는 트랙이라(계획 §2·§3)
 * 사전 밖 지자체가 기본 경우다 — 사전이 없으면 `--append`가 지역을 못 찾고 잠금이 빠진다.
 * 형식: [로마자 id, 이름, 접미사]. 별칭은 "이름+접미사"(합천군)이고, 특례시는 'X특례시'를 더한다.
 * 같은 이름이 위 EXTRA_REGIONS·regions.json에 있으면 그쪽이 우선한다(고성은 강원·경남 둘 다 '고성' 하나).
 * 광역시 자치구는 이름이 너무 흔해(중구·남구) 넣지 않는다 — 필요하면 EXTRA_REGIONS에 별칭과 함께.
 */
const NATIONWIDE = [
  // 경기
  ['suwon', '수원', '시'],
  ['seongnam', '성남', '시'],
  ['goyang', '고양', '시'],
  ['yongin', '용인', '시'],
  ['bucheon', '부천', '시'],
  ['ansan', '안산', '시'],
  ['anyang', '안양', '시'],
  ['namyangju', '남양주', '시'],
  ['pyeongtaek', '평택', '시'],
  ['uijeongbu', '의정부', '시'],
  ['siheung', '시흥', '시'],
  ['paju', '파주', '시'],
  ['gwangmyeong', '광명', '시'],
  ['gimpo', '김포', '시'],
  ['gunpo', '군포', '시'],
  ['icheon', '이천', '시'],
  ['yangju', '양주', '시'],
  ['osan', '오산', '시'],
  ['guri', '구리', '시'],
  ['anseong', '안성', '시'],
  ['pocheon', '포천', '시'],
  ['uiwang', '의왕', '시'],
  ['hanam', '하남', '시'],
  ['yeoju', '여주', '시'],
  ['dongducheon', '동두천', '시'],
  ['gwacheon', '과천', '시'],
  ['yeoncheon', '연천', '군'],
  ['gapyeong', '가평', '군'],
  ['yangpyeong', '양평', '군'],
  // 강원
  ['chuncheon', '춘천', '시'],
  ['wonju', '원주', '시'],
  ['donghae', '동해', '시'],
  ['taebaek', '태백', '시'],
  ['samcheok', '삼척', '시'],
  ['hongcheon', '홍천', '군'],
  ['hoengseong', '횡성', '군'],
  ['yeongwol', '영월', '군'],
  ['pyeongchang', '평창', '군'],
  ['cheorwon', '철원', '군'],
  ['hwacheon', '화천', '군'],
  ['yanggu', '양구', '군'],
  ['inje', '인제', '군'],
  // 충북
  ['chungju', '충주', '시'],
  ['jecheon', '제천', '시'],
  ['boeun', '보은', '군'],
  ['okcheon', '옥천', '군'],
  ['jeungpyeong', '증평', '군'],
  ['jincheon', '진천', '군'],
  ['goesan', '괴산', '군'],
  ['eumseong', '음성', '군'],
  ['danyang', '단양', '군'],
  // 충남
  ['cheonan', '천안', '시'],
  ['gongju', '공주', '시'],
  ['boryeong', '보령', '시'],
  ['asan', '아산', '시'],
  ['seosan', '서산', '시'],
  ['nonsan', '논산', '시'],
  ['gyeryong', '계룡', '시'],
  ['geumsan', '금산', '군'],
  ['buyeo', '부여', '군'],
  ['seocheon', '서천', '군'],
  ['hongseong', '홍성', '군'],
  ['yesan', '예산', '군'],
  ['taean', '태안', '군'],
  // 전북
  ['jeonju', '전주', '시'],
  ['gunsan', '군산', '시'],
  ['iksan', '익산', '시'],
  ['namwon', '남원', '시'],
  ['gimje', '김제', '시'],
  ['jinan', '진안', '군'],
  ['muju', '무주', '군'],
  ['jangsu', '장수', '군'],
  ['imsil', '임실', '군'],
  ['sunchang', '순창', '군'],
  // 전남
  ['mokpo', '목포', '시'],
  ['yeosu', '여수', '시'],
  ['suncheon', '순천', '시'],
  ['damyang', '담양', '군'],
  ['gokseong', '곡성', '군'],
  ['gurye', '구례', '군'],
  ['boseong', '보성', '군'],
  ['hwasun', '화순', '군'],
  ['gangjin', '강진', '군'],
  ['muan', '무안', '군'],
  ['yeonggwang', '영광', '군'],
  ['wando', '완도', '군'],
  ['sinan', '신안', '군'],
  // 경북
  ['pohang', '포항', '시'],
  ['gyeongju', '경주', '시'],
  ['gimcheon', '김천', '시'],
  ['andong', '안동', '시'],
  ['gumi', '구미', '시'],
  ['yeongju', '영주', '시'],
  ['sangju', '상주', '시'],
  ['gyeongsan', '경산', '시'],
  ['gunwi', '군위', '군'],
  ['cheongsong', '청송', '군'],
  ['yeongyang', '영양', '군'],
  ['cheongdo', '청도', '군'],
  ['goryeong', '고령', '군'],
  ['seongju', '성주', '군'],
  ['chilgok', '칠곡', '군'],
  ['yecheon', '예천', '군'],
  ['bonghwa', '봉화', '군'],
  ['ulleung', '울릉', '군'],
  // 경남
  ['jinju', '진주', '시'],
  ['sacheon', '사천', '시'],
  ['miryang', '밀양', '시'],
  ['geoje', '거제', '시'],
  ['haman', '함안', '군'],
  ['changnyeong', '창녕', '군'],
  ['namhae', '남해', '군'],
  ['sancheong', '산청', '군'],
  ['hamyang', '함양', '군'],
  ['hapcheon', '합천', '군'],
  // 제주
  ['seogwipo', '서귀포', '시'],
];
/** 특례시(인구 100만) — 'X특례시' 별칭을 더한다. */
const SPECIAL_CITIES = new Set(['수원', '고양', '용인', '창원', '화성']);

/**
 * 짧은 이름만으로는 일반 명사와 섞이는 지역. 이 지역은 별칭(경기도·광주광역시·예산군…)으로만 잡는다.
 * "경기 침체"·"광주(경기 광주시)"·"고성능"·"지원 강화"·"정선된"·"추경 예산"·"장수 시대"·"영양 섭취" 오탐을 막는다.
 */
const STRICT_NAMES = new Set([
  '경기',
  '광주',
  '고성',
  '화성',
  '강화',
  '정선',
  '장성',
  '양산',
  '예산',
  '공주',
  '장수',
  '영광',
  '영양',
  '고령',
  '음성',
  '동해',
  '남해',
  '부여',
  '상주',
  '영주',
  '구리',
  '광명',
  '보은',
  '전주',
]);

/**
 * 이미 알려진 쌍(계획 §1 표 14, §5). 같은 지자체에 두 글이 있지만 노출이 확인됐거나
 * 역할이 다르다. 3건째는 금지한다. spoke = 정규본(A)에 딸린 보조 글(5부제 요일표 등).
 */
const KNOWN_PAIRS = [
  {
    region: '영동',
    slugs: [
      'local-livelihood-support-payment-2026-07-15',
      'yeongdong-livelihood-stability-grant-2026-08-18',
    ],
    note: 'A/A 진짜 중복(who·amount·deadline 동일). 둘 다 유지, 3건째 금지',
  },
  {
    region: '고흥',
    slugs: ['goheung-livelihood-recovery-grant-2026-08-17', 'goheung-livelihood-grant-2026-08-19'],
    note: 'A/V 둘 다 노출(r1·r2). 신규 없음',
  },
  {
    region: '문경',
    slugs: [
      'mungyeong-high-oil-price-relief-2026-08-16',
      'mungyeong-livelihood-grant-chuseok-payment-2026-08-27',
    ],
    note: 'A/V. 9/16 B 필요 여부 별도 판단',
  },
  {
    region: '나주',
    slugs: [
      'naju-livelihood-recovery-grant-2026-08-07',
      'naju-livelihood-grant-rotation-days-2026-09-03',
    ],
    note: 'A/spoke(5부제 요일표). D-1·D+1 재측정',
    spoke: 'naju-livelihood-grant-rotation-days-2026-09-03',
  },
];

/** 제목 단서. V를 먼저 보고, 그다음 B, 나머지는 A. */
const V_CUES =
  /지급하나요|지급되나|부결|무산|재상정|여부|미정|추진|언제 나오나|미지급|관건|보류|유예/;
const B_CUES =
  /사용처|잔액|사용기한|미신청|추가신청|추가 신청|위임장|대리|못 받았|이후 신청|미수령|잔여/;
/**
 * T1(지자체가 주민에게 주는 현금성 지원) 클러스터 판정 — 제목·tags·targetQuery에서.
 * 민생·명절·재난 어휘에 더해 농민수당·농어민(공익)수당·농촌기본수당·기본소득·군민(활력)지원금 계열도
 * T1이다(계획 §5·§6 #6 영암 농촌기본수당 A). 여기 안 걸리면 잠금이 빠지므로, 새 유형이 나오면
 * 어휘를 더하거나 `--append --cluster=minsaeng`으로 손으로 잠근다.
 */
const MINSAENG_CUES =
  /민생|활력지원금|경제회복지원금|고유가|추석 ?(지자체 )?(민생)?지원금|명절 ?지원금|재난지원금|일상회복지원금|농민수당|농어민 ?수당|농업인 ?수당|농어업인 ?수당|농어민 ?공익수당|농촌 ?기본수당|기본수당|기본소득|(군민|시민|주민) ?(활력|안정|회복)?지원금/;
const CLUSTERS = ['minsaeng', 'other'];
/** 롤업 단서 — 지역이 아니라 어휘 축으로 잠그는 글. */
const ROLLUP_CUES = /지역별|받는 지역|지역 비교/;

function usage() {
  console.log(`사용:
  node scripts/build-cluster-intents.mjs                      전체 재생성 → ${OUT_REL}
  node scripts/build-cluster-intents.mjs --check "<지역>" <A|B|V> [--who=.. --amount=.. --deadline=.. | --facts=초안.json]
                                          [--allow-stale] [--stale-days=${DEFAULT_STALE_DAYS}] [--today=YYYY-MM-DD]
  node scripts/build-cluster-intents.mjs --append <post.json> [--family=A|B|V] [--spoke] [--region=지역[,지역]] [--cluster=minsaeng|other]`);
}

// ── 인자 ────────────────────────────────────────────────────────────────────
const VALUE_FLAGS = [
  'check',
  'append',
  'facts',
  'family',
  'cluster',
  'region',
  'who',
  'amount',
  'deadline',
  'today',
  'stale-days',
];

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      opts._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq > 0) {
      opts[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    // --check "완주" B 처럼 값이 뒤따르는 플래그
    if (VALUE_FLAGS.includes(key)) {
      if (next !== undefined && !next.startsWith('--')) {
        opts[key] = next;
        i += 1;
      } else {
        opts[key] = '';
      }
    } else {
      opts[key] = true;
    }
  }
  return opts;
}

// ── 지역 사전 ───────────────────────────────────────────────────────────────
async function loadRegions() {
  let base = [];
  try {
    base = JSON.parse(await readFile(REGIONS_FILE, 'utf8'));
  } catch {
    base = [];
  }
  const byName = new Map();
  const add = (r) => {
    if (!r?.name || byName.has(r.name)) return;
    const aliases = new Set(r.aliases || []);
    // full "전남 나주시" → "나주시" 같은 마지막 토큰도 별칭으로
    if (typeof r.full === 'string') {
      const last = r.full.trim().split(/\s+/).pop();
      if (last && last !== r.name) aliases.add(last);
    }
    if (SPECIAL_CITIES.has(r.name)) aliases.add(`${r.name}특례시`);
    byName.set(r.name, { id: r.id, name: r.name, aliases: [...aliases].sort() });
  };
  for (const r of base) add(r);
  for (const r of EXTRA_REGIONS) add(r);
  for (const [id, name, suffix] of NATIONWIDE) add({ id, name, aliases: [`${name}${suffix}`] });
  return [...byName.values()];
}

const ADMIN_SUFFIX_TAIL = /(특별자치시|특별자치도|광역시|특례시|시|군|구|도)$/;

/**
 * 입력 문자열("완주군"·"경기도"·"완주")을 정규 지역명으로. 사전에 없으면 행정 접미사를 뗀 이름을
 * 돌려준다(`--append --region=옹진` 뒤 `--check 옹진군`이 같은 '옹진'으로 떨어지게 — 양쪽 경로가
 * 같은 정규화). 뗀 결과가 한 글자면(예: '군') 입력 그대로.
 */
function resolveRegion(input, regions) {
  const s = String(input || '').trim();
  if (!s) return s;
  for (const r of regions) if (r.name === s || r.aliases.includes(s)) return r.name;
  const stripped = s.replace(ADMIN_SUFFIX_TAIL, '');
  if (stripped && stripped !== s) {
    for (const r of regions) if (r.name === stripped || r.aliases.includes(stripped)) return r.name;
    if (stripped.length >= 2) return stripped;
  }
  return s;
}

/** 정규 지역명이 사전(regions.json + EXTRA + NATIONWIDE)에 있는가. --check reason 표기용. */
function isKnownRegion(name, regions) {
  return regions.some((r) => r.name === name);
}

/** 광역(도·광역시). 제목에 없고 tags에만 있으면 소속 표시일 뿐이라 잠금 지역에 넣지 않는다. */
const PROVINCES = new Set([
  '경남',
  '경북',
  '전남',
  '전북',
  '충북',
  '충남',
  '강원',
  '경기',
  '서울',
  '인천',
  '대구',
  '대전',
  '부산',
  '광주',
  '울산',
  '제주',
  '세종',
]);
/** "함평 나주 고흥 민생지원금 비교"처럼 남의 지역을 끌어온 tag는 지역 판정에서 뺀다. */
const COMPARISON_TAG = /비교|차이|vs/i;

/** 짧은 지역명 뒤에 와도 되는 글자. 그 밖의 한글이 붙으면(고양이·정선된·완주읍장) 다른 단어다. */
const AFTER_NAME_OK = /^(시|군|구|도|읍|특|광|사랑|페이)/;
/** 행정 접미사로 끝나는 별칭(강화군·경기도)은 뒤 글자를 보지 않는다 — 강화군민·경기도민이 정상이다. */
const ADMIN_SUFFIX = /[시군구도]$/;
/** 광역·도 이름(서울커리업·전남학생교육수당·인천연수구)도 뒤 글자를 보지 않는다 — 제도명 접두로 흔히 붙는다. */
const noAfterCheck = (needle) => ADMIN_SUFFIX.test(needle) || PROVINCES.has(needle);

/**
 * text에서 needle이 낱말로 시작하는 위치. 앞 글자가 한글이면(정부안→부안) 오탐이고,
 * 짧은 이름은 뒤 글자도 본다(고양이→고양, 정선된→정선).
 */
function indexOfBounded(text, needle) {
  const checkAfter = !noAfterCheck(needle);
  let from = 0;
  for (;;) {
    const idx = text.indexOf(needle, from);
    if (idx < 0) return -1;
    const prev = idx === 0 ? '' : text[idx - 1];
    const rest = text.slice(idx + needle.length);
    const afterOk = !checkAfter || !/^[가-힣]/.test(rest) || AFTER_NAME_OK.test(rest);
    if (!/[가-힣]/.test(prev) && afterOk) return idx;
    from = idx + 1;
  }
}

/**
 * 겹치는 적중 중 남의 구간 안에 완전히 들어간 것을 버린다 — '경기 광주시'(경기 광주)가 잡히면
 * 그 안의 '광주시'(광주광역시)는 같은 글자를 두 번 센 것이다. slug의 'gwangju-gg' 안 'gwangju'도 같다.
 * 등장 순서(idx) → 이름 순으로 정렬해 돌려준다(결정적).
 */
function dropContained(hits) {
  const kept = hits.filter(
    (h) =>
      !hits.some(
        (o) =>
          o !== h &&
          o.idx <= h.idx &&
          o.idx + o.len >= h.idx + h.len &&
          (o.len > h.len || (o.len === h.len && o.name < h.name)),
      ),
  );
  return kept.sort((a, b) => a.idx - b.idx || a.name.localeCompare(b.name, 'ko'));
}

/**
 * 글 한 건에서 지역을 찾는다. 제목 → targetQuery → tags → slug(영문 id) 순으로 보고,
 * 등장 순서를 지킨다(제목에 먼저 나온 지역이 primary).
 * 돌려주는 것: regions(잠금 대상), context(광역 소속·tags에만 나온 언급 — 참고용), titleCount.
 */
function detectRegions(post, regions) {
  const found = [];
  const source = new Map();
  const push = (name, src) => {
    if (found.includes(name)) return;
    found.push(name);
    source.set(name, src);
  };
  const scan = (text, src) => {
    if (!text) return;
    const hits = [];
    for (const r of regions) {
      const needles = STRICT_NAMES.has(r.name) ? r.aliases : [r.name, ...r.aliases];
      let best = -1;
      let bestLen = 0;
      for (const n of needles) {
        if (!n) continue;
        const idx = indexOfBounded(text, n);
        if (idx >= 0 && (best < 0 || idx < best || (idx === best && n.length > bestLen))) {
          best = idx;
          bestLen = n.length;
        }
      }
      if (best >= 0) hits.push({ name: r.name, idx: best, len: bestLen });
    }
    for (const h of dropContained(hits)) push(h.name, src);
  };
  const title = String(post.title || '');
  scan(title, 'title');
  const titleCount = found.length;
  const inTitle = new Set(found);
  scan(String(post.targetQuery || ''), 'query');
  for (const t of Array.isArray(post.tags) ? post.tags : []) {
    const tag = String(t);
    if (COMPARISON_TAG.test(tag)) continue;
    scan(tag, 'tags');
  }
  const slug = String(post.slug || '');
  const slugHits = [];
  for (const r of regions) {
    if (!r.id) continue;
    const m = slug.match(new RegExp(`(^|-)${r.id}(-|$)`));
    if (m) slugHits.push({ name: r.name, idx: m.index + m[1].length, len: r.id.length });
  }
  for (const h of dropContained(slugHits)) push(h.name, 'slug');
  const strong = found.filter((n) => source.get(n) !== 'tags');
  const context = found.filter(
    (n) => (PROVINCES.has(n) && !inTitle.has(n)) || (source.get(n) === 'tags' && strong.length > 0),
  );
  const primary = found.filter((n) => !context.includes(n));
  return { regions: primary, context, titleCount };
}

// ── 패밀리·클러스터·롤업 ────────────────────────────────────────────────────
function detectFamily(post) {
  const t = `${post.title || ''} ${post.targetQuery || ''}`;
  if (V_CUES.test(t)) return 'V';
  if (B_CUES.test(t)) return 'B';
  return 'A';
}

function detectCluster(post) {
  const t = `${post.title || ''} ${(post.tags || []).join(' ')} ${post.targetQuery || ''}`;
  return MINSAENG_CUES.test(t) ? 'minsaeng' : 'other';
}

function detectRollup(post, regionsFound, titleCount) {
  const title = String(post.title || '');
  if (ROLLUP_CUES.test(title)) return true;
  if (titleCount >= 3) return true;
  if (titleCount === 0 && regionsFound.length >= 2) return true;
  return false;
}

function detectAxis(post) {
  const t = String(post.title || '');
  if (/추석/.test(t)) return '추석';
  if (/설 |설날|설 명절/.test(t)) return '설';
  const m = t.match(/(\d)차/);
  if (m) return `${m[1]}차`;
  return null;
}

// ── coreFacts 정규화 ────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');

/**
 * 문장에서 가장 앞에 나오는 날짜 하나를 YYYY-MM-DD(또는 YYYY-MM)로.
 * 받는 형식: 2026년 7월 31일 · 2026.7.31 · 2026-07-31 · 2026/7/31 · 7월 31일 · 7/31.
 * 연도 없는 형식은 fallbackYear. '2026-08-12'가 '2026-08'로 잘리지 않게 일 단위를 먼저 모은다.
 */
function firstDate(text, fallbackYear) {
  if (!text) return null;
  const s = String(text);
  const cands = [];
  for (const m of s.matchAll(/(\d{4})\s*[.년]\s*(\d{1,2})\s*[.월]\s*(\d{1,2})\s*일?/g)) {
    cands.push({ idx: m.index, v: `${m[1]}-${pad(m[2])}-${pad(m[3])}` });
  }
  for (const m of s.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) {
    cands.push({ idx: m.index, v: `${m[1]}-${m[2]}-${m[3]}` });
  }
  for (const m of s.matchAll(/(\d{4})\/(\d{1,2})\/(\d{1,2})/g)) {
    cands.push({ idx: m.index, v: `${m[1]}-${pad(m[2])}-${pad(m[3])}` });
  }
  for (const m of s.matchAll(/(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) {
    cands.push({ idx: m.index, v: `${fallbackYear}-${pad(m[1])}-${pad(m[2])}` });
  }
  for (const m of s.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g)) {
    cands.push({ idx: m.index, v: `${fallbackYear}-${pad(m[1])}-${pad(m[2])}` });
  }
  // 연도 없는 점 표기 '9.16~18'·'8.10~9.11'(기존 글 deadline 형식). '2026.7.31'의 '7.31'은 앞 '.'로,
  // '0.1ha'는 월 0으로, '3.5배'·'2.5%'는 뒤 단위로 거른다.
  for (const m of s.matchAll(
    /(?<![\d.])(\d{1,2})\.(\d{1,2})(?![\d.]|\s*(?:%|배|倍|ha|㎡|억|만|천|원|점|kg|km|cm|mm|m(?![가-힣A-Za-z])))/g,
  )) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    cands.push({ idx: m.index, v: `${fallbackYear}-${pad(mo)}-${pad(d)}` });
  }
  if (cands.length === 0) {
    const m = s.match(/(\d{4})\s*[.년]\s*(\d{1,2})\s*월/) || s.match(/(\d{4})-(\d{2})(?!\d|-\d)/);
    if (m) return `${m[1]}-${pad(m[2])}`;
    return null;
  }
  cands.sort((a, b) => a.idx - b.idx);
  return cands[0].v;
}

function amountKey(text) {
  if (!text) return null;
  const s = String(text).replace(/,/g, '');
  const per = s.match(/1\s*인당?\s*(?:최대\s*)?(\d+)\s*만\s*원/);
  if (per) return `${per[1]}만원`;
  const any = s.match(/(\d+)\s*만\s*원/);
  return any ? `${any[1]}만원` : null;
}

function coreFactsOf(post) {
  const cf = post.coreFacts && typeof post.coreFacts === 'object' ? post.coreFacts : {};
  return {
    who: typeof cf.who === 'string' ? cf.who : null,
    amount: typeof cf.amount === 'string' ? cf.amount : null,
    deadline: typeof cf.deadline === 'string' ? cf.deadline : null,
  };
}

function coreFactsKeysOf(facts, year) {
  const keys = [];
  const who = firstDate(facts.who, year);
  if (who) keys.push(`who=${who}`);
  const amt = amountKey(facts.amount);
  if (amt) keys.push(`amount=${amt}`);
  const dl = firstDate(facts.deadline, year);
  if (dl) keys.push(`deadline=${dl}`);
  return keys;
}

function sharedKeys(a, b) {
  const set = new Set(a);
  return b.filter((k) => set.has(k));
}

// ── 글 → 레지스트리 항목 ────────────────────────────────────────────────────
function postDate(post) {
  if (typeof post.date === 'string' && post.date) return post.date.slice(0, 10);
  if (typeof post.publishedAt === 'string') return post.publishedAt.slice(0, 10);
  return '0000-00-00';
}

function splitRegions(input, regions) {
  return String(input)
    .split(/[,·]/)
    .map((s) => resolveRegion(s, regions))
    .filter((s, i, arr) => s && arr.indexOf(s) === i);
}

function toEntry(post, relPath, regions, overrides = {}) {
  const det = detectRegions(post, regions);
  const regionList = overrides.region ? splitRegions(overrides.region, regions) : det.regions;
  if (regionList.length === 0) return null;
  const date = postDate(post);
  const year = date.slice(0, 4);
  const facts = coreFactsOf(post);
  const entry = {
    region: regionList,
    family: overrides.family || detectFamily(post),
    slug: post.slug,
    path: relPath,
    date,
    targetQuery: typeof post.targetQuery === 'string' ? post.targetQuery : null,
    coreFacts: facts,
    coreFactsKeys: coreFactsKeysOf(facts, year),
    cluster: overrides.cluster || detectCluster(post),
    rollup: detectRollup(post, regionList, det.titleCount),
  };
  const axis = detectAxis(post);
  if (entry.rollup && axis) entry.axis = axis;
  if (det.context.length > 0 && !overrides.region) entry.regionContext = det.context;
  if (overrides.spoke) entry.spoke = true;
  if (overrides.region) entry.regionOverride = true;
  if (overrides.family) entry.familyOverride = true;
  if (overrides.spoke) entry.spokeOverride = true;
  if (overrides.cluster) entry.clusterOverride = true;
  applyKnownPairs(entry);
  return entry;
}

function applyKnownPairs(entry) {
  for (const p of KNOWN_PAIRS) {
    if (!p.slugs.includes(entry.slug)) continue;
    entry.knownPair = true;
    entry.pairWith = p.slugs.find((s) => s !== entry.slug) || null;
    entry.pairNote = p.note;
    if (p.spoke === entry.slug) entry.spoke = true;
  }
}

function sortEntries(entries) {
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
}

/** 기존 레지스트리에서 수동 지정(--region/--family/--spoke) 항목을 slug별로 모은다. */
function manualOverridesOf(registry) {
  const map = new Map();
  for (const e of registry?.entries || []) {
    if (!e?.slug) continue;
    const o = {};
    if (e.regionOverride && Array.isArray(e.region) && e.region.length > 0) {
      o.region = e.region.join(',');
    }
    if (e.familyOverride && e.family) o.family = e.family;
    if (e.spokeOverride) o.spoke = true;
    if (e.clusterOverride && CLUSTERS.includes(e.cluster)) o.cluster = e.cluster;
    if (Object.keys(o).length > 0) map.set(e.slug, o);
  }
  return map;
}

// ── 스캔 ────────────────────────────────────────────────────────────────────
async function listIssueFiles(dir) {
  const out = [];
  const names = (await readdir(dir)).sort();
  for (const name of names) {
    if (name.startsWith('_')) continue; // _drafts·_scheduled·_history.json
    const p = join(dir, name);
    const st = await stat(p);
    if (st.isDirectory()) out.push(...(await listIssueFiles(p)));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

function relPathOf(abs) {
  return relative(ROOT, abs).split(sep).join('/');
}

/**
 * 전체 재생성. 입력은 글 집합 + 기존 레지스트리의 수동 지정(regionOverride 등)뿐이다.
 * 수동 지정이 없는 항목은 기존 레지스트리 내용과 무관하게 글에서 다시 계산한다.
 */
async function buildAll() {
  const regions = await loadRegions();
  const manual = manualOverridesOf(await loadRegistry());
  const files = await listIssueFiles(ISSUES_DIR);
  const entries = [];
  let scanned = 0;
  for (const f of files) {
    let post;
    try {
      post = JSON.parse(await readFile(f, 'utf8'));
    } catch {
      continue;
    }
    if (!post || typeof post !== 'object' || !post.slug) continue;
    scanned += 1;
    const e = toEntry(post, relPathOf(f), regions, manual.get(post.slug) || {});
    if (e) entries.push(e);
  }
  sortEntries(entries);
  return { registry: withMeta(entries, scanned), regions };
}

function withMeta(entries, scanned) {
  const regionSet = new Set();
  const families = { A: 0, B: 0, V: 0 };
  const clusters = { minsaeng: 0, other: 0 };
  let rollups = 0;
  let knownPairs = 0;
  const manualOverrides = [];
  for (const e of entries) {
    for (const r of e.region) regionSet.add(r);
    families[e.family] = (families[e.family] || 0) + 1;
    clusters[e.cluster] = (clusters[e.cluster] || 0) + 1;
    if (e.rollup) rollups += 1;
    if (e.knownPair) knownPairs += 1;
    if (e.regionOverride || e.familyOverride || e.spokeOverride || e.clusterOverride) {
      const o = { slug: e.slug };
      if (e.regionOverride) o.region = e.region;
      if (e.familyOverride) o.family = e.family;
      if (e.spokeOverride) o.spoke = true;
      if (e.clusterOverride) o.cluster = e.cluster;
      manualOverrides.push(o);
    }
  }
  return {
    meta: {
      schema: 1,
      source: 'src/data/issues/**/*.json (_drafts·_scheduled 제외)',
      generator: 'scripts/build-cluster-intents.mjs',
      scannedPosts: scanned,
      entryCount: entries.length,
      regionCount: regionSet.size,
      regions: [...regionSet].sort((a, b) => a.localeCompare(b, 'ko')),
      families,
      clusters,
      rollups,
      knownPairEntries: knownPairs,
      manualOverrides,
      rules: {
        lockUnit:
          '지자체 × 패밀리(cluster=minsaeng, rollup=false 항목만 잠금). minsaeng = T1 지자체 현금성 지원(민생·명절·재난지원금·농민수당·농어민 공익수당·농촌기본수당·기본소득·군민활력지원금)',
        VETO: '같은 지자체×같은 패밀리 존재, 또는 A 있는 지자체에 V 추가',
        FIX: 'coreFactsKeys(who·amount·deadline) 중 2개 이상 일치 → 기존 글 갱신. 비교 대상은 클러스터 무관 그 지역 rollup=false 전부(A 후보는 V 제외). VETO보다 먼저 판정',
        knownPair: '알려진 쌍은 유지하되 3건째 금지',
        stale: `막는 글의 deadline이 ${DEFAULT_STALE_DAYS}일 이상 지났으면 별개 제도일 수 있음 — 기본 VETO(reason에 표기), 운영자 판단 시 --allow-stale로 PASS`,
        regionSource:
          '제목·targetQuery·slug 지역이 잠금 대상. 그중 하나라도 있으면 tags에만 나온 지역은 regionContext(언급)',
        manualOverrides:
          '--append --region/--family/--spoke/--cluster 지정은 regionOverride/familyOverride/spokeOverride/clusterOverride로 기록되고 재생성이 보존',
      },
    },
    entries,
  };
}

function summarize(reg) {
  const m = reg.meta;
  console.log(
    `[cluster-intents] 글 ${m.scannedPosts}건 스캔 → 지역 글 ${m.entryCount}건 · 지역 ${m.regionCount}곳 · ` +
      `패밀리 A ${m.families.A} / B ${m.families.B} / V ${m.families.V} · ` +
      `민생 ${m.clusters.minsaeng} / 기타 ${m.clusters.other} · 롤업 ${m.rollups} · knownPair ${m.knownPairEntries}` +
      `${m.manualOverrides?.length ? ` · 수동 지정 ${m.manualOverrides.length}` : ''}`,
  );
}

async function loadRegistry() {
  try {
    const j = JSON.parse(await readFile(OUT_FILE, 'utf8'));
    if (Array.isArray(j)) return { meta: {}, entries: j };
    return { meta: j.meta || {}, entries: Array.isArray(j.entries) ? j.entries : [] };
  } catch {
    return null;
  }
}

async function saveRegistry(reg) {
  await writeFile(OUT_FILE, `${JSON.stringify(reg, null, 2)}\n`, 'utf8');
  formatWithBiome(OUT_FILE);
}

/**
 * biome가 있으면 산출 JSON을 저장소 규칙대로 정돈한다. JSON.stringify는 짧은 배열도 여러 줄로 쓰는데
 * biome 포맷터는 한 줄로 접어서, 재생성할 때마다 CI `biome check .`가 실패했다(2026-09-10).
 * 없거나 실패하면 그대로 둔다 — 커밋 전 `npx biome format --write`로 잡는다.
 */
function formatWithBiome(file) {
  if (!existsSync(BIOME_BIN)) return;
  try {
    execFileSync(process.execPath, [BIOME_BIN, 'format', '--write', file], {
      stdio: 'ignore',
      timeout: 60_000,
    });
  } catch {
    /* 포맷 실패는 치명적이지 않다 */
  }
}

// ── --check ─────────────────────────────────────────────────────────────────
/** 오늘(KST) YYYY-MM-DD. --today로 고정하면 판정이 결정적이다. */
function todayKst(override) {
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 항목의 deadline 키(YYYY-MM-DD 또는 YYYY-MM)가 today보다 며칠 과거인지. 키 없으면 null. */
function daysSinceDeadline(entry, today) {
  const key = (entry.coreFactsKeys || []).find((k) => k.startsWith('deadline='));
  if (!key) return null;
  let v = key.slice('deadline='.length);
  if (/^\d{4}-\d{2}$/.test(v)) v = `${v}-28`; // 월 단위면 보수적으로 월말 근처
  const d = Date.parse(`${v}T00:00:00Z`);
  const t = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(d) || Number.isNaN(t)) return null;
  return Math.floor((t - d) / 86400000);
}

/**
 * 막는 글들이 전부 stale(deadline이 staleDays 이상 과거)인지. 하나라도 deadline 키가 없거나
 * 아직 안 지났으면 stale 아님 — 살아 있는 제도를 "끝났다"고 착각하지 않게 보수적으로.
 */
function staleOf(blockers, today, staleDays) {
  const days = blockers.map((e) => daysSinceDeadline(e, today));
  if (days.some((d) => d === null || d < staleDays)) return null;
  return Math.min(...days);
}

function checkVerdict(registry, regionName, family, candidateKeys, opts = {}) {
  const today = todayKst(opts.today);
  const staleDays = Number.isFinite(Number(opts.staleDays))
    ? Number(opts.staleDays)
    : DEFAULT_STALE_DAYS;
  const existing = registry.entries
    .filter((e) => e.region.includes(regionName))
    .map((e) => {
      const row = { slug: e.slug, family: e.family, date: e.date, cluster: e.cluster };
      if (e.rollup) row.rollup = true;
      if (e.knownPair) row.knownPair = true;
      if (e.spoke) row.spoke = true;
      return row;
    });
  const inRegion = registry.entries.filter((e) => e.region.includes(regionName) && !e.rollup);
  const locking = inRegion.filter((e) => e.cluster === 'minsaeng');
  const notes = [];
  if (opts.knownRegion === false) notes.push('사전 밖 지역 — 입력 문자열 정확 일치만 검사');
  const others = existing.length - locking.length;
  if (others > 0) notes.push(`잠금 제외 ${others}건(롤업·비민생)`);

  // FIX가 VETO보다 먼저다: 같은 지자체×패밀리 잠금이 있어도 사실이 2/3 겹치면 "그 글을 고쳐라"가
  // 더 구체적인 지시다. 비교 대상은 클러스터와 무관하게 그 지역의 rollup=false 전부 — 제도가
  // 다르면(서울 기후동행카드 vs 커리어업) 키가 안 겹쳐 오탐이 없고, 민생 어휘를 못 잡은 T1 글
  // (영암 농촌기본수당)도 이 검사에는 걸린다.
  if (candidateKeys && candidateKeys.length > 0) {
    // V 뒤에 오는 A는 같은 제도가 확정된 것이라 who·amount가 겹치는 게 정상 — V와는 비교하지 않는다.
    // B 후보가 A와 who·amount를 그대로 쓰면 FIX가 뜨는 건 의도다(계획 §1 표 12 김해B):
    // B는 미수령자·대리인·이후 신청 기간처럼 B만의 사실을 coreFacts에 담아야 새 글이다.
    const fixPool = family === 'A' ? inRegion.filter((e) => e.family !== 'V') : inRegion;
    for (const e of fixPool) {
      const shared = sharedKeys(e.coreFactsKeys || [], candidateKeys);
      if (shared.length >= 2) {
        const lockNote =
          e.cluster === 'minsaeng' && e.family === family
            ? ` (${regionName} × ${family} 잠금도 존재)`
            : e.cluster === 'other'
              ? ' (비민생 항목이지만 같은 사실이면 같은 글)'
              : '';
        return {
          verdict: 'FIX',
          reason:
            `${e.slug}(${e.family}, ${e.date})와 coreFacts ${shared.length}/3 일치(${shared.join(', ')}) → 새 글이 아니라 기존 글 갱신(updates[]·dateModified)${lockNote}. ${notes.join(' · ')}`.trim(),
          existing,
        };
      }
    }
    notes.push(`coreFacts 비교 ${fixPool.length}건 모두 2개 미만 일치`);
  } else {
    notes.push('coreFacts 미제공 → FIX 검사 생략(--who/--amount/--deadline 또는 --facts)');
  }

  /** VETO를 만들되, 막는 글이 전부 stale이면 reason에 표기하고(--allow-stale이면 PASS+warning) */
  const veto = (blockers, reason) => {
    const stale = staleOf(blockers, today, staleDays);
    if (stale === null)
      return { verdict: 'VETO', reason: `${reason} ${notes.join(' · ')}`.trim(), existing };
    const hint = `막는 글의 deadline이 ${stale}일 지남(기준 ${today}, 임계 ${staleDays}일) — 끝난 제도이고 후보는 별개 제도(다음 물결)일 수 있음, 운영자 판단`;
    if (!opts.allowStale) {
      return {
        verdict: 'VETO',
        reason: `${reason} ${hint}(--allow-stale로 통과). ${notes.join(' · ')}`.trim(),
        existing,
        stale: true,
        staleDays: stale,
      };
    }
    notes.push(`stale 잠금 해제(--allow-stale): ${reason}`);
    return {
      verdict: 'PASS',
      reason: `${hint}. ${notes.join(' · ')}`.trim(),
      existing,
      stale: true,
      staleDays: stale,
      warning: `기존 ${blockers.map((e) => e.slug).join(', ')}과 같은 제도면 갱신 트랙으로 — 새 글은 공고·차수가 다를 때만`,
    };
  };

  const sameFamily = locking.filter((e) => e.family === family);
  if (sameFamily.length > 0) {
    const slugs = sameFamily.map((e) => `${e.slug}(${e.date})`).join(', ');
    const allKnown = sameFamily.every((e) => e.knownPair);
    const kp = allKnown
      ? ' — knownPair: 이미 알려진 쌍이라 기존 2건은 유지하되 3건째는 금지'
      : sameFamily.some((e) => e.knownPair)
        ? ' — 일부 knownPair'
        : '';
    return veto(sameFamily, `${regionName} × ${family} 이미 존재: ${slugs}${kp}.`);
  }
  if (family === 'V') {
    const aList = locking.filter((e) => e.family === 'A');
    if (aList.length > 0) {
      const slugs = aList.map((e) => `${e.slug}(${e.date})`).join(', ');
      return veto(
        aList,
        `${regionName}에 A(정규본)가 있어 V(검증형) 추가 금지: ${slugs}. 확정된 제도를 "지급하나요"로 다시 쓰면 정규본을 잠식한다.`,
      );
    }
  }
  if (family === 'A' && locking.some((e) => e.family === 'V')) {
    notes.push('V 먼저 → A 허용(가결 후 정규본 발행)');
  }

  const base =
    locking.length === 0
      ? `${regionName}에 잠금 대상(민생 클러스터) 글 없음`
      : `${regionName} × ${family} 없음(기존 패밀리: ${locking.map((e) => e.family).join(',')})`;
  return { verdict: 'PASS', reason: `${base}. ${notes.join(' · ')}`.trim(), existing };
}

/** 절대 경로면 그대로, 아니면 저장소 루트 기준으로. */
function absPath(p) {
  return /^[A-Za-z]:[\\/]|^\//.test(p) ? p : join(ROOT, p);
}

async function candidateKeysFrom(opts) {
  let facts = null;
  if (opts.facts) {
    const j = JSON.parse(await readFile(absPath(opts.facts), 'utf8'));
    facts = coreFactsOf(j);
  }
  if (opts.who || opts.amount || opts.deadline) {
    facts = {
      who: opts.who || facts?.who || null,
      amount: opts.amount || facts?.amount || null,
      deadline: opts.deadline || facts?.deadline || null,
    };
  }
  if (!facts) return null;
  const year = todayKst(opts.today).slice(0, 4);
  return coreFactsKeysOf(facts, year);
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  if (opts.check !== undefined) {
    const family = String(opts._[0] || '').toUpperCase();
    if (!opts.check || !['A', 'B', 'V'].includes(family)) {
      console.error('--check "<지역>" <A|B|V> 형태로 주어라.');
      usage();
      process.exit(1);
    }
    const regions = await loadRegions();
    let registry = await loadRegistry();
    if (!registry) registry = (await buildAll()).registry;
    const regionName = resolveRegion(opts.check, regions);
    const keys = await candidateKeysFrom(opts);
    const result = checkVerdict(registry, regionName, family, keys, {
      today: opts.today,
      staleDays: opts['stale-days'],
      allowStale: opts['allow-stale'] === true || opts['allow-stale-a'] === true,
      knownRegion: isKnownRegion(regionName, regions),
    });
    console.log(JSON.stringify({ region: regionName, family, ...result }));
    return;
  }

  if (opts.append !== undefined) {
    if (!opts.append) {
      console.error('--append <post.json 경로>');
      process.exit(1);
    }
    const abs = absPath(opts.append);
    const post = JSON.parse(await readFile(abs, 'utf8'));
    const regions = await loadRegions();
    const overrides = {};
    if (opts.family !== undefined) {
      const fam = String(opts.family).toUpperCase();
      if (!['A', 'B', 'V'].includes(fam)) {
        console.error(`--family는 A|B|V 중 하나여야 한다(받은 값: "${opts.family}").`);
        process.exit(1);
      }
      overrides.family = fam;
    }
    if (opts.cluster !== undefined) {
      const cl = String(opts.cluster).toLowerCase();
      if (!CLUSTERS.includes(cl)) {
        console.error(
          `--cluster는 ${CLUSTERS.join('|')} 중 하나여야 한다(받은 값: "${opts.cluster}").`,
        );
        process.exit(1);
      }
      overrides.cluster = cl;
    }
    if (opts.spoke) overrides.spoke = true;
    if (opts.region) overrides.region = opts.region;
    const entry = toEntry(post, relPathOf(abs), regions, overrides);
    if (!entry) {
      console.error(`지역을 찾지 못함: ${post.slug}. --region=<지역>으로 지정하라.`);
      process.exit(1);
    }
    if (entry.cluster === 'other' && !entry.rollup) {
      console.error(
        `[cluster-intents] 경고: ${entry.slug}는 T1 어휘(민생·명절·재난지원금·농민수당·기본수당 등)가 제목·tags에 없어 ` +
          `cluster=other로 등록된다 — ${entry.region.join('·')} × ${entry.family} 잠금(VETO)이 걸리지 않는다. ` +
          `지자체 현금성 지원(T1) 글이면 --cluster=minsaeng을 붙여 다시 --append 하라(clusterOverride로 재생성에도 보존).`,
      );
    }
    let registry = await loadRegistry();
    if (!registry) registry = (await buildAll()).registry;
    const scanned = (registry.meta.scannedPosts || registry.entries.length) + 1;
    const rest = registry.entries.filter((e) => e.slug !== entry.slug);
    const replaced = rest.length !== registry.entries.length;
    const merged = withMeta(sortEntries([...rest, entry]), replaced ? scanned - 1 : scanned);
    await saveRegistry(merged);
    console.log(
      `[cluster-intents] ${replaced ? '갱신' : '추가'}: ${entry.slug} → ${entry.region.join('·')} × ${entry.family}` +
        `${entry.cluster === 'other' ? ' (비민생, 잠금 없음)' : ''}${entry.rollup ? ' (롤업)' : ''}` +
        `${entry.regionOverride ? ' (지역 수동 지정 — 재생성에도 보존)' : ''}`,
    );
    summarize(merged);
    return;
  }

  const { registry } = await buildAll();
  await saveRegistry(registry);
  summarize(registry);
  console.log(`→ ${OUT_REL}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
