/**
 * @file packages/tokens/transitions.ts
 *
 * Design token transition/animation system — durations, easings,
 * and motion presets for consistent interactive feel.
 */

// ─── Duration ────────────────────────────────────────────────────────────────

export const duration = {
  instant:  '0ms',
  fast:     '100ms',
  normal:   '200ms',
  slow:     '300ms',
  slower:   '500ms',
  slowest:  '700ms',
  // Numeric (ms) for JS animation APIs
  instantMs: 0,
  fastMs:    100,
  normalMs:  200,
  slowMs:    300,
  slowerMs:  500,
  slowestMs: 700,
} as const;

// ─── Easing Curves ───────────────────────────────────────────────────────────

export const easing = {
  linear:       'cubic-bezier(0, 0, 1, 1)',
  in:           'cubic-bezier(0.4, 0, 1, 1)',
  out:          'cubic-bezier(0, 0, 0.2, 1)',
  inOut:        'cubic-bezier(0.4, 0, 0.2, 1)',
  outBack:      'cubic-bezier(0.34, 1.56, 0.64, 1)',
  inBack:       'cubic-bezier(0.36, 0, 0.66, -0.56)',
  outExpo:      'cubic-bezier(0.16, 1, 0.3, 1)',
  inOutExpo:    'cubic-bezier(0.87, 0, 0.13, 1)',
  spring:       'cubic-bezier(0.34, 1.56, 0.64, 1)', // Alias for outBack
  smooth:       'cubic-bezier(0.4, 0, 0.2, 1)',      // Alias for inOut
} as const;

// ─── Transition Presets ──────────────────────────────────────────────────────

export const transition = {
  fast:    `${duration.fast} ${easing.out}`,
  normal:  `${duration.normal} ${easing.inOut}`,
  slow:    `${duration.slow} ${easing.inOut}`,
  spring:  `${duration.normal} ${easing.spring}`,
  bounce:  `${duration.slow} ${easing.outBack}`,
  smooth:  `${duration.slow} ${easing.outExpo}`,
} as const;

// ─── Animation Keyframes (CSS string for injection) ──────────────────────────

export const keyframes = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }`,
  fadeOut: `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }`,
  slideUp: `
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }`,
  slideDown: `
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }`,
  scaleIn: `
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }`,
  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }`,
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }`,
  bounce: `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }`,
  shimmer: `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }`,
  float: `
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-6px); }
    }`,
} as const;
