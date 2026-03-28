import { useCallback } from 'react';

export function useAnnouncer() {
  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const el = document.getElementById('a11y-announcer');
    if (el) {
      el.setAttribute('aria-live', politeness);
      el.textContent = message;
      // Clear after read
      setTimeout(() => { el.textContent = ''; }, 3000);
    }
  }, []);

  return announce;
}
