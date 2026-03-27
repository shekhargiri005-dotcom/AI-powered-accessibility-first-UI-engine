/**
 * Design Rules — heuristics layer that helps the engine reason like a UI expert.
 * Encodes design decisions: when to use sidebar vs top-nav, when 3D is appropriate, etc.
 */

export interface DesignDecision {
  category: string;
  decision: string;
  rationale: string;
}

export interface DesignRulesResult {
  navigationStyle: 'sidebar' | 'top-nav' | 'bottom-nav' | 'none';
  layoutComplexity: 'minimal' | 'standard' | 'rich' | 'immersive';
  use3D: boolean;
  useMotion: boolean;
  usePhysics: boolean;
  useGlassmorphism: boolean;
  prioritizePerformance: boolean;
  prioritizeAccessibility: boolean;
  preferDesktopLayout: boolean;
  contentDensity: 'sparse' | 'balanced' | 'dense';
  animationStrategy: string;
  spacingRhythm: 'tight' | 'comfortable' | 'spacious';
  typographyScale: 'compact' | 'balanced' | 'display';
  decisions: DesignDecision[];
  warnings: string[];
}

/**
 * Core design heuristics.
 * Apply these rules to choose the correct layout and interaction style.
 */
const DESIGN_HEURISTICS = {
  useSidebar: {
    triggers: ['dashboard', 'admin', 'saas product', 'ide', 'file manager', 'crm'],
    rule: 'Use sidebar navigation when the app has 5+ sections, persistent state, or complex workflows',
  },
  useTopNav: {
    triggers: ['landing page', 'marketing', 'documentation', 'blog', 'portfolio'],
    rule: 'Use top navigation for content/marketing sites where hierarchy is shallow',
  },
  useBottomNav: {
    triggers: ['mobile app', 'social', 'feed', 'messaging'],
    rule: 'Use bottom navigation for mobile-primary social/media apps',
  },
  use3D: {
    triggers: ['3d', 'webgl', 'three.js', 'product showcase', 'portfolio 3d', 'immersive'],
    antiTriggers: ['simple', 'form', 'table', 'settings', 'auth', 'admin'],
    rule: '3D is appropriate for hero sections, product showcases, and portfolio sites. Avoid for data-dense or utility UIs.',
  },
  usePhysics: {
    triggers: ['physics', 'spring', 'elastic', 'draggable', 'playful', 'particle'],
    antiTriggers: ['enterprise', 'form', 'table', 'admin', 'simple'],
    rule: 'Physics interactions suit playful, creative, or consumer apps. Avoid in enterprise/form-heavy UIs.',
  },
  useMotion: {
    triggers: ['animated', 'motion', 'transition', 'framer', 'smooth', 'scroll animation'],
    antiTriggers: ['simple', 'static', 'performance critical'],
    rule: 'Motion improves perceived quality but degrades performance. Use only when it aids comprehension or brand expression.',
  },
  useGlassmorphism: {
    triggers: ['glassmorphism', 'glass', 'frosted', 'blur', 'translucent'],
    antiTriggers: ['table', 'admin', 'form', 'minimal', 'performance'],
    rule: 'Glassmorphism works on dark backgrounds with clear focal points. Avoid in data-heavy UIs where it hurts readability.',
  },
  mobileFirst: {
    triggers: ['mobile', 'responsive', 'phone', 'tablet', 'pwa', 'app-like'],
    rule: 'Always design mobile-first for consumer apps. Desktop-first is acceptable only for workflow/enterprise tools.',
  },
  accessibilityFirst: {
    triggers: ['accessibility', 'a11y', 'wcag', 'screen reader', 'keyboard', 'inclusive'],
    rule: 'Prioritize accessibility for: government, healthcare, education, and enterprise platforms.',
  },
  performanceFirst: {
    triggers: ['performance', 'fast', 'lightweight', 'low bandwidth', 'seo'],
    rule: 'Prioritize performance for: public-facing pages, SEO-dependent sites, and low-bandwidth environments.',
  },
};

function matchesTriggers(prompt: string, triggers: string[]): boolean {
  const p = prompt.toLowerCase();
  return triggers.some(t => p.includes(t));
}

function matchesAntiTriggers(prompt: string, antiTriggers?: string[]): boolean {
  if (!antiTriggers) return false;
  const p = prompt.toLowerCase();
  return antiTriggers.some(t => p.includes(t));
}

export function applyDesignRules(prompt: string, pageType?: string): DesignRulesResult {
  const decisions: DesignDecision[] = [];
  const warnings: string[] = [];
  const combined = (prompt + ' ' + (pageType ?? '')).toLowerCase();

  // Navigation style
  let navigationStyle: DesignRulesResult['navigationStyle'] = 'top-nav';
  if (matchesTriggers(combined, DESIGN_HEURISTICS.useSidebar.triggers)) {
    navigationStyle = 'sidebar';
    decisions.push({ category: 'Navigation', decision: 'Use Sidebar navigation', rationale: DESIGN_HEURISTICS.useSidebar.rule });
  } else if (matchesTriggers(combined, DESIGN_HEURISTICS.useBottomNav.triggers)) {
    navigationStyle = 'bottom-nav';
    decisions.push({ category: 'Navigation', decision: 'Use Bottom navigation', rationale: DESIGN_HEURISTICS.useBottomNav.rule });
  } else if (matchesTriggers(combined, DESIGN_HEURISTICS.useTopNav.triggers)) {
    navigationStyle = 'top-nav';
    decisions.push({ category: 'Navigation', decision: 'Use Top navigation', rationale: DESIGN_HEURISTICS.useTopNav.rule });
  }

  // 3D
  const use3D = matchesTriggers(combined, DESIGN_HEURISTICS.use3D.triggers) && !matchesAntiTriggers(combined, DESIGN_HEURISTICS.use3D.antiTriggers);
  if (use3D) {
    decisions.push({ category: '3D', decision: 'Include 3D scene', rationale: DESIGN_HEURISTICS.use3D.rule });
    warnings.push('3D content requires @react-three/fiber and @react-three/drei — ensure Sandpack has these dependencies');
  }

  // Physics
  const usePhysics = matchesTriggers(combined, DESIGN_HEURISTICS.usePhysics.triggers) && !matchesAntiTriggers(combined, DESIGN_HEURISTICS.usePhysics.antiTriggers);
  if (usePhysics) {
    decisions.push({ category: 'Physics', decision: 'Apply physics-based interactions', rationale: DESIGN_HEURISTICS.usePhysics.rule });
  }

  // Motion
  const useMotion = matchesTriggers(combined, DESIGN_HEURISTICS.useMotion.triggers);
  if (useMotion) {
    decisions.push({ category: 'Motion', decision: 'Use framer-motion animations', rationale: DESIGN_HEURISTICS.useMotion.rule });
  }

  // Glassmorphism
  const useGlassmorphism = matchesTriggers(combined, DESIGN_HEURISTICS.useGlassmorphism.triggers) && !matchesAntiTriggers(combined, DESIGN_HEURISTICS.useGlassmorphism.antiTriggers);
  if (useGlassmorphism) {
    decisions.push({ category: 'Visual', decision: 'Apply glassmorphism aesthetic', rationale: DESIGN_HEURISTICS.useGlassmorphism.rule });
    warnings.push('Glassmorphism with backdrop-blur may be performance-intensive — wrap in transform layer');
  }

  // Accessibility
  const prioritizeAccessibility = matchesTriggers(combined, DESIGN_HEURISTICS.accessibilityFirst.triggers) || combined.includes('accessibility') || combined.includes('wcag');
  if (prioritizeAccessibility) {
    decisions.push({ category: 'Accessibility', decision: 'Accessibility-first mode', rationale: DESIGN_HEURISTICS.accessibilityFirst.rule });
  }

  // Performance
  const prioritizePerformance = matchesTriggers(combined, DESIGN_HEURISTICS.performanceFirst.triggers);
  if (prioritizePerformance && use3D) {
    warnings.push('Performance-first and 3D are conflicting goals — simplify the 3D scene');
  }

  // Content density
  let contentDensity: DesignRulesResult['contentDensity'] = 'balanced';
  if (combined.includes('dense') || combined.includes('data-heavy') || combined.includes('table') || combined.includes('dashboard')) contentDensity = 'dense';
  else if (combined.includes('minimal') || combined.includes('landing') || combined.includes('hero')) contentDensity = 'sparse';
  decisions.push({ category: 'Content', decision: `Use ${contentDensity} content density`, rationale: 'Density should match information architecture complexity' });

  // Spacing
  let spacingRhythm: DesignRulesResult['spacingRhythm'] = 'comfortable';
  if (contentDensity === 'dense') spacingRhythm = 'tight';
  else if (combined.includes('luxury') || combined.includes('editorial') || combined.includes('minimal')) spacingRhythm = 'spacious';

  // Typography
  let typographyScale: DesignRulesResult['typographyScale'] = 'balanced';
  if (combined.includes('editorial') || combined.includes('hero') || combined.includes('landing') || combined.includes('bold typography')) typographyScale = 'display';
  else if (combined.includes('compact') || combined.includes('admin') || combined.includes('data table')) typographyScale = 'compact';

  // Layout complexity
  let layoutComplexity: DesignRulesResult['layoutComplexity'] = 'standard';
  if (use3D || usePhysics) layoutComplexity = 'immersive';
  else if (useMotion || useGlassmorphism) layoutComplexity = 'rich';
  else if (combined.includes('simple') || combined.includes('minimal')) layoutComplexity = 'minimal';

  // Animation strategy
  let animationStrategy = 'Subtle microinteractions on hover and focus';
  if (layoutComplexity === 'immersive') animationStrategy = 'Cinematic entrance animations with 3D transitions';
  else if (layoutComplexity === 'rich') animationStrategy = 'Smooth page entrance with stagger reveals using framer-motion';
  else if (layoutComplexity === 'minimal') animationStrategy = 'Minimal CSS transitions, no JavaScript animation';

  return {
    navigationStyle,
    layoutComplexity,
    use3D,
    useMotion,
    usePhysics,
    useGlassmorphism,
    prioritizePerformance,
    prioritizeAccessibility,
    preferDesktopLayout: combined.includes('desktop') || combined.includes('admin') || combined.includes('dashboard'),
    contentDensity,
    animationStrategy,
    spacingRhythm,
    typographyScale,
    decisions,
    warnings,
  };
}

export function formatDesignRulesForPrompt(rules: DesignRulesResult): string {
  return `
=== DESIGN REASONING LAYER ===
Navigation: ${rules.navigationStyle}
Layout Complexity: ${rules.layoutComplexity}
Content Density: ${rules.contentDensity}
Spacing Rhythm: ${rules.spacingRhythm}
Typography Scale: ${rules.typographyScale}
Animation Strategy: ${rules.animationStrategy}
Use Motion: ${rules.useMotion}
Use 3D: ${rules.use3D}
Use Glassmorphism: ${rules.useGlassmorphism}
Accessibility Priority: ${rules.prioritizeAccessibility}

Design Decisions Made:
${rules.decisions.map(d => `  [${d.category}] ${d.decision} — ${d.rationale}`).join('\n')}
${rules.warnings.length > 0 ? '\nWarnings:\n' + rules.warnings.map(w => `  ⚠ ${w}`).join('\n') : ''}
=== END DESIGN REASONING ===
`.trim();
}
