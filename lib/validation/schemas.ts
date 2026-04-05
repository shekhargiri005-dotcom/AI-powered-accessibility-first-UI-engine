import { z } from 'zod';

// ─── Intent Classification Schema ────────────────────────────────────────────

export const INTENT_TYPES = [
  'ui_generation',
  'ui_refinement',
  'product_requirement',
  'ideation',
  'debug_fix',
  'context_clarification',
] as const;

export type IntentType = typeof INTENT_TYPES[number];

export const IntentClassificationSchema = z.object({
  intentType: z.enum(INTENT_TYPES).catch('ui_generation'),
  confidence: z.number().min(0).max(1).catch(0.8),
  summary: z.string().catch(''),
  suggestedMode: z.enum(['component', 'app', 'webgl']).catch('component'),
  needsClarification: z.boolean().catch(false),
  clarificationQuestion: z.string().nullish().catch(undefined).transform(v => v ?? undefined),
  shouldGenerateCode: z.boolean().catch(true),
  
  // New: Expert UI Classification
  purpose: z.enum([
    'landing-page', 'dashboard', 'admin-panel', 'saas-tool', 'chat-ui', 
    'portfolio', 'login-signup', 'onboarding', 'e-commerce', 'education', 
    'simulation', 'robotics-drone', 'cyber-tactical', 'dev-tool', 'analytics', 'unknown'
  ]).catch('unknown'),
  visualType: z.enum([
    '2d-standard', 'aesthetic-motion', 'minimal-futuristic', 
    '3d-component', 'full-3d', 'physics-based', 'simulation-ui', 
    'hud-ui', 'cinematic', 'hybrid', 'unknown'
  ]).catch('unknown'),
  complexity: z.enum(['simple', 'medium', 'advanced', 'system-level']).catch('medium'),
  platform: z.enum(['web', 'mobile', 'tablet', 'desktop', 'responsive']).catch('responsive'),
  layout: z.enum([
    'single-page', 'multi-section', 'split-screen', 'multi-panel', 
    'dashboard-grid', 'wizard-flow', 'command-workspace', 'immersive-spatial'
  ]).catch('single-page'),
  motionLevel: z.enum(['none', 'subtle', 'moderate', 'high']).catch('subtle'),
  preferredStack: z.array(z.string()).catch(['react', 'tailwind']),
});

export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

// ─── Requirement Builder Schema ───────────────────────────────────────────────

export const RequirementBreakdownSchema = z.object({
  productSummary: z.string().catch(''),
  coreFeatures: z.array(z.string()).catch([]),
  userFlow: z.array(z.string()).catch([]),
  uiSections: z.array(z.string()).catch([]),
  designStyle: z.string().catch(''),
  targetAudience: z.string().catch(''),
  uxPriorities: z.array(z.string()).catch([]),
  componentSuggestions: z.array(z.string()).catch([]),
});

export type RequirementBreakdown = z.infer<typeof RequirementBreakdownSchema>;

// ─── Thinking Plan Schema ─────────────────────────────────────────────────────

export const ThinkingPlanSchema = z.object({
  detectedIntent: z.enum(INTENT_TYPES).catch('ui_generation'),
  summary: z.string().catch(''),
  plannedApproach: z.array(z.string()).catch([]),
  affectedScope: z.array(z.string()).catch([]),
  clarificationOpportunities: z.array(z.string()).catch([]),
  executionMode: z.enum([
    'Generate New UI',
    'Edit Existing UI',
    'Structure Requirements',
    'Debug UI',
    'Improve Design',
    'Ideation Response',
  ]).catch('Generate New UI'),
  
  // Prompt Understanding Enrichment & Expert Context
  expertReasoning: z.object({
    purpose: z.string(),
    userType: z.string(),
    informationDensity: z.string(),
    interactionModel: z.string(),
    visualTone: z.string(),
    motionStrategy: z.string(),
    renderingStrategy: z.string(),
    componentArchitecture: z.string(),
    usabilityCheck: z.string()
  }).optional(),
  likelySections: z.array(z.string()).optional(),

  requirementBreakdown: RequirementBreakdownSchema.optional(),
  suggestedMode: z.enum(['component', 'app', 'webgl']).catch('component'),
  shouldGenerateCode: z.boolean().catch(true),
});

export type ThinkingPlan = z.infer<typeof ThinkingPlanSchema>;

// ─── Field Schema ────────────────────────────────────────────────────────────

export const UIFieldSchema = z.object({
  id: z.string().catch('element'),
  type: z.enum([
    'text', 'email', 'password', 'checkbox', 'radio',
    'select', 'textarea', 'button', 'link', 'number', 'tel', 'date',
    'image', 'heading', 'paragraph', 'list', 'table', 'icon', 'video'
  ]).catch('text'),
  label: z.string().catch(''),
  placeholder: z.string().catch(''),
  required: z.boolean().catch(false),
  validation: z.string().catch(''),
  options: z.array(z.string()).catch([]),
});

export type UIField = z.infer<typeof UIFieldSchema>;

// ─── Layout Schema ───────────────────────────────────────────────────────────

export const LayoutSchema = z.object({
  type: z.enum([
    'single-column', 'two-column', 'grid', 'flex-row', 'centered',
  ]).catch('single-column'),
  maxWidth: z.enum(['sm', 'md', 'lg', 'xl', 'full']).catch('md'),
  alignment: z.enum(['left', 'center', 'right']).catch('left'),
});

export type Layout = z.infer<typeof LayoutSchema>;

// ─── Interaction Schema ──────────────────────────────────────────────────────

export const InteractionSchema = z.object({
  trigger: z.string().catch('click'),
  action: z.string().catch('update'),
  feedback: z.string().catch(''),
});

export type Interaction = z.infer<typeof InteractionSchema>;

// ─── Theme Schema ────────────────────────────────────────────────────────────

export const ThemeSchema = z.object({
  variant: z.enum(['default', 'primary', 'secondary', 'danger', 'success']).catch('primary'),
  size: z.enum(['sm', 'md', 'lg']).catch('md'),
});

// ─── UIIntent Schema (main output of Intent Parser) ──────────────────────────

export const UIIntentSchema = z.object({
  componentType: z.string().catch('component'),
  componentName: z.string().catch('GeneratedComponent'),
  description: z.string().catch('UI Component'),
  fields: z.array(UIFieldSchema).catch([]),
  layout: LayoutSchema.catch({ type: 'single-column', maxWidth: 'md', alignment: 'left' }),
  interactions: z.array(InteractionSchema).catch([]),
  theme: ThemeSchema.catch({ variant: 'primary', size: 'md' }),
  a11yRequired: z.array(z.string()).catch([]),
  semanticElements: z.array(z.string()).catch([]),
  // Iterative Context
  isRefinement: z.boolean().optional(),
  targetFiles: z.array(z.string()).optional(),
  previousProjectId: z.string().optional(),
});

// ─── AppIntent Schema ─────────────────────────────────────────────────────────

export const AppIntentSchema = UIIntentSchema.extend({
  componentType: z.literal('app'),
  appType: z.string().catch('multiscreen'),
  screens: z.array(z.object({
    name: z.string(),
    description: z.string(),
    isDefault: z.boolean().catch(false),
  })).catch([]),
  colorScheme: z.object({
    primary: z.string(),
    background: z.string(),
    surface: z.string(),
    text: z.string(),
  }).catch({ primary: '#3B82F6', background: '#000000', surface: '#111827', text: '#FFFFFF' }),
  features: z.array(z.string()).catch([]),
  navStyle: z.enum(['bottom', 'sidebar', 'top']).catch('bottom'),
});

// ─── WebGLIntent Schema ───────────────────────────────────────────────────────

export const WebGLIntentSchema = UIIntentSchema.extend({
  componentType: z.literal('webgl'),
  webglType: z.string().catch('canvas'),
  sceneElements: z.array(z.object({
    name: z.string(),
    type: z.string(),
    behavior: z.string(),
  })).catch([]),
  colorScheme: z.object({
    primary: z.string(),
    background: z.string(),
    ambientLight: z.string(),
    directionalLight: z.string(),
  }).catch({ primary: '#3B82F6', background: '#000000', ambientLight: '#FFFFFF', directionalLight: '#FFFFFF' }),
  uiOverlay: z.array(z.object({
    element: z.string(),
    position: z.string(),
  })).catch([]),
  cameraSetup: z.object({
    position: z.array(z.number()).length(3),
    fov: z.number(),
  }).catch({ position: [0, 0, 5], fov: 75 }),
});

export type UIIntent = z.infer<typeof UIIntentSchema> & {
  screens?: z.infer<typeof AppIntentSchema>['screens'];
  appType?: string;
  colorScheme?: unknown;
  features?: string[];
  navStyle?: string;
  webglType?: string;
  sceneElements?: unknown;
  uiOverlay?: unknown;
  cameraSetup?: unknown;
  // Refinement fields are already in the base schema but for clarity:
  isRefinement?: boolean;
  targetFiles?: string[];
  previousProjectId?: string;
};

// ─── Generated Component Schema ───────────────────────────────────────────────

export const GeneratedComponentSchema = z.object({
  code: z.string().min(10, 'Generated code too short'),
  componentName: z.string(),
  intent: UIIntentSchema,
});

export type GeneratedComponent = z.infer<typeof GeneratedComponentSchema>;

// ─── A11y Violation Schema ────────────────────────────────────────────────────

export const A11yViolationSchema = z.object({
  ruleId: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  element: z.string(),
  description: z.string(),
  suggestion: z.string(),
  wcagCriteria: z.string(),
});

export type A11yViolation = z.infer<typeof A11yViolationSchema>;

export const A11yReportSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  violations: z.array(A11yViolationSchema),
  suggestions: z.array(z.string()),
  timestamp: z.string(),
});

export type A11yReport = z.infer<typeof A11yReportSchema>;

// ─── API Response Schemas ─────────────────────────────────────────────────────

export const ParseAPIResponseSchema = z.object({
  success: z.boolean(),
  intent: UIIntentSchema.optional(),
  error: z.string().optional(),
});

export const GenerateAPIResponseSchema = z.object({
  success: z.boolean(),
  code: z.string().optional(),
  a11yReport: A11yReportSchema.optional(),
  tests: z.object({
    rtl: z.string(),
    playwright: z.string(),
  }).optional(),
  error: z.string().optional(),
});
