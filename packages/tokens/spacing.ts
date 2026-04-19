/**
 * @file packages/tokens/spacing.ts
 *
 * Design token spacing system — consistent spacing scale and layout tokens.
 * Maps to Tailwind's default spacing scale for seamless integration.
 */

// ─── Spacing Scale (4px base unit) ──────────────────────────────────────────

export const spacing = {
  0:   '0px',
  0.5: '2px',
  1:   '4px',
  1.5: '6px',
  2:   '8px',
  2.5: '10px',
  3:   '12px',
  3.5: '14px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  7:   '28px',
  8:   '32px',
  9:   '36px',
  10:  '40px',
  11:  '44px',
  12:  '48px',
  14:  '56px',
  16:  '64px',
  20:  '80px',
  24:  '96px',
  28:  '112px',
  32:  '128px',
  36:  '144px',
  40:  '160px',
  44:  '176px',
  48:  '192px',
  52:  '208px',
  56:  '224px',
  60:  '240px',
  64:  '256px',
  72:  '288px',
  80:  '320px',
  96:  '384px',
} as const;

export type SpacingKey = keyof typeof spacing;

// ─── Semantic Spacing ────────────────────────────────────────────────────────

export const space = {
  // Component internals
  inlineXs: spacing[1],    // 4px  — tight inline spacing
  inlineSm: spacing[2],    // 8px  — compact inline
  inlineMd: spacing[3],    // 12px — default inline
  inlineLg: spacing[4],    // 16px — relaxed inline

  // Stacking (vertical)
  stackXs: spacing[1],     // 4px  — tight stack (list items)
  stackSm: spacing[2],     // 8px  — compact stack
  stackMd: spacing[4],     // 16px — default stack
  stackLg: spacing[6],     // 24px — section gaps
  stackXl: spacing[8],     // 32px — major sections
  stack2xl: spacing[12],   // 48px — page sections

  // Inset (padding)
  insetXs: spacing[1],     // 4px  — button inner
  insetSm: spacing[2],     // 8px  — small card inner
  insetMd: spacing[4],     // 16px — default card inner
  insetLg: spacing[6],     // 24px — spacious card
  insetXl: spacing[8],     // 32px — page padding

  // Page layout
  pagePaddingX: spacing[6],  // 24px — mobile
  pagePaddingLg: spacing[8], // 32px — desktop
  sidebarWidth: '280px',
  sidebarCollapsed: '64px',
  headerHeight: '64px',
  footerHeight: '48px',
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const radius = {
  none:  '0px',
  xs:    '2px',
  sm:    '4px',
  md:    '6px',
  lg:    '8px',
  xl:    '12px',
  '2xl': '16px',
  '3xl': '24px',
  full:  '9999px',
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const shadow = {
  xs:    '0 1px 2px 0 rgba(0,0,0,0.05)',
  sm:    '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
  md:    '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
  lg:    '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
  xl:    '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
  '2xl': '0 25px 50px -12px rgba(0,0,0,0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0,0,0,0.05)',
  glow:  '0 0 15px 3px rgba(99,102,241,0.3)',
  glowSm:'0 0 8px 2px rgba(99,102,241,0.2)',
} as const;

// ─── Z-Index Scale ───────────────────────────────────────────────────────────

export const zIndex = {
  base:     0,
  dropdown: 10,
  sticky:   20,
  overlay:  30,
  modal:    40,
  popover:  50,
  toast:    60,
  tooltip:  70,
  skiplink: 9999,
} as const;

// ─── Breakpoints ─────────────────────────────────────────────────────────────

export const breakpoint = {
  xs: '475px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ─── Container Widths ────────────────────────────────────────────────────────

export const containerWidth = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: '100%',
} as const;
