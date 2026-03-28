import React, { useEffect, useRef } from 'react';

export function FocusTrap({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const focusable = ref.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) {
      (focusable[0] as HTMLElement).focus();
    }
  }, [active]);

  return <div ref={ref}>{children}</div>;
}
