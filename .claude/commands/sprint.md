---
description: 트래픽 스프린트 — 키워드 발굴부터 N건 병렬 작성·검증·일괄 발행까지 한 번에 (하루 최대 트래픽 모드)
argument-hint: "[N건] 또는 키워드1,키워드2,... (미지정 시 scout가 후보 제안)"
---

# /sprint — 멀티 포스트 병렬 발행

입력: `$ARGUMENTS` — 숫자(N건)면 scout가 상위 N개 추천, 키워드 쉼표 목록이면 그대로 사용, 비어 있으면 scout 후보 표에서 운영자가 선택. 기본 N=3 (권장 2~5).

목표: **단일 글 대비 발행 비용을 병렬화로 압축**해 하루 발행량을 늘린다. 품질 게이트는 단일 발행과 동일 — 양을 위해 검증을 줄이지 않는다.

## 실행 순서

### 0. 동기화
```bash
git fetch origin && git rebase origin/main
```

### 1. 발굴 — keyword-scout spawn 1회
오늘 후보 5~8개 스코어 표 + 갱신 후보. **갱신 후보가 있으면 신규 발행보다 우선 제안** (이미 색인된 글의 수치 갱신이 가장 빠른 트래픽).

### 2. 운영자 키워드 확정 (GATE-C')
AskUserQuestion으로 발행할 키워드 N개 + 각 angle 확정. 같은 시드의 클러스터(spoke 여러 건)와 서로 다른 시드 혼합 가능.

### 3. 전략 — longtail-strategist 병렬 spawn (시드별)
시드별 GATE-A/B·angle·reportType·매칭 ID 확정. 중복·0건 플래그는 즉시 운영자 질문.

### 4. 작성 — post-writer N개 **단일 메시지 병렬 spawn**
글별 입력: [키워드·angle·reportType·매칭 지원금 ID·오늘 KST 날짜·trendingTerm·trendingPrimary 여부].
클러스터면 카니발라이제이션 방지 배정표(글당 점유 의도 1개)를 각 writer 프롬프트에 명시.

### 5. 검증 — 2단 병렬
1. **fact-checker** × N (글별 병렬) + **google-quality-auditor** × 1 (일괄, 2026-08-28+ 필수 — 구조 지문·정보 이득) + **quality-gate** × 1 (일괄)
2. FIX → 메인 루프가 정정 → 해당 글만 재검증. BLOCK → 그 글만 제외하고 진행
3. 메인 루프 최종: `npm run lint:content && npm run build`

### 6. GATE-D 일괄 결재
표로 보고: | 제목 | 경로 | 팩트체크 | 비고 | → 운영자가 글별 "발행/제외" 결정.

### 7. 일괄 발행 + 후처리
```bash
npm run sync:history
git add -A src/data/issues/ today.md
git commit -m "feat(issues): {M/D} 스프린트 — {N}건 발행 ({키워드 요지})"
git fetch origin && git rebase origin/main && git push
npm run indexnow:ping
npm run update:today
git add today.md && git commit -m "chore(today): {M/D} 발행 반영" && git push
```
발행 URL 전건의 GSC·Naver 색인 요청 링크 목록 출력.

## 안전 규칙
- 같은 날 같은 trendingTerm 2건 이상이면 trendingPrimary 정확히 1개
- **구글 신뢰 회복기(2026-08-28~): 신규 하루 1~3건** (GOOGLE-NAVER-DUAL-STANDARD §5 — 구글 색인률 30%+ 회복 시까지). 갱신은 무제한, 신규보다 갱신 우선
- **지역명 치환 동시 발행 금지** — 같은 날 동일 템플릿 지역 변형 N건 연발 대신 비교 허브 1건 + 이후 날짜 분산, 지역 단건은 지역 고유 사실(조례·재원·인접 비교) 비중 확보
- 하루 8건 초과 권고하지 않음 (06-03 8건 사례: thin 임계 근접 + 동일 일자 대량발행 리스크 — AdSense 감사 지적)
- BLOCK·미확정 과다 글은 빼는 것이 낫다 — factCheckScore < 0.6 = noindex로 트래픽 0

## 보고 형식
```
✅ 스프린트 완료: {N}건 발행 / {M}건 제외
📊 글별: {제목 — 팩트체크 판정 — URL}
🔗 색인 요청 링크 {N×2}건
다음: /traffic (24~72h 후 색인·유입 점검)
```
