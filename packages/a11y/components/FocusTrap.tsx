import * as React from 'react';

export interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  restoreFocus?: boolean;
}

export function FocusTrap({ children, active = true, restoreFocus = true }: FocusTrapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!active) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    const getFocusableElements = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('aria-hidden'));

    // Focus first element
    const focusable = getFocusableElements();
    if (focusable.length) {
      requestAnimationFrame(() => focusable[0].focus());
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusableElements();
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (restoreFocus && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [active, restoreFocus]);

  return <div ref={containerRef}>{children}</div>;
}
