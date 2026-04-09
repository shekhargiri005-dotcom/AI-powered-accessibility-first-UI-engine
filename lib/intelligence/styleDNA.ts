/**
 * @file lib/intelligence/styleDNA.ts
 *
 * Style DNA — deterministic visual personality system.
 *
 * Phase 7: Resolves a StyleDNAPreset from the user's prompt and page type,
 * then returns a structured StyleDNA object that is injected into the
 * generation prompt as a "visual fingerprint" for the component.
 *
 * This ensures consistent visual personality across all generated components
 * for `component` and `depth_ui` modes. App mode uses its own design system.
 *
 * Presets:
 *   premium_saas      → Linear/Vercel/Stripe aesthetic (dark, precise, trusted)
 *   ai_workspace      → Dense, functional, tool-first (Cursor/Raycast/Notion)
 *   minimal_consumer  → Clean, white-space forward (Apple/Airbnb/Figma)
 *   enterprise_clean  → Predictable, content-forward (Salesforce/Atlassian)
 *   storytelling_brand → Editorial, motion-rich (Pitch/Loom brand sites)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type StyleDNAPreset =
  | 'premium_saas'
  | 'ai_workspace'
  | 'minimal_consumer'
  | 'enterprise_clean'
  | 'storytelling_brand';

export interface StyleDNA {
  /** The named preset — used as a label in the prompt */
  preset:          StyleDNAPreset;
  /** Overall spacing density */
  spacingDensity:  'tight' | 'comfortable' | 'spacious';
  /** Border radius personality */
  radiusSoftness:  'sharp' | 'rounded' | 'pill';
  /** Card elevation feel */
  cardElevation:   'flat' | 'soft' | 'raised';
  /** Typography scale tendency */
  typographyScale: 'compact' | 'balanced' | 'display';
  /** Contrast and tone mood */
  contrastMood:    'soft' | 'standard' | 'high';
  /** How prominent the primary CTA is */
  ctaEmphasis:     'subtle' | 'prominent' | 'dominant';
  /** How much motion to use */
  motionRestraint: 'none' | 'micro' | 'moderate' | 'expressive';
  /** A short human-readable description of this preset for prompt injection */
  description:     string;
  /** Specific Tailwind class hints to guide the model's colour/style choices */
  tailwindHints:   string[];
}

// ─── Preset Definitions ───────────────────────────────────────────────────────

const STYLE_DNA_PRESETS: Record<StyleDNAPreset, StyleDNA> = {
  premium_saas: {
    preset:          'premium_saas',
    spacingDensity:  'comfortable',
    radiusSoftness:  'rounded',
    cardElevation:   'soft',
    typographyScale: 'balanced',
    contrastMood:    'high',
    ctaEmphasis:     'prominent',
    motionRestraint: 'micro',
    description:     'Premium SaaS aesthetic — dark, precise, and trusted. Think Linear, Vercel, or Stripe. High contrast, subtle depth, sharp but not clinical.',
    tailwindHints: [
      'bg-zinc-950 or bg-slate-900 for dark surfaces',
      'text-zinc-50 for primary text, text-zinc-400 for secondary',
      'border-zinc-800 for subtle dividers',
      'rounded-xl for cards, rounded-lg for inputs',
      'shadow-xl shadow-black/20 for card elevation',
      'bg-indigo-500 or bg-violet-600 for primary CTA',
      'hover:bg-indigo-600 transition-colors duration-150 for interactions',
    ],
  },

  ai_workspace: {
    preset:          'ai_workspace',
    spacingDensity:  'tight',
    radiusSoftness:  'rounded',
    cardElevation:   'flat',
    typographyScale: 'compact',
    contrastMood:    'high',
    ctaEmphasis:     'subtle',
    motionRestraint: 'micro',
    description:     'AI workspace aesthetic — dense, functional, and tool-first. Think Cursor, Raycast, or Notion. Every pixel is purposeful. Dark mode. Monospace-friendly.',
    tailwindHints: [
      'bg-neutral-950 or bg-gray-950 for base',
      'bg-neutral-900 for panels and sidebars',
      'text-neutral-100 for primary, text-neutral-500 for muted',
      'border-neutral-800 for all dividers — use sparingly',
      'rounded-md for compact elements, rounded-lg for panels',
      'font-mono for secondary labels or code hints',
      'text-sm or text-xs for dense information displays',
    ],
  },

  minimal_consumer: {
    preset:          'minimal_consumer',
    spacingDensity:  'spacious',
    radiusSoftness:  'pill',
    cardElevation:   'soft',
    typographyScale: 'display',
    contrastMood:    'soft',
    ctaEmphasis:     'dominant',
    motionRestraint: 'moderate',
    description:     'Minimal consumer aesthetic — clean, white-space forward, and inviting. Think Apple, Airbnb, or Figma. Light mode by default. Large typography. Rounded everything.',
    tailwindHints: [
      'bg-white or bg-gray-50 for base surfaces',
      'text-gray-900 for primary text, text-gray-500 for secondary',
      'rounded-2xl or rounded-full for interactive elements',
      'shadow-md shadow-gray-200 for soft elevation',
      'p-6 md:p-10 for generous section spacing',
      'text-4xl font-semibold or text-5xl font-bold for hero headings',
      'bg-black text-white or bg-gray-900 for CTAs (high-contrast on light)',
    ],
  },

  enterprise_clean: {
    preset:          'enterprise_clean',
    spacingDensity:  'comfortable',
    radiusSoftness:  'sharp',
    cardElevation:   'raised',
    typographyScale: 'balanced',
    contrastMood:    'standard',
    ctaEmphasis:     'prominent',
    motionRestraint: 'none',
    description:     'Enterprise clean aesthetic — predictable, content-forward, and trustworthy. Think Salesforce, Atlassian, or ServiceNow. Blue primary palette. Structured grids.',
    tailwindHints: [
      'bg-white for surfaces, bg-slate-50 for alternating rows',
      'text-slate-800 for primary, text-slate-500 for secondary',
      'border-slate-200 for borders and table lines',
      'rounded or rounded-md — no pill shapes',
      'bg-blue-600 hover:bg-blue-700 for primary actions',
      'shadow-sm for card elevation — never shadow-xl in enterprise',
      'font-medium text-sm for labels and table headers',
    ],
  },

  storytelling_brand: {
    preset:          'storytelling_brand',
    spacingDensity:  'spacious',
    radiusSoftness:  'rounded',
    cardElevation:   'flat',
    typographyScale: 'display',
    contrastMood:    'high',
    ctaEmphasis:     'dominant',
    motionRestraint: 'expressive',
    description:     'Storytelling brand aesthetic — editorial, motion-rich, and memorable. Think Pitch, Loom, or Linear marketing site. Bold typography. Gradient accents. Cinema-quality animations.',
    tailwindHints: [
      'bg-black or bg-zinc-950 for immersive dark base',
      'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 for accent gradients',
      'text-7xl font-extrabold tracking-tight for hero headlines',
      'text-zinc-300 for body text on dark backgrounds',
      'rounded-3xl for large hero cards and media containers',
      'Use framer-motion for entrance animations — opacity 0→1, y 30→0',
      'backdrop-blur-md bg-white/5 border border-white/10 for glass cards',
    ],
  },
};

// ─── Trigger Mapping ──────────────────────────────────────────────────────────

interface PresetTrigger {
  preset:      StyleDNAPreset;
  keywords:    string[];
  antiKeywords: string[];
  priority:    number; // Higher = checked first
}

const PRESET_TRIGGERS: PresetTrigger[] = [
  {
    preset:       'storytelling_brand',
    keywords:     ['parallax', 'depth ui', 'hero section', 'brand', 'cinematic', 'storytelling', 'scroll story', 'startup landing', 'product launch', 'creative agency', 'editorial'],
    antiKeywords: ['dashboard', 'admin', 'table', 'settings', 'data'],
    priority:     10,
  },
  {
    preset:       'premium_saas',
    keywords:     ['saas', 'startup', 'product', 'landing page', 'pricing', 'dark mode', 'developer tool', 'api', 'platform', 'subscription', 'premium'],
    antiKeywords: ['enterprise', 'government', 'healthcare', 'table', 'report'],
    priority:     8,
  },
  {
    preset:       'ai_workspace',
    keywords:     ['ai', 'ide', 'code editor', 'workspace', 'tool', 'productivity', 'assistant', 'command', 'terminal', 'palette', 'notion', 'raycast', 'cursor'],
    antiKeywords: ['landing', 'marketing', 'brand', 'blog', 'portfolio'],
    priority:     9,
  },
  {
    preset:       'enterprise_clean',
    keywords:     ['enterprise', 'admin', 'crm', 'erp', 'government', 'healthcare', 'education', 'table', 'report', 'compliance', 'internal tool', 'corporate'],
    antiKeywords: ['creative', 'brand', 'portfolio', 'consumer', 'startup'],
    priority:     7,
  },
  {
    preset:       'minimal_consumer',
    keywords:     ['minimal', 'clean', 'consumer', 'lifestyle', 'ecommerce', 'portfolio', 'blog', 'personal', 'simple', 'light mode', 'ios', 'mobile app'],
    antiKeywords: ['enterprise', 'admin', 'dark mode', 'dashboard'],
    priority:     6,
  },
];

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Deterministically resolve a StyleDNA from the user's prompt and page type.
 *
 * Algorithm:
 * 1. Score each preset trigger against the combined prompt + pageType.
 * 2. For depth_ui mode: prefer 'storytelling_brand' or 'premium_saas'.
 * 3. Return the highest-scoring preset above the threshold (or default: 'premium_saas').
 *
 * @param prompt   The user's raw prompt
 * @param pageType The page type from the blueprint engine (e.g. 'landing-page')
 * @param mode     Generation mode — 'component' | 'depth_ui'
 */
export function resolveStyleDNA(
  prompt:   string,
  pageType?: string,
  mode:     'component' | 'depth_ui' = 'component',
): StyleDNA {
  const combined = (prompt + ' ' + (pageType ?? '')).toLowerCase();

  // For depth_ui: bias heavily toward storytelling_brand
  if (mode === 'depth_ui') {
    const storyScore = scorePreset(combined, PRESET_TRIGGERS.find(t => t.preset === 'storytelling_brand')!);
    const saasScore  = scorePreset(combined, PRESET_TRIGGERS.find(t => t.preset === 'premium_saas')!);
    if (storyScore > 0) return STYLE_DNA_PRESETS.storytelling_brand;
    if (saasScore  > 0) return STYLE_DNA_PRESETS.premium_saas;
    return STYLE_DNA_PRESETS.storytelling_brand; // depth_ui default
  }

  // General scoring
  let bestPreset: StyleDNAPreset = 'premium_saas'; // sensible default
  let bestScore  = 0;

  // Sort triggers by priority descending to respect tie-breaking
  const sortedTriggers = [...PRESET_TRIGGERS].sort((a, b) => b.priority - a.priority);

  for (const trigger of sortedTriggers) {
    const score = scorePreset(combined, trigger);
    if (score > bestScore) {
      bestScore  = score;
      bestPreset = trigger.preset;
    }
  }

  return STYLE_DNA_PRESETS[bestPreset];
}

function scorePreset(combined: string, trigger: PresetTrigger): number {
  let score = 0;
  for (const kw of trigger.keywords) {
    if (combined.includes(kw)) score += 2;
  }
  for (const anti of trigger.antiKeywords) {
    if (combined.includes(anti)) score -= 1;
  }
  return Math.max(score, 0);
}

// ─── Prompt Formatter ─────────────────────────────────────────────────────────

/**
 * Format the StyleDNA as a concise block for injection into the generation system prompt.
 */
export function formatStyleDNAForPrompt(dna: StyleDNA): string {
  return `
=== STYLE DNA ===
Preset:          ${dna.preset.replace(/_/g, ' ').toUpperCase()}
Description:     ${dna.description}
Spacing:         ${dna.spacingDensity}
Radius:          ${dna.radiusSoftness}
Card Elevation:  ${dna.cardElevation}
Typography:      ${dna.typographyScale}
Contrast Mood:   ${dna.contrastMood}
CTA Emphasis:    ${dna.ctaEmphasis}
Motion:          ${dna.motionRestraint}

Tailwind Class Hints (apply these as your visual baseline):
${dna.tailwindHints.map(h => `  • ${h}`).join('\n')}

IMPORTANT: These are design constraints, not suggestions.
Apply this Style DNA consistently across the entire component.
Do NOT mix styles from different presets.
=== END STYLE DNA ===
`.trim();
}
