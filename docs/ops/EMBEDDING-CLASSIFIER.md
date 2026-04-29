# 페르소나 임베딩 분류기 도입 가이드 (T2-3)

> 현재 페르소나 태깅은 [tag-personas.mjs](../../scripts/tag-personas.mjs) 키워드 휴리스틱 — 109건 중 103건 자동 (94%).
> 임베딩 분류기로 전환 시 정밀도 97%+ 가능 + 새로운 의미 패턴 자동 학습.

---

## 1. 현재 vs 차세대

### 현재 (휴리스틱)
- 6 페르소나 × 약 12개 키워드 사전 (`PERSONA_KEYWORDS`)
- 텍스트 부분 일치 → 페르소나 binary tag
- 카테고리 fallback (창업→self-employed 등)
- 정밀도: 94% (수동 검증 기준)
- 한계: 동의어·간접 표현 미대응 (예: "보육 어려움" → newlywed-family 매치 X)

### 차세대 (임베딩)
- 각 페르소나 기준 텍스트(label + sub + pains) → 임베딩
- 각 지원금 텍스트(title + summary + eligibility) → 임베딩
- 코사인 유사도 ≥ threshold → 매칭
- 추가 신호: 카테고리·소득·연령 키워드 weight

---

## 2. 구현 옵션

### Option A: Cloudflare Workers AI (권장)
- 모델: `@cf/baai/bge-m3` (다국어 지원, 한국어 양호)
- 무료 한도: 일 10K 요청 (지원금 119건 × 1회 = 한도 내)
- 빌드타임 호출 → JSON에 임베딩 캐시
- 비용: 무료 한도 내 — Cloudflare 계정 활성만 필요

### Option B: OpenAI text-embedding-3-small
- 차원 1536, 다국어 강함
- 비용: $0.02 / 1M 토큰 — 119건 sync 1회당 ~$0.001
- API 키 별도 등록

### Option C: 로컬 모델 (Sentence-Transformers)
- 빌드타임 Python 호출 — Node 환경 부적합
- 권장 X

---

## 3. 구현 설계 (Option A 기준)

### 빌드타임 흐름
```
sync-subsidies (주1) 또는 별도 cron:
  1. 모든 페르소나 텍스트 → 임베딩 (6번)
  2. 모든 지원금 텍스트 → 임베딩 (119번)
  3. 코사인 유사도 매트릭스 (6 × 119)
  4. threshold(0.4 권장) 이상 → targetPersonas 추가
  5. 휴리스틱 결과와 diff 비교 → 변경분만 사람 검수 후 commit
```

### 폴더 구조 추가
```
src/data/embeddings/
├── personas.json     # 6 페르소나 임베딩 (1024차원 각)
└── subsidies/
    └── {slug}.json   # 119 지원금 임베딩 캐시
```

### 스크립트
- `scripts/embed-personas.mjs` — 페르소나 임베딩 갱신 (수동 trigger)
- `scripts/embed-subsidies.mjs` — 지원금 임베딩 갱신 (sync 후 자동)
- `scripts/tag-personas-embed.mjs` — 임베딩 + 휴리스틱 결합 분류

### Workers AI 호출 (Node 빌드타임)
```js
// REST API 직접 호출 (Workers 환경 외부에서)
const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/baai/bge-m3`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: ['지원금 제목 + 요약'] }),
  },
);
const { result } = await res.json();
const embedding = result.data[0]; // 1024차원 array
```

### 환경 변수
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (Workers AI 권한 필요)

---

## 4. Diff 기반 검증 워크플로

자동 적용 X — 휴리스틱(94%) 위에 임베딩 보강 + 사람 검수.

```
1. 임베딩 분류 실행 → diff: 휴리스틱 결과 vs 임베딩 결과
2. 신규 추가 매칭만 추출 (예: 12건)
3. PR 자동 생성 — 사람이 sample 검토
4. 통과 시 merge → targetPersonas 갱신
```

→ 한 번에 전부 신뢰하지 않고 incremental 적용. 1인 운영에 적합.

---

## 5. KPI 목표

| 지표 | 현재 | 목표 |
|---|---|---|
| 자동 태깅 정밀도 | 94% | 97%+ |
| 추가 매칭 발견 | 0 | +20~30건 (간접 표현) |
| Cross-ref hub 활성 | 18 | 30+ (페르소나 태깅 풍부화 효과) |

---

## 6. 도입 시점

권장: **Tier 2 후반** (T2-1·T2-4 끝난 후)
- T2-1 토픽 hub가 안정되어 임베딩이 토픽에도 활용 가능
- AI Citation 측정 데이터 축적 (T1-1) → 어떤 페르소나·토픽이 인용되는지 신호 확인 후 분류기 조정

조기 도입 시 위험:
- 임베딩 결과 자동 적용 → 휴리스틱 대비 정밀도 검증 시간 부족
- 페르소나·토픽 라벨링이 변하면 임베딩 재계산 비용

---

## 7. Phase 1 진입 체크리스트

진입 전 준비:
- [ ] Cloudflare Workers AI 계정 활성 (대시보드 → Workers AI → Get started)
- [ ] CLOUDFLARE_ACCOUNT_ID + API_TOKEN .env.local 등록
- [ ] 페르소나 prompt 텍스트 정제 (label·sub·pains 정리)
- [ ] threshold·weight 초기값 결정 (Mock 결과 보고 조정)

진입 후:
- [ ] 첫 회 dry-run 결과 sample 30건 사람 검수
- [ ] 신뢰 검증되면 PR 자동 모드 → 1인 운영 부담 0

---

## 8. 결론

차세대 도입 효익: **휴리스틱 한계인 동의어·간접 표현 자동 매칭**.

비용은 적지만 (Workers AI 무료 한도) 라벨 갱신 워크플로 정착이 1인 운영에 부담 → **T2 후반에 단계적 도입** 권장.
