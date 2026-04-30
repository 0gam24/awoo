# 콘텐츠 큐레이션 Runbook

운영 단일 진실 소스 — 콘텐츠 작성·보강·검수 절차.

## 1. 전체 콘텐츠 인벤토리

| 타입 | 위치 | 작성 방식 | 자동/수동 |
|---|---|---|---|
| 영구 포스트 (이슈) | `src/data/issues/{date}/{slug}.json` | Claude 자동 생성 + 검수 | 자동 (sync-issues.yml) |
| flagship 가이드 | `src/content/guides/{slug}.md` | 사람 작성 (markdown) | **수동** |
| 지원금 (curated) | `src/data/subsidies/_curated/{id}.json` | 사람 작성 | **수동** |
| 지원금 (gov24) | `src/data/subsidies/_gov24/{id}.json` | 정부24 API 동기화 | 자동 (sync-subsidies.mjs) |
| 페르소나 | `src/data/personas.json` | 사람 작성 | **수동** |
| 글로서리 | `src/data/glossary.json` | 사람 작성 | **수동** |
| 토픽 | `src/data/topics.json` | 사람 작성 | **수동** |
| 상황 | `src/data/situations.json` | 사람 작성 | **수동** |

## 2. 우선순위 — flagship 가이드 (외부 평가 권고)

평가 결과: "5~10개 심층 가이드" 작성이 AdSense 승인·SEO 핵심.

### 작성 절차

1. **주제 선정**: 검색량 높은 지원금 우선
   - 청년월세, 부모급여, 청년도약계좌, 소상공인 정책자금, 청년후계농 등

2. **템플릿 복사**:
   ```bash
   cp src/content/guides/_template.md src/content/guides/{slug}.md
   ```

3. **frontmatter 채우기** (필수):
   - `title`: 제목 (50-60자, 검색 결과 노출)
   - `description`: 한 줄 요약 (120-160자)
   - `category`: `주거`/`취업`/`창업`/`교육`/`복지`/`자산`/`농업`/`범용`
   - `tldr`: 핵심 요약 3-7건
   - `publishedAt`: ISO 날짜

4. **본문 섹션** (specificity 기준 충족):
   - 누가 받을 수 있나 — 정확한 자격 조건 (정부 공식 자료 인용)
   - 얼마 받을 수 있나 — 표 활용
   - 신청 방법 — 단계별
   - **빠지기 쉬운 함정** (specificity 핵심)
   - **거부되는 흔한 사유** (specificity 핵심)
   - 결론

5. **검증**:
   ```bash
   npm run audit:specificity  # vague claim 검출
   npm run audit:content-depth  # 2000자 임계
   npm run build              # 빌드 통과 + schema 자동 부착
   ```

## 3. 보강 우선순위

매주 audit 실행 → 부족 페이지 우선순위 출력.

### 명령어

```bash
npm run audit:content-depth  # 본문 부족 페이지 Top 20
npm run audit:specificity    # vague claim 페이지
npm run audit:titles         # 중복 title·길이 위반
```

### 보강 대상 결정 기준

| audit 결과 | 조치 |
|---|---|
| `audit:content-depth` violations Top 5 | 다음 주 보강 큐 |
| `audit:specificity` violations | _curated 우선 (gov24 raw는 외부 데이터) |
| `audit:titles` 중복 | 즉시 정리 (cannibalization 차단) |

## 4. _gov24 → _curated 보강 절차

자동 동기화된 _gov24 데이터는 description이 짧음 (정부24 API 한계). 검색·AI 인용 confidence 낮음.

### 보강 절차

1. _gov24 raw 데이터 검토:
   ```bash
   cat src/data/subsidies/_gov24/{slug}.json
   ```

2. _curated에 보강 버전 작성:
   ```bash
   cp src/data/subsidies/_gov24/{slug}.json src/data/subsidies/_curated/{slug}.json
   # eligibility, benefits, documents 풍부화
   ```

3. _gov24 manifest에서 entry 제거 (중복 차단):
   ```bash
   # node 스크립트로 _gov24 manifest items[xxx] 제거 + 파일 삭제
   ```

4. 검증:
   ```bash
   npm run audit:titles  # duplicate_title_count 0 유지
   ```

## 5. 영구 포스트 자동 생성 (Claude API)

조건:
- ANTHROPIC_API_KEY GitHub Secrets 등록 (사용자 외부 작업)
- 매일 06:00 KST 자동 실행 (sync-issues.yml)
- 1일 1개 메인 + 보너스 ≤ 2건 (Cycle #11 P0-2)

검증:
```bash
ls src/data/issues/$(date +%Y-%m-%d)/  # 오늘 생성된 포스트
cat src/data/issues/_history.json     # 누적 트렌드
cat src/data/issues/$(date +%Y-%m-%d)/_fail-*.json  # 실패 로그
```

## 6. 콘텐츠 품질 임계 (재참조)

| 타입 | 본문 최소 | description | tldr | faq |
|---|---|---|---|---|
| flagship 가이드 | 2000자 | 120-160자 | 3-7건 | 권장 |
| 영구 포스트 | 1500자 | 120-160자 | 3-5건 | 4-6건 |
| 지원금 (curated) | 600자 | 60-160자 | — | 4-6건 |
| 페르소나 | 1200자 | 120-160자 | — | — |
| 토픽 | 1500자 | 120-160자 | — | — |

## 7. 정정·갱신 정책

- 사용자 제보 접수 (24-48시간 내 검토)
- 정책 변경 시 `updatedAt` 갱신 → schema dateModified 자동 반영
- 마감된 지원금: status `'마감'` → 30일 후 sweep-stale.mjs로 archived 이동
