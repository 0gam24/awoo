# 고립 페이지 31건 해소 — Explore

## 발견 (Findings)

Cycle #1 audit 결과 31건의 고립 페이지(inbound 링크 부족)가 확인되었다. 분석 결과:

1. **`/categories/[id]/` 7건** — 현재 홈 → `/subsidies/?category=X` 쿼리 기반 접근. TopBar·Footer 모두 카테고리 hub 링크 없음. Footer는 `/categories/` 자체 미노출.

2. **`/subsidies/category/[c]/persona/[p]/` 대부분** — 4축 cross-ref hub이지만 inbound 링크 부족. 페르소나 hub(`/personas/[id]/`)에서는 `.hub-card` 링크 노출(고정), 카테고리 페이지(`/categories/[id]/`)에서는 링크 없음.

3. **`/issues/topics/[term]/`** — `/issues/index.astro`의 트렌딩 영역에서만 조건부(`topicHref > 3건`) 노출. hero cards 및 rail 트렌딩 리스트는 동일 조건이므로 일관성 있으나, inbound 경로 1개만.

4. **기타** — `/personas/index.astro`, `/issues/main/`, `/demo/` 등은 의도적 고립(별도 역할).

## 제안 (Proposals)

### P0: Footer 카테고리 링크 추가 (IA·거버넌스)

**문제**: Footer는 주 메뉴(홈·이슈·지원금·가이드)만 포함. 카테고리 hub인 `/categories/` 미노출.

**해법**: Footer 제1섹션(링크 그룹)에 카테고리 컬렉션 추가.
```markdown
예: [카테고리] 컬럼 신설
- 주거 지원금
- 자산 형성
- 교육 지원
...
```

**효과**: `/categories/[id]/` 7건 + `/subsidies/?category=X` 모두 inbound 확보. PSI 영향 무(정적 텍스트 링크).

---

### P1: 카테고리 페이지 cross-ref hub 추가

**문제**: `/categories/[id]/`에서 4축 hub(`/subsidies/category/[c]/persona/[p]/`)로의 링크 없음.

**해법**: 카테고리 페이지의 "다른 분야도 보기" 섹션 아래에 hub 그리드 추가 (기존 `/personas/[id]/` 스타일 재사용).
```astro
// categories/[id].astro 내 추가:
{hubCategories.length > 0 && (
  <section class="hub-section">
    <h3>페르소나별로 매칭받기</h3>
    <ul class="hub-grid">
      {hubCategories.map(([persona, count]) => (
        <a href={`/subsidies/category/${category}/persona/${persona}/`}>
          {persona}: {count}건
        </a>
      ))}
    </ul>
  </section>
)}
```

**효과**: `/subsidies/category/[c]/persona/[p]/` inbound 강화. 카테고리 선택자 → 페르소나 drill-down 유도.

---

### P2: 트렌딩 토픽 hero 노출 정책 재정의 (SEO)

**현황**: `/issues/topics/[term]/` 링크는 `topicHref()` 조건(≥3건) 충족 시에만 활성화. 현재 rail 트렌딩 리스트와 hero 2·3위 모두 동일 조건.

**제안**: 정책 유지(≥3건 이상만 색인). 단, hero 트렌딩 영역 명확화:
- "이 키워드는 정책 변화가 빠르면 페이지가 생성되지 않을 수 있습니다" 안내 추가
- rail 트렌딩 리스트: 링크 없는 항목도 표시(회색, 마우스 오버 시 `/subsidies/?q=...` fallback)

**효과**: 독자 혼란 해소. `/issues/topics/[term]/` 생성 조건은 명확히 유지.

---

## 권장 P0 (1~2개)

1. **Footer 카테고리 링크** — 최소 노력(Footer.astro 수정 1줄), 최대 효과(7건 고립 해소).
2. **카테고리 페이지 hub 그리드** — 중간 노력, 유저 경험 향상 (분야 → 페르소나 선택 플로우 강화).

**지표**: 
- P0 적용 후: `/categories/` 진입 깊이 감소, `/subsidies/category/.../persona/...` 세션당 방문 수 증가 추적.
- PSI 영향: 모두 0 (CSS 재사용, 비동기 로딩 불필요).

---

**다음 사이클**: 8월 audit에서 이들 링크 추가 후 고립 페이지 재집계 (목표: 31건 → <10건).
