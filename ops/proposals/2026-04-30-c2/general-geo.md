# GEO — Cycle #2

## 발견
- Cycle #1에서 4 hub만 BLUF 박스 적용. glossary [id]·issues/topics/[term]에는 미적용 — AI 답변 엔진이 인용할 "한 줄 사실" 박스가 없음.
- glossary [id].astro: hero 다음 def-card 2개(한 줄 정의·자세한 설명) 구조이고 matched 지원금 카운트 산출 로직(28~31행)이 이미 존재 — BLUF 자동 통계 즉시 가능.
- issues/topics/[term].astro: stats 그리드(128~152행)에 totalCount·daysActive·matchedSubsidies 다 있으나 lead 문장으로만 노출. 인용 친화적 단일 BlufBox 부재.
- llms-full.txt 169KB / 200KB 한도까지 ~30KB 마진. subsidies eligibility/benefits/documents 본문은 현재 메타 dump만 — 답변 엔진이 자격·금액 인용 시 본문 미포함.
- glossary [id]에 DefinedTerm schema는 있으나 BlufBox로 가시 영역 강화 시 SGE 인용률 상승 여지.

## 제안
1. **glossary [id] BlufBox** — hero 직후 "term · shortDef · 적용 지원금 N건 · 동의어 K개" 1박스. 기존 def-card 위 2~3줄 압축 BLUF.
2. **issues/topics/[term] BlufBox** — head 다음 stats 위에 "term · totalCount건 · daysActive일 · matchedSubsidies건" 단일 박스로 stats 요약. lead 문장 → 박스 승격.
3. **llms-full subsidies 본문 확장** — 메타+요약 → eligibility·benefits·documents·applyMethod 추가. 한도 200KB 이내 압축(요약 100자 컷 + 핵심 필드만).
4. **NewsArticle author Person schema 강화** — 기존 author 필드에 sameAs·jobTitle 추가로 E-E-A-T 신호 증대.

## 권장 P0
- **P0-1**: glossary [id] BlufBox (30 페이지 일괄 적용, 4 hub 컴포넌트 재사용)
- **P0-2**: issues/topics/[term] BlufBox (트렌딩 영구 페이지, 자동 통계 활용도 ↑)
- **P0-3**: llms-full subsidies 본문 확장 (답변 엔진 인용 정확도 직결, 한도 마진 활용)
