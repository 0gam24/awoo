# awoo.or.kr 단일 우선순위 운영 로드맵 (2026-06-01)

> 종합 대상: 5개 관점(트렌딩 freshness / 콘텐츠 운영 / SEO·GEO / 애널리틱스 KPI / 링크 무결성) 멀티에이전트 분석 충돌조정·중복제거
> 운영자: 김준혁(1인). 코드 변경은 Claude가 diff 제안, 운영자가 검증·머지.
> 원칙: **P0 = 이번 '피해지원금' 버그(트렌딩 링크가 한 달 전 무관 글로 감) 재발 방지와 직결되는 것 우선.**
> 진행 상태(2026-06-01 기준): QW-1·QW-2(잔존 버그 3곳)·QW-3(lint 무결성 게이트) **완료/배포**. 아래 나머지는 후속.

---

## 0. 북극성 지표 (North-star)

**주간 유기적 검색 세션 → `apply_outbound`(외부 신청처 이동) 전환수**

- 근거: 사이트의 유일한 실질 가치는 "검색 유입 사용자가 실제 정부 지원금 신청처로 이동"하는 것. 이 한 지표가 (a) SEO/GEO 유입 = 분자 증가, (b) 콘텐츠 적합도 = 전환율을 동시에 압축하고, (c) 1인 운영의 발행 토픽 선정을 후행 정렬시킨다.
- 보조지표: GSC·네이버 색인 페이지수, 유기검색 세션, 트렌딩 카드 CTR, 매칭카드 CTR, reportType별 포스트 유입.
- 측정 전제: `apply_outbound` 이벤트(현재 0건) 계측 + 주간 리뷰 SOP 문서화. 둘 다 아래 로드맵에 포함.

---

## 1. 핵심 진단 (repo 실측 검증 완료)

| 사실 | 근거 |
|---|---|
| NewsHero는 `postDate ?? firstSeen` 적용됨(수정 완료) | `src/components/home/NewsHero.astro` |
| topic hub도 firstSeen→postDate로 통일(이번에 수정) | `src/pages/issues/topics/[term].astro` L77·L203·L273 |
| OtherIssuesSection도 통일(이번에 수정) | `src/components/home/OtherIssuesSection.astro` findPostUrl |
| sync-issues는 `_history.json` read-only(write-back 없음) → daysActive/totalCount 동결 | `scripts/sync-issues.mjs` loadHistory만, OUT_PATH만 write |
| lint-content에 `_history` 무결성 게이트 신설(이번에 추가) | `scripts/lint-content.mjs` |
| `audit:links`는 있으나 항상 exit 0, CI 미연결 | `scripts/internal-link-audit.mjs`, `package.json` |
| `lint:content`는 CI 게이트 | `.github/workflows/ci.yml` |
| sync-issues.yml은 `git add src/data/issues/` 포함 → _history write-back 시 자동 커밋됨 | `.github/workflows/sync-issues.yml` |
| IndexNow 키 미설정 → ping 전면 skip | `indexnow.yml`, `sync-issues.yml` |
| gtag('event') 0건(페이지뷰만) | repo 전역 (GA4·네이버는 2026-06-01 설치) |

**근본 원인:** term→포스트 매핑의 진실 소스가 '운영자 수기 _history.json'이고, (1) 매핑 갱신이 수동·문서 절차에도 없음, (2) 3개 렌더 표면의 날짜 기준 불일치, (3) 빌드 게이트에 무결성 검사 부재 → 드리프트가 조용히 배포됨.

---

## 2. Quick Wins (오늘~내일) — 재발 즉시 차단

### QW-1 [P0] ✅ topic hub 날짜 기준 통일 — 완료
- `src/pages/issues/topics/[term].astro`: `HistoryEntry`에 `postDate?` 추가, L77 find는 `postDate ?? firstSeen`, URL은 찾은 글의 `post.date` 사용.

### QW-2 [P0] ✅ OtherIssuesSection 날짜 기준 통일 — 완료
- `src/components/home/OtherIssuesSection.astro` findPostUrl: `postDate ?? firstSeen`.

### QW-3 [P0] ✅ lint-content 무결성 게이트 — 완료
- `scripts/lint-content.mjs`: `byTerm` 전 엔트리의 `{postDate ?? firstSeen}/{postSlug}` 포스트 실존 검사, 미존재 시 exit 1. ci.yml lint:content 게이트에 자동 편입.

### QW-4 [P0] IndexNow 키 활성화(즉시 색인) — **운영자 액션 필요**
- 키 생성: `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`
- `public/<KEY>.txt`에 키 한 줄 커밋 + GitHub Secret `INDEXNOW_KEY` 등록(indexnow.yml·sync-issues.yml 참조) + 로컬 `.env.local` 동일 값
- 검증: `npm run build && npm run indexnow:ping` (200/202)
- 주의: public/<KEY>.txt 값과 Secret 값 반드시 동일(불일치 시 403)

---

## 3. This Week — freshness 자동화 + 계측 시작

### W-1 [P0] sync-issues.mjs _history write-back (누적 시그널 해소)
- 위치: main()의 OUT_PATH `writeFile` 직후
- 각 term의 `byTerm[term]` 머지: `firstSeen` 보존, `lastSeen=todayKST`, `dailyCounts[todayKST]=count`(**덮어쓰기·멱등**), `totalCount=ΣdailyCounts`, `daysActive=Object.keys(dailyCounts).length`
- **`postSlug`/`postDate`/`reportType`은 spread로 보존(절대 덮어쓰지 않음)** → `writeFile(HISTORY_PATH, ...)`
- 검증: `npm run sync:issues` 2회 → 이중 가산 없음 확인

### W-2 [P0·근본해결] scripts/sync-history.mjs 신설 (매핑 단일 진실 소스화)
1. `src/data/issues/*/*.json` 전수 스캔(walkIssues 재사용)
2. 포스트별 term: `freshness.trendingTerm` 우선, 없으면 tags 매칭
3. term별 date desc 최신 1건의 `postSlug`/`postDate` 채택
4. 카운트는 기존값 보존 머지 → `writeFile(HISTORY_PATH, ...)`
- `package.json`에 `"sync:history": "node scripts/sync-history.mjs"`
- `sync-issues.yml`: **sync:issues → sync:history → lint:content** 순서 호출
- 효과: 운영자가 _history를 손으로 고치는 작업 **영구 제거**

### W-3 [P0] 전환 클릭 3종 gtag event 계측
- CSP 이미 `unsafe-inline` → 인프라 불필요. **한글 값 escape 안전을 위해 `data-*` 속성 + `addEventListener` 패턴 권장**(인라인 onclick 따옴표 깨짐 회피)
- `src/pages/subsidies/[id].astro` 외부 CTA → `apply_outbound {subsidy_id, category, agency}`
- `NewsHero.astro` 트렌딩 링크 → `trending_click {term, tier, rank}`
- NewsHero nm-card 매칭카드 → `matched_subsidy_click {subsidy_id}`
- 검증: `npm run build` → GA4 DebugView 수신 + `npm run lint:content` 통과

### W-4 [P1] ANALYTICS-KPI SOP 문서화
- `docs/ops/ANALYTICS-KPI.md` 신규: 북극성 정의, 보조지표 표, 주간 리뷰 체크리스트, '상위 트렌딩 term → 다음 수동 발행 토픽 승격' 규칙, 네이버 vs 구글 채널 분리. `MEMORY.md` 등록.

---

## 4. This Month — 회귀 백스톱 + 운영 표준화

- **M-1 [P1]** `internal-link-audit.mjs`에 `--strict`(dangling>0 시 exit 1) 추가 → `ci.yml` Build 뒤 `npm run audit:links -- --strict`. 단, **먼저 현 상태 audit 0건 확인 후 승격**(기존 dangling으로 main red 방지). orphan은 warn 유지.
- **M-2 [P1]** lint-content 신선도 가드: today-issue.json trending term 교차 → 현재 트렌딩인데 postDate가 today-30일 초과면 `warn`.
- **M-3 [P1]** 발행 cadence 표준화(`docs/ops/MANUAL-POSTING.md` §8D 아래): (월) evergreen weekly 6축 spoke 3~5건+hub, (목) spoke 2~3건, 그 외엔 daysActive≥3 OR publisherCount≥4 OR matchedCount≥1 강신호 시에만 issue-followup 1건.
- **M-4 [P1]** MANUAL-POSTING STEP 8의 수기 _history 갱신 → `npm run sync:history` 1줄로 교체, STEP 5 게이트에 lint:content(무결성 가드) 명시.
- **M-5 [P1]** GA4 콘텐츠 차원: page_view에 content_type(issue|subsidy|home)·reportType·trendingTerm·category 커스텀 파라미터, GA4 콘솔 custom dimension 등록.
- **M-6 [P2]** 트렌딩 카드 impression(IntersectionObserver→`trending_impression`)으로 CTR 분모, sitemap-news.xml을 sitemap-index에 명시 등록, `PERPLEXITY_API_KEY`로 citations.yml GEO 인용 복구, sync-issues output에 `suggestedReportType`.

---

## 5. 구조 변경 요약 (트렌딩→포스트 freshness 자동화)

```
[현재] 운영자 손 → _history.json (수동·이원화·드리프트)
                       ↓ read-only
            NewsHero / hub / OtherIssues (날짜 기준 불일치)  ← (3곳 통일 완료)

[목표] 발행 포스트(freshness.trendingTerm) = 권위 소스
   sync-issues.mjs  → _history 카운트 write-back            [소유: 카운트]
   sync-history.mjs → _history 매핑(postSlug/postDate) derive [소유: 매핑]
   (실행 순서: sync-issues → sync-history → lint:content)
                       ↓ (postDate ?? firstSeen 단일 규칙)
   NewsHero / topics[term] / OtherIssues  ← 가능 시 src/lib 공용 헬퍼로 추출
                       ↑ 빌드 게이트
   lint-content (_history↔파일 무결성 + 신선도) + ci audit:links --strict
```

핵심 변경 6가지:
1. 매핑 진실 소스를 수기→파일시스템 derive(sync-history.mjs)로 전환 → 매일 손작업 영구 제거
2. sync-issues를 read-only→write-back(멱등 카운트 누적)
3. lint-content에 무결성 게이트 신설(✅) + 신선도 가드(후속)
4. 3개 표면 날짜 기준을 postDate 우선으로 단일화(✅, 가능 시 공용 헬퍼로)
5. internal-link-audit --strict를 CI 게이트로 승격
6. GA4 전환 이벤트+콘텐츠 차원으로 ROI 피드백 루프 신설

---

## 6. 리스크 및 완화

| 리스크 | 완화 |
|---|---|
| sync-issues write-back totalCount 이중 가산 | dailyCounts[todayKST] 덮어쓰기 + totalCount=ΣdailyCounts 멱등 설계 |
| sync-issues(카운트) vs sync-history(매핑) 소유권 혼선 | 키 경계 주석·머지로직 명시, 실행 순서 sync-issues→sync-history 엄수 |
| lint 무결성 가드가 레거시 엔트리로 빌드 차단 | (현재 전 엔트리 통과 확인됨) 향후 도입 항목은 sync-history derive로 정합화 후 활성화, 신선도는 warn으로 시작 |
| IndexNow public/<KEY>.txt와 Secret 불일치 → 403 | 커밋 전 값 일치 확인 |
| gtag 인라인 한글 값 escape 깨짐 → 무음 실패 | data-* + addEventListener 패턴 권장 |
| audit --strict 즉시 CI red | 현 상태 audit 0건 확인 후 게이트 승격 |
| 1인 리소스 한계 동시 진행 누락 | Quick wins 먼저 머지·배포(완료) → 그 후 자동화 |

---

## 7. 실행 순서 (권장)

1. **오늘(완료):** QW-1·QW-2(잔존 버그 3곳)·QW-3(lint 게이트) → 빌드·배포로 재발 즉시 차단
2. **내일:** QW-4(IndexNow 키 — 운영자 시크릿)
3. **이번 주:** W-1(write-back) → W-2(sync-history) → W-3(계측) → W-4(KPI 문서)
4. **이번 달:** M-1~M-6
