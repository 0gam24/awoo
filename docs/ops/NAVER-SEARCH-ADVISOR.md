# Naver Search Advisor 등록 가이드

> 한국 검색 엔진 1위 Naver는 IndexNow에 참여하지 않으므로 별도 등록·sitemap 제출 필요.
> 본 문서는 awoo.or.kr이 Naver 검색 결과에 색인되는 절차를 정리한다.

---

## 1. 사전 준비

- Naver 계정 (운영자: kjh791213@gmail.com 또는 별도 운영 계정)
- Cloudflare 도메인 관리 권한 (DNS TXT 인증용)
- awoo.or.kr 라이브 + HTTPS 정상

---

## 2. Naver Search Advisor 사이트 등록

### 2-1. 사이트 추가

1. https://searchadvisor.naver.com/ 접속 → Naver 로그인
2. 우측 상단 **웹마스터 도구 → 사이트 등록** 클릭
3. URL 입력: `https://awoo.or.kr` → **등록**

### 2-2. 소유 확인 (HTML 메타 태그 vs HTML 파일 vs DNS)

**권장: HTML 메타 태그 (코드 commit 가능)**

1. Naver 안내 화면에서 메타 태그 복사:
   ```html
   <meta name="naver-site-verification" content="ABC123..." />
   ```
2. 본 프로젝트 `src/layouts/BaseLayout.astro` 의 `<head>` 안에 추가
3. main 브랜치 push → Cloudflare 자동 배포 (1~3분)
4. Naver 화면에서 **확인** 클릭

**대안: DNS TXT (영구적이고 보안상 유리)**

1. Naver 화면에서 TXT 레코드 값 복사
2. Cloudflare → `awoo.or.kr` → DNS → **레코드 추가**
   - 유형: `TXT`
   - 이름: `@`
   - 콘텐츠: `naver-site-verification=ABC123...`
   - 프록시: 회색 구름 (DNS only)
3. 5분 대기 후 Naver **확인**

> 메타 태그·DNS 둘 다 추가해도 무관 (이중 검증).

---

## 3. Sitemap 제출

본 사이트는 빌드 타임에 `sitemap-index.xml` 자동 생성.

1. Search Advisor → 좌측 메뉴 → **요청 → 사이트맵 제출**
2. 입력: `sitemap-index.xml` (전체 URL 아님)
3. **확인**
4. 24시간 내 status 정상 표시 시 완료

> 새 페이지(예: `/issues/topics/...`)는 다음 빌드 후 자동으로 sitemap에 포함된다.

---

## 4. RSS 피드 등록 (선택)

Naver는 RSS 직접 색인 X. 단 News 검색 노출에 도움될 수 있음.

- `/feed.xml` — 신규 정부 지원금
- `/feed-issues.xml` — 오늘의 이슈 포스트

**제출 방법**: 현재 Search Advisor에서 RSS 별도 제출 메뉴는 없음. sitemap에 RSS 항목이 자동 포함되어 있다면 OK.

---

## 5. 색인 요청 (수동)

특정 URL을 즉시 색인 큐에 넣기:

1. Search Advisor → **요청 → 웹페이지 수집 요청**
2. URL 입력 (예: `https://awoo.or.kr/issues/2026-04-29/damage-relief-ganghwa-2026/`)
3. **요청**

> 1일 약 50개 URL 가능. 새 이슈 포스트나 트렌딩 토픽 페이지에 사용.

---

## 6. 모니터링 체크리스트 (월 1회)

- **사이트 진단 → 콘텐츠**: 수집 거부·오류 0건 유지
- **사이트 진단 → 검색 노출**: 색인된 페이지 수 증가 추세
- **검색어 분석**: 어떤 키워드로 진입하는지
  - "지원금" 광역 → "청년 월세지원" 롱테일까지 분포 확인
- **로봇 차단·Naver 봇 점검**:
  - robots.txt에 `Naverbot` 또는 `Yeti` 명시 거부 X 확인
  - 본 프로젝트는 `User-agent: *` Allow 라 통과

---

## 7. 본 프로젝트 robots.txt 확인

`public/robots.txt`:

```
User-agent: *
Allow: /
```

이 설정으로 Naver Yeti 봇 자동 허용. 별도 명시 추가 불필요.

> AI 봇(GPTBot·ClaudeBot 등)은 별도 명시 — Naver 검색과 무관.

---

## 8. 문제 해결

| 증상 | 원인·해결 |
|---|---|
| 메타 태그 인증 실패 | Cloudflare 캐시 — Page Rules에서 캐시 강제 갱신 또는 5분 재시도 |
| sitemap 0 URL | sitemap-index.xml 직접 접속 → XML 정상이면 24시간 대기 |
| 색인 거부 | "사이트 진단 → 콘텐츠 → 차단된 페이지" 확인. noindex 누락 페이지 점검 |
| Naver 검색 0건 | 신규 사이트는 1~3주 소요. 그 사이 색인 요청으로 가속 |

---

## 9. IndexNow vs Naver — 자동화 차이

| 항목 | IndexNow (Bing/Yandex) | Naver Search Advisor |
|---|---|---|
| 자동 ping | ✓ (workflow 통합) | ✗ (수동만) |
| sitemap 자동 발견 | △ (제출 필요) | ✗ (수동 제출) |
| AI 봇 노출 | 무관 | 무관 |

→ **Naver는 1회성 등록 후 자동 sitemap 갱신만 신뢰**, 큰 콘텐츠 변경은 수동 색인 요청 필요.

---

## 10. 운영 자동화 검토 (미구현)

수동이지만 자동화 가능한 부분:

- **Naver 검색 분석 API 연동**: 매주 진입 키워드 Top 20 → Slack
  - 신청: Search Advisor → 설정 → API 키 발급
  - 본 프로젝트는 미구현 — 운영 단계에서 검토

- **사이트 진단 자동 알림**: 콘텐츠 차단·오류 발생 시 이메일
  - Search Advisor 자체 알림 설정 → 운영자 이메일 등록 (1회 설정)
