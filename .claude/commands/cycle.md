---
description: SEO/GEO 트래픽 성장 운영 사이클 — 다음 phase 자동 실행 (PLAN→REVIEW→EXECUTE→OPERATE→OBSERVE 순환)
---

# /cycle — 운영 사이클 디스패처

사용자가 "사이클" 또는 `/cycle`을 입력했다. 본 명령은 `ops/OPS_CYCLE.md`의 현재 phase를 읽고 **다음 phase**를 실행한다.

## 0. 진행 절차 (모든 phase 공통)

1. `node scripts/cycle-runner.mjs status` 실행 → 현재 phase·다음 phase·cycle_no 확인
2. 아래 해당 phase 섹션의 절차를 그대로 수행
3. 완료 후 `node scripts/cycle-runner.mjs advance` 실행 → 상태 자동 갱신
4. 변경된 파일 스테이지 + 커밋 (푸시 X)
5. 사용자에게 §22-2 보고 형식으로 1줄 요약 + 다음 phase 안내

## 1. PLAN phase — 모든 에이전트 소환

**목표:** SEO/GEO 트래픽 성장 관점의 고급화 제안을 11개 에이전트로 병렬 도출.

**선행 조건:**
- `ops/backlog-external.md` 정독 → 외부 의존·유료 항목은 제안 자체 금지
- 직전 OBSERVE 결과(`ops/observations/{prev-date}.md`)가 있으면 그 인사이트를 모든 에이전트 프롬프트에 컨텍스트로 주입

**실행:** 다음 11개 에이전트를 **단일 메시지에서 병렬 spawn**. 각 에이전트는 `ops/proposals/{TODAY}/{filename}.md` (~300~500자)에 결과 저장 후 한 줄 요약만 반환.

| # | subagent_type | 담당 축 | 산출 파일 |
|---|---|---|---|
| 1 | Explore (medium) | 내부링크 그래프·고립 페이지·딥페이지 | `explore-ia.md` |
| 2 | Explore (medium) | 기존 SEO/GEO 구현 현황 (메타·schema·robots·llms·sitemap) | `explore-seo.md` |
| 3 | Plan | 새 hub 패턴·schema 확장·라우트 추가 아키텍처 옵션 3가지 | `plan-architecture.md` |
| 4 | general-purpose | Technical SEO (canonical·hreflang·structured data·indexing) | `general-tech-seo.md` |
| 5 | general-purpose | Content SEO (키워드 커버리지·롱테일·E-E-A-T 신호) | `general-content-seo.md` |
| 6 | general-purpose | GEO (llms.txt·AI 인용 친화도·BLUF·FOX) | `general-geo.md` |
| 7 | general-purpose | CWV·성능 (LCP·INP 150ms·CLS·번들) | `general-cwv.md` |
| 8 | general-purpose | A11y·BP (WCAG 2.2·target-size·CSP) | `general-a11y-bp.md` |
| 9 | security-review | 자동화/스크립트 보안 영향 | `security-review.md` |
| 10 | review | 최근 5 커밋 회귀 점검 | `review-regression.md` |
| 11 | claude-code-guide | Claude API/SDK prompt-injection·caching 최신 베스트프랙티스 | `claude-api.md` |

**각 에이전트 프롬프트 공통 헤더:**
```
프로젝트: awoo.or.kr (정부 지원금 비영리 정보 사이트, Astro 6 + Cloudflare Workers)
사이클 #{cycle_no} PLAN phase. 단일 KPI: SEO/GEO 트래픽 성장.
제약:
  - 외부 API 등록·결제·계정 가입 등 사용자 손이 필요한 항목 제안 금지 (ops/backlog-external.md 키워드 사전 참조)
  - PSI 4×100 게이트 유지 (Lighthouse 4 카테고리 모두 90+, 모바일 LCP ≤ 2.5s, INP ≤ 150ms, CLS ≤ 0.1)
  - 콘텐츠 카피는 독자 중심 (운영자 행동 X) — feedback_reader_centric_copy 메모리 룰
  - 푸시·외부 호출 금지

산출 형식 (300~500자):
  ## {축 이름}
  ### 발견 (Findings) — 3~5 bullets, 파일경로:라인 인용
  ### 제안 (Proposals) — 각 항목당:
    - 이름:
    - 효과(트래픽 가설): {왜 SEO/GEO에 기여하나}
    - 구현 비용: S/M/L
    - 외부 의존: 없음/있음(있으면 항목 명시)
    - 회귀 위험: 낮음/중간/높음
  ### 권장 P0 (1~2개): 가장 ROI 높은 항목
```

**저장 후 작업:**
- 모든 에이전트 응답 받으면 `ops/proposals/{TODAY}/_index.md`에 11개 산출물 1줄씩 인덱스 작성
- `node scripts/cycle-runner.mjs advance` 실행 → phase: REVIEW 갱신
- 커밋: `ops(cycle-{n}): PLAN — 11 에이전트 제안 도출`

## 2. REVIEW phase — 합성·격리·우선순위

**목표:** PLAN 산출물을 합성하고 외부 의존 항목 격리, P0/P1/P2 분류.

**실행:**

1. `ops/proposals/{TODAY}/` 의 11개 .md 모두 Read
2. **외부 의존 격리:** `ops/backlog-external.md`의 정규식 키워드로 매칭. 매칭된 제안은 backlog-external.md에 추가하고 본 사이클에서 제외
3. **점수화:** 각 제안에 대해
   - score = (트래픽 효과 1~5) × (구현 용이도 1~5) ÷ (회귀 위험 1~3)
4. **분류:**
   - **P0**: score ≥ 6, 외부 의존 0, 회귀 위험 ≤ 중간 → 본 사이클 EXECUTE 대상
   - **P1**: score 4~5.99 → 다음 사이클 후보
   - **P2**: score < 4 → 백로그
5. 결과 `ops/reviews/{TODAY}.md`에 작성:
   ```markdown
   # Cycle {n} REVIEW — {TODAY}

   ## 1. 합성 요약
   {3~5줄}

   ## 2. P0 (본 사이클 EXECUTE)
   - [ ] {제안1} — 출처: proposals/{TODAY}/{file}.md — 예상 효과 — 구현 노트
   - [ ] {제안2}

   ## 3. P1 (다음 사이클)
   - {…}

   ## 4. P2 (백로그)
   - {…}

   ## 5. 외부 의존으로 격리된 항목 → backlog-external.md 추가됨
   - {…}

   ## 6. 회귀 위험 / 주의
   - {…}
   ```
6. 사용자에게 1줄 브리핑: "Cycle {n} REVIEW 완료. P0 {N}건. EXECUTE 진입."
7. `node scripts/cycle-runner.mjs advance` → phase: EXECUTE
8. 커밋: `ops(cycle-{n}): REVIEW — P0 {N}건 / 외부격리 {M}건`

**중요:**
- 사용자가 "사이클" 다음 입력 시 EXECUTE가 자동 진입됨
- P0가 0건이면 REVIEW에서 즉시 OPERATE로 점프 (cycle-runner advance에 `--skip-execute` 옵션 사용)

## 3. EXECUTE phase — P0 구현

**목표:** REVIEW에서 승인된 P0를 모두 구현, 검증 게이트 통과, 커밋.

**실행:**

1. **새 브랜치 생성:** `git checkout -b cycle/{cycle_no}-{TODAY}` (이미 있으면 reuse)
2. P0 항목별로 차례대로:
   - 구현 (Edit/Write)
   - 항목당 별도 커밋 (`feat(cycle-{n}): {제안 이름}` 또는 적절한 prefix)
3. 모든 P0 끝나면 검증 게이트 일괄:
   ```bash
   npm run lint
   npm run lint:content
   npm run check
   npm run build
   ```
   각 단계 실패 시 즉시 중단 → 사용자 보고
4. **lhci는 선택** — 시간이 오래 걸리고 Chrome 의존이라 EXECUTE에서는 skip, OBSERVE에서 측정
5. 결과 `ops/execute-log/{TODAY}.md`:
   ```markdown
   # Cycle {n} EXECUTE — {TODAY}
   브랜치: cycle/{n}-{TODAY}

   ## 구현 항목
   - ✅ {제안1} — commit {sha} — 변경: {파일}
   - ✅ {제안2}
   - ❌ {제안3} — 사유

   ## 검증 게이트
   - lint: ✅
   - lint:content: ✅
   - astro check: ✅
   - build: ✅
   ```
6. `node scripts/cycle-runner.mjs advance` → phase: OPERATE
7. 커밋: `ops(cycle-{n}): EXECUTE 로그`
8. 사용자에게 1줄: "Cycle {n} EXECUTE 완료. {N}건 구현, 게이트 통과. 푸시는 '푸쉬' 입력 시."

**푸시 금지** — 메모리 룰에 따라 사용자가 "푸쉬" 명시 시에만.

## 4. OPERATE phase — 운영 가동

**목표:** 기존 cron 5종 + 신규 운영 스크립트 5종 가동, 결과 수집.

**실행 (병렬 가능한 것은 병렬):**

```bash
# 신규 운영 스크립트 (외부 호출 0)
node scripts/internal-link-audit.mjs > /tmp/audit-link.json
node scripts/schema-validate.mjs > /tmp/audit-schema.json
node scripts/llms-freshness.mjs > /tmp/audit-llms.json
node scripts/keyword-coverage.mjs > /tmp/audit-keyword.json
```

**기존 운영 스크립트 — 외부 호출 있는 것은 SKIP** (사이클은 외부 의존 X 원칙):
- ❌ sync:subsidies (보조금24 API)
- ❌ sync:issues (네이버 뉴스 API)
- ❌ generate:issues (Claude API — API 키 사용)
- ❌ check:apply-urls (외부 URL HEAD)
- ❌ indexnow:ping (Bing/Yandex)
→ 이들은 GitHub Actions cron에 위임. 사이클은 빌드타임 검증만.

**로컬 가능 운영:**
```bash
node scripts/lint-content.mjs    # 콘텐츠 무결성
npm run build                    # 산출물 확인
```

결과 `ops/observations/{TODAY}.md`의 "## 1. OPERATE" 섹션에 작성:
```markdown
## 1. OPERATE
### 신규 audit
- internal-link: 고립 페이지 {N}개, 평균 진입 깊이 {D}, 최장 경로 {P}
- schema: JSON-LD 검증 {pass}/{total}, 실패 {목록}
- llms-freshness: llms.txt와 실제 콘텐츠 diff {차이}
- keyword-coverage: persona/situation/category 키워드 본문 노출 {%}

### 기존 (skip 사유)
- sync:* / generate:issues / check:apply-urls / indexnow — GitHub Actions cron 위임
```

`advance` → phase: OBSERVE
커밋: `ops(cycle-{n}): OPERATE — 신규 audit 4종 가동`

## 5. OBSERVE phase — 지표·회귀 점검

**목표:** OPERATE 결과를 정량 지표로 정리, 회귀 점검, 다음 PLAN 인풋 도출.

**실행:**

1. `ops/observations/{TODAY}.md`의 "## 2. OBSERVE" 섹션 작성:
   ```markdown
   ## 2. OBSERVE
   ### 내부 지표 (build 산출물)
   - sitemap-index.xml 페이지 수: {N}
   - dist/client 인라인 CSS 평균: {KB}
   - 라우트 수: {N}
   - subsidies _gov24 활성: {N} / archived: {M}
   - issues 누적: {N} (최근 7일: {K})

   ### 회귀 점검
   - 직전 cycle 대비:
     - 페이지 수: {±N}
     - 고립 페이지: {±N}
     - schema 검증 실패: {±N}
     - 키워드 커버리지: {±%}

   ### 다음 PLAN 인풋
   - {현 사이클에서 발견된 우선순위 영역 3개}
   - {다음 사이클이 집중해야 할 가설}

   ### backlog-external 변동
   - 신규 추가: {목록}
   - 사용자 처리됨(✅): {목록}
   ```

2. `OPS_CYCLE.md` "사이클 이력" 표에 본 사이클 1행 추가
3. `cycle-runner advance` → phase: PLAN, cycle_no +1
4. 커밋: `ops(cycle-{n}): OBSERVE — 지표·회귀 + 다음 PLAN 인풋`
5. 사용자에게: "Cycle {n} 완료. 다음 사이클은 #{n+1} PLAN. '사이클' 입력 시 시작."

## 6. 보고 형식 (모든 phase 공통)

§22-2 (AGENTS.md):
- ✅완료 / ⚠️부분 / ❌차단 / 🔍확인필요 / 📊지표 / 🔗파일

각 phase 종료 시 1~3줄로:
```
✅ Cycle {n} {PHASE} 완료
📊 {핵심 지표 1~2개}
🔗 ops/{phase-folder}/{file}
다음: /cycle (다음 phase: {NEXT})
```

## 7. 트러블슈팅

- **cycle-runner.mjs status가 phase: ??? 반환** → `OPS_CYCLE.md` frontmatter 손상. `phase: PLAN`으로 수동 복구
- **에이전트 spawn 11개 동시 → 토큰 한도** → 7+4 분할 (Explore 2개·Plan 1개·security-review·review·claude-code-guide 1차, general-purpose 5종 2차)
- **외부 의존 키워드 매칭 의심스러움** → REVIEW phase는 격리만, 사용자가 reviews/{date}.md에서 수동 P0 추가 가능
- **EXECUTE 검증 게이트 실패** → 해당 P0 commit revert, 나머지만 유지, 실패 항목은 다음 cycle PLAN 인풋으로 자동 이월
