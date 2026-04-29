# IndexNow 자동 ping 운영 가이드

> [IndexNow](https://www.indexnow.org/)는 Bing·Yandex·Seznam 등이 채택한 표준으로, 사이트 소유자가 콘텐츠 변경을 검색엔진에 직접 푸시할 수 있다.
> 본 문서는 awoo.or.kr이 빌드 후 IndexNow에 자동 ping 보내는 절차를 설명한다.

---

## 1. 1회성 사전 설정

### 1-1. 키 파일 생성 (운영자 직접)

IndexNow 키는 8~128자 16진수 문자열로, 운영자가 임의 생성해 사이트 루트에 평문 파일로 배포한다.

**키 생성 (운영자 PC에서 1회):**

```bash
# Mac/Linux
openssl rand -hex 16
# 또는 Node
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

출력 예: `7b3f9c2a4d1e8f5b6c0d2e3f4a5b6c7d` — 이 값을 **`KEY`** 라고 부른다.

### 1-2. public 파일 배치

IndexNow는 ping 시 `https://awoo.or.kr/<KEY>.txt` 에 동일 키가 평문으로 있는지 검증한다.

```bash
# 프로젝트 루트에서
echo "<KEY>" > public/<KEY>.txt
```

예: 키가 `7b3f9c2a4d1e8f5b6c0d2e3f4a5b6c7d` 이면

```
public/7b3f9c2a4d1e8f5b6c0d2e3f4a5b6c7d.txt
```

파일 내용은 그 키 한 줄.

### 1-3. 환경변수 등록

| 위치 | 키 | 값 |
|---|---|---|
| 로컬 | `.env.local` | `INDEXNOW_KEY=<KEY>` |
| GitHub | Settings → Secrets → Actions | `INDEXNOW_KEY=<KEY>` |

> 키는 비밀이 아니지만 (public 파일과 동일) 환경변수로 관리해 코드 commit에서 분리한다.

### 1-4. 검증

```bash
# 로컬에서 빌드 후 실행
npm run build
npm run indexnow:ping
```

성공 시 출력 예:
```
[indexnow] sitemap에서 URL 230건 추출
[indexnow] 신규/변경 230건 ping 시작
  · batch 1/1: 230건 → ✓ (status 200)
[indexnow] 1/1 batch 성공
```

---

## 2. 자동 트리거 (CI)

배포 워크플로 다음 단계로 자동 ping. `.github/workflows/deploy.yml` 또는 별도 workflow에서 호출:

```yaml
- name: IndexNow ping
  if: github.ref == 'refs/heads/main'
  env:
    INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }}
  run: |
    npm run build
    npm run indexnow:ping
  continue-on-error: true  # 색인 실패가 배포를 막지 않음
```

이미 통합된 경우 `.github/workflows/indexnow.yml` 참조.

---

## 3. 동작 원리

### 3-1. 변경 감지

빌드 산출물 `dist/client/sitemap-*.xml` 을 파싱해 모든 URL을 수집한다.

`.indexnow-state.json` (gitignored) 에 직전 ping의 알려진 URL을 저장하고, 이번 ping 시 차이만 추출한다.

- 신규 페이지: 즉시 ping
- 기존 페이지: 직전 ping 이후 sitemap에서 사라지지 않은 한 재ping X

### 3-2. ping API

`POST https://api.indexnow.org/IndexNow`

```json
{
  "host": "awoo.or.kr",
  "key": "<KEY>",
  "keyLocation": "https://awoo.or.kr/<KEY>.txt",
  "urlList": ["https://awoo.or.kr/...", "..."]
}
```

응답:
- `200/202` 성공 (큐에 들어감, 실제 색인은 별개 일정)
- `400` 형식 오류
- `403` 키 검증 실패
- `422` 너무 많은 호스트 또는 잘못된 URL

---

## 4. 지원 검색엔진

본 서비스는 한국어 사이트이므로 다음에 가치 있음:

| 검색엔진 | 본 사이트 영향 |
|---|---|
| **Bing** | 직접 색인 (한국 일부 사용자) |
| **Yandex** | 색인 (한국 영향 적음) |
| **Seznam** | 색인 (체코 — 무관) |
| **Naver** | IndexNow 미참여 → Search Advisor 별도 등록 필요 |
| **Google** | IndexNow 미참여 → Search Console (sitemap만으로 색인) |

> Naver Search Advisor: https://searchadvisor.naver.com/  
> 별도 사이트맵 제출 필요. 수동 작업 1회.

---

## 5. 모니터링

`.indexnow-state.json` 항목:

```json
{
  "lastPing": "2026-04-29T12:34:56.789Z",
  "knownUrls": [...],
  "lastBatchUrls": 12,
  "lastBatchOk": true
}
```

- `lastPing` — 마지막 ping 시각
- `lastBatchUrls` — 마지막 ping에서 보낸 URL 수
- `lastBatchOk` — 모든 batch 성공 여부

CI 워크플로의 GITHUB_STEP_SUMMARY에도 동일 정보가 마크다운 표로 출력된다.

---

## 6. 키 회전

키 변경이 필요한 경우 (유출 의심 등):

1. 새 키 생성 (§1-1)
2. 새 `public/<NEW_KEY>.txt` 추가 (구 파일은 잠시 유지 — DNS·CDN 캐시 갱신 동안)
3. `INDEXNOW_KEY` 환경변수 갱신 (로컬 + GH secret)
4. `npm run build && npm run indexnow:ping` — 새 키로 ping
5. 1주일 후 구 `public/<OLD_KEY>.txt` 삭제

---

## 7. 문제 해결

| 증상 | 원인·해결 |
|---|---|
| `INDEXNOW_KEY 미설정` | `.env.local` 또는 GH secret 추가 |
| `403 forbidden` | `<KEY>.txt` 파일이 public/에 없거나 빌드에서 누락 |
| `400 invalid` | URL 형식 오류 — sitemap 검증 |
| 같은 URL 매번 ping | `.indexnow-state.json` 손상 → 삭제 후 재실행 (1회 전체 재ping) |
| Bing에서 안 보임 | IndexNow는 큐 등록만 — 실제 색인은 며칠~수주 |
