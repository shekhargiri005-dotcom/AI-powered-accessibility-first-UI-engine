'use client';

import { useMemo } from 'react';

// ─── Provider Color Definitions ────────────────────────────────────────────────
// Each provider gets a complete color palette that flows through the entire UI.

export interface ProviderTheme {
  // Tailwind color names
  name: string;
  // Primary accent (replaces violet everywhere)
  accent: string;        // e.g. 'emerald'
  // Text colors
  textPrimary: string;   // e.g. 'text-emerald-400'
  textMuted: string;     // e.g. 'text-emerald-400/70'
  textFaint: string;     // e.g. 'text-emerald-400/50'
  // Background colors
  bgLight: string;       // e.g. 'bg-emerald-500/10'
  bgMedium: string;      // e.g. 'bg-emerald-500/20'
  bgSolid: string;       // e.g. 'bg-emerald-500'
  bgCard: string;        // e.g. 'bg-emerald-500/5'
  // Border colors
  border: string;        // e.g. 'border-emerald-500/20'
  borderActive: string;  // e.g. 'border-emerald-500/40'
  borderFocus: string;   // e.g. 'border-emerald-500/50'
  // Shadow colors
  shadow: string;        // e.g. 'shadow-emerald-500/25'
  shadowGlow: string;    // e.g. 'shadow-emerald-500/60'
  // Gradient classes
  gradient: string;      // e.g. 'from-emerald-500 to-teal-600'
  gradientSubtle: string;// e.g. 'from-emerald-500/10 to-teal-500/5'
  // Radial gradient for CSS (inline styles)
  radialOrb: string;     // e.g. 'rgba(16,185,129,0.10)'
  radialOrbMid: string;  // e.g. 'rgba(16,185,129,0.03)'
  // Scrollbar
  scrollbar: string;     // e.g. 'bg-emerald-500/10'
  scrollbarHover: string;// e.g. 'bg-emerald-500/30'
}

const THEMES: Record<string, ProviderTheme> = {
  openai: {
    name: 'OpenAI',
    accent: 'emerald',
    textPrimary: 'text-emerald-400',
    textMuted: 'text-emerald-400/70',
    textFaint: 'text-emerald-400/50',
    bgLight: 'bg-emerald-500/10',
    bgMedium: 'bg-emerald-500/20',
    bgSolid: 'bg-emerald-500',
    bgCard: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    borderActive: 'border-emerald-500/40',
    borderFocus: 'border-emerald-500/50',
    shadow: 'shadow-emerald-500/25',
    shadowGlow: 'shadow-emerald-500/60',
    gradient: 'from-emerald-500 to-teal-600',
    gradientSubtle: 'from-emerald-500/10 to-teal-500/5',
    radialOrb: 'rgba(16,185,129,0.10)',
    radialOrbMid: 'rgba(16,185,129,0.03)',
    scrollbar: 'bg-emerald-500/10',
    scrollbarHover: 'bg-emerald-500/30',
  },
  google: {
    name: 'Google',
    accent: 'blue',
    textPrimary: 'text-blue-400',
    textMuted: 'text-blue-400/70',
    textFaint: 'text-blue-400/50',
    bgLight: 'bg-blue-500/10',
    bgMedium: 'bg-blue-500/20',
    bgSolid: 'bg-blue-500',
    bgCard: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    borderActive: 'border-blue-500/40',
    borderFocus: 'border-blue-500/50',
    shadow: 'shadow-blue-500/25',
    shadowGlow: 'shadow-blue-500/60',
    gradient: 'from-blue-500 to-cyan-600',
    gradientSubtle: 'from-blue-500/10 to-cyan-500/5',
    radialOrb: 'rgba(59,130,246,0.10)',
    radialOrbMid: 'rgba(59,130,246,0.03)',
    scrollbar: 'bg-blue-500/10',
    scrollbarHover: 'bg-blue-500/30',
  },
  groq: {
    name: 'Groq',
    accent: 'orange',
    textPrimary: 'text-orange-400',
    textMuted: 'text-orange-400/70',
    textFaint: 'text-orange-400/50',
    bgLight: 'bg-orange-500/10',
    bgMedium: 'bg-orange-500/20',
    bgSolid: 'bg-orange-500',
    bgCard: 'bg-orange-500/5',
    border: 'border-orange-500/20',
    borderActive: 'border-orange-500/40',
    borderFocus: 'border-orange-500/50',
    shadow: 'shadow-orange-500/25',
    shadowGlow: 'shadow-orange-500/60',
    gradient: 'from-orange-500 to-red-600',
    gradientSubtle: 'from-orange-500/10 to-red-500/5',
    radialOrb: 'rgba(249,115,22,0.10)',
    radialOrbMid: 'rgba(249,115,22,0.03)',
    scrollbar: 'bg-orange-500/10',
    scrollbarHover: 'bg-orange-500/30',
  },
};

// Default violet theme (used when no provider is selected)
const DEFAULT_THEME: ProviderTheme = {
  name: 'Default',
  accent: 'violet',
  textPrimary: 'text-violet-400',
  textMuted: 'text-violet-400/70',
  textFaint: 'text-violet-400/50',
  bgLight: 'bg-violet-500/10',
  bgMedium: 'bg-violet-500/20',
  bgSolid: 'bg-violet-500',
  bgCard: 'bg-violet-500/5',
  border: 'border-violet-500/20',
  borderActive: 'border-violet-500/40',
  borderFocus: 'border-violet-500/50',
  shadow: 'shadow-violet-500/25',
  shadowGlow: 'shadow-violet-500/60',
  gradient: 'from-violet-500 to-purple-600',
  gradientSubtle: 'from-violet-500/10 to-purple-500/5',
  radialOrb: 'rgba(139,92,246,0.10)',
  radialOrbMid: 'rgba(139,92,246,0.03)',
  scrollbar: 'bg-violet-500/10',
  scrollbarHover: 'bg-violet-500/30',
};

/**
 * Hook to get the current provider's theme.
 * Falls back to violet theme when no provider is selected.
 */
export function useProviderTheme(provider?: string | null): ProviderTheme {
  return useMemo(() => {
    if (!provider) return DEFAULT_THEME;
    return THEMES[provider.toLowerCase()] ?? DEFAULT_THEME;
  }, [provider]);
}

export { DEFAULT_THEME, THEMES };
