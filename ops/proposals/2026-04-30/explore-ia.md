# IA / 내부 링크 그래프 — Explore

## 발견 (Findings)

### 1. 4축 cross-reference hub 구조 매우 잘 구현됨 (2건 이상 threshold)
- **파일**: `src/pages/subsidies/category/[category]/persona/[persona].astro:10-18`
  - 카테고리 × 페르소나 교차 hub (sparse matrix 구조 · MIN_RESULTS = 2)
  - 실제 매칭 데이터 기반 동적 페이지 생성, thin content 보호(NOINDEX_THRESHOLD=5)
  - 각 hub에서 양방향 진입 가능: `/subsidies/category/주거/persona/office-rookie/`

- **파일**: `src/pages/personas/[id].astro:48-82`
  - 페르소나 hub: 카테고리별 sub-hub 제시 + 대표 지원금 노출(HOT 우선, 금액 큼 순)
  - CrossRefRail 컴포넌트로 상황·토픽·진단 링크 4개 (내부 권장도 매우 높음)
  - 6개 페르소나 간 순환 nav (prev/next 링크, 호출 가능 피커)

### 2. 트렌딩 토픽 페이지 hub 품질 낮음 (임계 미달)
- **파일**: `src/pages/issues/topics/[term].astro:53-88`
  - 생성 조건: totalCount ≥ 3 (매우 낮은 threshold)
  - 만족: 자체 통계 & 관련 지원금 매칭(제목/요약 텍스트 검색), 포스트 연결
  - **문제**: 관련 지원금 0건인 경우 noindex 처리하지만, 토픽 자체 노출은 검색 트래픽 낮음
  - 진입 경로: `/issues/` hub 리스트에만 (다른 페이지에서 언급 미흡)

### 3. 상황별 페이지(situations) 내부 링크 충분함
- **파일**: `src/pages/situations/[id].astro:56-84`
  - 매칭 페르소나·토픽·카테고리 모두 CrossRefRail로 노출
  - 사이드바(rail): 관련 페르소나, 진단(/quick/), 가이드(/guide/) 명시적 링크
  - 다른 상황 8개 horizontal chip nav (event-chip)

### 4. 홈 진입점 충분하고 밀도 높음
- **파일**: `src/pages/index.astro` + `src/components/home/*`
  - TopBar 4개 주 메뉴: 홈, 오늘의 이슈, 지원금, 가이드
  - Footer 3열: 메인 메뉴(반복) + 사이트 정보 + 법적 고지 (3개 링크 그룹)
  - 홈 컴포넌트: CategoriesGrid(/subsidies/?category=), PersonaPicker(/personas/[id])
  - QuickCheckCTA, RecentlyAdded, OtherIssuesSection → 내부 페이지 모두 링크됨

### 5. 개별 지원금 페이지 내부 링크 최소화 (의도적)
- **파일**: `src/pages/subsidies/[id].astro`
  - 백링크: 페르소나 hub, 카테고리 hub, 상황 페이지, 토픽 페이지
  - 포워드 링크: 관련 지원금 2~3개만(apply rail 제외), 뒤로가기만
  - **이유**: 신청 CTA 강조(정부 공식 사이트 진출)

### 6. 격리 페이지 없음 — 모든 페이지 2개 이상 진입 경로
- 페이지별 도달성:
  - `/guide/`: TopBar(4) + Footer(3) + 상황/personas에서 rail 링크 (P0)
  - `/quick/`: 모든 hub 페이지의 CrossRefRail 마지막 항목 + Footer
  - `/glossary/`: 구조 추가 확인 필요(접근성 낮은 것으로 추정)
  - `/about/`, `/contact/`: Footer에만 (충분)

---

## 제안 (Proposals)

### 1. 트렌딩 토픽 → 메인 hub로 승격 (상황·분야와 등가)
- **효과**: 오늘의 이슈 페이지 트래픽 → 토픽 hub로 분산 (관심 키워드 기반 관여도 ↑)
  - 토픽별 지원금 매칭 기능 활용 SEO (롱테일 "청년 월세", "신혼 전세" 같은 뉴스-지원금 연결고리)
  - Google News 수집 → 관련 지원금 추천 흐름 자연스러움
- **비용**: S (1~2시간 / 링크 추가, 홈 컴포넌트 일부 수정)
- **외부 의존**: 없음
- **회귀 위험**: 낮음 (기존 토픽 페이지 구조 유지, 링크만 추가)

**실행**: 
- `/issues/topics/[term].astro` 내 "다른 토픽 보기" nav 추가 (8개 최신·핫 토픽)
- 또는 `/issues/` 허브에서 상단 5개 토픽을 **Featured Topics** 섹션으로 노출 (CategoriesGrid 스타일)
- 홈 컴포넌트 하단에 "오늘의 뉴스-지원금 연결" 섹션 (3개 토픽 카드)

---

### 2. 용어(glossary) 페이지 내 지원금·페르소나 cross-ref 보강
- **효과**: 용어 검색 → 관련 지원금·상황 추천 (정보 체류 시간 ↑, SEO 긴 꼬리 키워드 커버)
  - "소득 기준", "전세보증금" 같은 용어가 지원금 신청 과정에서 빈번 (진단→신청 단계 완성도 ↑)
- **비용**: M (4~6시간 / 용어-지원금 관계 데이터 구축)
- **외부 의존**: 없음 (기존 collection 재사용)
- **회귀 위험**: 낮음 (새 컴포넌트 추가, 기존 페이지 구조 불변)

**실행**:
- `src/pages/glossary/[id].astro`에서 관련 지원금 top3 fetch (태그/요약 텍스트 매칭)
- CrossRefRail 추가: "이 용어가 나오는 지원금", "관련 상황", "관련 페르소나"
- glossary 색인 페이지에서 인기 용어 10개 호출 (섹션: "자주 찾는 용어")

---

### 3. 카테고리 hub 양방향 링크 강화 (진입→상황별 필터)
- **효과**: `/subsidies/?category=주거` → 상황별 필터링 제시 (사용자 흐름 "분야→내 상황" 명시화)
  - 주거 지원금 30건 중 "신혼", "청년", "저소득" 필터링 → 직관성 ↑, 바운스율 ↓
- **비용**: M (3~4시간 / 필터 UI 재사용, 서버 로직 변경 미소)
- **외부 의존**: 없음
- **회귀 위험**: 낮음 (기존 filtered list 로직 유지)

**실행**:
- `/subsidies/` 페이지 필터 바에 "상황별" toggle 추가 (situations list 기반)
- 또는 `/categories/[id].astro` 페이지 신규: 분야별 hub → 상황 칩 + 페르소나 칩
- 예: `/categories/주거/` → "신혼특공", "청년 월세", "주거급여" (관련 지원금 카운트 표시)

---

### 4. /quick/ (5분 진단) 결과 페이지 내부 hub 링크 강화
- **효과**: 진단 결과 → 관련 상황·페르소나·토픽 추천 (사후 몰입도 ↑, 추가 클릭 경로 확보)
  - 예: "office-rookie + 주거" 결과 → 오피스텔, 신혼집 상황, "청년 월세" 토픽 링크
- **비용**: M (5~6시간 / 진단 로직 기존, 결과 렌더링 추가)
- **외부 의존**: 없음
- **회귀 위험**: 중간 (클라이언트 상태 관리, 해시 기반 데이터 통합 필요)

**실행**:
- 진단 완료 UI에 "당신의 정보" 카드 추가: 선택 페르소나, 소득, 관심 분야, 이벤트
- 아래 "추천 관점" 섹션: 상황(3개) + 토픽(2개) + 더 찾기 (/subsidies/?category=…)
- 결과 URL 공유 시 해시 유지 (친구 공유 시 같은 매칭 결과 재현)

---

## 권장 P0

**1. 트렌딩 토픽 hub 승격** — 가장 높은 SEO 효율
- 뉴스-지원금 연결이 강력한 SEO/사용자 이해도 증대 신호
- 구현 간단 (링크 4~6개만 추가), 즉시 효과
- 경합도 낮은 뉴스 키워드 & 지원금 동시 랭킹 가능

**2. /quick/ 결과 hub 강화** — 가장 높은 전환도 (사용자 몰입)
- 이미 5분 투자한 사용자 → 지원금 신청 단계로 자연스럽 유도
- 클라이언트 진단 데이터 → 모든 hub 페이지 개인화 추천 가능
- 추후 세션·로그 분석 데이터 축적 최고

---

최종: 1번 → 2번 순으로 추진, 각 2주 sprint로 충분. 용어(glossary) 강화는 선택.
