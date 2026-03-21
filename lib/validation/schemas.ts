import { z } from 'zod';

// ─── Field Schema ────────────────────────────────────────────────────────────

export const UIFieldSchema = z.object({
  id: z.string().catch('element'),
  type: z.enum([
    'text', 'email', 'password', 'checkbox', 'radio',
    'select', 'textarea', 'button', 'link', 'number', 'tel', 'date',
    'image', 'heading', 'paragraph', 'list', 'table', 'icon', 'video'
  ]).catch('text'),
  label: z.string().nullable().catch(''),
  placeholder: z.string().nullable().catch(''),
  required: z.boolean().nullable().catch(false),
  validation: z.string().nullable().catch(''),
  options: z.array(z.string()).nullable().catch([]),
});

export type UIField = z.infer<typeof UIFieldSchema>;

// ─── Layout Schema ───────────────────────────────────────────────────────────

export const LayoutSchema = z.object({
  type: z.enum([
    'single-column', 'two-column', 'grid', 'flex-row', 'centered',
  ]).nullable().catch('single-column'),
  maxWidth: z.enum(['sm', 'md', 'lg', 'xl', 'full']).nullable().catch('md'),
  alignment: z.enum(['left', 'center', 'right']).nullable().catch('left'),
});

export type Layout = z.infer<typeof LayoutSchema>;

// ─── Interaction Schema ──────────────────────────────────────────────────────

export const InteractionSchema = z.object({
  trigger: z.string().catch('click'),
  action: z.string().catch('update'),
  feedback: z.string().nullable().catch(''),
});

export type Interaction = z.infer<typeof InteractionSchema>;

// ─── Theme Schema ────────────────────────────────────────────────────────────

export const ThemeSchema = z.object({
  variant: z.enum(['default', 'primary', 'secondary', 'danger', 'success']).nullable().catch('primary'),
  size: z.enum(['sm', 'md', 'lg']).nullable().catch('md'),
});

// ─── UIIntent Schema (main output of Intent Parser) ──────────────────────────

export const UIIntentSchema = z.object({
  componentType: z.string().catch('component'),
  componentName: z.string().catch('GeneratedComponent'),
  description: z.string().catch('UI Component'),
  fields: z.array(UIFieldSchema).nullable().catch([]),
  layout: LayoutSchema.default({ type: 'single-column', maxWidth: 'md', alignment: 'left' }),
  interactions: z.array(InteractionSchema).nullable().catch([]),
  theme: ThemeSchema.default({ variant: 'primary', size: 'md' }),
  a11yRequired: z.array(z.string()).nullable().catch([]),
  semanticElements: z.array(z.string()).nullable().catch([]),
});

export type UIIntent = z.infer<typeof UIIntentSchema>;

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
