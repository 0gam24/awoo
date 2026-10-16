// 네이버 검색광고 API — 키워드 도구(/keywordstool).
// 검색어마다 한 달 실제 검색 수(PC·모바일), 평균 노출 광고 수(plAvgDepth), 광고 경쟁 정도(compIdx)를 준다.
// 데이터랩은 상대값이고 웹문서 검색 API는 웹문서 칸 안의 순서만 줘서, 통합검색 화면에서 웹문서가 얼마나
// 밀리는지 모른다. 광고가 많이 붙는 검색어는 맨 위가 광고로 채워진다(2026-10-15 운영자 눈 확인:
// "소상공인 지원금"·"고향사랑기부제" 모두 웹문서가 한참 아래).
//
// 키: .env.local의 NAVER_SEARCHAD_CUSTOMER_ID · NAVER_SEARCHAD_ACCESS_LICENSE · NAVER_SEARCHAD_SECRET_KEY
// (발급: searchad.naver.com → 도구 → API 사용 관리). 값은 어디에도 출력하지 않는다.
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'https://api.searchad.naver.com';
export const SEARCHAD_KEYS = [
  'NAVER_SEARCHAD_CUSTOMER_ID',
  'NAVER_SEARCHAD_ACCESS_LICENSE',
  'NAVER_SEARCHAD_SECRET_KEY',
];

/**
 * .env → .env.local → 환경변수 순으로 읽는다. 빈 값은 앞에서 읽은 값을 덮지 않는다
 * (.env.local 끝에 빈 칸을 덧붙여 둔 상태라, 빈 줄이 진짜 값을 지우면 안 된다).
 */
export async function loadSearchAdKeys() {
  /** @type {Record<string, string>} */
  const env = {};
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of (await readFile(join(ROOT, f), 'utf8')).split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m || !SEARCHAD_KEYS.includes(m[1])) continue;
        const v = m[2].trim().replace(/^["']|["']$/g, '');
        if (v) env[m[1]] = v;
      }
    } catch {
      /* 파일이 없으면 환경변수만 쓴다 */
    }
  }
  for (const k of SEARCHAD_KEYS) {
    const v = process.env[k]?.trim();
    if (v) env[k] = v;
  }
  return {
    customerId: env.NAVER_SEARCHAD_CUSTOMER_ID,
    accessLicense: env.NAVER_SEARCHAD_ACCESS_LICENSE,
    secretKey: env.NAVER_SEARCHAD_SECRET_KEY,
    missing: SEARCHAD_KEYS.filter((k) => !env[k]),
  };
}

/** 검색광고 API 서명 — HMAC-SHA256(비밀키, "타임스탬프.메서드.경로")를 base64로 */
function sign(secretKey, timestamp, method, uri) {
  return createHmac('sha256', secretKey).update(`${timestamp}.${method}.${uri}`).digest('base64');
}

/** 월간 검색 수 — 10 미만은 API가 "< 10"으로 준다. 숫자 계산용으론 5로 둔다 */
function count(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  if (/^<\s*10$/.test(s)) return 5;
  return Number(s.replace(/,/g, '')) || 0;
}

// 검색광고 API는 hintKeywords에 공백·기호가 있으면 묶음 전체를 400(11001)으로 돌려보낸다
// (2026-10-16 "근로·자녀장려금 …"의 가운뎃점 하나로 35건이 다 빠졌다). 한글·영문·숫자만 남겨 묻고 같은 꼴로 맞춘다.
const norm = (s) =>
  String(s)
    .replace(/[^0-9a-zA-Z가-힣]/g, '')
    .toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class SearchAdError extends Error {
  constructor(status, body) {
    super(`검색광고 API ${status}: ${body}`);
    this.status = status;
  }
}

/**
 * 검색어별 월간 검색 수·광고 지표. 검색광고 API는 검색어 안 공백·기호를 받지 않아 한글·영문·숫자만 남긴 꼴로
 * 묻고, 돌려받은 연관 검색어 목록에서 같은 꼴 줄만 고른다. 5개씩 묶어 부르고, 묶음이 400이면 하나씩 다시 묻는다
 * (그래도 안 되는 검색어는 null).
 * @param {string[]} queries
 * @param {{ customerId?: string, accessLicense?: string, secretKey?: string }} keys
 * @returns {Promise<Map<string, { query: string, pc: number, mobile: number, total: number, pcRaw: string, mobileRaw: string, adDepth: number | null, competition: string | null } | null>>}
 */
export async function keywordStats(queries, keys) {
  if (!keys.customerId || !keys.accessLicense || !keys.secretKey) {
    throw new Error(
      '검색광고 API 키가 비어 있다 — .env.local의 NAVER_SEARCHAD_* 세 칸을 채워야 한다',
    );
  }
  const uri = '/keywordstool';
  /** @param {string[]} hints */
  const call = async (hints) => {
    const timestamp = String(Date.now());
    const params = new URLSearchParams({ hintKeywords: hints.join(','), showDetail: '1' });
    const res = await fetch(`${BASE}${uri}?${params}`, {
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': keys.accessLicense,
        'X-Customer': String(keys.customerId),
        'X-Signature': sign(keys.secretKey, timestamp, 'GET', uri),
      },
    });
    if (!res.ok) throw new SearchAdError(res.status, (await res.text()).slice(0, 300));
    const data = await res.json();
    return Array.isArray(data?.keywordList) ? data.keywordList : [];
  };
  /** @type {Map<string, any>} */
  const out = new Map();
  const uniq = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 5) {
    const batch = uniq.slice(i, i + 5);
    const hints = [...new Set(batch.map(norm).filter(Boolean))];
    let list = [];
    if (hints.length) {
      try {
        list = await call(hints);
      } catch (e) {
        // 키·서명 문제(401·403)나 서버 오류는 그대로 올린다. 400은 검색어 탓 — 하나씩 다시 물어 나머지를 살린다
        if (!(e instanceof SearchAdError) || e.status !== 400 || hints.length === 1) throw e;
        for (const h of hints) {
          await sleep(300);
          try {
            list.push(...(await call([h])));
          } catch (e1) {
            if (!(e1 instanceof SearchAdError) || e1.status !== 400) throw e1;
          }
        }
      }
    }
    const byKey = new Map(list.map((k) => [norm(k.relKeyword), k]));
    for (const q of batch) {
      const k = byKey.get(norm(q));
      out.set(
        q,
        k
          ? {
              query: q,
              pc: count(k.monthlyPcQcCnt),
              mobile: count(k.monthlyMobileQcCnt),
              total: count(k.monthlyPcQcCnt) + count(k.monthlyMobileQcCnt),
              pcRaw: String(k.monthlyPcQcCnt),
              mobileRaw: String(k.monthlyMobileQcCnt),
              adDepth: k.plAvgDepth == null ? null : Number(k.plAvgDepth),
              competition: k.compIdx ?? null,
            }
          : null,
      );
    }
    if (i + 5 < uniq.length) await sleep(300);
  }
  return out;
}
