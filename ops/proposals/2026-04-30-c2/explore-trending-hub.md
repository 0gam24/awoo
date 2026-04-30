# 트렌딩 토픽 hub 진입점 — Explore

## 발견

**현재 상태:**
- `_history.json`: totalCount ≥ 3 임계로 토픽 페이지 동적 생성 (2건: 피해지원금 13회, 공익수당 7회)
- `/issues/index.astro`: 상단 hero 5×3 다층 구조 + 사이드바 트렌딩 키워드 (정렬된 탑 5)
- `/issues/topics/[term].astro`: 토픽별 전문 페이지 (포스트/지원금/일별 추이) — **하단 nav 미구현**
- `src/components/home/`: NewsHero (자동화) + RecentlyAdded (신규) 기존 섹션
- 홈에서 "오늘의 뉴스-지원금 연결" 섹션 없음

**PSI 제약:** global.css 7.8KB (한도 50KB — 충분한 여유)

## 제안 (3가지 진입점)

### 1. 홈 하단 "트렌딩 토픽 & 관련 지원금" 섹션 (3카드)
**위치:** `RecentlyAdded` 다음  
**데이터:** _history.json top 3 (totalCount 내림차순)  
**카드 구성:** 토픽명 + 보도건수 + 관련 지원금 수 + 토픽 페이지 링크  
**CSS 영향:** ~1.2KB (인라인 그리드 + hover)  
**읽기시간:** 2초

### 2. 이슈 인덱스 hero 상단 "Featured Topics" 섹션 (5개)
**위치:** `.hero-section` 직전  
**데이터:** trending top 5 (today-issue.json)  
**카드 구성:** 토픽명 + 보도건수 + "/issues/topics/[term]/" 링크  
**CSS 영향:** ~1.0KB  
**기존 hero와 구분:** 색상 톤 (accent 대신 text-2 배경)

### 3. 토픽 페이지 하단 nav "다른 토픽 보기" (8개)
**위치:** timeline 섹션 이후  
**데이터:** _history.json 전체 - 현재 term (totalCount 내림차순, 8개)  
**카드 구성:** 토픽명 + 보도건수 + 화제일수 배지  
**CSS 영향:** ~1.2KB (2열 그리드 + badge)  
**탐색:** 독자가 같은 맥락의 다른 이슈 발견 용이

## 권장 P0

**1순위: 토픽 페이지 하단 nav** (explore-ia 가장 단순, 유지보수 최소)  
- `[term].astro` 末尾에 8개 카드 추가 (inline loop)  
- 데이터는 getStaticPaths에서 이미 로드된 history 활용
- UX: 당신이 본 토픽 → 유사 핫토픽 자연스러운 흐름

**2순위: 홈 섹션** (사용자 온보딩 강화)  
- NewsHero 다음 재사용 가능한 컴포넌트화  
- "오늘 뜨는 정부 지원금" 카피로 context 제공

**3순위: 이슈 hero 위** (필터 피로도 ↑, 나중 재검토)  
- 이미 hero 5개 + 사이드바 5개로 정보량 많음  
- Cycle #3 이후 A/B 테스트 필요

**실행 순서:** 3 → 1 → 2 (가벼운 것부터 검증)
