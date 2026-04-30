/**
 * Focus trap — modal/dialog 내부에 키보드 포커스 가둠.
 *
 * WCAG 2.1.2 (No Keyboard Trap의 역방향 — 모달은 의도적 trap),
 * WCAG 2.4.3 (Focus Order), WCAG 2.4.11 (Focus Not Obscured) 대응.
 *
 * 외부 의존 0 — 순수 DOM API만 사용.
 *
 * @example
 *   const trap = createFocusTrap(modalRoot, {
 *     onEscape: () => closeModal(),
 *   });
 *   // 모달 열림
 *   trap.activate();
 *   // 모달 닫힘
 *   trap.deactivate();
 */

const TABBABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface FocusTrapOptions {
  /** Esc 키 누름 시 호출. 미지정 시 Esc는 trap에 전달되지 않음. */
  onEscape?: () => void;
  /** deactivate 시 자동으로 이전 포커스 복귀 (기본 true) */
  returnFocus?: boolean;
}

interface FocusTrap {
  activate(): void;
  deactivate(): void;
}

export function createFocusTrap(root: HTMLElement, opts: FocusTrapOptions = {}): FocusTrap {
  const { onEscape, returnFocus = true } = opts;
  let previousActive: HTMLElement | null = null;
  let active = false;

  function getTabbable(): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
      (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
    );
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (!active) return;
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }
    if (e.key !== 'Tab') return;

    const tabbables = getTabbable();
    if (tabbables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = tabbables[0]!;
    const last = tabbables[tabbables.length - 1]!;
    const current = document.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      if (current === first || !root.contains(current)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (current === last || !root.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return {
    activate(): void {
      if (active) return;
      previousActive = document.activeElement as HTMLElement | null;
      active = true;
      document.addEventListener('keydown', handleKeyDown);
      // 첫 tabbable에 포커스 (없으면 root 자체)
      const tabbables = getTabbable();
      if (tabbables.length > 0) {
        tabbables[0]!.focus();
      } else if (root.tabIndex >= 0) {
        root.focus();
      }
    },
    deactivate(): void {
      if (!active) return;
      active = false;
      document.removeEventListener('keydown', handleKeyDown);
      if (returnFocus && previousActive && document.contains(previousActive)) {
        previousActive.focus();
      }
      previousActive = null;
    },
  };
}
