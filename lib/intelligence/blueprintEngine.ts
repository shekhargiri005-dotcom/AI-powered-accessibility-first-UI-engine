/**
 * Blueprint Engine — selects or assembles a UI Blueprint before code generation.
 * The blueprint describes the full intent: layout, style, components, and constraints.
 */
import { findMatchingLayouts, type LayoutEntry } from './layoutRegistry';
import { findCompatibleComponents } from './componentRegistry';
import type { IntentClassification } from '../validation/schemas';

export interface UIBlueprint {
  pageType: string;
  layoutId: string;
  layoutName: string;
  visualStyle: string;
  requiredComponents: string[];
  suggestedComponents: string[];
  animationDensity: 'none' | 'subtle' | 'moderate' | 'high' | 'cinematic';
  depthUIRequired: boolean;
  physicsRequired: boolean;
  previewSafetyConstraints: string[];
  assemblyRules: string[];
  structuralSections: string[];
  responsiveStrategy: string;
  motionLibrary: string | null;
  complexityLevel: string;
  complexity?: string;
  bestPracticeNotes: string[];
}

const DEFAULT_BLUEPRINT: UIBlueprint = {
  pageType: 'component',
  layoutId: 'landing-page',
  layoutName: 'Landing Page UI',
  visualStyle: 'minimal',
  requiredComponents: ['HeroSection', 'AnimatedButton'],
  suggestedComponents: ['FeatureGrid', 'FAQAccordion'],
  animationDensity: 'subtle',
  depthUIRequired: false,
  physicsRequired: false,
  previewSafetyConstraints: [
    'No Node.js-only APIs',
    'No readline or tty imports',
    'No fs or path imports',
    'Use browser-safe event APIs only',
  ],
  assemblyRules: [
    'Use export default for the main component',
    "Import ALL UI primitives (Button, Card, Input, Modal) from '@ui/core'",
    "Import advanced layout components from '@ui/layout'",
    "Use @ui/motion for animations instead of raw framer-motion",
    "Compose the UI using the @ui/* ecosystem heavily (e.g., @ui/icons, @ui/forms, @ui/typography)",
    'All data must be hardcoded as mock arrays',
  ],
  structuralSections: ['Header', 'Main', 'Footer'],
  responsiveStrategy: 'mobile-first with Tailwind responsive prefixes',
  motionLibrary: null,
  complexityLevel: 'moderate',
  bestPracticeNotes: [
    'Ensure 4.5:1 contrast ratio for all text',
    'Add aria-labels to all interactive elements',
    'Use semantic HTML elements throughout',
  ],
};

function resolveVisualStyle(prompt: string, classification?: Partial<IntentClassification>): string {
  const p = prompt.toLowerCase();
  if (p.includes('glassmorphism') || p.includes('glass effect')) return 'glassmorphism';
  if (p.includes('cyberpunk') || p.includes('neon') || p.includes('glitch')) return 'cyberpunk';
  if (p.includes('futuristic') || p.includes('sci-fi') || p.includes('hud')) return 'futuristic';
  if (p.includes('minimal') || p.includes('clean') || p.includes('simple')) return 'minimal';
  if (p.includes('dark') || p.includes('premium dark')) return 'premium-dark';
  if (p.includes('luxury') || p.includes('elegant') || p.includes('premium')) return 'luxury';
  if (p.includes('bento') || p.includes('bento grid')) return 'bento-grid';
  if (p.includes('neumorphism') || p.includes('soft ui')) return 'neumorphism';
  if (p.includes('brutalist') || p.includes('brutalism')) return 'brutalist';
  if (p.includes('gradient') || p.includes('colorful')) return 'gradient-heavy';
  if (p.includes('playful') || p.includes('fun') || p.includes('colorful')) return 'playful';
  if (p.includes('editorial') || p.includes('magazine')) return 'editorial';
  if (classification?.visualType === 'aesthetic-motion') return 'animated';
  if (classification?.visualType === '3d-component' || classification?.visualType === 'full-3d' || classification?.visualType === 'depth-ui') return 'futuristic';
  return 'minimal';
}

function resolveAnimationDensity(prompt: string, layout?: LayoutEntry): UIBlueprint['animationDensity'] {
  const p = prompt.toLowerCase();
  if (p.includes('cinematic') || p.includes('dramatic') || p.includes('scroll story')) return 'cinematic';
  if (p.includes('heavy animation') || p.includes('motion rich') || p.includes('fully animated')) return 'high';
  if (p.includes('animated') || p.includes('smooth') || p.includes('framer') || p.includes('motion')) return 'moderate';
  if (p.includes('no animation') || p.includes('static') || p.includes('plain')) return 'none';
  return layout?.animationSuitability ?? 'subtle';
}

function resolveAssemblyRules(layout: LayoutEntry, isDepthUI: boolean, hasMotion: boolean): string[] {
  const rules = [
    'Use export default for the main component',
    "Import ALL UI primitives (Button, Card, Modal, Input) from '@ui/core'",
    "Import layout primitives (Grid, Stack) from '@ui/layout'",
    "Use @ui/icons for all iconography",
    'All mock data must be declared at the top of the file',
    'Use Tailwind CSS classes for layout glue and specific overrides',
    'Ensure proper semantic HTML elements',
  ];
  if (isDepthUI) {
    rules.push('Use framer-motion extensively for layered parallax effects');
    rules.push('Implement multiple CSS layers with varying z-index');
    rules.push('Avoid traditional 3D/WebGL rendering, use CSS transforms instead');
  }
  if (hasMotion) {
    rules.push('Import the <Motion> component from @ui/motion for all animations');
    rules.push('Do NOT import framer-motion directly unless writing complex gestural overrides');
  }
  if (layout.category === 'dashboard') {
    rules.push('Sidebar must be sticky and full-height');
    rules.push('Content area must be independently scrollable');
  }
  if (layout.category === 'auth') {
    rules.push('Center the form card vertically and horizontally');
    rules.push('Include form validation with error states');
  }
  return rules;
}

export function selectBlueprint(
  prompt: string,
  classification?: Partial<IntentClassification>,
): UIBlueprint {
  const matchedLayouts = findMatchingLayouts(prompt, 2);
  const primaryLayout = matchedLayouts[0];

  if (!primaryLayout) return DEFAULT_BLUEPRINT;

  const visualStyle = resolveVisualStyle(prompt, classification);
  const isDepthUI = primaryLayout.depthUISuitability || prompt.toLowerCase().includes('depth') || prompt.toLowerCase().includes('parallax') || prompt.toLowerCase().includes('layer');
  const hasMotion = ['moderate', 'high', 'cinematic'].includes(primaryLayout.animationSuitability) || prompt.toLowerCase().includes('animated') || prompt.toLowerCase().includes('motion');
  const animationDensity = resolveAnimationDensity(prompt, primaryLayout);
  const isPhysics = primaryLayout.physicsSuitability || prompt.toLowerCase().includes('physics') || prompt.toLowerCase().includes('spring');

  const compatibleComponents = findCompatibleComponents(primaryLayout.id, visualStyle);
  const required = compatibleComponents.filter(c => c.usagePriority <= 2).slice(0, 5).map(c => c.name);
  const suggested = compatibleComponents.filter(c => c.usagePriority >= 3 && c.usagePriority <= 5).slice(0, 4).map(c => c.name);

  const previewConstraints = [
    'No Node.js-only APIs (fs, path, readline, tty, child_process)',
    'No process.stdout or process.stdin',
    'No dynamic requires',
    'Use browser-safe APIs only',
  ];
  if (isDepthUI) previewConstraints.push('Depth UI layers must not break stacking contexts that obscure interactive elements');
  if (hasMotion) previewConstraints.push('Framer-motion variants must be defined as constants outside render');

  const bestPracticeNotes = [
    'WCAG 2.1 AA: ensure 4.5:1 text contrast ratio',
    'Every input must have an associated label',
    'All buttons must have visible text or aria-label',
    'Use aria-live regions for dynamic content',
    `Apply mobile-first responsive breakpoints using Tailwind sm: md: lg: xl: prefixes`,
  ];

  return {
    pageType: primaryLayout.category,
    layoutId: primaryLayout.id,
    layoutName: primaryLayout.name,
    visualStyle,
    requiredComponents: required,
    suggestedComponents: suggested,
    animationDensity,
    depthUIRequired: isDepthUI,
    physicsRequired: isPhysics,
    previewSafetyConstraints: previewConstraints,
    assemblyRules: resolveAssemblyRules(primaryLayout, isDepthUI, hasMotion),
    structuralSections: primaryLayout.structure,
    responsiveStrategy: 'Mobile-first with Tailwind responsive prefixes (sm: md: lg: xl:)',
    motionLibrary: hasMotion ? 'framer-motion' : null,
    complexityLevel: primaryLayout.complexity,
    bestPracticeNotes,
  };
}

/**
 * Serialise a blueprint into a string block for injection into AI prompts.
 */
export function formatBlueprintForPrompt(blueprint: UIBlueprint): string {
  return `
=== UI BLUEPRINT (CONSULT BEFORE GENERATING) ===
Page Type: ${blueprint.pageType}
Layout: ${blueprint.layoutName} (${blueprint.layoutId})
Visual Style: ${blueprint.visualStyle}
Complexity: ${blueprint.complexityLevel}
Animation Density: ${blueprint.animationDensity}
Depth UI Required: ${blueprint.depthUIRequired}
Physics Required: ${blueprint.physicsRequired}
Motion Library: ${blueprint.motionLibrary ?? 'none'}

Structural Sections:
${blueprint.structuralSections.map(s => `  - ${s}`).join('\n')}

Required Components (MUST include):
${blueprint.requiredComponents.map(c => `  - ${c}`).join('\n')}

Suggested Components (include if appropriate):
${blueprint.suggestedComponents.map(c => `  - ${c}`).join('\n')}

Assembly Rules (NON-NEGOTIABLE):
${blueprint.assemblyRules.map(r => `  - ${r}`).join('\n')}

Preview Safety Constraints:
${blueprint.previewSafetyConstraints.map(c => `  - ${c}`).join('\n')}

Best Practice Notes:
${blueprint.bestPracticeNotes.map(n => `  - ${n}`).join('\n')}

Responsive Strategy: ${blueprint.responsiveStrategy}
=== END BLUEPRINT ===
`.trim();
}
