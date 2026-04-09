/**
 * Input Validator — validates user prompts before sending to the AI pipeline.
 * Catches empty, nonsensical, or structurally invalid requests early.
 */

export interface InputValidationResult {
  valid: boolean;
  reason?: string;
  sanitized?: string;
  suggestions?: string[];
}

const SIGNAL_WORDS = [
  'create', 'build', 'make', 'design', 'generate', 'show', 'display', 'render',
  'page', 'component', 'app', 'form', 'button', 'card', 'header', 'footer',
  'nav', 'sidebar', 'dashboard', 'hero', 'ui', 'layout', 'screen', 'interface',
  'style', 'dark', 'light', 'modal', 'table', 'chart', 'list', 'feed', 'grid',
  'login', 'signup', 'chat', 'profile', 'settings', 'portfolio', 'landing', 'store',
  'ecommerce', 'saas', 'admin', 'analytics', 'report', 'notification', 'blog', 'news',
  'animated', 'motion', '3d', 'glassmorphism', 'futuristic', 'dark mode', 'crypto',
  'fintech', 'health', 'edu', 'travel', 'booking', 'kanban', 'crm', 'pricing',
];

const LOW_SIGNAL_PATTERNS = [
  /^[^a-zA-Z]*$/, // All non-letters
  /^[a-z]{1,3}$/i, // Single word 1-3 chars
  /^(.)\1{4,}$/, // Repeated character: "aaaaaaa"
  /^[^a-zA-Z\d]{3,}$/, // All punctuation/symbols
];

const MEANINGLESS_PHRASES = [
  'test', 'asdf', 'qwerty', 'aaa', 'bbb', 'hello world',
  'lol', 'lmao', 'idk', 'no idea', 'nothing', 'whatever',
];

function hasEnoughSignal(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return SIGNAL_WORDS.some(w => lower.includes(w));
}

function isLowSignal(prompt: string): boolean {
  const trimmed = prompt.trim();
  // Check for low-signal patterns
  for (const pattern of LOW_SIGNAL_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  // Check for meaningless phrases
  const lower = trimmed.toLowerCase();
  if (MEANINGLESS_PHRASES.some(p => lower === p)) return true;
  return false;
}

export function validatePromptInput(prompt: unknown): InputValidationResult {
  // Type check
  if (prompt === null || prompt === undefined) {
    return { valid: false, reason: 'No prompt provided. Please describe the UI you want to create.' };
  }
  if (typeof prompt !== 'string') {
    return { valid: false, reason: 'Prompt must be text. Please type your UI description.' };
  }

  const trimmed = prompt.trim();

  // Empty check
  if (trimmed.length === 0) {
    return {
      valid: false,
      reason: 'Prompt is empty. Please describe the UI you want to generate.',
      suggestions: [
        'Try: "Create a modern SaaS dashboard with sidebar navigation and metric cards"',
        'Try: "Build a fintech landing page with glassmorphism and hero section"',
        'Try: "Generate a beautiful login form with email and password fields"',
      ],
    };
  }

  // Too short
  if (trimmed.length < 5) {
    return {
      valid: false,
      reason: `Your prompt is too short (${trimmed.length} chars). Please provide more detail.`,
      suggestions: ['Try adding what type of UI, its visual style, and key features'],
    };
  }

  // Low signal / gibberish
  if (isLowSignal(trimmed)) {
    return {
      valid: false,
      reason: 'Your prompt appears to be too vague or meaningless. Please describe a specific UI.',
      suggestions: [
        'Example: "Create a crypto trading dashboard with dark theme and candlestick charts"',
        'Example: "Design an e-commerce product page with 3D product viewer"',
      ],
    };
  }

  // No UI-related signal at all (only check if prompt is short)
  if (trimmed.length < 50 && !hasEnoughSignal(trimmed)) {
    return {
      valid: false,
      reason: 'Your prompt does not appear to describe a UI component or screen. Please include what you want to build.',
      suggestions: [
        'Try: "Create a [type] UI/page/component with [features]"',
        'Be specific about what visual elements, layout, or interactions you want',
      ],
    };
  }

  // Sanitize: remove potential injection attempts
  const sanitized = trimmed
    .substring(0, 20000)
    .replace(/system:|assistant:|<\|.*?\|>/gi, '')
    .trim();

  return { valid: true, sanitized };
}

export function validateGenerationMode(mode: unknown): { valid: boolean; reason?: string } {
  const validModes = ['component', 'app', 'depth_ui'];
  if (!mode || !validModes.includes(String(mode))) {
    return { valid: false, reason: `Invalid generation mode "${mode}". Must be one of: ${validModes.join(', ')}` };
  }
  return { valid: true };
}

export function validateModel(model: unknown): { valid: boolean; reason?: string } {
  if (!model || typeof model !== 'string') {
    return { valid: false, reason: 'Model must be a non-empty string' };
  }
  // Accept any string that looks like an OpenAI model ID
  if (model.length < 3 || model.length > 100) {
    return { valid: false, reason: 'Invalid model identifier length' };
  }
  return { valid: true };
}
