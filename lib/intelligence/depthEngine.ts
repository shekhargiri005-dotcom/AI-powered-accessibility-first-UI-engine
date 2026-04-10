import type {
  UIIntent,
  DepthUIModePreset,
  MotionDesignSpec,
  ParallaxSpec,
  ParallaxCoefficients,
} from '../validation/schemas';
import type { UIBlueprint } from './blueprintEngine';

const DEFAULT_FORBIDDEN_ZONES = ['forms', 'settings', 'dashboard-main', 'data-tables', 'checkout'];

/**
 * DepthExperienceEngine
 *
 * Deterministically evaluates the UI intent and blueprint to generate a
 * safe, premium Depth UI preset. This controls how the AI will implement
 * motion, parallax, and floating layers.
 *
 * Phase 8 — TAF Gap #1 (Dimensions 3, 4, 13):
 *  Now computes quantified `parallaxCoefficients` so the generation prompt
 *  injects EXACT speed factors per layer instead of letting the model invent
 *  them. Also enforces `useRelativeScroll: true` to prevent parallax "jump"
 *  when the page is loaded mid-scroll.
 */
export function evaluateDepthExperience(intent: UIIntent, blueprint: UIBlueprint): DepthUIModePreset {
  const isDashboard = intent.purpose === 'dashboard' || blueprint.pageType === 'dashboard';
  const isAdmin = intent.purpose === 'admin-panel' || blueprint.pageType === 'admin';
  const isForm = intent.purpose === 'login-signup' || intent.purpose === 'onboarding' || blueprint.pageType === 'form';
  const isMarketing = intent.purpose === 'landing-page' || intent.purpose === 'portfolio' || blueprint.pageType === 'landing-page';

  const text = (intent.description + ' ' + (intent.depthArchetype || '')).toLowerCase();

  // 1. Evaluate pure safety constraints
  const shouldMinimizeMotion =
    isDashboard || isAdmin || isForm ||
    blueprint.complexityLevel === 'dense' ||
    text.includes('subtle') || text.includes('minimal');

  // 2. Determine archetype based on heuristics
  let parallaxType: MotionDesignSpec['parallaxType'] = 'soft_depth';
  let motionTrigger: ParallaxSpec['motionTrigger'] = 'scroll';
  let pageScope: ParallaxSpec['pageScope'] = 'section-based';
  let depthLayers = 2;

  if (text.includes('mouse') || text.includes('cursor')) {
    parallaxType = 'mouse_reactive';
    motionTrigger = 'mouse';
    pageScope = 'hero-only';
  } else if (text.includes('cinematic') || text.includes('immersive')) {
    parallaxType = 'scroll_scene';
    pageScope = 'full-page';
    depthLayers = 4;
  } else if (text.includes('hero') && isMarketing) {
    parallaxType = 'hero_depth';
    pageScope = 'hero-only';
    depthLayers = 3;
  } else if (text.includes('features') || text.includes('showcase') || text.includes('reveal')) {
    parallaxType = 'feature_reveal';
  }

  // High intensity triggers
  const isHighIntensity = text.includes('extreme') || text.includes('crazy') || text.includes('intense');

  // Build the Motion Design Spec
  const motionDesign: MotionDesignSpec = {
    motionStyle: shouldMinimizeMotion ? 'minimal' : (isHighIntensity ? 'immersive' : 'premium'),
    parallaxEnabled: !shouldMinimizeMotion,
    parallaxType: shouldMinimizeMotion ? 'soft_depth' : parallaxType,
    intensity: shouldMinimizeMotion ? 'low' : (isHighIntensity ? 'high' : 'medium'),
    allowedZones: ['hero', 'feature-showcase', 'section-transition', 'background-layer'],
    forbiddenZones: DEFAULT_FORBIDDEN_ZONES,
    reducedMotionFallback: true,
    mobileReduction: true,
    performanceMode: isHighIntensity ? 'premium' : 'safe',
  };

  // Build the Parallax Spec
  const parallax: ParallaxSpec = {
    enabled: motionDesign.parallaxEnabled,
    style: shouldMinimizeMotion ? 'subtle' : (isHighIntensity ? 'cinematic' : 'layered'),
    pageScope: shouldMinimizeMotion ? 'hero-only' : pageScope,
    intensity: motionDesign.intensity,
    motionTrigger: shouldMinimizeMotion ? 'scroll' : motionTrigger,
    allowedRegions: motionDesign.allowedZones,
    forbiddenRegions: motionDesign.forbiddenZones,
    depthLayers: shouldMinimizeMotion ? 1 : depthLayers,
    mobileBehavior: 'reduce',
    reducedMotionSupport: true,
    performanceMode: motionDesign.performanceMode,
  };

  // ─── Phase 8: Parallax Coefficient Calculation ────────────────────────────
  // Compute quantified per-layer speed factors driven by intensity + layer count.
  // These prevent the model from inventing arbitrary values (TAF Dims 3, 4, 13).
  //
  // Coefficient ranges by intensity:
  //   low     → bg: 0.08, mid: 0.20, fg: 0.40  (barely noticeable)
  //   medium  → bg: 0.15, mid: 0.35, fg: 0.60  (polished premium)
  //   high    → bg: 0.22, mid: 0.50, fg: 0.80  (cinematic / immersive)
  //
  // If motion is minimized OR only 1 layer, all factors collapse to 0.10 for
  // a barely-visible depth hint that satisfies prefers-reduced-motion users.
  const parallaxCoefficients: ParallaxCoefficients = computeCoefficients(
    motionDesign.intensity,
    parallax.depthLayers,
    shouldMinimizeMotion,
  );

  return {
    generationMode: 'depth_ui',
    visualPriority: isMarketing ? 'startup' : (shouldMinimizeMotion ? 'premium' : 'immersive'),
    motionDesign,
    parallax,
    parallaxCoefficients,
  };
}

/**
 * Compute deterministic per-layer speed coefficients.
 *
 * @param intensity        - low | medium | high
 * @param depthLayers      - number of parallax layers (1–4)
 * @param minimizeMotion   - if true, collapse to near-zero for reduced-motion compat
 */
function computeCoefficients(
  intensity: 'low' | 'medium' | 'high',
  depthLayers: number,
  minimizeMotion: boolean,
): ParallaxCoefficients {
  // Reduced motion / single-layer: use a single near-static factor for all layers
  if (minimizeMotion || depthLayers <= 1) {
    return {
      bgLayerSpeedFactor:  0.05,
      midLayerSpeedFactor: 0.08,
      fgLayerSpeedFactor:  0.10,
      useRelativeScroll:   true,
    };
  }

  const TABLE: Record<'low' | 'medium' | 'high', Pick<
    ParallaxCoefficients,
    'bgLayerSpeedFactor' | 'midLayerSpeedFactor' | 'fgLayerSpeedFactor'
  >> = {
    low:    { bgLayerSpeedFactor: 0.08, midLayerSpeedFactor: 0.20, fgLayerSpeedFactor: 0.40 },
    medium: { bgLayerSpeedFactor: 0.15, midLayerSpeedFactor: 0.35, fgLayerSpeedFactor: 0.60 },
    high:   { bgLayerSpeedFactor: 0.22, midLayerSpeedFactor: 0.50, fgLayerSpeedFactor: 0.80 },
  };

  return {
    ...TABLE[intensity],
    // useRelativeScroll is ALWAYS true — non-negotiable to prevent jump-on-load
    useRelativeScroll: true,
  };
}
