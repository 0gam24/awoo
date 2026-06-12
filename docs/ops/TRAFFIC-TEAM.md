# 트래픽 스프린트 팀 (Agent Team Runbook)

> 목적: 수동 포스팅 체제(MANUAL-POSTING.md)를 에이전트 팀으로 병렬화해 **가장 빠른 시기에 가장 많은 검색 트래픽**을 확보한다.
> 작성일: 2026-06-12 · 운영자: 김준혁 · 콘텐츠 표준의 단일 진실 소스는 여전히 `docs/ops/MANUAL-POSTING.md` + `docs/ops/POSTING-STRUCTURE-SEO-AEO-GEO.md`.

## 1. 트래픽 4대 레버 (팀이 자동화하는 것)

| 레버 | 왜 빠른가 | 담당 |
|---|---|---|
| ① 시기성 선점 | 마감 D-N·지급일·확정 발표 직후가 검색 의도 최고점 | keyword-scout |
| ② 병렬 발행 | 하루 1건 → 2~5건, 작성·검증을 동시 진행 | /sprint |
| ③ 색인 가속 | 발행 후 24h 내 색인 = 트렌드 윈도우 안에 노출 | /post·/sprint STEP 8 |
| ④ freshness 갱신 | 기색인 글 수치 확정 갱신은 신규 발행보다 빠른 유입 | /traffic |

## 2. 팀 구성

### 서브에이전트 (.claude/agents/)

| 에이전트 | 역할 | 병렬성 |
|---|---|---|
| `keyword-scout` | 트렌딩·마감·수요갭·갱신후보 발굴 + 스코어링 | 1회 |
| `longtail-strategist` | GATE-A/B + 6축 롱테일 + 단발 vs 클러스터 판단 | 시드별 병렬 |
| `post-writer` | SEO/AEO/GEO 표준 JSON 작성 + 파일 저장 | **글별 병렬 (핵심)** |
| `fact-checker` | 정부 1차 출처 교차검증, PASS/FIX/BLOCK 판정 | 글별 병렬 |
| `quality-gate` | 18항목 + 가독성 + lint:content 일괄 검수 | 1회 (일괄) |

### 커맨드 (.claude/commands/)

| 커맨드 | 용도 | 빈도 |
|---|---|---|
| **`/today`** (트리거: "오늘 포스팅") | **점검→발굴→발행 3커맨드 통합 실행** | 매일 아침 1회 |
| `/post 키워드` | 단일 발행 (8단계 파이프라인) | 매일 |
| `/sprint [N건\|키워드,...]` | 멀티 발행 스프린트 | 트렌드 폭발 시 |
| `/traffic` | 색인·유입 점검 + 갱신 후보 + 다음 한 수 | 발행 24~72h 후 |

### 운영자 결정 지점 (사람만 하는 것)

1. **GATE-C**: angle/키워드 확정 (후보 표에서 선택)
2. **GATE-D**: 발행 결재 ("발행/수정/취소")
3. 발행 후 GSC·Naver 색인 요청 1클릭 (Chrome MCP 연결 시 대행 가능)

## 3. 일일 운영 루틴 (최소 입력)

```
아침: "오늘 포스팅"     ← 이 한마디로 /traffic 점검 → scout 발굴 → 발행까지 전부 실행
  → 결정 1회 (추천 1건 / 스프린트 3건 / 갱신만 / 직접 입력)
  → 발행 결재 1회 ("발행")
  → 끝 (운영자 입력 총 2회)

개별 실행도 가능:
  /post 키워드 · /sprint 3 · /traffic
```

## 4. 품질 불변 조건 (병렬화해도 깎지 않는 것)

- YMYL: 확정값만 단정, 미확정은 "발표 대기" 프레이밍, factCheckScore ≥ 0.6 (미만 = noindex = 트래픽 0)
- KST 날짜 4중 일치 (publishedAt ↔ date ↔ 디렉토리 ↔ slug)
- push 전 fetch+rebase (06KST cron 선행 push 대비)
- 하루 8건 초과 금지 (scaled-content 인상 — AdSense 감사 지적)
- 카니발라이제이션 차단: 글당 점유 검색의도 1개

## 5. 확장 여지 (선택)

- **Chrome MCP**: GSC URL 색인 요청·Naver Advisor 등록을 브라우저 대행 → 운영자 3분 → 0분
- **/schedule 클라우드 루틴**: 매일 아침 scout 리포트 자동 수신 (운영자는 키워드 선택만)
- **naver-mate-econ 스킬**: 자산 카테고리 글의 네이버 블로그 syndication (canonical은 awoo 유지)
