/**
 * @file packages/tokens/typography.ts
 *
 * Design token typography system — font sizes, weights, line heights,
 * and letter spacing for consistent text rendering.
 */

// ─── Font Families ───────────────────────────────────────────────────────────

export const fontFamily = {
  sans:  "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  mono:  "'JetBrains Mono', ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
  display: "'Inter', ui-sans-serif, system-ui, sans-serif",
} as const;

// ─── Font Size Scale ─────────────────────────────────────────────────────────

export const fontSize = {
  xs:   { size: '0.75rem', lineHeight: '1rem' },       // 12px / 16px
  sm:   { size: '0.875rem', lineHeight: '1.25rem' },    // 14px / 20px
  base: { size: '1rem', lineHeight: '1.5rem' },         // 16px / 24px
  lg:   { size: '1.125rem', lineHeight: '1.75rem' },    // 18px / 28px
  xl:   { size: '1.25rem', lineHeight: '1.75rem' },     // 20px / 28px
  '2xl': { size: '1.5rem', lineHeight: '2rem' },        // 24px / 32px
  '3xl': { size: '1.875rem', lineHeight: '2.25rem' },   // 30px / 36px
  '4xl': { size: '2.25rem', lineHeight: '2.5rem' },     // 36px / 40px
  '5xl': { size: '3rem', lineHeight: '3.25rem' },       // 48px / 52px
  '6xl': { size: '3.75rem', lineHeight: '4rem' },       // 60px / 64px
  '7xl': { size: '4.5rem', lineHeight: '5rem' },        // 72px / 80px
} as const;

// ─── Font Weight ─────────────────────────────────────────────────────────────

export const fontWeight = {
  thin:       100,
  extralight: 200,
  light:      300,
  normal:     400,
  medium:     500,
  semibold:   600,
  bold:       700,
  extrabold:  800,
  black:      900,
} as const;

// ─── Letter Spacing ──────────────────────────────────────────────────────────

export const letterSpacing = {
  tighter: '-0.05em',
  tight:   '-0.025em',
  normal:  '0em',
  wide:    '0.025em',
  wider:   '0.05em',
  widest:  '0.1em',
} as const;

// ─── Semantic Typography Presets ─────────────────────────────────────────────

export const text = {
  // Headings
  h1: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['4xl'].size,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['4xl'].lineHeight,
    letterSpacing: letterSpacing.tighter,
  },
  h2: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'].size,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['3xl'].lineHeight,
    letterSpacing: letterSpacing.tighter,
  },
  h3: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'].size,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize['2xl'].lineHeight,
    letterSpacing: letterSpacing.tight,
  },
  h4: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl.size,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.xl.lineHeight,
    letterSpacing: letterSpacing.tight,
  },
  // Body
  body: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base.size,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.base.lineHeight,
    letterSpacing: letterSpacing.normal,
  },
  bodySm: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm.size,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.sm.lineHeight,
    letterSpacing: letterSpacing.normal,
  },
  bodyLg: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg.size,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.lg.lineHeight,
    letterSpacing: letterSpacing.normal,
  },
  // UI elements
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs.size,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.xs.lineHeight,
    letterSpacing: letterSpacing.wider,
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm.size,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.sm.lineHeight,
    letterSpacing: letterSpacing.normal,
  },
  overline: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs.size,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.xs.lineHeight,
    letterSpacing: letterSpacing.widest,
  },
  // Code
  code: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm.size,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.sm.lineHeight,
    letterSpacing: letterSpacing.normal,
  },
  codeLg: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.base.size,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.base.lineHeight,
    letterSpacing: letterSpacing.normal,
  },
} as const;

// ─── Utility: Convert preset to CSS style object ─────────────────────────────

export function toStyle(preset: typeof text[keyof typeof text]): React.CSSProperties {
  return {
    fontFamily: preset.fontFamily,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    lineHeight: preset.lineHeight,
    letterSpacing: preset.letterSpacing,
  };
}

import type React from 'react';
