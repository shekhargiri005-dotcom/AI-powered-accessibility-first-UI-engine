/**
 * @file packages/tokens/spacing.ts
 *
 * Single source of truth for all spacing in the design system.
 *
 * This scale maps directly to Tailwind CSS spacing utilities.
 * Every number key corresponds to a Tailwind class suffix:
 *   e.g. spacing[4] → p-4, m-4, gap-4, mt-4, px-4, etc.
 *
 * RULES FOR GENERATED CODE (ENFORCED BY AI SYSTEM PROMPT):
 *   ✅ Use ONLY keys present in this scale (e.g., p-4, m-2.5, gap-6)
 *   ❌ Never use arbitrary values like p-[13px] or m-[7px]
 *   ❌ Never use spacing keys not in this list (e.g., p-13 is forbidden)
 *   🔄 For non-scale values, round DOWN to the nearest available key
 */

// ─── Base Spacing Scale ───────────────────────────────────────────────────────
// Matches Tailwind v3/v4 default spacing + full half-step extension.

export const spacing = {
  0:    '0px',
  0.5:  '0.125rem',   //  2px
  1:    '0.25rem',    //  4px
  1.5:  '0.375rem',   //  6px
  2:    '0.5rem',     //  8px
  2.5:  '0.625rem',   // 10px
  3:    '0.75rem',    // 12px
  3.5:  '0.875rem',   // 14px
  4:    '1rem',       // 16px
  5:    '1.25rem',    // 20px
  6:    '1.5rem',     // 24px
  7:    '1.75rem',    // 28px
  8:    '2rem',       // 32px
  9:    '2.25rem',    // 36px
  10:   '2.5rem',     // 40px
  11:   '2.75rem',    // 44px
  12:   '3rem',       // 48px
  14:   '3.5rem',     // 56px
  16:   '4rem',       // 64px
  18:   '4.5rem',     // 72px  ← extended
  20:   '5rem',       // 80px
  24:   '6rem',       // 96px
  28:   '7rem',       // 112px
  32:   '8rem',       // 128px
  36:   '9rem',       // 144px
  40:   '10rem',      // 160px
  44:   '11rem',      // 176px
  48:   '12rem',      // 192px
  52:   '13rem',      // 208px
  56:   '14rem',      // 224px
  60:   '15rem',      // 240px
  64:   '16rem',      // 256px
  72:   '18rem',      // 288px
  80:   '20rem',      // 320px
  96:   '24rem',      // 384px
} as const;

export type SpacingKey = keyof typeof spacing;
export type SpacingValue = (typeof spacing)[SpacingKey];

/** Sorted list of all valid spacing keys — used by the linter/AI validator. */
export const VALID_SPACING_KEYS: readonly SpacingKey[] = Object.keys(spacing).map(Number) as SpacingKey[];

// ─── Semantic Spacing Tokens ──────────────────────────────────────────────────
// Map design intent → scale key for consistent, named usage across components.
// AI generators MUST use these names for the described contexts.

export const semanticSpacing = {
  // Layout
  pagePadding:        spacing[6],   // p-6  — outer page padding (mobile)
  pagePaddingDesktop: spacing[10],  // p-10 — outer page padding (lg+)
  sectionGap:         spacing[16],  // gap-16 between major page sections
  sectionPaddingY:    spacing[12],  // py-12 inside a full-width section

  // Cards & Panels
  cardPadding:        spacing[6],   // p-6  — standard card inner padding
  cardPaddingCompact: spacing[4],   // p-4  — compact/dense card
  cardPaddingLarge:   spacing[8],   // p-8  — featured / hero card
  cardGap:            spacing[4],   // gap-4 between sibling cards
  cardGapLoose:       spacing[6],   // gap-6 for editorial card grids

  // Navigation
  navHeight:          spacing[14],  // h-14 — standard top nav height
  navPaddingX:        spacing[6],   // px-6 — nav horizontal padding
  navItemGap:         spacing[1],   // gap-1 — between nav links

  // Sidebar
  sidebarWidth:       spacing[64],  // w-64 — standard sidebar
  sidebarPaddingX:    spacing[4],   // px-4 — sidebar horizontal padding
  sidebarItemGap:     spacing[1],   // gap-1 — between sidebar items

  // Form Controls
  inputPadding:       spacing[3],   // p-3  — input/textarea inner padding
  inputPaddingX:      spacing[4],   // px-4
  inputGap:           spacing[4],   // gap-4 between form fields
  labelGap:           spacing[1.5], // gap-1.5 between label and input

  // Buttons
  buttonPaddingX:     spacing[4],   // px-4
  buttonPaddingY:     spacing[2.5], // py-2.5
  buttonPaddingXLg:   spacing[6],   // px-6 — large button
  buttonPaddingYLg:   spacing[3],   // py-3 — large button
  buttonGap:          spacing[2],   // gap-2 — icon + label inside button

  // Inline / Text
  inlineGap:          spacing[2],   // gap-2 — between inline elements (icon+text)
  badgePaddingX:      spacing[2.5], // px-2.5
  badgePaddingY:      spacing[0.5], // py-0.5
  tooltipPaddingX:    spacing[3],   // px-3
  tooltipPaddingY:    spacing[1.5], // py-1.5

  // Modal / Dialog
  modalPadding:       spacing[6],   // p-6
  modalPaddingLarge:  spacing[8],   // p-8 — wide modals
  modalGap:           spacing[4],   // gap-4 — between modal sections

  // Table
  tableCellPaddingX:  spacing[4],   // px-4
  tableCellPaddingY:  spacing[3],   // py-3
  tableRowGap:        spacing[0],   // row gap (border-based)

  // Utility
  stackGapXs:         spacing[2],   // gap-2 — tightest readable stack
  stackGapSm:         spacing[3],   // gap-3 — sm stack
  stackGapMd:         spacing[4],   // gap-4 — default
  stackGapLg:         spacing[6],   // gap-6
  stackGapXl:         spacing[8],   // gap-8
} as const;

export type SemanticSpacingKey = keyof typeof semanticSpacing;

// ─── Tailwind Class Helpers ───────────────────────────────────────────────────
// Returns the Tailwind class string for a given scale key.
// Use these in JS logic when class names must be constructed programmatically.

/** Returns the `p-{n}` class for a scale key, e.g. tw.p(4) → 'p-4' */
export const tw = {
  p:  (k: SpacingKey) => `p-${k}`   as const,
  px: (k: SpacingKey) => `px-${k}`  as const,
  py: (k: SpacingKey) => `py-${k}`  as const,
  m:  (k: SpacingKey) => `m-${k}`   as const,
  mx: (k: SpacingKey) => `mx-${k}`  as const,
  my: (k: SpacingKey) => `my-${k}`  as const,
  gap:(k: SpacingKey) => `gap-${k}` as const,
  mt: (k: SpacingKey) => `mt-${k}`  as const,
  mb: (k: SpacingKey) => `mb-${k}`  as const,
  ml: (k: SpacingKey) => `ml-${k}`  as const,
  mr: (k: SpacingKey) => `mr-${k}`  as const,
};