# entity-graph 인덱서 + inline-glossary — Explore

## 발견

**현황 분석:**
- `glossary.json` 30개 term (term·shortDef·synonyms[]·related[] 구조 완성)
- `topics.json` 2개 hub (relatedGlossary·relatedSubsidyKeywords·mainPersonas 필드 완성)
- `subsidies/_curated/` 10개 + `_gov24/` 110개 = 120개 지원금 (tags·targetPersonas·category)
- `CrossRefRail.astro` — entity-graph 결과 렌더 컴포넌트 이미 준비
- Astro 6 정적 빌드 (output: static), 빌드 12.82s 기준 +2s 여유

**구현 경로 없음:**
- `scripts/build-entity-graph.mjs` 미존재
- `src/lib/entity-graph.ts` 미존재 (타입 안전 reader)
- inline-glossary 자동 anchor 미구현 (현재 링크 수동 작성)

**활용 가능 요소:**
- `renderInlineMarkdown()` (inline-markdown.ts) — 링크 안전 처리 기반 확장 가능
- Build script 인프라 완성 (sync-subsidies·lint-content·schema-validate 등 15개 script)

## 제안 (구조 + 알고리즘 + 빌드 hook)

### 1. entity-graph 인덱서 구조
**`src/data/entity-graph.json` (git-tracked, prebuild 생성):**
```json
{
  "glossary": {
    "median-income": { "mentionedIn": ["youth-housing-criteria", "basic-livelihood"] },
    ...
  },
  "topicIndex": {
    "youth-housing": { "relatedGlossaryIds": [...], "relatedSubsidyIds": [...] }
  }
}
```

### 2. inline-glossary anchor 알고리즘
**`src/lib/entity-graph.ts` reader + `anchorGlossary()` function:**
- subsidy·topic·situation 본문 대상
- glossary.term + synonyms[] 정렬 (긴 순서 → 중복 방지)
- 문단당 첫 1회만 anchor (Set 추적)
- XSS 안전: renderInlineMarkdown 기반 URL 필터 재사용

### 3. 빌드 시점 hook
**Option A (권장 — +0.8s 예상):** Astro 6 integration hook
- `astro:build:setup` hook에서 prebuild 단계 실행
- `scripts/build-entity-graph.mjs` 호출 → entity-graph.json 생성
- astro.config.mjs에 통합 (기존 패턴: sync-subsidies, schema-validate)

**Option B (fallback):** npm script
- `"prebuild": "node scripts/build-entity-graph.mjs"` in package.json
- `package.json#build`에 prebuild 추가: `"build": "npm run prebuild && astro build ..."`

### 4. 출력 포맷
- `entity-graph.json` → git-tracked (dev workflow 일관성)
- 크기 예상: 30 terms × 8 mentions = 2.4KB (최소 ~5KB json 직렬화)

## 권장 P0 (1단계 시작 step)

**Step 1: Reader + build script 뼈대**
1. `src/lib/entity-graph.ts` — `readEntityGraph()` 타입 정의 (10줄)
2. `scripts/build-entity-graph.mjs` — glossary.json + subsidies 읽기 → entity-graph.json 생성 (60줄)
3. `astro.config.mjs` — integration hook 추가 (20줄)

**Step 2: inline-glossary anchor (분리된 2주차)**
1. `anchorGlossary(text: string, term: string): string` 함수 추가 (40줄)
2. 컴포넌트 (subsidy·topic detail) 적용 (5개 × 2줄)

**빌드 시간 영향:**
- Reader + script: +0.6s (glossary.json 파싱 + map 생성)
- inline anchor (컴포넌트): +0.4s (렌더타임 term 검색 — lazy)
- 합: +1.0s (2s 한도 내)

**제약 준수:**
- 라우트 추가 X (정적 데이터 파일만)
- PSI 4×100 유지 (JSON 크기 5KB ≈ 0.05초)
- 외부 API/계정 X
- 푸시 X
