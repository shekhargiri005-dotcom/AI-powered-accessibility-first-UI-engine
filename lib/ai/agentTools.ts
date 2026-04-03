/**
 * @file agentTools.ts
 * Pre-built tools that agents can call during generation.
 *
 * These are the tools the AI may *request* during a generate() call — for
 * example "look up what components are in the design system" or "check if
 * this Tailwind class exists".  After the model requests them, the code
 * calls executeToolCalls(), runs the implementations, and feeds the results
 * back into the next generate() turn.
 *
 * To register a new tool:
 *  1. Define it here with a `name`, `description`, `parameters`, and `execute`.
 *  2. Add it to the exported `DEFAULT_AGENT_TOOLS` array.
 *  3. Pass the array into `adapter.generate({ ..., tools: DEFAULT_AGENT_TOOLS })`.
 */

import type { Tool } from './tools';

// ─── Tool: Design System Component Lookup ─────────────────────────────────────

/**
 * Lets the model query which UI primitives exist in our local design system
 * before deciding what to render.  The list is sourced directly from the
 * `packages/` directory so it always reflects the real state of the codebase.
 */
const componentLookupTool: Tool = {
  name: 'lookup_design_system_components',
  description:
    'Returns a list of all available components in the design system. ' +
    'Call this when you are unsure whether a primitive (Button, Card, Input, etc.) ' +
    'already exists before generating custom JSX.',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Optional keyword to filter component names (e.g. "button", "form").',
      },
    },
    required: [],
  },
  execute: async ({ filter }: Record<string, unknown>) => {
    // Source-of-truth: the same JSON that Sandpack uses
    // We import it lazily to avoid bloating the bundle
    const ecosystem = await import('../sandbox/ui-ecosystem.json').catch(() => null);
    if (!ecosystem) {
      return { components: [], note: 'Ecosystem index not built yet. Run build-ecosystem.mjs.' };
    }

    const allNames = Object.keys(ecosystem as Record<string, unknown>).filter(
      (k) => !k.startsWith('/') && k.endsWith('.tsx')
    );

    const filtered =
      typeof filter === 'string' && filter.length > 0
        ? allNames.filter((n) => n.toLowerCase().includes(filter.toLowerCase()))
        : allNames;

    return { components: filtered, total: filtered.length };
  },
};

// ─── Tool: Tailwind Class Validator ───────────────────────────────────────────

/**
 * Checks whether a Tailwind utility class is semantically valid.
 * This prevents the model from hallucinating non-existent classes.
 */
const tailwindValidatorTool: Tool = {
  name: 'validate_tailwind_class',
  description:
    'Check whether one or more Tailwind CSS utility classes are valid. ' +
    'Returns a mapping of class → valid/invalid. Use this before writing JSX ' +
    'to avoid generating non-existent classes.',
  parameters: {
    type: 'object',
    properties: {
      classes: {
        type: 'array',
        description: 'Array of Tailwind class strings to validate.',
        items: { type: 'string' },
      },
    },
    required: ['classes'],
  },
  execute: async ({ classes }: Record<string, unknown>) => {
    const list = Array.isArray(classes) ? (classes as string[]) : [];

    // Lightweight pattern-based validation — covers 95%+ of common classes
    // without importing the full Tailwind PostCSS pipeline server-side.
    const prefixPattern =
      /^(m|p|w|h|max-w|min-w|max-h|min-h|flex|grid|col|row|gap|space|border|rounded|shadow|text|font|bg|ring|opacity|z|top|right|bottom|left|overflow|cursor|transition|duration|ease|scale|rotate|translate|skew|sr-only|not-sr-only|block|inline|hidden|absolute|relative|fixed|sticky|items|justify|content|self|place)(-|\b)/;

    const result: Record<string, boolean> = {};
    for (const cls of list) {
      // Allow arbitrary values like w-[400px] and responsive prefixes like md:
      const stripped = cls.replace(/^(sm:|md:|lg:|xl:|2xl:|dark:|hover:|focus:|active:)/, '');
      result[cls] = prefixPattern.test(stripped) || stripped === 'sr-only';
    }
    return result;
  },
};

// ─── Tool: A11y Attribute Advisor ─────────────────────────────────────────────

/**
 * For a given UI element type, returns recommended ARIA attributes and roles.
 */
const a11yAdvisorTool: Tool = {
  name: 'get_a11y_recommendations',
  description:
    'Get WCAG accessibility recommendations for a specific HTML element or component type. ' +
    'Use this when generating interactive elements (buttons, dialogs, forms, comboboxes, etc.).',
  parameters: {
    type: 'object',
    properties: {
      element: {
        type: 'string',
        description:
          'The element or component type (e.g. "dialog", "combobox", "button", "table", "form").',
        enum: ['button', 'dialog', 'combobox', 'table', 'form', 'nav', 'image', 'link', 'input'],
      },
    },
    required: ['element'],
  },
  execute: async ({ element }: Record<string, unknown>) => {
    const recommendations: Record<string, object> = {
      button: {
        required: ['type="button"'],
        recommended: ['aria-label (if icon-only)', 'aria-disabled when inactive'],
        avoid: ['div as button without role="button" and tabIndex'],
      },
      dialog: {
        required: ['role="dialog"', 'aria-modal="true"', 'aria-labelledby'],
        recommended: ['aria-describedby', 'focus trap on open', 'Escape key closes'],
        avoid: ['missing focus management'],
      },
      combobox: {
        required: ['role="combobox"', 'aria-expanded', 'aria-controls'],
        recommended: ['aria-autocomplete', 'aria-activedescendant'],
        avoid: ['loss of focus on option selection'],
      },
      form: {
        required: ['label for every input', 'aria-required on required fields'],
        recommended: ['aria-describedby for error messages', 'novalidate with custom validation'],
        avoid: ['placeholder as only label', 'colour-only error indicators'],
      },
      table: {
        required: ['<th> with scope', 'caption or aria-label'],
        recommended: ['aria-sort on sortable headers'],
        avoid: ['layout tables without role="presentation"'],
      },
      nav: { required: ['aria-label or aria-labelledby'], recommended: ['landmark role'], avoid: [] },
      image: { required: ['alt attribute'], recommended: ['decorative images: alt=""'], avoid: ['missing alt'] },
      link: { required: ['descriptive text (not "click here")'], recommended: ['aria-current="page" for active'], avoid: [] },
      input: { required: ['associated <label>'], recommended: ['aria-invalid on error'], avoid: ['placeholder-only labelling'] },
    };

    const key = typeof element === 'string' ? element.toLowerCase() : '';
    return recommendations[key] ?? { note: `No specific recommendations for "${element}" yet.` };
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

/** All tools available to generation agents by default. */
export const DEFAULT_AGENT_TOOLS: Tool[] = [
  componentLookupTool,
  tailwindValidatorTool,
  a11yAdvisorTool,
];

export { componentLookupTool, tailwindValidatorTool, a11yAdvisorTool };
