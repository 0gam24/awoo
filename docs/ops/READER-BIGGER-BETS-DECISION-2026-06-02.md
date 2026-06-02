# Reader Bigger Bets 결정 (2026-06-02)

대상: awoo.or.kr 정부 지원금 안내 사이트(Astro 6 + Cloudflare). 독자 화면 구조 리뷰(부분 타당 7/10)의 Must Fix·Quick Wins는 배포 완료. 남은 "Bigger Bets" 5건의 방향을 결정한다.

근거: 모든 베팅의 currentState를 repo로 직접 검증했고 주장은 모두 정확함을 확인. 일부 라인번호 오기(cta-dedup의 rail "829"→실제 859 등)는 분석 내에서 자가수정됨.

판단 기준: reader impact 높고 effort·risk 낮은 것 우선, 1인 운영 지속가능성(빌드타임·문서·CSS 선호 / 추가 client JS 경계), 과확장 방지.

## 결정 요약

| 베팅 | impact | effort | risk | 결정 | 채택 접근 |
|---|---|---|---|---|---|
| pill-hub-fit | high | M | low | **do-now** | (c) hub 1:N 확장 + pill 라벨 정합 |
| tel-links | high | S | low | **do-now** | 옵션1 화이트리스트+지역번호 패턴 |
| sidebar-sticky | medium | S | low | **do-now** | 옵션1 CSS-only sticky + 데이터 연동 |
| tldr-corefacts-role | medium | S | low | **do-now** | 옵션2 문서규칙 + lint warn |
| cta-dedup | medium | M | medium | **do-later** | 옵션1 역할분리(1단계부터 증분) |

---

## 1. pill-hub-fit — do-now (high / M / low)

**현황(검증):** `_history.json` byTerm은 term당 단일 postSlug만 보관, `topics/[term].astro:74-88` getStaticPaths는 이 postSlug 하나로만 post를 찾아 본문에 단일 카드만 렌더(:272-288 post-link-card). 그러나 실제 자산은 1:N — `freshness.trendingTerm` 집계 시 "피해지원금"=7건, "장애인 평생교육이용권"=2건. top1 pill "피해지원금"(65건/7일)이 hub에서 6건의 내부 분석글을 누락. spoke 포스트에 listing 필드(title·metaDescription·category·date·tldr) 모두 존재해 1:N 구현 가능. (postsByDate는 이미 :55-64에서 전체 로드됨 — 추가 glob 불필요.)

**결정:** 옵션(c) — (a)를 핵심으로, (b) 라벨 정합 병행.
1. getStaticPaths에서 postsByDate 전체 순회 → `p.freshness?.trendingTerm===term` 포스트를 날짜 desc로 relatedPosts 배열 집계, props 추가(기존 단일 post는 첫 요소로 호환).
2. 본문 post-link-card를 relatedPosts.map 리스트로 교체(0건=기존 fallback-pack 경로, 1건=현재와 동일 단일 카드, 2건+=추가 카드 compact).
3. collectionSchema items에 relatedPosts 전체 url 반영.
4. NewsHero 라벨/문구를 hub 실보유 '관련 글 N개'로 정합(과대약속 제거).
5. `_history.json`·MANUAL-POSTING 워크플로는 손대지 않음 — 빌드타임 집계라 향후 발행 자동 반영(운영부담 0).

**근거:** 기대-실현 불일치를 가장 직접 해소, 내부링크 6~7개 확보(SEO·체류). 데이터 마이그레이션·발행 워크플로 변경 0이 1인 운영에 최적.

## 2. tel-links — do-now (high / S / low)

**현황(검증):** 본문/FAQ/topic은 공유 렌더러 `inline-markdown.ts:47-80`을 통해 출력되나 tel 처리 없음(escape→code/링크/bold/italic만). coreFacts는 별도 highlightFact 경로(slug.astro:144)로 renderInlineMarkdown 미경유. 데이터에 전화번호 43건(1577-1000·129·032-930-3114·'☎054-830-6114'·prose 괄호삽입형 '고객센터(1577-1000)'). 3자리 단축번호 129는 prose 수량 숫자와 충돌 가능.

**결정:** 옵션1 — 화이트리스트+지역번호 패턴.
- renderInlineMarkdown에서 링크 치환 이후·code 복원 이전에, 단축번호 화이트리스트 RE(1577-1000,1644-2000,129,110,120,125,132,1350 등)와 지역번호 RE(`0\d{1,2}-\d{3,4}-\d{4}`)를 적용해 `<a href="tel:..." class="tel-link">`로 치환. lookbehind/lookahead로 href 속성 내부 숫자·금액·날짜 회피.
- 2차로 coreFacts where 필드도 동일 헬퍼를 highlightFact에서 호출해 일관 적용.
- 발행표준 문서에 신규 콜센터 추가 시 화이트리스트 갱신 노트 1줄.

**근거:** 화이트리스트로 오탐 거의 0, 단일 파일 변경으로 본문·FAQ·토픽 동시 적용, 모바일 원탭 통화 가치 high. (옵션3 수동 백필은 기존 43건 소급 누락이라 기각.)

## 3. sidebar-sticky — do-now (medium / S / low)

**현황(검증):** `.rail`(:1637)은 flex-column gap:12px만, position:sticky 없음 → 긴 글에서 사이드바가 스크롤 밖으로 사라짐(리뷰 #11). rail-card 2장은 정적(/subsidies/, /guide/)으로 post 데이터 미참조(:859-870). body-grid는 1fr 280px, @880px에서 1열 붕괴(:1384-1386) → sticky/scrollspy는 본질적으로 데스크톱 전용. 연동 데이터(relatedSubsidies·officialSource·prevPost/nextPost)는 이미 scope에 있음.

**결정:** 옵션1 — CSS-only sticky + 데이터 연동(scrollspy 없음).
- `.rail`에 `position:sticky; top:80px; align-self:start; max-height:calc(100vh-96px); overflow-y:auto`(top 80px는 기존 scroll-margin-top·sticky topbar와 일치).
- rail-card 2번째(신청흐름)를 post 연동 카드로 교체: relatedSubsidies[0..1] + officialSource + prev/next 미니링크.
- @880px 1열에서 sticky 자연 해제 확인.

**근거:** JS 0줄 — PSI/TBT 무영향, Cloudflare 정적출력 100% 호환, 접근성 리스크 없음. **scrollspy(옵션2 IO)는 skip** — 데스크톱 전용 가치인데 전 사용자 JS 비용, 섹션 3-6개라 한계효용 낮음, 정적사이트 1인운영 단순성과 상충(데이터 근거 생기면 do-later 승격).

## 4. tldr-corefacts-role — do-now (medium / S / low)

**현황(검증):** 중복 실재하나 유형별 편차. 자가진단형(oil-relief-eligibility-check)은 tldr 5개 중 ~4개가 coreFacts 단순 재진술, 정보형(welfare-payment)은 coreFacts 일반화로 자연 분리. 규칙 부재: MANUAL-POSTING L111/L119, POSTING-STRUCTURE L52/L87이 tldr[0] 수치를 강제해 오히려 중복 유도, lint-content.mjs:383-390은 개수·tldr[0] 수치 토큰만 검사(coreFacts↔tldr 중복 감지 없음).

**결정:** 옵션2 — 문서규칙 + lint warn.
1. POSTING-STRUCTURE §3/§5에 역할분리 규칙: coreFacts=4W 사실수치 / tldr=왜·배경·논란·영향. tldr[0]은 변화·이유 문장에 핵심수치 1개를 녹이되 coreFacts 단순복붙 금지.
2. MANUAL-POSTING L111/L119 동일 갱신 + 체크리스트에 'tldr가 coreFacts 복붙 아닌가' 추가.
3. lint-content.mjs tldr 루프에 보수적 중복 휴리스틱 warn(정규화 후 토큰 자카드 ≥0.6 항목 2개+ → warn). 전부 warn 유지로 기존 46건 무차단.

**근거:** 회귀 0, 신규 포스트부터 점진 개선, 자동 가드 결합. **옵션3 런타임 필터는 skip** — AEO speakable/ClaimReview가 tldr[0] 참조라 schema 신호 훼손 위험.

## 5. cta-dedup — do-later (medium / M / medium)

**현황(검증):** 본문 끝 행동유도 6블록 중복 실재 — /subsidies(2~3블록), /personas(2), /guide(2), /quick(2)가 화면 끝에서 반복. rail에는 핵심 전환동선 /quick/이 빠진 진짜 결함 확인(:859-870).

**결정:** do-later, 옵션1(역할분리)을 증분으로.
- **1단계(저위험·즉효):** rail에 /quick/ 5분진단 카드 추가 + rail의 /subsidies/(:863, related-grid와 중복) 제거. → sidebar-sticky가 rail을 먼저 개편하므로 그 직후 이어서.
- **2단계:** next-actions card2/3를 relatedSubsidies[1]??[0]·relatedPersonas[1]??[0]로 인덱스 시프트(빈카드 fallback). 5곳에 회귀범위가 걸쳐 risk medium → 별도 사이클로 분리.
- related-grid slice(1)은 SEO 내부링크 수 영향 측정 후 결정(보류).

**근거:** 중복은 실재하나 effort M·risk medium(빈카드 분기·회귀 범위 넓음)이고 rail이 sidebar-sticky와 겹쳐, 안정화 후 저위험 1단계부터 진행하는 것이 회귀 관리상 합리. **옵션2 통째삭제는 skip**(내부링크 SEO/AEO 신호 급감 위험).

---

## 구현 순서

1. **tel-links** — inline-markdown.ts 단일 파일 격리, 충돌 없음, impact high.
2. **tldr-corefacts-role** — 문서+scripts, 렌더 무영향(병렬 가능).
3. **sidebar-sticky** — [slug].astro CSS+rail. cta-dedup이 같은 rail을 건드리므로 먼저 안정화.
4. **pill-hub-fit** — topics/[term].astro 빌드타임 집계 + NewsHero 라벨(effort M).
5. **(do-later) cta-dedup 1단계** — sidebar-sticky로 rail 개편 직후 /quick/ 추가. 2단계는 별도 회귀 사이클.

## 명시적 Skip (과확장 방지)

- sidebar-sticky 옵션2 IntersectionObserver scrollspy — JS 비용·유지비 대비 한계효용 낮음.
- cta-dedup 옵션2 통째삭제 — SEO/AEO 내부링크 신호 급감.
- tldr-corefacts 옵션3 런타임 필터 — schema 신호 훼손·런타임 한국어 유사도 불안정.
- tel-links 옵션3 수동 백필 — 기존 43건 소급 누락·자동성 없음.
