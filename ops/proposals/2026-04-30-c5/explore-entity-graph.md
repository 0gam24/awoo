# entity-graph 본격 구현 — Explore (4사이클 보류 끝)

## 발견

**현황 스냅샷**: 30개 glossary (term·shortDef·synonyms·related·category) + 2개 topics (relatedSubsidyKeywords·relatedGlossary·mainPersonas·mainSituations) + 6개 personas + 12개 situations + 119개 subsidies (curated 10 + gov24 109) + 7개 categories.

**스키마 준비도**: `src/lib/schema.ts`에 BreadcrumbList·CollectionPage·Organization·WebSite 헬퍼 이미 구현; 각 페이지는 @id 절대 URL + @context 일관적으로 사용. glossary.json·topics.json의 related[]·relatedSubsidyKeywords[] 필드가 graph 링크의 원재료 대기 중.

**빌드 인프라**: package.json "build" 현재 `astro build && node scripts/check-bundle-size.mjs`. 스크립트 디렉토리에 audit-headings·citation-tracker·lint-content·schema-validate 등 이미 14개 도구 상주 (prebuild hook 도입 준비 완료).

**검증 기반**: schema-validate.mjs가 dist/ HTML의 JSON-LD 무결성을 검사; @context·@type·필수 필드 외 @id 중복 탐지 로직 이미 가동 중 (dangling @id 검증 기초 확보).

## 제안 (구체 스키마 + 빌드 hook)

**1. entity-graph.json 스키마** (src/data/entity-graph.json):
```js
{
  "@context": "https://schema.org",
  "@type": "Graph",
  "entities": {
    "glossary": { 
      "[id]": { "@id": "/glossary/[id]/", mentions: [...@ids], related: [...@ids], category: "..." }
    },
    "topics": { 
      "[id]": { "@id": "/topics/[id]/", relatedSubsidies: [...@ids], relatedGlossary: [...@ids] }
    },
    "subsidies": { 
      "[id]": { "@id": "/subsidies/[id]/", topics: [...@ids], glossary: [...@ids], category: "..." }
    },
    "personas": { "[id]": { "@id": "/personas/[id]/" } },
    "situations": { "[id]": { "@id": "/situations/[id]/" } }
  }
}
```

**2. build-entity-graph.mjs** (scripts/): 
- glossary.json 순회 → related[] @id 해석 + subsidies.tags와의 매칭 (낮은 신뢰도 항목 제외)
- topics.json의 relatedSubsidyKeywords·relatedGlossary 검증
- persona·situation 자동 링크 (mainPersonas·mainSituations로부터)
- schema-validate와 통합: 생성된 graph의 모든 @id 참조를 HTML 산출물의 JSON-LD와 교차 검증

**3. prebuild hook** (package.json):
```json
"build": "node scripts/build-entity-graph.mjs && astro build && node scripts/check-bundle-size.mjs && node scripts/audit-headings.mjs"
```

**4. CrossRefRail.astro 자동 주입 가능성**:
entity-graph.json을 읽어 detail 페이지의 cross-reference를 프로그래매틱 생성 (수동 hardcoding 제거 → 일관성·유지보수성 향상).

## 권장 P0 (1단계 시작 step)

**Step 1**: build-entity-graph.mjs 골격 구현 + entity-graph.json 산출 (테스트 불가 상태 허용, 다음 사이클에서 schema-validate 통합).

**Step 2**: schema-validate.mjs에 dangling @id 검증 추가 (entity-graph 로드 → 모든 @id 참조 확인).

**빌드 시간 영향**: +0.5~1s 예상 (JSON 순회 + 정렬만, I/O 최소).

**라우트 추가 X**: entity-graph는 정적 JSON으로 번들 포함 가능 (PSI 안전).
