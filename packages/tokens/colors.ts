/**
 * @file packages/tokens/colors.ts
 *
 * Design token color system — semantic color variables for the UI engine.
 * Provides named color tokens that map to Tailwind CSS values,
 * ensuring consistent theming across all @ui/* components.
 */

// ─── Brand Colors ────────────────────────────────────────────────────────────

export const brand = {
  50:  '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',  // Primary
  600: '#4f46e5',  // Primary hover
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
  950: '#1e1b4b',
} as const;

// ─── Semantic Colors ─────────────────────────────────────────────────────────

export const colors = {
  // Primary actions
  primary: {
    bg:    '#4f46e5',
    hover: '#4338ca',
    text:  '#ffffff',
    muted: '#818cf8',
    ring:  '#6366f1',
  },
  // Destructive / danger
  destructive: {
    bg:    '#ef4444',
    hover: '#dc2626',
    text:  '#ffffff',
    muted: '#f87171',
    ring:  '#ef4444',
  },
  // Success / positive
  success: {
    bg:    '#10b981',
    hover: '#059669',
    text:  '#ffffff',
    muted: '#34d399',
    ring:  '#10b981',
  },
  // Warning / caution
  warning: {
    bg:    '#f59e0b',
    hover: '#d97706',
    text:  '#1c1917',
    muted: '#fbbf24',
    ring:  '#f59e0b',
  },
  // Info / neutral emphasis
  info: {
    bg:    '#3b82f6',
    hover: '#2563eb',
    text:  '#ffffff',
    muted: '#60a5fa',
    ring:  '#3b82f6',
  },

  // ─── Surface hierarchy (dark theme) ───────────────────────────────────────
  surface: {
    base:     '#0c0c0e',   // Page background
    raised:   '#111114',   // Card/sidebar bg
    overlay:  '#18181b',   // Modal/dropdown bg
    sunken:   '#09090b',   // Well/input bg
  },

  // ─── Text hierarchy ───────────────────────────────────────────────────────
  text: {
    primary:   '#f3f4f6',  // Headlines, body
    secondary: '#9ca3af',  // Descriptions, hints
    muted:     '#6b7280',  // Placeholders, disabled
    inverse:   '#1c1917',  // On light surfaces
    link:      '#818cf8',  // Links
  },

  // ─── Borders ──────────────────────────────────────────────────────────────
  border: {
    default:  '#27272a',   // Default borders
    hover:    '#3f3f46',   // Hover state borders
    focus:    '#6366f1',   // Focus ring
    error:    '#ef4444',   // Error state
    success:  '#10b981',   // Success state
  },

  // ─── Gradients ────────────────────────────────────────────────────────────
  gradient: {
    primary:   'linear-gradient(135deg, #6366f1, #8b5cf6)',
    warm:      'linear-gradient(135deg, #f59e0b, #ef4444)',
    cool:      'linear-gradient(135deg, #06b6d4, #3b82f6)',
    sunset:    'linear-gradient(135deg, #f97316, #ec4899)',
    aurora:    'linear-gradient(135deg, #10b981, #3b82f6, #8b5cf6)',
    midnight:  'linear-gradient(135deg, #1e1b4b, #312e81, #4338ca)',
    glass:     'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
  } as Record<string, string>,
} as const;

// ─── Status Colors ───────────────────────────────────────────────────────────

export const statusColors: Record<string, string> = {
  online:  colors.success.bg,
  offline: '#6b7280',
  busy:    colors.destructive.bg,
  away:    colors.warning.bg,
  error:   colors.destructive.bg,
  warning: colors.warning.bg,
  success: colors.success.bg,
  info:    colors.info.bg,
  default: '#6b7280',
};

// ─── Chart Palette ───────────────────────────────────────────────────────────

export const chartPalette = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#3b82f6', // Blue
] as const;

export function getChartColor(index: number): string {
  return chartPalette[index % chartPalette.length];
}
