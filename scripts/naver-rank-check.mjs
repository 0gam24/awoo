#!/usr/bin/env node
/**
 * naver-rank-check — 발행한 글이 네이버에서 실제로 몇 위인지 측정한다.
 *
 * 이 사이트의 병목은 색인이 아니라 랭킹이다(2026-09-08 실측). 그런데 지금까지
 * "썼다"까지만 있고 "올라갔나"를 재는 장치가 없었다. 이 스크립트가 그 자리를 채운다.
 * 측정값이 있어야 다음 글의 각도를 고칠 수 있다 — 수정·보완 루프의 근거다.
 *
 * 대상: docs/ops/rank-targets.json + 포스트 JSON의 targetQuery 필드(자동 수집)
 * 산출: src/data/naver-ranks.json (90일 롤링)
 *
 * 두 모드(2026-09-10, KEYWORD-PLAN-2026-09-10 §4-4·§8-3):
 *   --mode=track (기본) 등록된 쿼리를 재서 naver-ranks.json에 이력을 쌓는다.
 *   --mode=scout        발행 전 정찰. --query/--file로 받은 쿼리를 재되 **스토어에 쓰지 않고**
 *                       stdout에 JSON만 낸다(단건이면 객체, --file이면 배열). 상한 25건.
 *
 * 사용:
 *   node scripts/naver-rank-check.mjs                    # 전체 측정(track)
 *   node scripts/naver-rank-check.mjs --limit=5          # 상위 5건만
 *   node scripts/naver-rank-check.mjs --query="..."      # 단건 조회(적재 X)
 *   node scripts/naver-rank-check.mjs --dry-run          # 적재 생략
 *   node scripts/naver-rank-check.mjs --mode=scout --query="..."
 *   node scripts/naver-rank-check.mjs --mode=scout --file=docs/ops/scout-queries.txt
 *   node scripts/naver-rank-check.mjs --help               # 사용법만 출력(측정·적재 없음). 모르는 인자는 종료 코드 2
 *       (--file: 한 줄에 쿼리 하나. '#' 줄 무시. JSON이면 문자열 배열 / {queries:[]} / [{query}] 허용)
 *
 * scout 출력 한 건의 형태(다른 스크립트가 이 이름을 그대로 믿는다 — 바꾸지 말고 추가만):
 *   { query, rank, webDocCount, aboveIsWholeBlock, openSlots, mainGovAbove, pressAbove,
 *     sisterAbove, webDocOffset, verdictT1:'open'|'closed', verdictT2:'open'|'closed',
 *     reason:[...], above:[{host,kind,title,stale?,mainGov?}] }
 *
 * rank null 해석: 웹문서 블록 미노출이지 트래픽 0이 아니다. "완주군 민생안정지원금"은 rank null인데
 * 주 512 유입(애널리틱스 9/2~9/8)이었다 — 스마트블록·통합검색 다른 영역에서 들어온다.
 * null은 aboveIsWholeBlock:true로 구분만 하고, 발행을 막는 근거로 쓰지 않는다.
 *
 * 예의: 요청 간 3초 간격, 1회 실행 상한(track 40·scout 25). 자사 순위 확인 용도로만 쓴다.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS_FILE = join(ROOT, 'docs', 'ops', 'rank-targets.json');
const ISSUES_DIR = join(ROOT, 'src', 'data', 'issues');
const OUT_FILE = join(ROOT, 'src', 'data', 'naver-ranks.json');
const SISTER_FILE = join(ROOT, 'docs', 'ops', 'sister-sites.json');
const REGIONS_FILE = join(ROOT, 'src', 'data', 'regions.json');

const SITE_HOST = 'awoo.or.kr';
const DELAY_MS = 3000;
const MAX_PER_RUN = 40; // 3초 간격 × 40 = 2분. 25일 때 당일 발행분이 잘리는 사고가 있었다(2026-09-09)
const MAX_SCOUT_PER_RUN = 25; // 정찰 예산(계획 §7-7: 창 안 T1 15 / T2 5 / 재측정 5)
const KEEP_DAYS = 90;

// 공백 렌즈(계획 §1 표 4·7). 웹문서 블록이 페이지 아래로 밀릴수록 1위여도 유입이 준다.
// 15~30%는 경고, ≥30%는 신규 금지 — n≈10 관측이라 ≥30 하드 컷 하나만 verdict에 반영한다.
const OFFSET_WARN = 15;
const OFFSET_CLOSED = 30;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const kstYear = () => Number(kstDate().slice(0, 4));

// ── 외부 목록(자매 호스트·지역명) ─────────────────────────────
// 모듈 로드 시점엔 비어 있고 main()에서 채운다. parseSerp는 동기 함수라 미리 읽어 둬야 한다.
let SISTER_HOSTS = new Set();
let REGION_NAMES = new Set();

async function loadSisterHosts() {
  try {
    const f = JSON.parse(await readFile(SISTER_FILE, 'utf8'));
    SISTER_HOSTS = new Set(
      (f.hosts ?? []).map((h) =>
        String(h)
          .toLowerCase()
          .replace(/^www\./, ''),
      ),
    );
  } catch {
    /* 파일이 없으면 자매 분류 없이 진행 — 자매가 commercial로 잡히는 건 종전 동작과 같다 */
  }
}

/**
 * 지역 토큰 판정용 이름 사전. src/data/regions.json(name·aliases)에 접미 없는 시·군 이름을 더한다.
 * regions.json엔 우리가 글을 낸 24곳뿐이라, 정찰 대상(울진·광양·영암 등)이 빠진다 — 상수로 보강.
 */
const KNOWN_REGIONS = `
서울 부산 대구 인천 광주 대전 울산 세종 경기 강원 충북 충남 전북 전남 경북 경남 제주
수원 성남 고양 용인 부천 안산 안양 남양주 화성 평택 의정부 시흥 파주 광명 김포 군포 이천 양주 오산 구리 안성 포천 의왕 하남 여주 양평 동두천 과천 가평 연천
춘천 원주 강릉 동해 태백 속초 삼척 홍천 횡성 영월 평창 정선 철원 화천 양구 인제 고성 양양
청주 충주 제천 보은 옥천 영동 증평 진천 괴산 음성 단양
천안 공주 보령 아산 서산 논산 계룡 당진 금산 부여 서천 청양 홍성 예산 태안
전주 군산 익산 정읍 남원 김제 완주 진안 무주 장수 임실 순창 고창 부안
목포 여수 순천 나주 광양 담양 곡성 구례 고흥 보성 화순 장흥 강진 해남 영암 무안 함평 영광 장성 완도 진도 신안
포항 경주 김천 안동 구미 영주 영천 상주 문경 경산 군위 의성 청송 영양 영덕 청도 고령 성주 칠곡 예천 봉화 울진 울릉
창원 진주 통영 사천 김해 밀양 거제 양산 의령 함안 창녕 남해 하동 산청 함양 거창 합천
서귀포 경상남도 경상북도 전라남도 전라북도 충청남도 충청북도 경기도 강원도 강원특별자치도 전북특별자치도 제주도
`
  .split(/\s+/)
  .filter(Boolean);

async function loadRegionNames() {
  REGION_NAMES = new Set(KNOWN_REGIONS);
  try {
    for (const r of JSON.parse(await readFile(REGIONS_FILE, 'utf8'))) {
      if (r.name) REGION_NAMES.add(r.name);
      for (const a of r.aliases ?? []) REGION_NAMES.add(a);
    }
  } catch {
    /* regions.json이 없어도 상수 사전으로 진행 */
  }
}

// 접미(시·군·구·도)로 끝나지만 지역이 아닌 흔한 낱말. "경정청구 기한" 같은 쿼리에서 오탐을 막는다.
const REGION_STOP_RE =
  /(청구|요구|연구|추구|지구|기구|도구|가구|인구|입구|출구|복구|촉구|탐구|욕구|지역구|실시|동시|당시|일시|임시|정시|즉시|잠시|역시|감시|표시|게시|공시|명시|개시|응시|장군|대군|국군|육군|해군|공군|친구|연도|제도|한도|정도|용도|각도|태도|빈도|난이도|완성도|인지도|만족도|신뢰도|가속도)$/;

/**
 * 쿼리의 지역 토큰. "완주군 민생지원금" → {token:'완주군', base:'완주', suffix:'군'},
 * "김해 지원금 10만원 신청" → {token:'김해', base:'김해', suffix:null}. 지역 쿼리가 아니면 null.
 * 제목 대조는 base(접미 뗀 이름)로 한다 — "완주" 없는 기관 문서는 이 쿼리의 자리가 아니다.
 */
function regionToken(query) {
  for (const tok of String(query).split(/\s+/)) {
    if (REGION_NAMES.has(tok)) {
      const m = tok.match(/^([가-힣]{2,4})(특별자치시|특별자치도|광역시|특별시|시|군|구|도)$/);
      return { token: tok, base: m ? m[1] : tok, suffix: m ? m[2] : null };
    }
    const m = tok.match(/^([가-힣]{2,4})(특별자치시|특별자치도|광역시|특별시|시|군|구|도)$/);
    if (m && !REGION_STOP_RE.test(tok)) return { token: tok, base: m[1], suffix: m[2] };
  }
  return null;
}

// ── SERP 파싱 ────────────────────────────────────────────────
// 웹문서 블록은 결과 1건마다 `fds-web-doc-root` 클래스를 단 컨테이너가 하나씩 붙는다.
// 이 구조는 네이버가 언제든 바꾼다 — 0건이면 조용히 "순위 없음"으로 넘기지 말고
// parseOk:false로 남겨 "미노출"과 "못 읽음"을 구분한다.
/**
 * 기관 도메인 판정.
 * `go.kr`만 보면 과소 판정된다. 2026-09-09 실측에서 korea.kr(정부 대표 포털),
 * mil.kr(국방), nhis.or.kr(건보공단), energyv.or.kr(에너지바우처 공식),
 * 8899.or.kr(노란우산 공식), eiec.kdi.re.kr(KDI)이 전부 "외부 상업 사이트"로
 * 잡혔다. 그 결과 externalCount가 "우리가 들어갈 자리"를 과대평가한다 —
 * 본인부담상한액은 external 4로 보였지만 4건 전부 공공·공식기관이라 실제 빈자리는 0이었다.
 */
const isInstitutional = (h) =>
  // gov.kr(정부24)이 상업으로 새던 것을 2026-09-09 SERP 정찰에서 발견 — 기관으로 편입
  /(^|\.)(go\.kr|or\.kr|re\.kr|mil\.kr|ac\.kr|gov\.kr)$/.test(h) || h === 'korea.kr';

/**
 * 언론 도메인. 2026-09-10 "완주군 민생안정지원금" 실측에서 웹문서 11건 중 10건이 개시일(9/8)
 * 언론 신디케이션이었다 — 상업(commercial)과 섞어 두면 "열린 자리 10"으로 읽혀 오판한다.
 * 라벨 토큰 정규식 + 토큰만으론 못 잡는 짧은 도메인 목록. 완전하지 않다 — 누락은 commercial로 남는다.
 */
const PRESS_LABEL_RE =
  /^(?:.*(?:news|ilbo|times|daily|press|journal|media|sinmun|shinmun|broadcast|nocut|newspim|dailian|kihoilbo|joongboo|pressian|ohmy).*|tv.*|.*tv)$/;
const PRESS_HOSTS = new Set([
  'yna.co.kr',
  'ytn.co.kr',
  'mbc.co.kr',
  'kbs.co.kr',
  'sbs.co.kr',
  'jtbc.co.kr',
  'hani.co.kr',
  'joongang.co.kr',
  'chosun.com',
  'donga.com',
  'khan.co.kr',
  'kyeongin.com',
  'kwnews.co.kr',
  'kjdaily.com',
  'gukjenews.com',
  'ajunews.com',
  'ccdn.co.kr',
  'kbmaeil.com',
  'mt.co.kr',
  'mk.co.kr',
  'hankyung.com',
  'hankookilbo.com',
  'kmib.co.kr',
  'segye.com',
  'munhwa.com',
  'fnnews.com',
  'asiae.co.kr',
  'etoday.co.kr',
  'imaeil.com',
  'yeongnam.com',
  'kyongbuk.co.kr',
  'domin.co.kr',
  'busan.com',
  'kookje.co.kr',
  'kns.tv',
  'wbcjbtv.com',
  'hnnews365.com',
  'jjjachinews.com',
  'inews24.com',
  'kukinews.com',
  'news1.kr',
  'newsis.com',
  'edaily.co.kr',
  'sisajournal.com',
  'mediatoday.co.kr',
  'incheonilbo.com',
  'kgnews.co.kr',
  'kyeonggi.com',
  'jbnews.com',
  'jnilbo.com',
  'sjbnews.com',
  'jjan.kr',
  'kwangju.co.kr',
  'namdonews.com',
  'idomin.com',
  'knn.co.kr',
  'kbc.co.kr',
  'jibs.co.kr',
  'ihalla.com',
  'jejunews.com',
  'kado.net',
  'cctoday.co.kr',
  'ccdailynews.com',
  'daejonilbo.com',
]);

const isPress = (h) => {
  if (PRESS_HOSTS.has(h)) return true;
  if ([...PRESS_HOSTS].some((p) => h.endsWith(`.${p}`))) return true;
  // 'tv'는 라벨 단독/접미/접두만 — 'tvcf' 같은 오탐을 줄인다
  return h.split('.').some((label) => label.length >= 3 && PRESS_LABEL_RE.test(label));
};

const isSister = (h) => SISTER_HOSTS.has(h) || [...SISTER_HOSTS].some((s) => h.endsWith(`.${s}`));

/**
 * 호스트 1차 분류: 자사(us) / 네이버 UGC(naver) / 자매(sister) / 기관(institutional) / 언론(press) / 상업(commercial).
 * 기관은 parseSerp에서 제목·URL·연도를 보고 'institutional-open'(열린 자리)으로 다시 나뉜다.
 * 자매를 기관보다 먼저 보는 이유: 자매 도메인엔 or.kr이 없지만 앞으로 생겨도 '자매'가 우선이어야 한다.
 */
function hostKind(host) {
  if (host === SITE_HOST) return 'us';
  if (host.includes('naver.com')) return 'naver';
  if (isSister(host)) return 'sister';
  if (isInstitutional(host)) return 'institutional';
  return isPress(host) ? 'press' : 'commercial';
}

// ── 기관 재분류(계획 §4-4 "go.kr 게시판·구청·읍면동·지난해 문서는 open") ──
// (a) 게시판 경로. 본청 대문이 아니라 공지 한 장이면 우리 글이 이길 수 있는 자리다(완주군청 board/post 1위·자사 null).
const BOARD_PATH_RE =
  /(bbs|board|notice|게시판|nttId|bbsId|boardView|selectBbs|postUid|\/post\/|fboard=)/i;
// (c) 구청·읍면동·주민센터 = 본청 아님. 단, 쿼리 지역 자체가 '구'면 구청이 본청이다.
const SUB_OFFICE_RE = /(구청|[읍면동]\s?(사무소|행정복지센터)|행정복지센터|주민센터)/;
// 지자체 본청(mainGov) 판정: go.kr + 출처명(프로필)이 "완주군청·경기도·서울특별시" 꼴, 또는 제목에 "X군청·X시청".
const LOCAL_GOV_NAME_RE =
  /^[가-힣]{1,6}(특별시|광역시|특별자치시|특별자치도|시|군|구|도)(청)?(\s|$)/;
const LOCAL_GOV_TITLE_RE = /[가-힣]{1,6}(시청|군청|구청|도청)/;

function isLocalGovMain(host, profile, title) {
  if (!/(^|\.)go\.kr$/.test(host)) return false;
  return LOCAL_GOV_NAME_RE.test(profile ?? '') || LOCAL_GOV_TITLE_RE.test(title ?? '');
}

const decodeUrl = (u) => {
  const s = String(u).replace(/&amp;/g, '&');
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** 제목·스니펫에 적힌 연도(2000~2099). "2026.07.17." "2026년 7월" "2025-12-30" 전부 잡는다. */
const yearsIn = (text) =>
  [...String(text ?? '').matchAll(/(20\d{2})\s*[.\-년/]/g)].map((m) => Number(m[1]));

/**
 * 기관 문서를 열린 자리로 돌려 세우는 규칙. 이유를 남겨 above[]를 읽는 사람이 판정을 검증할 수 있게 한다.
 * @returns {{kind:string, stale:boolean, mainGov:boolean, openBy:string[]}}
 */
function classifyDoc(doc, region, year) {
  const kind0 = hostKind(doc.host);
  const yrs = yearsIn(`${doc.title ?? ''} ${doc.snippet ?? ''}`);
  // (d) 연도가 전부 지난해 이전 = 지난 회차 문서. 올해 언급이 하나라도 있으면 살아 있는 문서로 본다.
  const stale = yrs.length > 0 && Math.max(...yrs) < year;
  if (kind0 !== 'institutional') return { kind: kind0, stale, mainGov: false, openBy: [] };

  const title = doc.title ?? '';
  const openBy = [];
  if (BOARD_PATH_RE.test(decodeUrl(doc.url))) openBy.push('board');
  if (region && !title.includes(region.base)) openBy.push('no-region');
  const guIsMain =
    region?.suffix === '구' &&
    /구청/.test(title) &&
    !/([읍면동]|주민센터|행정복지센터)/.test(title);
  if (SUB_OFFICE_RE.test(`${title} ${doc.profile ?? ''}`) && !guIsMain) openBy.push('sub-office');
  if (stale) openBy.push('stale');
  if (openBy.length) return { kind: 'institutional-open', stale, mainGov: false, openBy };
  return {
    kind: 'institutional',
    stale,
    mainGov: isLocalGovMain(doc.host, doc.profile, title),
    openBy,
  };
}

/**
 * 결과 제목. headline1 요소 안에 검색어 강조 태그가 섞여 있어
 * 첫 `<`에서 끊으면 "2026 "처럼 잘린다 — 태그만 걷어내고 링크 라벨 앞까지 취한다.
 * 상대 제목을 남겨야 "이긴 문서의 제목이 쿼리와 얼마나 겹치는가"를 자기 데이터로 검증할 수 있다.
 */
function docTitle(block) {
  const i = block.search(/sds-comps-text-type-headline1/);
  if (i === -1) return null;
  const j = block.indexOf('>', i);
  if (j === -1) return null;
  let w = block.slice(j + 1, j + 1200);
  const cut = w.indexOf('새 창 열림');
  if (cut !== -1) w = w.slice(0, cut);
  const t = w
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return t || null;
}

const stripTags = (s) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * 스니펫 = 제목(headline1) 뒤 첫 body1 문단. 날짜("2일 전"·"2026.07.17.")가 그 사이에 붙는다.
 * 블록 텍스트 전체를 쓰면 안 된다 — 출처 설명("1995년 설립")과 뒤에 딸린 서브링크·다른 문서까지
 * 섞여 연도 판정이 틀어진다(2026-09-10 실측). headline1~첫 body1의 '새 창 열림'까지만 취한다.
 */
function docSnippet(block) {
  const i = block.search(/sds-comps-text-type-headline1/);
  if (i === -1) return null;
  const seg = block.slice(i, i + 8000);
  const j = seg.search(/sds-comps-text-type-body1/);
  if (j === -1) return null;
  const end = seg.indexOf('새 창 열림', j);
  const s = stripTags(seg.slice(j, end === -1 ? j + 1500 : end)).slice(0, 300);
  return s || null;
}

/** 출처명(프로필 제목). "완주군청"·"정부24"·"뉴시스" — 본청 판정의 1차 근거. */
function docProfile(block) {
  const m = block.match(/sds-comps-profile-info-title-text[^>]*>([^<]{1,60})</);
  return m ? m[1].trim() : null;
}

/**
 * 웹문서 블록 시작 오프셋(%). 블록이 페이지 어디에 놓였는지가 유입을 가른다(계획 §1 표 4·7).
 * HTML 바이트 기준이 아니라 문자열 인덱스 기준이다 — 상대 위치라 비율엔 차이가 거의 없다.
 */
function webDocOffset(html) {
  const i = html.indexOf('fds-web-doc-root');
  if (i === -1 || html.length === 0) return null;
  return Math.round((i / html.length) * 1000) / 10;
}

/**
 * @param {string} html
 * @param {string} [query] 지역 토큰 추출용. 없으면 지역 규칙(no-region)은 적용하지 않는다.
 */
function parseSerp(html, query = '') {
  const blocks = html.split('fds-web-doc-root').slice(1);
  const region = regionToken(query);
  const year = kstYear();
  const webDocs = [];
  for (const b of blocks) {
    const m = b.match(/<a[^>]+href="(https?:\/\/[^"]+)"/);
    if (!m) continue;
    try {
      const host = new URL(m[1]).hostname.replace(/^www\./, '');
      const doc = {
        url: m[1],
        host,
        title: docTitle(b),
        snippet: docSnippet(b),
        profile: docProfile(b),
      };
      const c = classifyDoc(doc, region, year);
      webDocs.push({ ...doc, kind: c.kind, stale: c.stale, mainGov: c.mainGov, openBy: c.openBy });
    } catch {
      /* URL 파싱 불가 항목은 건너뛴다 */
    }
  }

  const uniq = (re) => new Set(html.match(re) ?? []).size;
  const ugc = {
    blog: uniq(/blog\.naver\.com\/[A-Za-z0-9_-]+\/\d{6,}/g),
    cafe: uniq(/cafe\.naver\.com\/[A-Za-z0-9_-]+\/\d{3,}/g),
    kin: uniq(/kin\.naver\.com\/qna\/[A-Za-z0-9.?=&_-]{6,}/g),
  };

  const count = (k) => webDocs.filter((d) => d.kind === k).length;

  return {
    parseOk: blocks.length > 0,
    webDocs,
    webDocCount: webDocs.length,
    // 종전 정의 유지: 기관 도메인 전부(본청·중앙기관·열린 게시판 포함). 이력 비교가 깨지지 않게 한다.
    institutionalCount: count('institutional') + count('institutional-open'),
    institutionalOpenCount: count('institutional-open'),
    mainGovCount: webDocs.filter((d) => d.mainGov).length,
    // 종전 정의 유지: 기관·네이버·자사가 아닌 외부 전부(언론·자매 포함). 아래 둘은 그 부분집합.
    commercialCount: count('commercial') + count('press') + count('sister'),
    pressCount: count('press'),
    sisterCount: count('sister'),
    webDocOffset: webDocOffset(html),
    region: region?.token ?? null,
    ugc,
  };
}

async function fetchSerp(query) {
  const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
  });
  if (!res.ok) throw new Error(`SERP ${res.status}`);
  return res.text();
}

/**
 * 열린 자리·판정(계획 §4-4). above[] 기준이다 — 우리보다 위에 무엇이 있느냐가 진입 가능성이다.
 *   openSlots     = above 중 naver·institutional(본청/중앙)·sister가 아닌 것(press·commercial·institutional-open)
 *   verdictT1     = 본청 ≤1 AND 언론 ≤3 AND (자사 미노출 OR rank ≥4)  — 물결 버스트(지역 글) 진입 조건
 *   verdictT2     = openSlots ≥2                                        — 대형 세부 롱테일 진입 조건
 *   webDocOffset ≥30% 이면 둘 다 closed(reason 'offset'). 블록을 못 읽었으면 둘 다 closed(reason 'parse').
 */
function verdicts({ rank, above, webDocOffset: off, parseOk }) {
  const openSlots = above.filter(
    (d) => !['naver', 'institutional', 'sister', 'us'].includes(d.kind),
  ).length;
  const mainGovAbove = above.filter((d) => d.mainGov).length;
  const pressAbove = above.filter((d) => d.kind === 'press').length;
  const sisterAbove = above.filter((d) => d.kind === 'sister').length;
  const reason = [];

  let verdictT1 = 'open';
  if (mainGovAbove > 1) {
    verdictT1 = 'closed';
    reason.push(`mainGov ${mainGovAbove}>1`);
  }
  if (pressAbove > 3) {
    verdictT1 = 'closed';
    reason.push(`press ${pressAbove}>3`);
  }
  if (rank != null && rank < 4) {
    verdictT1 = 'closed';
    reason.push(`already r${rank}`);
  }
  let verdictT2 = 'open';
  if (openSlots < 2) {
    verdictT2 = 'closed';
    reason.push(`openSlots ${openSlots}<2`);
  }
  if (!parseOk) {
    verdictT1 = 'closed';
    verdictT2 = 'closed';
    reason.push('parse');
  } else if (off != null && off >= OFFSET_CLOSED) {
    verdictT1 = 'closed';
    verdictT2 = 'closed';
    reason.push(`offset ${off}%≥${OFFSET_CLOSED}`);
  } else if (off != null && off >= OFFSET_WARN) {
    reason.push(`offset-warn ${off}%`);
  }
  if (sisterAbove > 0) reason.push(`sister ${sisterAbove}`);

  return { openSlots, mainGovAbove, pressAbove, sisterAbove, verdictT1, verdictT2, reason };
}

/** 한 쿼리 측정 */
async function measure(query) {
  const html = await fetchSerp(query);
  const s = parseSerp(html, query);
  const idx = s.webDocs.findIndex((d) => d.host === SITE_HOST);

  // 미노출일 때 above를 비워두면, 원인 규명이 가장 필요한 케이스에서 근거가 없어진다.
  // 순위가 없으면 "우리 위"가 곧 블록 전체다.
  const above = (idx === -1 ? s.webDocs : s.webDocs.slice(0, idx)).map((d) => ({
    host: d.host,
    kind: d.kind,
    title: d.title,
    ...(d.stale ? { stale: true } : {}),
    ...(d.mainGov ? { mainGov: true } : {}),
    ...(d.openBy.length ? { openBy: d.openBy } : {}),
  }));

  const rank = idx === -1 ? null : idx + 1;
  const v = verdicts({ rank, above, webDocOffset: s.webDocOffset, parseOk: s.parseOk });

  return {
    query,
    // null = 웹문서 블록 미노출. 트래픽 0이 아니다("완주군 민생안정지원금" null인데 주 512 유입).
    rank,
    url: idx === -1 ? null : s.webDocs[idx].url,
    webDocCount: s.webDocCount,
    above,
    aboveIsWholeBlock: idx === -1, // 미노출이라 블록 전체를 담았다는 표시
    ...v,
    webDocOffset: s.webDocOffset,
    region: s.region,
    commercialCount: s.commercialCount,
    pressCount: s.pressCount,
    sisterCount: s.sisterCount,
    institutionalCount: s.institutionalCount,
    institutionalOpenCount: s.institutionalOpenCount,
    mainGovCount: s.mainGovCount,
    ugc: s.ugc,
    // 웹문서 블록 밖(스마트블록 등)에 잡힌 경우도 놓치지 않는다
    onPage: html.includes(SITE_HOST),
    parseOk: s.parseOk,
  };
}

/** scout 출력(계약 형태). 다른 스크립트가 이 키 이름을 그대로 읽는다 — 이름 변경 금지, 추가만. */
function scoutView(m) {
  return {
    query: m.query,
    rank: m.rank,
    url: m.url,
    webDocCount: m.webDocCount,
    aboveIsWholeBlock: m.aboveIsWholeBlock,
    openSlots: m.openSlots,
    mainGovAbove: m.mainGovAbove,
    pressAbove: m.pressAbove,
    sisterAbove: m.sisterAbove,
    webDocOffset: m.webDocOffset,
    verdictT1: m.verdictT1,
    verdictT2: m.verdictT2,
    reason: m.reason,
    region: m.region,
    onPage: m.onPage,
    parseOk: m.parseOk,
    measuredAt: new Date().toISOString(),
    above: m.above,
  };
}

/** --file 로 받은 쿼리 목록. 텍스트(한 줄 하나) 또는 JSON(문자열 배열 / {queries:[]} / [{query}]). */
async function loadQueryFile(path) {
  const raw = await readFile(join(ROOT, path), 'utf8').catch(() => readFile(path, 'utf8'));
  const text = (raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw).trim(); // BOM 제거
  let list;
  if (text.startsWith('[') || text.startsWith('{')) {
    const j = JSON.parse(text);
    const arr = Array.isArray(j) ? j : (j.queries ?? []);
    list = arr.map((x) => (typeof x === 'string' ? x : x?.query)).filter(Boolean);
  } else {
    list = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  }
  return [...new Set(list)];
}

// ── 대상 수집 ────────────────────────────────────────────────
async function loadTargets() {
  const out = new Map(); // query → { query, url, source }

  // 포스트가 선언한 targetQuery를 먼저 — 가장 최근 글이 가장 먼저 측정돼야 한다.
  // 상한에 걸려 잘리면 파일 등록분이 잘리게 하고, 당일 발행분은 절대 잘리지 않게 한다.
  try {
    for (const d of await readdir(ISSUES_DIR, { withFileTypes: true })) {
      // _drafts·_scheduled 같은 비발행 디렉토리는 제외 — 폐기된 초안이 측정 대상에 섞였다(2026-09-09)
      if (!d.isDirectory() || d.name.startsWith('_')) continue;
      for (const f of await readdir(join(ISSUES_DIR, d.name))) {
        if (!f.endsWith('.json') || f.startsWith('_')) continue;
        const p = JSON.parse(await readFile(join(ISSUES_DIR, d.name, f), 'utf8'));
        if (p.targetQuery && !out.has(p.targetQuery)) {
          out.set(p.targetQuery, { query: p.targetQuery, url: p.slug ?? null, source: 'post' });
        }
      }
    }
  } catch {
    /* 이슈 디렉토리 문제는 targets만으로 진행 */
  }

  try {
    const f = JSON.parse(await readFile(TARGETS_FILE, 'utf8'));
    for (const t of f.targets ?? []) {
      if (t.query) out.set(t.query, { query: t.query, url: t.url ?? null, source: 'targets' });
    }
  } catch {
    /* 파일이 없으면 포스트에서만 모은다 */
  }

  return [...out.values()];
}

// ── 적재 ─────────────────────────────────────────────────────
async function loadStore() {
  try {
    return JSON.parse(await readFile(OUT_FILE, 'utf8'));
  } catch {
    return { updatedAt: null, byQuery: {} };
  }
}

function record(store, date, m) {
  const rec = store.byQuery[m.query] ?? { first: date, history: [] };
  // 날짜를 키로 덮어쓰면 같은 날 두 번 재면 앞의 관측이 사라진다. 실제로 2026-09-09에
  // 72분 간격 두 회차 중 1차가 소멸해, 변화 추적이 한 번도 작동하지 못했다.
  // 타임스탬프로 쌓고 집계는 읽는 쪽에서 한다.
  rec.history.push({
    ts: new Date().toISOString(),
    date,
    rank: m.rank,
    webDocCount: m.webDocCount,
    commercialCount: m.commercialCount,
    onPage: m.onPage,
    // 2026-09-10 추가(계획 §4-4). 이전 항목엔 없다 — 읽는 쪽은 undefined를 허용해야 한다.
    openSlots: m.openSlots,
    mainGovAbove: m.mainGovAbove,
    pressAbove: m.pressAbove,
    sisterAbove: m.sisterAbove,
    webDocOffset: m.webDocOffset,
    verdictT1: m.verdictT1,
    verdictT2: m.verdictT2,
  });
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString().slice(0, 10);
  rec.history = rec.history
    .filter((h) => (h.date ?? '') >= cutoff)
    .sort((a, b) => ((a.ts ?? a.date) < (b.ts ?? b.date) ? -1 : 1));
  rec.latest = { ...m, date };
  store.byQuery[m.query] = rec;
}

/** 직전 측정 대비 변화 */
function delta(rec) {
  const h = rec.history;
  if (h.length < 2) return null;
  const cur = h[h.length - 1].rank;
  const prev = h[h.length - 2].rank;
  if (cur == null && prev == null) return null;
  if (cur == null) return `이탈 (직전 ${prev}위)`;
  if (prev == null) return `신규 진입 ${cur}위`;
  if (cur === prev) return `${cur}위 유지`;
  return cur < prev ? `${prev}→${cur}위 (▲${prev - cur})` : `${prev}→${cur}위 (▼${cur - prev})`;
}

// ── main ─────────────────────────────────────────────────────
/**
 * scout: 발행 전 정찰. 스토어에 쓰지 않는다. 진행 로그는 stderr로 보내 stdout을 JSON만으로 유지한다.
 * 단건(--query)이면 객체 하나, --file이면 배열. 실패한 쿼리는 {query, error} 로 남긴다.
 */
async function runScout(queries) {
  const batch = queries.slice(0, MAX_SCOUT_PER_RUN);
  if (queries.length > batch.length) {
    console.error(`[scout] 상한 ${MAX_SCOUT_PER_RUN}건 — ${queries.length - batch.length}건 잘림`);
  }
  const out = [];
  for (const [i, q] of batch.entries()) {
    try {
      const m = await measure(q);
      out.push(scoutView(m));
      console.error(
        `[scout] ${String(i + 1).padStart(2)}. ${q} — ${m.rank ? `r${m.rank}` : 'null'}/${m.webDocCount} ` +
          `open ${m.openSlots} gov ${m.mainGovAbove} press ${m.pressAbove} off ${m.webDocOffset ?? '-'}% ` +
          `T1 ${m.verdictT1} T2 ${m.verdictT2}`,
      );
    } catch (e) {
      out.push({ query: q, error: e.message });
      console.error(`[scout] ⚠ ${q}: ${e.message}`);
    }
    if (i < batch.length - 1) await sleep(DELAY_MS);
  }
  return out;
}

// ── 인자 가드 ────────────────────────────────────────────────
// 기본 모드가 track(실측 40건·약 2분·스토어 적재)이라, 오타·--help가 그대로 측정으로 흘러가면
// naver-ranks.json에 원치 않는 이력이 쌓인다(2026-09-10 통합 검증에서 실제 발생). 아는 인자만 통과시킨다.
const KNOWN_FLAGS = new Set(['--dry-run', '--help', '-h']);
const KNOWN_PREFIXES = ['--mode=', '--query=', '--file=', '--limit='];

function usage() {
  return `사용법:
  node scripts/naver-rank-check.mjs                    # 전체 측정(track) → src/data/naver-ranks.json 적재
  node scripts/naver-rank-check.mjs --limit=5          # 상위 5건만
  node scripts/naver-rank-check.mjs --query="..."      # 단건 조회(적재 X)
  node scripts/naver-rank-check.mjs --dry-run          # 측정만 하고 적재 생략
  node scripts/naver-rank-check.mjs --mode=scout --query="..."   # 정찰(적재 X, stdout JSON)
  node scripts/naver-rank-check.mjs --mode=scout --file=<경로>   # 정찰 여러 건(상한 ${MAX_SCOUT_PER_RUN})
  node scripts/naver-rank-check.mjs --help`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  const unknown = args.filter(
    (a) => !KNOWN_FLAGS.has(a) && !KNOWN_PREFIXES.some((p) => a.startsWith(p)),
  );
  if (unknown.length > 0) {
    console.error(`[rank] 알 수 없는 인자: ${unknown.join(' ')} — 측정하지 않고 종료한다.`);
    console.error(usage());
    process.exit(2);
  }
  const dryRun = args.includes('--dry-run');
  const mode = args.find((a) => a.startsWith('--mode='))?.slice(7) ?? 'track';
  const one = args.find((a) => a.startsWith('--query='))?.slice(8);
  const file = args.find((a) => a.startsWith('--file='))?.slice(7);
  const limit = Number(args.find((a) => a.startsWith('--limit='))?.slice(8)) || MAX_PER_RUN;

  if (!['track', 'scout'].includes(mode))
    throw new Error(`알 수 없는 --mode=${mode} (track|scout)`);

  await Promise.all([loadSisterHosts(), loadRegionNames()]);

  if (mode === 'scout') {
    const queries = one ? [one] : file ? await loadQueryFile(file) : [];
    if (queries.length === 0)
      throw new Error('scout 모드는 --query="..." 또는 --file=<경로>가 필요하다');
    const out = await runScout(queries);
    console.log(JSON.stringify(one ? out[0] : out, null, 2));
    return;
  }

  if (one) {
    console.log(JSON.stringify(await measure(one), null, 2));
    return;
  }

  const targets = await loadTargets();
  if (targets.length === 0) {
    console.log('[rank] 측정 대상 없음 — docs/ops/rank-targets.json에 추가하거나');
    console.log('       포스트 JSON에 targetQuery 필드를 넣어라.');
    return;
  }

  const batch = targets.slice(0, Math.min(limit, MAX_PER_RUN));
  console.log(`[rank] ${batch.length}건 측정 (전체 ${targets.length}건, 요청 간 ${DELAY_MS}ms)`);

  const date = kstDate();
  const store = await loadStore();
  const results = [];
  let failed = 0;

  for (const [i, t] of batch.entries()) {
    try {
      const m = await measure(t.query);
      if (!m.parseOk) {
        console.warn(`  ⚠ 파싱 실패: ${t.query} — SERP 구조 변경 의심`);
        failed++;
      } else {
        record(store, date, m);
        results.push(m);
        const pos = m.rank ? `${m.rank}위/${m.webDocCount}` : m.onPage ? '블록밖 노출' : '미노출';
        const d = delta(store.byQuery[t.query]);
        const lens = `open ${m.openSlots}·gov ${m.mainGovAbove}·press ${m.pressAbove}·off ${m.webDocOffset ?? '-'}%`;
        console.log(
          `  ${String(i + 1).padStart(2)}. ${pos.padEnd(12)} ${t.query}${d ? `  — ${d}` : ''}  [${lens}]`,
        );
      }
    } catch (e) {
      console.warn(`  ⚠ ${t.query}: ${e.message}`);
      failed++;
    }
    if (i < batch.length - 1) await sleep(DELAY_MS);
  }

  const ranked = results.filter((r) => r.rank != null);
  const top3 = ranked.filter((r) => r.rank <= 3).length;
  // 상업 사이트가 0건인 쿼리 = 기관 도메인이 블록을 채운 자리. 글을 고칠 게 아니라 버릴 자리다.
  const noRoom = results.filter((r) => r.commercialCount === 0).length;
  const t1open = results.filter((r) => r.verdictT1 === 'open').length;
  const t2open = results.filter((r) => r.verdictT2 === 'open').length;
  const offClosed = results.filter((r) => (r.webDocOffset ?? 0) >= OFFSET_CLOSED).length;
  console.log(
    `\n[rank] 노출 ${ranked.length}/${results.length} · 3위 이내 ${top3} · ` +
      `진입 불가(상업 0건) ${noRoom}건${failed ? ` · 실패 ${failed}` : ''}`,
  );
  console.log(
    `[rank] 공백 렌즈: T1 열림 ${t1open} · T2 열림 ${t2open} · 오프셋 ≥${OFFSET_CLOSED}% ${offClosed}건`,
  );
  if (ranked.length) {
    const avg = Math.round((ranked.reduce((s, r) => s + r.rank, 0) / ranked.length) * 10) / 10;
    console.log(`[rank] 평균 순위 ${avg}위 (웹문서 블록 기준)`);
  }

  if (dryRun) {
    console.log('[rank] --dry-run — 적재 생략');
    return;
  }
  if (results.length === 0) {
    console.log('[rank] 유효 측정 0건 — 적재 생략');
    return;
  }

  store.updatedAt = new Date().toISOString();
  await writeFile(OUT_FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  console.log(
    `[rank] 적재 완료 → src/data/naver-ranks.json (쿼리 ${Object.keys(store.byQuery).length}개)`,
  );
}

main().catch((e) => {
  console.error('[rank] 실패:', e.message);
  process.exit(1);
});
