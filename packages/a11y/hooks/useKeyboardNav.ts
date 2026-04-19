import * as React from 'react';
import { useEffect, useCallback } from 'react';

interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
}

export function useKeyboardNav(bindings: KeyBinding[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const binding of bindings) {
        const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase();
        const ctrlMatch = !!binding.ctrl === (e.ctrlKey || e.metaKey);
        const shiftMatch = !!binding.shift === e.shiftKey;
        const altMatch = !!binding.alt === e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          binding.handler(e);
          return;
        }
      }
    },
    [bindings]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function useRoveFocus(itemCount: number, orientation: 'horizontal' | 'vertical' = 'vertical') {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
      const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

      if (e.key === nextKey) {
        e.preventDefault();
        setCurrentIndex(prev => (prev + 1) % itemCount);
      } else if (e.key === prevKey) {
        e.preventDefault();
        setCurrentIndex(prev => (prev - 1 + itemCount) % itemCount);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentIndex(itemCount - 1);
      }
    },
    [itemCount, orientation]
  );

  return { currentIndex, setCurrentIndex, handleKeyDown };
}
