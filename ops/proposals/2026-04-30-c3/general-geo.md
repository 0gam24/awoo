# GEO — Cycle #3

## 발견
- `subsidies/[id].astro`: GovService schema는 있으나 본문 BLUF 청크 부재. 금액·마감·핵심 자격 1박스 인용 단위 없음 — AI 답변 엔진이 "누구·얼마·언제" 합쳐서 인용 불가.
- `llms-full.txt.ts` 라인 157~189: subsidies는 eligibility/benefits/documents 본문 합본 이미 포함 (보류 항목 재확인 결과 — 이미 완료 상태). 단 이슈 포스트만 sections 압축, subsidies는 list dump 형식이라 청크 경계 약함.
- `issues/topics/[term].astro`: stats 그리드는 풍부하나 첫 화면 BLUF 압축 박스 없음 — `entry.totalCount/daysActive/matchedSubsidies.length/peakDay` 통계가 lead 문장에 흩어짐.
- `quick/index.astro`·`guide/index.astro`: hub 페이지 BLUF 미적용 — 각 5분 진단·신청 가이드의 "한 문장 요약" 부재.

## 제안
- P0-A: `subsidies/[id]` BLUF 박스 (대상·금액·마감·신청처 4행) — schema와 본문 동시 인용 가능.
- P0-B: `issues/topics/[term]` BlufBox — totalCount·daysActive·matchedSubsidies·peakDay 1박스 압축.
- P1-A: `llms-full` subsidies 청크 압축 — coreFacts 블록 추가 (대상·금액·마감·신청처 키-값).
- P1-B: `/quick/`·`/guide/` BlufBox — hub 페이지 답변형 1줄 요약.

## 권장 P0
- **P0-A `subsidies/[id]` BLUF 박스** — 70여 개 페이지에 일괄 적용, GovService schema와 본문 정합 즉시 확보. AI 인용 단위 청크 1개로 4가지 핵심 사실 합쳐 노출. 최대 ROI.
- **P0-B `topics/[term]` BlufBox** — 트렌딩 진입 페이지 첫 화면 압축, Cycle #1·#2 BLUF 패턴 재사용으로 구현 비용 낮음.
