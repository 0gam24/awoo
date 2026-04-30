# inline-glossary anchor 본격 — Explore (Cycle #5 P0-2 이월)

## 발견

**현황 기초 자산:**
- `entity-graph.json` 내 subsidies 119개 중 약 70개가 mentionedGlossary 보유
- glossary.json 30개 term + synonyms 배열 완성
- `src/lib/inline-markdown.ts` 기존 `renderInlineMarkdown()` (bold/italic/link) + `paragraphsAndLists()` (단락/리스트 분리)

**렌더링 위치 확인:**
1. **subsidies/[id].astro** (L226-246, L288-291): eligibility/benefits 배열 → `<li><span>{e}</span>` (평문)
2. **topics/[id].astro** (L119-126, L136): longDef + decisionTree.a → `set:html={...paragraphsAndLists()...html}` (이미 HTML 파이프)
3. **situations/[id].astro** (L125): description 평문 (시간 없음)

**기존 마크다운 렌더링 아키텍처:**
- escapeHtml() 우선 (XSS 방어)
- 후 인라인 토큰 변환 — **bold** / *italic* / [link]()
- 코드 placeholder 처리로 nested 토큰 충돌 방지

## 제안 (구체 알고리즘 + 적용 위치)

### 1. `src/lib/inline-glossary.ts` 신규 작성

```typescript
// glossary term + synonyms를 역렬 정렬 (긴 문자열 우선 → 부분 매칭 방지)
// 첫 1회 매칭만 anchor 생성 (오탐 감소)
// 이미 set:html된 텍스트는 sanitized 상태 → 추가 escape 불필요

export function injectGlossaryAnchors(
  html: string, 
  glossaryTermMap: Map<string, {id: string; shortDef: string}>
): string {
  if (!html) return html;
  
  // glossary term + synonyms 통합, 긴 것부터 정렬
  const sortedTerms = Array.from(glossaryTermMap.entries())
    .flatMap(([term, data]) => {
      // entity-graph.json mentionedGlossary 기반 필터링은 호출부에서
      return [{term, ...data}];
    })
    .sort((a, b) => b.term.length - a.term.length); // 긴 것부터

  let result = html;
  const matched = new Set<string>(); // 이미 anchor 처리된 term 추적

  for (const {term, id, shortDef} of sortedTerms) {
    if (matched.has(id)) continue; // term 중복 방지 (synonyms)

    // word boundary 정확 매칭 (부분 단어 X)
    // 정규식: \b + term + \b (숫자/한글 포함)
    const pattern = new RegExp(
      `(\b|^)${escapeRegex(term)}(\b|$)`,
      'g'
    );

    let count = 0;
    result = result.replace(pattern, (match, before, after) => {
      if (count >= 1) return match; // 페이지당 최대 1회
      count++;
      matched.add(id);
      return `<a href="/glossary/${id}/" class="gloss-link" title="${escapeAttr(shortDef)}">${match}</a>`;
    });
  }

  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\]/g, '\$&');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

### 2. 적용 위치

**subsidies/[id].astro (L226-246, L288-291):**
- eligibility/benefits는 평문 배열 → renderInlineMarkdown() 경유로 변경
- HTML 렌더링 후 injectGlossaryAnchors() 적용
- mentionedGlossary는 entity-graph.json에서 subsidy id 매핑

**topics/[id].astro (L119-126, L136):**
- longDef 이미 `set:html={...}` 사용 → 후처리 불가
- 빌드 시점에 `paragraphsAndLists()` 호출 후 각 html block에 glossary 주입
- decisionTree.a도 동일

**glossary term 필터링 (entity-graph.json mentionedGlossary 기반):**
```typescript
// component/template에서
const glossaryMap = new Map(
  (s.data.mentionedGlossary ?? [])
    .map(gid => allGlossary.find(g => g.data.id === gid))
    .filter(g => g)
    .map(g => [g.data.term, {id: g.data.id, shortDef: g.data.shortDef}])
);
```

### 3. CSS 점선 underline

```css
.gloss-link {
  border-bottom: 1px dotted var(--text-2);
  text-decoration: none;
  color: inherit;
  cursor: help;
  transition: border-color 0.15s;
}
.gloss-link:hover {
  border-bottom-color: var(--accent);
  color: var(--accent);
}
```

## 권장 P0

**P0-1 (우선):** injectGlossaryAnchors() 함수 구현 + topics/[id].astro 적용 (longDef 기존 HTML 파이프라인 활용)

**P0-2:** subsidies/[id].astro eligibility/benefits 마크다운 렌더링으로 변경 + glossary anchor 주입

**P0-3:** CSS 점선 스타일 + title 호버 hint (UX 시각 구분)

---

## 기술 고려

- **정확 매칭:** word boundary regex (\b) — 부분 단어 차단
- **페이지당 3건 cap 이월:** 알고리즘에서 per-term count 1회로 제한 (페이지 전체는 별도 로직)
- **XSS 안전:** entity-graph 기반 필터링이므로 glossary id 사용자 입력 X + escapeAttr() 추가 방어
- **빌드타임 변환:** 런타임 JS 0 유지 (PSI 4×100)
- **동기화:** entity-graph.json mentionedGlossary ↔ glossary term id 1:1 대응 확인 필수

