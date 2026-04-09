/**
 * @file lib/intelligence/uxStateEngine.ts
 *
 * UX State Engine — audits generated code for missing interaction states.
 *
 * Phase 7: Inspects generated TSX to check whether essential UX states
 * (loading, empty, error, disabled) are present. Returns a structured
 * UXStateAudit that is:
 *  - Appended to the generation system prompt as missing-state guidance
 *  - Included in the critique pass (finalRoundCritic.ts)
 *  - Logged for telemetry
 *
 * Applies to `component` and `depth_ui` modes only.
 * Does NOT block generation — purely advisory.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UXStateCheck {
  /** Identifier for this UX state */
  state:    'loading' | 'empty' | 'error' | 'disabled' | 'hover' | 'focus';
  /** Whether the state appears to be handled in the code */
  present:  boolean;
  /** How important this state is for this component type */
  priority: 'required' | 'recommended' | 'optional';
  /** Specific suggestion for how to implement the missing state */
  guidance: string;
}

export interface UXStateAudit {
  /** Component type inferred from the code */
  componentType:   string;
  checks:          UXStateCheck[];
  /** States that are missing and have 'required' priority */
  criticalMissing: string[];
  /** States that are missing and have 'recommended' priority */
  suggestedMissing: string[];
  /** A concise prompt-ready description of what's missing */
  promptGuidance:  string | null;
  /** True if any critical states are missing */
  needsRepair:     boolean;
}

// ─── Component Type Detection ─────────────────────────────────────────────────

/**
 * Infer the functional component type from the code + prompt.
 * Used to determine which UX states are required vs optional.
 */
function inferComponentType(code: string, prompt: string): string {
  const combined = (code + ' ' + prompt).toLowerCase();

  if (combined.includes('login') || combined.includes('sign in') || combined.includes('signin'))   return 'auth_form';
  if (combined.includes('signup') || combined.includes('register'))                                return 'auth_form';
  if (combined.includes('<form') || combined.includes('onsubmit') || (combined.includes('input') && combined.includes('submit'))) return 'form';
  if (combined.includes('fetch') || combined.includes('usequery') || combined.includes('swr') || combined.includes('axios'))     return 'data_fetch';
  if (combined.includes('table') || combined.includes('datagrid') || combined.includes('data grid') || combined.includes('tbody')) return 'data_table';
  if (combined.includes('card') && (combined.includes('product') || combined.includes('item') || combined.includes('listing')))  return 'card_list';
  if (combined.includes('button') && !combined.includes('form'))  return 'interactive_ui';
  if (combined.includes('chart') || combined.includes('analytics') || combined.includes('graph')) return 'analytics';
  if (combined.includes('dashboard'))                             return 'dashboard';
  if (combined.includes('hero') || combined.includes('landing'))  return 'marketing';
  if (combined.includes('parallax') || combined.includes('depth')) return 'depth_experience';

  return 'general';
}

// ─── State Detection ──────────────────────────────────────────────────────────

/** Detect if loading state is implemented */
function hasLoadingState(code: string): boolean {
  return (
    code.includes('isLoading') ||
    code.includes('loading') ||
    code.includes('skeleton') ||
    code.includes('Skeleton') ||
    code.includes('animate-pulse') ||
    code.includes('spinner') ||
    code.includes('Spinner') ||
    code.includes('LoadingState') ||
    code.includes('isFetching')
  );
}

/** Detect if empty state is implemented */
function hasEmptyState(code: string): boolean {
  return (
    code.includes('.length === 0') ||
    code.includes('.length == 0') ||
    code.includes('isEmpty') ||
    code.includes('empty state') ||
    code.includes('EmptyState') ||
    code.includes('No results') ||
    code.includes('no results') ||
    code.includes('Nothing here') ||
    code.includes('empty') && (code.includes('illustration') || code.includes('icon'))
  );
}

/** Detect if error state is implemented */
function hasErrorState(code: string): boolean {
  return (
    code.includes('error') ||
    code.includes('Error') ||
    code.includes('catch') ||
    code.includes('isError') ||
    code.includes('onError') ||
    code.includes('ErrorBoundary') ||
    code.includes('try {')
  );
}

/** Detect if disabled state is implemented */
function hasDisabledState(code: string): boolean {
  return (
    code.includes('disabled') ||
    code.includes('isDisabled') ||
    code.includes(':disabled')
  );
}

/** Detect if hover state is implemented */
function hasHoverState(code: string): boolean {
  return (
    code.includes('hover:') ||         // Tailwind hover:
    code.includes(':hover') ||          // CSS
    code.includes('onMouseEnter') ||
    code.includes('onMouseOver') ||
    code.includes('whileHover')        // framer-motion
  );
}

/** Detect if focus state is implemented (a11y critical) */
function hasFocusState(code: string): boolean {
  return (
    code.includes('focus:') ||          // Tailwind focus:
    code.includes('focus-visible:') ||  // Tailwind focus-visible:
    code.includes(':focus') ||
    code.includes('focus:ring') ||
    code.includes('outline:')
  );
}

// ─── Priority Rules per Component Type ───────────────────────────────────────

interface PriorityRule {
  state:    UXStateCheck['state'];
  priority: UXStateCheck['priority'];
}

const PRIORITY_RULES: Record<string, PriorityRule[]> = {
  auth_form: [
    { state: 'loading',  priority: 'required' },
    { state: 'error',    priority: 'required' },
    { state: 'disabled', priority: 'required' },
    { state: 'focus',    priority: 'required' },
    { state: 'hover',    priority: 'recommended' },
    { state: 'empty',    priority: 'optional' },
  ],
  form: [
    { state: 'loading',  priority: 'required' },
    { state: 'error',    priority: 'required' },
    { state: 'disabled', priority: 'required' },
    { state: 'focus',    priority: 'required' },
    { state: 'hover',    priority: 'recommended' },
    { state: 'empty',    priority: 'optional' },
  ],
  data_fetch: [
    { state: 'loading',  priority: 'required' },
    { state: 'error',    priority: 'required' },
    { state: 'empty',    priority: 'required' },
    { state: 'focus',    priority: 'recommended' },
    { state: 'hover',    priority: 'recommended' },
    { state: 'disabled', priority: 'optional' },
  ],
  data_table: [
    { state: 'loading',  priority: 'required' },
    { state: 'empty',    priority: 'required' },
    { state: 'error',    priority: 'recommended' },
    { state: 'hover',    priority: 'recommended' },
    { state: 'focus',    priority: 'recommended' },
    { state: 'disabled', priority: 'optional' },
  ],
  analytics: [
    { state: 'loading',  priority: 'required' },
    { state: 'empty',    priority: 'recommended' },
    { state: 'error',    priority: 'recommended' },
    { state: 'hover',    priority: 'recommended' },
    { state: 'focus',    priority: 'optional' },
    { state: 'disabled', priority: 'optional' },
  ],
  dashboard: [
    { state: 'loading',  priority: 'required' },
    { state: 'empty',    priority: 'recommended' },
    { state: 'error',    priority: 'recommended' },
    { state: 'hover',    priority: 'recommended' },
    { state: 'focus',    priority: 'recommended' },
    { state: 'disabled', priority: 'optional' },
  ],
  interactive_ui: [
    { state: 'hover',    priority: 'required' },
    { state: 'focus',    priority: 'required' },
    { state: 'disabled', priority: 'recommended' },
    { state: 'loading',  priority: 'optional' },
    { state: 'error',    priority: 'optional' },
    { state: 'empty',    priority: 'optional' },
  ],
  card_list: [
    { state: 'hover',    priority: 'required' },
    { state: 'empty',    priority: 'required' },
    { state: 'loading',  priority: 'recommended' },
    { state: 'focus',    priority: 'recommended' },
    { state: 'error',    priority: 'optional' },
    { state: 'disabled', priority: 'optional' },
  ],
  marketing: [
    { state: 'hover',    priority: 'recommended' },
    { state: 'focus',    priority: 'recommended' },
    { state: 'loading',  priority: 'optional' },
    { state: 'empty',    priority: 'optional' },
    { state: 'error',    priority: 'optional' },
    { state: 'disabled', priority: 'optional' },
  ],
  depth_experience: [
    { state: 'hover',    priority: 'recommended' },
    { state: 'focus',    priority: 'required' },  // a11y: parallax must degrade gracefully
    { state: 'loading',  priority: 'optional' },
    { state: 'empty',    priority: 'optional' },
    { state: 'error',    priority: 'optional' },
    { state: 'disabled', priority: 'optional' },
  ],
  general: [
    { state: 'hover',    priority: 'recommended' },
    { state: 'focus',    priority: 'recommended' },
    { state: 'loading',  priority: 'optional' },
    { state: 'error',    priority: 'optional' },
    { state: 'empty',    priority: 'optional' },
    { state: 'disabled', priority: 'optional' },
  ],
};

// ─── Guidance Templates ───────────────────────────────────────────────────────

const GUIDANCE: Record<UXStateCheck['state'], string> = {
  loading:  'Add a loading skeleton or spinner: {isLoading && <div className="animate-pulse ...">...skeleton...</div>}',
  empty:    'Add an empty state for when the data array is empty: {items.length === 0 && <EmptyState icon={...} message="No items yet" />}',
  error:    'Add an error state: {error && <div role="alert" className="text-red-500">...</div>}',
  disabled: 'Add disabled state to interactive elements: disabled={isLoading || isSubmitting} with aria-disabled={true}',
  hover:    'Add hover states using Tailwind: hover:bg-zinc-800 hover:scale-[1.02] transition-all duration-150',
  focus:    'Add visible focus rings for keyboard accessibility: focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
};

// ─── Main Audit Function ──────────────────────────────────────────────────────

/**
 * Audit generated code for missing UX states.
 *
 * @param code   The generated TSX code
 * @param prompt The user's original prompt (for component type inference)
 */
export function auditUXStates(code: string, prompt: string): UXStateAudit {
  const componentType = inferComponentType(code, prompt);
  const rules         = PRIORITY_RULES[componentType] ?? PRIORITY_RULES.general;

  const detectors: Record<UXStateCheck['state'], (c: string) => boolean> = {
    loading:  hasLoadingState,
    empty:    hasEmptyState,
    error:    hasErrorState,
    disabled: hasDisabledState,
    hover:    hasHoverState,
    focus:    hasFocusState,
  };

  const checks: UXStateCheck[] = rules.map(rule => ({
    state:    rule.state,
    priority: rule.priority,
    present:  detectors[rule.state](code),
    guidance: GUIDANCE[rule.state],
  }));

  const criticalMissing  = checks.filter(c => !c.present && c.priority === 'required').map(c => c.state);
  const suggestedMissing = checks.filter(c => !c.present && c.priority === 'recommended').map(c => c.state);

  // Build prompt guidance only for critical and recommended states
  const missingForPrompt = [...criticalMissing, ...suggestedMissing];
  let promptGuidance: string | null = null;

  if (missingForPrompt.length > 0) {
    const lines: string[] = [
      `UX STATE REQUIREMENTS for this ${componentType.replace(/_/g, ' ')} component:`,
    ];

    for (const state of criticalMissing) {
      const check = checks.find(c => c.state === state)!;
      lines.push(`  [REQUIRED] ${state.toUpperCase()} state: ${check.guidance}`);
    }
    for (const state of suggestedMissing) {
      const check = checks.find(c => c.state === state)!;
      lines.push(`  [RECOMMENDED] ${state.toUpperCase()} state: ${check.guidance}`);
    }

    lines.push('\nEnsure ALL required states are implemented before returning the component.');
    promptGuidance = lines.join('\n');
  }

  return {
    componentType,
    checks,
    criticalMissing,
    suggestedMissing,
    promptGuidance,
    needsRepair: criticalMissing.length > 0,
  };
}

/**
 * Format a pre-generation UX state contract for the SYSTEM PROMPT.
 * Called BEFORE generation — tells the model what states to include.
 *
 * @param prompt  The user's prompt (used to infer component type)
 */
export function buildUXStateContract(prompt: string): string | null {
  const componentType = inferComponentType('', prompt);
  const rules         = PRIORITY_RULES[componentType] ?? PRIORITY_RULES.general;

  const required    = rules.filter(r => r.priority === 'required');
  const recommended = rules.filter(r => r.priority === 'recommended');

  if (required.length === 0 && recommended.length === 0) return null;

  const lines: string[] = [
    `=== UX STATE CONTRACT for ${componentType.replace(/_/g, ' ').toUpperCase()} ===`,
  ];

  if (required.length > 0) {
    lines.push('REQUIRED states (must implement):');
    for (const r of required) lines.push(`  • ${r.state.toUpperCase()}: ${GUIDANCE[r.state]}`);
  }
  if (recommended.length > 0) {
    lines.push('RECOMMENDED states (strongly suggested):');
    for (const r of recommended) lines.push(`  • ${r.state.toUpperCase()}: ${GUIDANCE[r.state]}`);
  }

  lines.push('=== END UX STATE CONTRACT ===');
  return lines.join('\n');
}
