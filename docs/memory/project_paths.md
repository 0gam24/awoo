---
name: Project working paths
description: 실제 개발 경로 — Z: 드라이브 path 문제로 C:\dev\awoo에서 작업
type: project
originSessionId: 6e3a0917-3f3b-4e4a-b07e-5a89395fc854
---
**실제 작업 경로**: `C:\dev\awoo`
**Z: 위치**: `Z:\#0-1 작업진행\Bibe_Code\01_지원금가이드\awoo` 는 사용 불가

**제약 사항:**
1. **Vite + `#` 문자 비호환** — 경로 `Z:\#0-1...` 에 `#`가 포함돼 Vite가 `null bytes` 에러로 빌드 실패. Astro 6의 Vite는 명시적으로 경고 출력
2. **Z: = 네트워크 드라이브** — NTFS 정션(`mklink /J`)이 "Local NTFS volumes are required"로 거절됨. 디렉토리 심볼릭 링크(`mklink /D`)는 admin 또는 Developer Mode 필요
3. **pnpm은 Z: 사용 불가** — 심볼릭 링크 store 생성 시 EPERM 에러. **npm 사용**

**Z: 위치에는 `AWOO_PROJECT_LOCATION.md` 포인터 파일만 둠.**

**Why:** 네트워크 드라이브 + 특수문자 경로 조합은 Node 생태계 도구 다수가 깨짐. 1회 검증된 우회 방법(파일을 C:\dev\awoo로 이동)이 가장 안정적.

**How to apply:**
- 모든 npm/build/lighthouse 명령은 `cd /c/dev/awoo` 또는 `cd "C:\dev\awoo"` 에서 실행
- VS Code 등 IDE도 C:\dev\awoo를 작업 폴더로 열 것
- GitHub repo push도 C:\dev\awoo의 .git에서
- 사용자가 향후 다른 머신에서 클론할 때는 어느 경로든 무방 (단, # 문자나 네트워크 드라이브만 피하기)
