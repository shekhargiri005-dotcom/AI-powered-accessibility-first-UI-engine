import { useCallback, useEffect, useRef } from 'react';

export function useAnnouncer() {
  const announcerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let el = document.getElementById('a11y-announcer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'a11y-announcer';
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.setAttribute('role', 'status');
      el.className = 'sr-only';
      el.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
      document.body.appendChild(el);
    }
    announcerRef.current = el;

    return () => {
      // Don't remove — other instances may still use it
    };
  }, []);

  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const el = announcerRef.current || document.getElementById('a11y-announcer');
    if (!el) return;
    el.setAttribute('aria-live', politeness);
    // Clear and re-set to ensure re-announcement of same message
    el.textContent = '';
    requestAnimationFrame(() => {
      el!.textContent = message;
    });
    setTimeout(() => { if (el.textContent === message) el.textContent = ''; }, 5000);
  }, []);

  return announce;
}
