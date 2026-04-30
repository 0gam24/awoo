# `ops/` — 운영 사이클 산출물

본 디렉토리는 **고급화 운영 사이클**의 모든 산출물을 보관한다.

## 디렉토리

```
ops/
├── OPS_CYCLE.md           # 단일 진실 소스 (현재 phase·이력)
├── backlog-external.md    # 외부 의존·유료 백로그 (사이클 동결)
├── README.md              # 본 문서
├── proposals/             # PLAN phase — 에이전트별 고급화 제안
│   └── YYYY-MM-DD/
│       ├── explore-ia.md
│       ├── explore-seo.md
│       ├── plan-architecture.md
│       ├── general-tech-seo.md
│       ├── general-content-seo.md
│       ├── general-geo.md
│       ├── general-cwv.md
│       ├── general-a11y-bp.md
│       ├── security-review.md
│       ├── review-regression.md
│       └── claude-api.md
├── reviews/               # REVIEW phase — 합성·우선순위
│   └── YYYY-MM-DD.md
├── execute-log/           # EXECUTE phase — 구현 결과
│   └── YYYY-MM-DD.md
└── observations/          # OPERATE/OBSERVE phase — 운영·지표
    └── YYYY-MM-DD.md
```

## 사용법

사용자가 "**사이클**"(또는 `/cycle`)을 입력하면 Claude가:

1. `OPS_CYCLE.md`를 읽고 현재 phase 확인
2. 다음 phase 실행 (PLAN → REVIEW → EXECUTE → OPERATE → OBSERVE → PLAN…)
3. 산출물을 본 디렉토리에 저장
4. `OPS_CYCLE.md` frontmatter 갱신 + 이력 추가

자세한 phase 정의·진행 규칙은 `OPS_CYCLE.md` 참조.

## 푸시 정책

- 모든 phase는 로컬 커밋까지 자동
- **푸시는 사용자가 "푸쉬" 명시 시에만** (메모리 룰)
- EXECUTE phase는 `cycle/{cycle_no}-{date}` 브랜치에서 작업 → main 머지는 PR 검토 후
