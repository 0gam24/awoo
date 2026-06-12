---
description: 트래픽 관측 + 다음 액션 — 색인·키워드 커버리지·citation 점검, 갱신(freshness) 후보 발굴, 내일 발행 추천
---

# /traffic — 관측과 다음 한 수

발행이 트래픽이 됐는지 점검하고, 가장 빠른 다음 액션 1~3개를 추천한다. 입력: `$ARGUMENTS` (선택 — 특정 글 slug나 키워드).

## 실행 순서

### 1. 로컬 지표 (Bash, 병렬 가능)
```bash
npm run audit:keywords    # 키워드 커버리지
npm run audit:links       # 고립·dangling (색인 손실 신호)
npm run citations:track   # AI 인용 추적
```
+ `today.md` 최근 7일 발행 목록 + `src/data/today-issue.json` 오늘 트렌딩.

### 2. 색인·노출 점검 (WebSearch)
최근 7일 발행 글 중 표본 3~5건:
- `site:awoo.or.kr {키워드}` 색인 여부
- `{키워드}` 일반 검색 시 awoo 노출 여부·경쟁 콘텐츠 상태
- 미색인 글 → GSC·Naver 색인 재요청 링크 출력

### 3. freshness 갱신 후보 (가장 빠른 트래픽 레버)
```
grep -rl "발표 대기\|미확정\|예정\|검토중" src/data/issues/ --include=*.json
```
후보별 WebSearch로 확정 발표 여부 확인 → 발표됐으면:
- 해당 글 수치 교체 + dateModified 갱신 + `npm run indexnow:ping` 제안
- (확정 직후 검색 급증 구간 선점 — CHEONGNYEON-MIRAE-KEYWORD-PLAN §6 전술)

### 4. 다음 발행 추천
keyword-scout 에이전트 spawn → 내일 후보 상위 3개.

## 보고 형식
```
## 트래픽 리포트 (YYYY-MM-DD)

### 발행→색인 현황 (최근 7일)
| 글 | 색인 | 노출 | 액션 |

### 지표
- 키워드 커버리지: {…} / 고립·dangling: {N} / AI 인용: {…}

### 🔥 지금 가장 빠른 한 수 (1~3개, 효과 순)
1. {갱신: slug — 확정 발표됨, 수치 교체+indexnow}
2. {발행: 키워드 — 근거}
3. {색인: 미색인 N건 재요청}
```

원칙: 액션 없는 지표 나열 금지 — 모든 지표는 "그래서 뭘 하나"로 끝난다.
