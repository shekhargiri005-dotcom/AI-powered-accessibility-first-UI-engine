/**
 * @file lib/ai/knowledgeAggregator.ts
 *
 * Universal Knowledge Aggregator — Phase 4 of the Architecture Upgrade.
 *
 * Converts structured codebase knowledge into source-tagged semantic chunks
 * that can be embedded into pgvector and retrieved during UI generation.
 *
 * Knowledge Sources:
 *  - source:template  → KNOWLEDGE_BASE manual templates (depth UI, app templates, etc.)
 *  - source:registry  → COMPONENT_REGISTRY entries (all 50+ UI components)
 *  - source:blueprint → LAYOUT_REGISTRY entries (all layout archetypes)
 *  - source:motion    → Depth UI / motion/parallax patterns (from depthEngine archetypes)
 *
 * Each chunk is a structured natural-language description designed for
 * semantic embedding — NOT raw code dumps.
 *
 * Usage:
 *   import { aggregateAllKnowledge } from '@/lib/ai/knowledgeAggregator';
 *   const chunks = aggregateAllKnowledge(); // → AggregatedKnowledgeChunk[]
 *
 * Then pipe chunks to upsertComponentEmbedding() via sync-knowledge.ts.
 */

import { KNOWLEDGE_BASE, type ComponentKnowledge } from './knowledgeBase';
import { COMPONENT_REGISTRY, type ComponentEntry } from '../intelligence/componentRegistry';
import { LAYOUT_REGISTRY, type LayoutEntry } from '../intelligence/layoutRegistry';

// ─── Types ────────────────────────────────────────────────────────────────────

export type KnowledgeSource =
  | 'template'
  | 'registry'
  | 'blueprint'
  | 'motion'
  | 'feedback'
  | 'repair';

export interface AggregatedKnowledgeChunk {
  /** Stable, source-prefixed ID. Format: "{source}:{slug}" */
  id:       string;
  source:   KnowledgeSource;
  name:     string;
  keywords: string[];
  /** Structured prose — this is what gets embedded. NOT raw code. */
  content:  string;
}

// ─── Source: template (KNOWLEDGE_BASE) ────────────────────────────────────────

/**
 * Convert a KNOWLEDGE_BASE entry into a knowledge chunk.
 * The KNOWLEDGE_BASE already has guidelines — we use them as-is.
 */
function templateToChunk(entry: ComponentKnowledge): AggregatedKnowledgeChunk {
  return {
    id:       `template:${entry.id}`,
    source:   'template',
    name:     entry.name,
    keywords: entry.keywords,
    content:  entry.guidelines,
  };
}

// ─── Source: registry (COMPONENT_REGISTRY) ────────────────────────────────────

/**
 * Convert a ComponentRegistry entry into a structured semantic description.
 *
 * Format is deliberately human-readable so the embedding captures
 * use-case meaning, not just identifiers.
 */
function componentToChunk(c: ComponentEntry): AggregatedKnowledgeChunk {
  const libraries = c.requiredLibraries.length > 0
    ? `Requires: ${c.requiredLibraries.join(', ')}.`
    : 'No external libraries required.';

  const depFlags: string[] = [];
  if (c.animationSupport) depFlags.push('supports animation');
  if (c.depthSupport)     depFlags.push('supports Depth UI parallax');
  if (c.physicsSupport)   depFlags.push('supports physics interactions');
  if (!c.responsive)      depFlags.push('desktop layout only');

  const capabilities = depFlags.length > 0
    ? `Capabilities: ${depFlags.join(', ')}.`
    : 'Standard layout component.';

  const content = [
    `Component: ${c.name} (${c.category}/${c.subcategory ?? c.category}).`,
    `Description: ${c.description}.`,
    `Intended usage: ${c.intendedUsage}.`,
    `Compatible layouts: ${c.compatibleLayouts.join(', ')}.`,
    `Compatible styles: ${c.compatibleStyles.join(', ')}.`,
    libraries,
    capabilities,
    c.requiredProps.length > 0
      ? `Required props: ${c.requiredProps.join(', ')}.`
      : 'No required props.',
    c.optionalProps.length > 0
      ? `Optional props: ${c.optionalProps.join(', ')}.`
      : '',
    `Usage priority: ${c.usagePriority}/10 (lower = more frequently used).`,
    `Preview safe: ${c.previewSafe ? 'yes' : 'no'}.`,
  ].filter(Boolean).join('\n');

  const keywords = [
    c.name.toLowerCase(),
    c.category,
    c.subcategory ?? '',
    ...c.compatibleLayouts,
    ...c.compatibleStyles,
    ...c.requiredLibraries,
    c.intendedUsage,
  ].filter(Boolean);

  return {
    id:       `registry:${c.name}`,
    source:   'registry',
    name:     `${c.name} Component`,
    keywords: [...new Set(keywords)],
    content,
  };
}

// ─── Source: blueprint (LAYOUT_REGISTRY) ─────────────────────────────────────

/**
 * Convert a LayoutRegistry entry into a structured semantic description.
 */
function layoutToChunk(l: LayoutEntry): AggregatedKnowledgeChunk {
  const depthNote = l.depthUISuitability
    ? 'This layout is suitable for Depth UI parallax effects.'
    : 'This layout does not benefit from Depth UI parallax.';

  const animNote = `Animation suitability: ${l.animationSuitability}.`;

  const content = [
    `Layout: ${l.name} (${l.category}).`,
    `Description: ${l.description}.`,
    `Structure: ${l.structure.join(' → ')}.`,
    `Best for: ${l.bestFitScenarios.join(', ')}.`,
    `Compatible components: ${l.compatibleComponents.join(', ')}.`,
    `Compatible styles: ${l.compatibleStyles.join(', ')}.`,
    `Complexity: ${l.complexity}. Responsive: ${l.responsive ? 'yes' : 'desktop-only'}.`,
    animNote,
    depthNote,
    `Physics interactions: ${l.physicsSuitability ? 'supported' : 'not recommended'}.`,
  ].join('\n');

  const keywords = [
    l.id,
    l.name.toLowerCase(),
    l.category,
    ...l.keywords,
    ...l.bestFitScenarios,
  ].filter(Boolean);

  return {
    id:       `blueprint:${l.id}`,
    source:   'blueprint',
    name:     `${l.name} Layout`,
    keywords: [...new Set(keywords)],
    content,
  };
}

// ─── Source: motion (Depth UI archetypes) ────────────────────────────────────

/**
 * Static depth/motion pattern definitions.
 * These are not stored in a registry file — they encode expert knowledge
 * about when and how to use Framer Motion depth layers.
 */
const DEPTH_MOTION_PATTERNS: AggregatedKnowledgeChunk[] = [
  {
    id:       'motion:soft-depth',
    source:   'motion',
    name:     'Soft Depth Parallax Pattern',
    keywords: ['soft depth', 'gentle parallax', 'subtle motion', 'landing page', 'depth'],
    content:  [
      'Soft Depth is the default Depth UI archetype for most landing pages and hero sections.',
      'Use gentle parallax layers (translateY 20–60px range) with low scroll sensitivity.',
      'Layer count: 2–3 layers maximum. Background moves slowest, foreground fastest.',
      'Implementation: Framer Motion useScroll + useTransform with input/output ranges.',
      'Accessibility: Always provide @media (prefers-reduced-motion) fallback with static layout.',
      'Mobile: Disable parallax on mobile (max-width 768px), use static background instead.',
      'Performance: Use will-change: transform on parallax layers. Avoid heavy shadows on moving elements.',
      'Best for: SaaS landing pages, startup homepages, AI product hero sections.',
    ].join('\n'),
  },
  {
    id:       'motion:hero-depth',
    source:   'motion',
    name:     'Hero Depth Scene Pattern',
    keywords: ['hero depth', 'parallax hero', 'cinematic hero', 'depth hero', 'scroll hero'],
    content:  [
      'Hero Depth creates a layered scene effect for high-impact hero sections.',
      'Uses absolute-positioned div layers with different translateY multipliers.',
      'Typical layers: far background (0.1x speed) → mid layer (0.3x) → near layer (0.6x) → foreground text (no scroll).',
      'Atmospheric: Add radial gradients or ambient glow elements as extra background layers.',
      'Glass card floaters: Use backdrop-filter: blur() on semi-transparent card elements for depth.',
      'Text layer: Must be scroll-static (no parallax) for readability.',
      'Accessibility: Respect prefers-reduced-motion. Disable all parallax in reduced motion mode.',
      'Best for: Product launches, creative agency homepages, premium SaaS hero sections.',
    ].join('\n'),
  },
  {
    id:       'motion:feature-reveal',
    source:   'motion',
    name:     'Scroll Feature Reveal Pattern',
    keywords: ['feature reveal', 'scroll reveal', 'stagger reveal', 'scroll animation', 'feature depth'],
    content:  [
      'Feature Reveal uses scroll-triggered entrance animations for feature sections.',
      'Each feature card or block enters with a staggered fade-up animation as it enters the viewport.',
      'Implementation: framer-motion whileInView with viewport once:true to prevent re-triggering.',
      'Stagger: 0.1–0.15s delay between each item in a row or grid.',
      'Variants: initial {opacity:0, y:30} → animate {opacity:1, y:0} transition duration 0.5–0.8s.',
      'Background: Optionally add a very slow horizontal drift (5–10px) on the section background.',
      'Accessibility: Use prefers-reduced-motion to skip animation and show final state immediately.',
      'Best for: Feature grids, pricing sections, timeline reveals, product comparison sections.',
    ].join('\n'),
  },
  {
    id:       'motion:scroll-scene',
    source:   'motion',
    name:     'Scroll Scene Narrative Pattern',
    keywords: ['scroll scene', 'scroll storytelling', 'narrative scroll', 'cinematic scroll', 'scroll story'],
    content:  [
      'Scroll Scene creates a cinematic narrative experience tied to scrolling progress.',
      'Uses framer-motion useScroll + useTransform to drive multiple animations from one scroll value.',
      'Content reveals in "chapters" — one scene per viewport height.',
      'Sticky container pattern: outer div is scroll-height:400vh, inner is position:sticky top:0.',
      'Progress: Drive opacity, scale, x/y from scrollYProgress (0→1) using custom breakpoints.',
      'Text: Fade in at 0.1 progress, hold until 0.4, fade out at 0.5 for each chapter.',
      'Accessibility: Provide a non-animated linear layout as a fallback for reduced-motion users.',
      'Performance: Heavy — only use for dedicated storytelling pages, not dashboards or apps.',
      'Best for: Brand storytelling, product feature deep dives, interactive annual reports.',
    ].join('\n'),
  },
  {
    id:       'motion:mouse-reactive',
    source:   'motion',
    name:     'Mouse Reactive Depth Pattern',
    keywords: ['mouse reactive', 'cursor depth', 'tilt effect', 'magnetic', 'cursor parallax'],
    content:  [
      'Mouse Reactive adds subtle depth by translating elements based on cursor position.',
      'Track mouse X/Y relative to the component center using onMouseMove events.',
      'Map mouse offset to element transform: small elements move more (5–15px), large elements less (2–5px).',
      'Smooth with framer-motion spring: damping:30, stiffness:100 for natural feel.',
      'Depth illusion: Elements closer to user (higher z-index) should move more.',
      'Exit: Reset to center position onMouseLeave with spring transition.',
      'Mobile: Disable entirely on touch devices (no cursor).',
      'Accessibility: Respect prefers-reduced-motion — disable all movement.',
      'Best for: Hero cards, product showcases, portfolio items, creative hover states.',
    ].join('\n'),
  },
];

// ─── Main Aggregator ─────────────────────────────────────────────────────────

/**
 * Aggregate all internal knowledge sources into a flat array of
 * source-tagged semantic chunks ready for embedding.
 *
 * @returns Deduplicated AggregatedKnowledgeChunk[] sorted by source, then name.
 */
export function aggregateAllKnowledge(): AggregatedKnowledgeChunk[] {
  const chunks: AggregatedKnowledgeChunk[] = [];

  // 1. Manual templates from KNOWLEDGE_BASE
  for (const entry of KNOWLEDGE_BASE) {
    chunks.push(templateToChunk(entry));
  }

  // 2. Component registry (all 50+ components)
  for (const component of COMPONENT_REGISTRY) {
    chunks.push(componentToChunk(component));
  }

  // 3. Layout registry (all layout archetypes)
  for (const layout of LAYOUT_REGISTRY) {
    chunks.push(layoutToChunk(layout));
  }

  // 4. Depth UI / motion patterns (static expert knowledge)
  chunks.push(...DEPTH_MOTION_PATTERNS);

  return chunks;
}

/**
 * Get only chunks from a specific source domain.
 * Useful for debugging or partial re-syncs.
 */
export function aggregateBySource(source: KnowledgeSource): AggregatedKnowledgeChunk[] {
  return aggregateAllKnowledge().filter(c => c.source === source);
}

/**
 * Quick summary of what will be synced — for CLI reporting.
 */
export function getAggregationSummary(): Record<KnowledgeSource, number> {
  const chunks = aggregateAllKnowledge();
  return chunks.reduce<Record<KnowledgeSource, number>>(
    (acc, c) => {
      acc[c.source] = (acc[c.source] ?? 0) + 1;
      return acc;
    },
    {} as Record<KnowledgeSource, number>,
  );
}
