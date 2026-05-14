# Naver 재인덱싱 운영 런북

> awoo.or.kr가 네이버에서 색인 stuck (235페이지 빌드 vs 3페이지 색인) 상태일 때 운영자가 직접 수행하는 절차.
>
> 자동화 X — Naver Search Advisor 콘솔이 API 미공개. 사람 손이 필요.

## 1. 현황 확인 (5분)

1. [네이버 서치어드바이저 콘솔](https://searchadvisor.naver.com/) 접속
2. **사이트 진단 → 색인 현황**:
   - 색인된 페이지 카운트 vs 색인제외 카운트 확인
   - "유형별 진단 정보"에서 소프트 404·중복 콘텐츠·crawl error 분류
3. **검색 노출 → 검색어 통계** (최근 7일):
   - `site:awoo.or.kr` 외 실제 organic 쿼리에서 클릭이 발생하는지 확인
   - 클릭 0건이면 색인 미달 + 노출 ranking 양쪽 문제 가능성

## 2. 신규 콘텐츠 색인 요청 (10분/주)

1. **수동 색인 요청** (Search Advisor → 요청 → 웹페이지 수집):
   - 우선순위 페이지 5~10건만 제출 (할당량 제한)
   - 신규 발행 영구 이슈 포스트 (최근 7일치) 우선 — `src/data/issues/{date}/*.json`
   - flagship 가이드 (`/guides/*`) — 발행 후 24h 이내 즉시 제출
2. 제출 후 24~72시간 내 결과 통보 — 색인 거부 시 본문 thin 또는 메타 부적합 점검
3. 자동 IndexNow는 awoo가 매일 수행 (Bing/Yandex만). Naver는 제외 (지원 안 함)

## 3. 색인제외 (soft-404·중복) 정리 (운영자 결정)

| 사유 | 조치 |
|---|---|
| soft 404 — 옛 도메인 자료 | Search Advisor → 사이트 진단 → 검색 제외 요청 |
| soft 404 — 본문 thin | `audit:content-depth` 결과 확인 후 본문 보강 또는 noindex |
| 중복 콘텐츠 | canonical 또는 301 redirect (`public/_redirects`) |
| crawl error | robots.txt 점검 (`/api/`만 Disallow) |

**2026-05-11 기준 28건 색인제외는 모두 옛 도메인 잔존물 → 운영자가 검색 제외 요청 완료** (project_naver_soft404_legacy 메모리 참조).

## 4. 메타 개선 사이클 (월 1회)

상위 트래픽 5~10페이지의 `<title>` / `<meta description>`를 점검:

| 페이지 | 현재 상태 | 점검 포인트 |
|---|---|---|
| `/` (홈) | `지원금가이드 — 나에게 맞는 정부 지원금 찾기` | 검색 쿼리와 매칭 ✓ |
| `/subsidies/` | `정부 지원금 N개 둘러보기 — 지원금가이드` | 동적 카운트로 freshness 신호 ✓ |
| `/quick/` | `5분 만에 받을 수 있는 지원금 찾기` | 사용자 쿼리 "나에게 맞는 정부 지원금 찾기" 매칭 ✓ |
| `/guide/` | `정부 지원금 신청 가이드 2026 — 처음 신청자용 단계별 안내` | Cycle #87 보강 (year + intent 강화) |
| `/personas/` | `페르소나별 지원금 — 사회초년생·자영업·신혼·중장년·저소득·농업` | 페르소나 키워드 다중 ✓ |

신규 페이지 발행 시:
- title 60자 이내, 자연 한국어 (콜론·대시 클리셰 금지)
- description 120-160자, 핵심 정보 + 행동 유도
- year/keyword를 자연스럽게 포함 ("2026년 기준" 등)

## 5. 네이버 특화 신호 점검 (분기 1회)

- **naver-site-verification**: `BaseLayout.astro`에 인라인 — 이미 등록됨
- **NaverBot / Yeti / DaumBot**: `public/robots.txt`에 명시적 Allow — 이미 적용됨
- **Sitemap**: `https://awoo.or.kr/sitemap-index.xml` 자동 갱신 (daily/weekly/monthly priority 차등화)
- **Google News sitemap**: `/sitemap-news.xml` (Naver도 참고)
- **JSON-LD**: Organization + WebSite + BreadcrumbList + GovernmentService — sitelinks·entity 신호

신호 양호. 색인 부진은 메타·신호 부족이 아니라 **사이트 신규성 + 도메인 권위** 문제일 가능성.

## 6. 외부 backlink 모니터링 (분기 1회)

서치어드바이저 "콘텐츠를 링크한 도메인 TOP 10"에서:

| 패턴 | 대응 |
|---|---|
| `allerxmall.co.kr` 등 의외 대량 backlink (300+) | 스팸 farm 가능성 — 무시 (Naver는 disavow 도구 X) |
| `tistory.com` / `naver.com` / 일반 매체 | 정상 — 자연 인용 |
| story.kr / inforstory.co.kr 등 farm 패턴 | 모니터링만, 패턴 누적 시 운영자 검토 |

스팸 farm 다수는 도메인 권위에 부정 신호일 수 있으나 Naver는 disavow 미지원 — 콘텐츠 품질을 끌어올리는 방식으로 상대화하는 게 정공법.

## 7. 다음 점검 일정

- **이번 주**: 신규 flagship 가이드(`/guides/subsidy-application-checklist/`) 색인 요청 — Cycle #87 발행 직후
- **다음 주**: fact-checker normalizer (Cycle #87) 적용 후 발행 처리량 회복 측정 → 신규 영구 포스트 색인 요청
- **월 1회**: 메타 개선 사이클
- **분기 1회**: 네이버 특화 신호 + backlink 모니터링

## 참고

- 사이트 진단: https://searchadvisor.naver.com/
- 색인 요청: https://searchadvisor.naver.com/console/site/request/crawl
- 검색어 통계: https://searchadvisor.naver.com/console/board/keyword
