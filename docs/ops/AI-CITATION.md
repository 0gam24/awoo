# AI Citation 측정 가이드

> 본 사이트가 ChatGPT·Perplexity·Gemini 등 AI 답변 엔진에 **얼마나 인용되는지** 매주 측정.
> 50개 핵심 쿼리에 대한 인용률을 시계열로 추적하여 GEO(Generative Engine Optimization) 효과 검증.

---

## 1. 사전 설정 (1회)

### 1-1. Perplexity API 키 발급

1. https://www.perplexity.ai/settings/api 접속 → 로그인
2. **Generate API Key** 클릭
3. 키 복사 (`pplx-...`)
4. **결제 등록 필수** — Perplexity API는 사용량 기반 과금
   - sonar 기본 모델: 입력 $1/1M tok + 출력 $1/1M tok
   - 50개 쿼리 × 4주 = 200회 → 월 약 $0.5~1 예상

### 1-2. 환경변수 등록

| 위치 | 키 | 값 |
|---|---|---|
| 로컬 | `.env.local` | `PERPLEXITY_API_KEY=pplx-...` |
| GitHub | Settings → Secrets → Actions | `PERPLEXITY_API_KEY=pplx-...` |

### 1-3. 검증

```bash
npm run citations:track
```

성공 시:
```
[citation] 50개 쿼리 측정 시작 (model: sonar)
  [1/50] 청년 월세 지원금 자격… ✓
  [2/50] 청년도약계좌 가입 조건… ✗
  ...
[citation] 인용 14 / 측정 50 / 실패 0
[citation] 인용률: 28.0%
```

---

## 2. 자동 cron

`.github/workflows/citations.yml` — 매주 월요일 08:00 KST 자동 실행.
- `PERPLEXITY_API_KEY` 미설정 시 graceful skip (워크플로 실패 X)
- 결과는 `src/data/citations/[YYYY-MM-DD].json` + `_summary.json`에 commit

---

## 3. 측정 쿼리 50개 (구성)

| 카테고리 | 건수 | 예시 |
|---|---|---|
| 청년 | 10 | "청년 월세 지원금 자격", "청년도약계좌 가입 조건" |
| 신혼·육아 | 10 | "부모급여 0세 100만원 신청", "신혼부부 특별공급 자격" |
| 저소득·복지 | 10 | "기초생활수급자 자격", "에너지바우처 신청" |
| 중장년·시니어 | 5 | "기초연금 자격 65세", "노인 일자리 지원" |
| 교육·자산 | 5 | "국가장학금 신청 자격", "근로장려금 신청" |
| 농업·기타 | 5 | "청년농업인 영농정착지원", "소상공인 정책자금" |
| 보편 | 5 | "2026년 정부 지원금 종합", "내가 받을 수 있는 지원금 진단" |

쿼리 수정: `scripts/citation-tracker.mjs` `QUERIES` 배열 직접 편집.

---

## 4. 결과 해석

### `_summary.json`

```json
{
  "lastRun": "2026-04-30",
  "latestRate": 0.28,
  "runs": [
    { "date": "2026-04-30", "cited": 14, "total": 50, "rate": 0.28 },
    { "date": "2026-04-23", "cited": 11, "total": 50, "rate": 0.22 }
  ]
}
```

### KPI 임계 (가이드)

| 인용률 | 평가 |
|---|---|
| < 10% | 본 사이트가 AI 엔진에 거의 노출 안 됨. 콘텐츠 깊이·llms.txt 점검 |
| 10~30% | 정상 — Perplexity가 도메인 신뢰 형성 중 |
| 30~50% | 양호 — AI 답변 친화 본문 패턴 효과 |
| > 50% | 우수 — 정부 지원금 1순위 인용 후보 |

### 회차별 [date].json

```json
{
  "date": "2026-04-30",
  "model": "sonar",
  "cited": 14,
  "total": 50,
  "rate": 0.28,
  "results": [
    {
      "query": "청년 월세 지원금 자격",
      "cited": true,
      "ourUrl": "https://awoo.or.kr/subsidies/youth-rent-support-000099/",
      "sourcesCount": 5
    },
    ...
  ]
}
```

---

## 5. 인용률 향상 전략

**인용 안 된 쿼리 분석**:
- "내가 받을 수 있는 지원금 진단" → /quick/ 페이지 SEO 강화 필요
- "기초연금 자격 65세" → 큐레이션 부족 — 큐레이션 30건 확장 시 개선 예상

**일반적 GEO 향상**:
1. **답변 친화 본문 패턴**: 정의 1문단·날짜·숫자·출처 표기 일관화 (T2-4)
2. **DefinedTerm schema**: `/glossary/[term]/` 30+ 항목 (Tier 1 완료)
3. **Fresh content**: 매일 이슈 포스트 + 매주 보조금24 신규 sync
4. **AI 봇 명시 허용**: robots.txt에 GPTBot·ClaudeBot·PerplexityBot·CCBot 등 (이미 적용)

---

## 6. 다른 엔진 측정 (확장)

현재는 Perplexity만 측정. 다른 엔진 추가 시:

| 엔진 | API | 측정 가능성 |
|---|---|---|
| Perplexity | ✓ | 구현됨 (sources citation 명시) |
| ChatGPT | △ Search API β | β 시점에 추가 가능 |
| Gemini | × | 답변에 sources 명시 X — 측정 어려움 |
| Claude | × | 답변에 sources X (web search 옵션 빼면) |

→ Perplexity가 sources 명시가 가장 명확하고 일관적이라 1순위 측정 도구.

---

## 7. 비용 모니터링

| 시나리오 | 월 비용 |
|---|---|
| 50쿼리 × 주1회 (default) | ~$0.5 |
| 50쿼리 × 일1회 (debug) | ~$3.5 |
| 100쿼리 × 주1회 | ~$1 |

Perplexity Dashboard → Usage 에서 실시간 확인.

---

## 8. 문제 해결

| 증상 | 원인·해결 |
|---|---|
| `PERPLEXITY_API_KEY 미설정` | `.env.local` 또는 GH secret 추가 |
| `429 rate limit` | `PER_QUERY_DELAY_MS` 상향 (현 1500ms → 3000ms) |
| `401 unauthorized` | API 키 만료 또는 결제 카드 만료 — Perplexity Dashboard 확인 |
| 인용률 0% | sources 추출 실패 가능 — 응답 raw 디버그 (citations 배열 비어있는지 확인) |
