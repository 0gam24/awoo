# 독자 화면 구조 리뷰 종합 (awoo.or.kr 이슈 포스트 상세)

- 평가일: 2026-06-02
- 평가 범위: 렌더링되어 독자에게 보이는 읽기 경험만 (JSON-LD/schema/SEO 메타 제외)
- 대상 파일: `src/pages/issues/[date]/[slug].astro`, `src/layouts/BaseLayout.astro`, `src/styles/global.css`, `src/components/Container.astro`, `src/lib/inline-markdown.ts`, 데이터 `src/data/issues/2026-06-01/oil-relief-objection-surge-2026-06-01.json`
- 6개 관점 리뷰 + 코드 직접 검증 종합

## 종합 판정: 부분 타당(개선 권장) · 독자 경험 점수 7/10

현재 구조는 정보 모델과 기본기가 탄탄해 "타당"하다. 단, above-the-fold의 핵심 답 도달, coreFacts 숫자 강조, 신청 절차 시각화, 공식 신청처 링크 부재, 중첩 main 등 **독자 전환·스캔에 직접 영향을 주는 결함**이 명확해 개선이 필요하다. 6개 리뷰 모두 `partial` 판정으로 일치하며, 코드 검증 결과 제기된 evidence는 대부분 사실로 확인됐다.

## 관점별 요약

| 관점 | 판정 | 핵심 강점 | 핵심 문제(최고 severity) |
|---|---|---|---|
| 정보 위계·스캔성 | partial | coreFacts 4질문 매핑, ToC 자동 | 핵심 답이 hero 4번째로 밀림 / 숫자 강조 없음 (high) |
| 가독성·모바일 | partial | keep-all 전역, 표·grid 반응형 | 본문 줄길이 과대(>880px) / 탭 타깃 44px 미달 (medium) |
| 접근성(a11y) | partial | skip-link·focus·reduced-motion·표 semantics | 중첩 main 2개 (high) |
| 신뢰·전환 | partial | 편집책임자 실명·출처 카드 | 공식 신청처 클릭 링크 화면 부재 (high) |
| 참여·내비게이션 | partial | dead-end 없는 다층 동선 | 사이드바 비-sticky·정적 / pill-hub 기대 불일치 (medium) |
| 컴포넌트 렌더 | partial | tldr·출처·관련카드 완성도 | HowTo 단계가 줄글 렌더 (high) |

## 강점 (이미 잘 된 것 — 유지)

- **정보 모델 정확**: coreFacts(대상/금액/기간/신청)가 '내가 받나·얼마·언제까지·어떻게'에 1:1 매핑, hero 상단 배치 (`[slug].astro:605-610`).
- **한국어 가독 기본기**: `word-break:keep-all` + `overflow-wrap:break-word` 전역(`global.css:251-252`), `.prose` 16px/1.7, `.lead` 17px/1.55. 표 `overflow-x:auto`, coreFacts·body-grid 880px 1열 전환.
- **접근성 토대**: skip-link(`BaseLayout:183`), `:focus-visible` 2~3px, `prefers-reduced-motion` 전역+pulse 차단, 표 `caption`/`th scope`, 섹션 앵커 맥락 aria-label, `--text-2` WCAG AA, `.sr-only` 유틸 존재(`global.css:299`).
- **탐색 동선**: ToC(섹션 3+ 자동)·관련 지원금·다음 단계 4카드·이전/다음 포스트·모바일 sticky CTA·토픽 hub pill 모두 실제 렌더 — 막다른 길 없음.
- **신뢰 단서 가시화**: H1 직후 편집책임자 실명·Fact-check·편집정책, 출처 'N곳 매체 N건 종합' 카드, thin post 자동 noindex.

## 문제 (severity 우선순위)

### High — 독자 이탈/전환 직결

1. **핵심 답이 above-the-fold에서 밀림** — DOM 순서 meta(배지6)→H1→ai-disclosure→tldr(5불릿)→core-facts→toc. 사용자가 온 목적(자격/금액/마감)이 AI고지·요약 뒤 4번째. 모바일 첫 스크롤에서 '25만원·마감일'을 못 봄. (`[slug].astro:571-610`)
2. **coreFacts 숫자 강조 부재** — `.val` 일괄 15px/600. amount='피해지원금 1인당 최대 25만원(소득·가구별 차등)…', who 40자+ 문장. 핵심 숫자가 긴 문장에 묻혀 카드의 즉답 기능 상실. (`:606-609, 1347`)
3. **신청 절차 HowTo 줄글 렌더** — 데이터 '**1단계: 탈락 사유 확인** — …'가 `paragraphsAndLists`의 `\n\n` 분리로 평범한 `<p><strong>` 단락이 됨. 단계 수·순서를 한눈에 못 셈. `stepRegex`(`:341`)는 schema에만 쓰임. (`:659-668`, `inline-markdown.ts:90`)
4. **공식 신청처 클릭 링크 화면 부재** — coreFacts 신청 셀은 plain text div. `relatedSubsidies[0].applyUrl`은 JSON-LD `potentialAction`에만(`:256-281`) 존재하고 화면 미렌더. 독자가 실제 행동(신청·조회)할 대상이 없어 사이트 이탈 후 재검색. (`:609`)
5. **중첩 main(접근성 위반)** — `BaseLayout:185 <main id="main">` 안에 `[slug].astro:647 <main class="body">` 중첩. 문서당 main 1개 원칙 위반, SR landmark 탐색 시 본문 시작점 모호.

### Medium

6. 본문 줄길이 과대 — `.prose`에 max-width 없음. 880px 이상 단일 컬럼에서 본문이 컨테이너 1200px(`Container.astro:29`) 전폭 → 한 줄 80~100자, 한국어 권장 크게 초과. (`:1400`)
7. 탭 타깃 44px 미달 — `.share-btn` min-height 28px(`:1228`), `.freshness-pill`·`.cat-pill` 소형, `.meta` gap 8px로 인접 오터치. WCAG 2.5.5/2.5.8 미달.
8. tldr↔coreFacts 정보 중복 — tldr[3]=신청, tldr[4]=기간이 coreFacts와 직접 중복(데이터 확인). hero가 길어지고 스캔 지연.
9. coreFacts 4박스 높이 들쭉날쭉 — `.fact`에 등높이 없음. who 3줄 wrap, 금액·기간은 짧아 미완성 인상.
10. coreFacts 필드 무가드 — `{post.coreFacts.who}` 직접 출력, 빈 값 시 라벨만 뜬 빈 박스(다른 블록은 가드 있음).
11. 사이드바 비-sticky·정적 — `.rail` 고정 2카드, post 데이터 미참조, sticky 없어 스크롤 시 사라짐.
12. 트렌딩 pill↔hub 기대 불일치 — '65건 보도' 기대 vs hub 내부 분석글 1건만 링크.

### Low

13. 소형 pill 색 대비 미검증 — `rt-issue-followup`(#ec4899)·`freshness-pill` 12~13px bold 유채색 on 저투명 동색 배경, prefers-contrast:more 미적용.
14. FAQ 전부 접힘·어포던스 약함 — `<details>` 기본 닫힘, open/아이콘 없음.
15. AI 고지 모바일 레이아웃 — `.ai-policy { margin-left:auto }` 줄바꿈 시 어긋남, 링크 탭 영역 작음.
16. 넘침 표 스크롤 신호 부재 — `overflow-x:auto`만, 페이드/힌트 없음(다열 표 위험).
17. 새 탭 링크 SR 사전고지 없음 / 공유 상태 별도 live region 미분리 / sec-anchor hover 의존.
18. 글 끝 다음행동 목적지 4~5회 중복(결정 피로).
19. AI 작성 고지 위치가 YMYL 첫인상에서 신뢰 영향 가능 / Fact-check % 근거 라벨 부재.

## 우선순위 개선안

### 즉시(Quick Wins, S)
- `.prose`/`.body`에 max-width 38~42em(640~720px) — hero와 통일 (`:1349-1356, 1400`).
- `.share-btn` min-height 44px, 모바일 `.meta` gap 10~12px (`:1219-1230, 1040-1046`).
- 출처 카드에 `<span class="sr-only">(새 창)</span>` (`:763`).
- coreFacts val 빈 값 폴백 `{post.coreFacts.who || '확인 필요'}` (`:606-609`).
- tldr·core-facts 앞 `<h2 class="sr-only">` (`:597-610`).
- FAQ 첫 항목 open + summary 토글 아이콘 (`:742, 1525-1534`).
- 전화번호 tel: 링크화 (`inline-markdown.ts`).

### 핵심(Must Fix)
- hero DOM 재배치: meta→H1→**core-facts**→tldr→ai-disclosure→toc.
- coreFacts 숫자/마감 시각 강조 2단 구조(핵심 숫자 큰 글씨 + 보조 텍스트).
- HowTo 단계 시각 컴포넌트 렌더(`stepRegex` 파싱 결과 재사용, 신청 섹션 한정).
- 공식 신청처 클릭 버튼 가시 렌더(`applyUrl`/정부 URL).
- `[slug].astro:647` `<main class="body">` → `<div class="body">`.

### 구조 개선(Bigger Bets, M)
- tldr=맥락 / coreFacts=수치 역할 분리(데이터 생성 룰).
- 사이드바 sticky + 콘텐츠 연동(미니 ToC scrollspy·관련 지원금·이전/다음).
- 트렌딩 pill↔hub 기대 정합(getStaticPaths 1:N 또는 라벨 변경).
- 글 끝 다음행동 중복 정리(목적별 1개).
- 소형 pill 색 대비 보정 + prefers-contrast 분기.

## 충돌·중복 조정 노트
- '핵심 답을 위로' vs 'AI 고지가 신뢰 프레이밍이라 위에 있어야' → 고지는 H1 옆 얇은 한 줄로 유지하되 prime 면적은 coreFacts에 양보(절충).
- hero meta 배지 정리(위계 관점)와 탭 타깃 확대(가독성 관점)는 같은 `.meta` 영역 — 한 번에 처리 권장.
- coreFacts 등높이/폴백/숫자강조는 동일 컴포넌트 — 묶어서 S~M 1건으로 처리.
