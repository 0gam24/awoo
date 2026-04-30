# A11y / BP — Cycle #7

## 발견
- `src/pages/quick/index.astro` 스텝퍼 `<ol class="stepper" aria-label="진행 단계">` (L114): `showStep()`에서 `current`/`done` 클래스만 토글, `aria-current="step"` 미부여. 스크린리더가 "현재 단계"를 음성으로 안내하지 못함.
- `src/pages/contact.astro` form (L28~56): name·email·subject·message 4필드 모두 이미 `required` 명시됨. 다만 에러 메시지 `#cf-error`(L55)가 `role="alert"`만 있고, 폼 필드와 `aria-describedby`로 연결 안 됨. submit 실패 시 SR이 폼 단위 에러를 필드와 연관 짓지 못함.
- `src/components/FeedbackWidget.astro` textarea(L26~32): 선택사항이라 `required` 부적절. 에러 `#fb-error`(L42) 역시 form과 `aria-describedby` 미연결.
- `src/pages/preferences.astro`: form input 없음 (조회·삭제 UI만). C6 P1의 "preferences form required"는 적용 대상 부재.
- gloss-link(C6 P0-1): `title` 속성만 있고 `aria-label` fallback 없음 — SR 일부에서 title 미낭독 케이스.

## 제안
1. **/quick stepper aria-current="step"** — `showStep()` 내 `el.classList.add('current')`와 동시에 `el.setAttribute('aria-current','step')`, current 외 항목은 `removeAttribute('aria-current')`. (vanilla, ~3줄)
2. **contact form aria-describedby** — `<form id="contact-form" aria-describedby="cf-error">` 부여, 에러 표시 시 SR이 폼-에러 자동 연결.
3. **FeedbackWidget aria-describedby** — `<form id="fb-form" aria-describedby="fb-error">` 부여 (textarea는 required 없음 유지).
4. **gloss-link aria-label fallback** — InlineGlossary anchor에 `aria-label={`${term} 용어 설명`}` 추가 (C6 P0-1 컴포넌트 직접 수정).

## 권장 P0
**P0-1 (스텝퍼 aria-current)** — 가장 단순(3줄) + WCAG 4.1.2 직접 향상, 진단 흐름 SR 사용자 경험 핵심. P0-2는 contact·feedback 두 폼 aria-describedby 일괄 (각 1속성).
