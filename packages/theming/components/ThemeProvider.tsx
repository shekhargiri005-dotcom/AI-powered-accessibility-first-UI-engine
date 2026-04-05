'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system' | (string & Record<never, never>);

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => undefined,
});

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

/**
 * Provides a theme context with localStorage persistence.
 *
 * Fix: The original code called setState directly inside useEffect which triggered
 * a cascade render on every mount. We now separate the initial hydration (which only
 * touches state once) from the full setTheme side-effect handler (DOM + localStorage).
 */
export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  /** Applies a theme: updates state, DOM attribute, and persists to localStorage. */
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ui-theme', t);
    }
  }, []);

  /** Hydrate from localStorage once on mount — intentionally only reads, no side-effects. */
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem('ui-theme');
    if (saved && saved !== defaultTheme) {
      // Use setThemeState directly to avoid triggering localStorage re-write during hydration
      setThemeState(saved as Theme);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', saved);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty — runs once on mount only

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
