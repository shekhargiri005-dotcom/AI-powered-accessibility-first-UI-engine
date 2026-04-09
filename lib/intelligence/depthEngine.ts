import type { UIIntent, DepthUIModePreset, MotionDesignSpec, ParallaxSpec } from '../validation/schemas';
import type { UIBlueprint } from './blueprintEngine';

const DEFAULT_FORBIDDEN_ZONES = ['forms', 'settings', 'dashboard-main', 'data-tables', 'checkout'];

/**
 * DepthExperienceEngine
 * 
 * Deterministically evaluates the UI intent and blueprint to generate a
 * safe, premium Depth UI preset. This controls how the AI will implement
 * motion, parallax, and floating layers.
 */
export function evaluateDepthExperience(intent: UIIntent, blueprint: UIBlueprint): DepthUIModePreset {
  const isDashboard = intent.purpose === 'dashboard' || blueprint.pageType === 'dashboard';
  const isAdmin = intent.purpose === 'admin-panel' || blueprint.pageType === 'admin';
  const isForm = intent.purpose === 'login-signup' || intent.purpose === 'onboarding' || blueprint.pageType === 'form';
  const isMarketing = intent.purpose === 'landing-page' || intent.purpose === 'portfolio' || blueprint.pageType === 'landing-page';
  
  const text = (intent.description + ' ' + (intent.depthArchetype || '')).toLowerCase();
  
  // 1. Evaluate pure safety constraints
  const shouldMinimizeMotion = isDashboard || isAdmin || isForm || blueprint.complexityLevel === 'dense' || text.includes('subtle') || text.includes('minimal');
  
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

  return {
    generationMode: 'depth_ui',
    visualPriority: isMarketing ? 'startup' : (shouldMinimizeMotion ? 'premium' : 'immersive'),
    motionDesign,
    parallax
  };
}
