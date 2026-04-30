# audit 도구 강화 + categories 정규식 — Cycle #2

## 발견
- `scripts/keyword-coverage.mjs` L48~53: `CATEGORIES` 정규식은 매칭하지만, 필드명을 **`label`로 추출**하는 반면 실제 `src/data/site-data.ts` L59~159는 **`name`** 필드를 사용 → `labelM`이 항상 null, keyword 배열은 `[c.id]` 단일로 fallback (8개 항목 모두 `label` 누락)
- 추가로 inner regex `\{([^{}]*)\}`는 `commonEligibility: [...]` 배열 자체에 중괄호가 없어 운 좋게 동작 중이나, 향후 nested 객체 추가 시 즉시 깨짐
- `internal-link-audit.mjs`는 incoming count만 → 진짜 PageRank 부재
- `schema-validate.mjs`에 `GovernmentService.isBasedOn` / `numberOfItems:0` ItemList 검증 미흡

## 제안
1. **P0**: keyword-coverage CATEGORIES 추출을 동적 import로 전환 — `await import(pathToFileURL('src/data/site-data.ts'))` 는 .ts 직접 안 되므로, **JSON 사이드카** `src/data/categories.json` 추출 후 site-data.ts가 그것을 import (single source) → 스크립트는 JSON만 read. 또는 즉시 hotfix: 정규식의 `label` → `name` 정정 + nested `\{[\s\S]*?\}` 카운트 기반 파서로 교체
2. **P1**: internal-link-audit에 1) 깊이 ≤3 위반 카운트 2) 단순 PageRank (10 iter, damping 0.85) 추가
3. **P1**: schema-validate에 `numberOfItems === 0` warn, `GovernmentService.isBasedOn` 누락 warn
4. **P2**: 빌드 시간 측정 audit (`scripts/build-timing.mjs`) — `astro build` wrap, server/client phase 기록

## 권장 P0
- **categories 정규식 hotfix** (`label` → `name`, 1줄 수정 + 이후 JSON sidecar 마이그레이션) → keyword-coverage 카테고리 8건 즉시 정상화. 외부 의존 0, 푸시 없이 로컬 검증 가능.
