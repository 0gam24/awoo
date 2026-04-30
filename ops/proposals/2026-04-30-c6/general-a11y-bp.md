# A11y / BP — Cycle #6

## 발견
- Cycle #5 완료: skip-link/headings strict audit 217·218 페이지 위반 0, prefers-contrast: more 토큰, focusTrap.ts + HotkeyNav.
- 신규 schema 채널(HowTo·WebApplication·AboutPage·Article)은 JSON-LD라 sr 무시 → a11y 영향 없음, 검증 항목 제외.
- inline-glossary anchor `<a class="gloss-link" title="…">` 점선 underline visual + title hover, sr는 link role + accessible name 정상 읽힘.
- /quick stepper `<ol class="stepper" aria-label="진행 단계">` 적용됨, 단 현재 단계(aria-current) 미명시.
- 폼(contact·feedback·preferences) input 일부 required 누락, error 메시지 aria-describedby 연결 안 됨 → sr 사용자 오류 인지 어려움.

## 제안
1. inline-glossary anchor a11y 검증 (P0-2 협업) — gloss-link aria-label fallback + title sr-readable 확인 audit.
2. /quick stepper aria-current="step" 추가 — 현재 단계 li에 동적 부여, 진행 위치 sr 안내.
3. 폼 input required attribute + aria-describedby="<id>-error" 강화 — contact·feedback·preferences 3종 일괄.
4. CSP nonce 마이그레이션 — 대규모 보류 유지 (Cycle #7+ 검토).

## 권장 P0
- **P0-1**: /quick stepper aria-current="step" — 가장 적은 변경으로 sr UX 개선, 즉시 측정 가능.
- **P0-2**: 폼 3종 required + aria-describedby — 폼 a11y 표준 준수, Best Practices 점수 보호.
