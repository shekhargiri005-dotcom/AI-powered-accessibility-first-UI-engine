import type { A11yReport, A11yViolation } from './schemas';

/**
 * WCAG 2.1 AA Rule-Based Accessibility Validator
 * Performs static analysis on generated TSX code strings.
 */

// ─── Rule Definitions ─────────────────────────────────────────────────────────

interface A11yRule {
  id: string;
  wcagCriteria: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  check: (code: string) => { passed: boolean; element?: string; detail?: string };
  suggestion: string;
}

const A11Y_RULES: A11yRule[] = [
  {
    id: 'input-has-label',
    wcagCriteria: 'WCAG 1.3.1 (Level A)',
    severity: 'error',
    description: 'All form inputs must have an associated label',
    check: (code) => {
      // Find inputs that lack htmlFor matching an input id, or aria-label, or aria-labelledby
      const inputMatches = [...code.matchAll(/<input\s[^>]*>/g)];
      for (const match of inputMatches) {
        const tag = match[0];
        const hasAriaLabel = /aria-label\s*=/.test(tag);
        const hasAriaLabelledby = /aria-labelledby\s*=/.test(tag);
        const idMatch = tag.match(/\bid\s*=\s*["'{`]([^"'}`]+)["'{`]/);
        if (!hasAriaLabel && !hasAriaLabelledby && idMatch) {
          const inputId = idMatch[1];
          const hasMatchingLabel = new RegExp(`htmlFor\\s*=\\s*["'{${"`"}]${inputId}["'{${"`"}]`).test(code);
          if (!hasMatchingLabel) {
            return { passed: false, element: `<input id="${inputId}">`, detail: 'No associated <label htmlFor>' };
          }
        } else if (!hasAriaLabel && !hasAriaLabelledby && !idMatch) {
          return { passed: false, element: '<input> (no id)', detail: 'Input has no id and no aria-label' };
        }
      }
      return { passed: true };
    },
    suggestion: 'Add <label htmlFor="inputId"> for every <input>, or use aria-label attribute',
  },
  {
    id: 'button-has-accessible-name',
    wcagCriteria: 'WCAG 4.1.2 (Level A)',
    severity: 'error',
    description: 'All buttons must have an accessible name',
    check: (code) => {
      // Check for buttons with no text content and no aria-label
      const buttonPattern = /<button(?:\s[^>]*)?>(\s*)<\/button>/g;
      const emptyButtons = [...code.matchAll(buttonPattern)];
      if (emptyButtons.length > 0) {
        return { passed: false, element: '<button>', detail: 'Button has no text content' };
      }
      // Check button tags for aria-label if they appear to have icon-only content
      return { passed: true };
    },
    suggestion: 'Add visible text or aria-label="Description" to every <button>',
  },
  {
    id: 'img-alt-text',
    wcagCriteria: 'WCAG 1.1.1 (Level A)',
    severity: 'error',
    description: 'Images must have alternative text',
    check: (code) => {
      const imgMatches = [...code.matchAll(/<img\s[^>]*>/g)];
      for (const match of imgMatches) {
        const tag = match[0];
        if (!/\balt\s*=/.test(tag)) {
          return { passed: false, element: '<img>', detail: 'Missing alt attribute' };
        }
      }
      return { passed: true };
    },
    suggestion: 'Add alt="" for decorative images or alt="Description" for informative images',
  },
  {
    id: 'form-has-label',
    wcagCriteria: 'WCAG 1.3.1 (Level A)',
    severity: 'warning',
    description: 'Forms should have an accessible label or legend',
    check: (code) => {
      const hasForms = /<form\s/.test(code) || /<form>/.test(code);
      if (!hasForms) return { passed: true };
      const hasAriaLabel = /aria-label\s*=/.test(code) || /aria-labelledby\s*=/.test(code);
      const hasLegend = /<legend\s*>/.test(code) || /<legend>/.test(code);
      if (!hasAriaLabel && !hasLegend) {
        return { passed: false, element: '<form>', detail: 'Form has no aria-label or <legend>' };
      }
      return { passed: true };
    },
    suggestion: 'Add aria-label="Form purpose" to <form> or wrap fields in <fieldset><legend>',
  },
  {
    id: 'heading-hierarchy',
    wcagCriteria: 'WCAG 1.3.1 (Level A)',
    severity: 'warning',
    description: 'Headings should follow a logical hierarchy',
    check: (code) => {
      const headings = [...code.matchAll(/<h([1-6])/g)].map(m => parseInt(m[1]));
      for (let i = 1; i < headings.length; i++) {
        if (headings[i] - headings[i - 1] > 1) {
          return {
            passed: false,
            element: `<h${headings[i]}>`,
            detail: `Heading jumps from h${headings[i-1]} to h${headings[i]}`,
          };
        }
      }
      return { passed: true };
    },
    suggestion: 'Ensure heading levels increase by one (h1 → h2 → h3, never h1 → h3)',
  },
  {
    id: 'interactive-keyboard-accessible',
    wcagCriteria: 'WCAG 2.1.1 (Level A)',
    severity: 'error',
    description: 'Interactive elements must be keyboard accessible',
    check: (code) => {
      // Check for onClick handlers on non-interactive elements (div, span with onClick)
      const nonInteractive = code.match(/<(?:div|span)\s[^>]*onClick[^>]*>/);
      if (nonInteractive) {
        return {
          passed: false,
          element: nonInteractive[0].substring(0, 50),
          detail: 'onClick on non-interactive element without role/tabIndex',
        };
      }
      return { passed: true };
    },
    suggestion: 'Use <button> instead of <div onClick>. If you must use div, add role="button" tabIndex={0}',
  },
  {
    id: 'error-announcements',
    wcagCriteria: 'WCAG 4.1.3 (Level AA)',
    severity: 'info',
    description: 'Error messages should be announced to screen readers',
    check: (code) => {
      const hasErrorDisplay = /error|Error/.test(code);
      const hasAriaLive = /aria-live/.test(code);
      const hasRole = /role\s*=\s*["']alert["']/.test(code);
      if (hasErrorDisplay && !hasAriaLive && !hasRole) {
        return {
          passed: false,
          element: 'Error message element',
          detail: 'Error messages not announced via aria-live or role="alert"',
        };
      }
      return { passed: true };
    },
    suggestion: 'Add aria-live="polite" or role="alert" to error message containers',
  },
  {
    id: 'color-contrast-tokens',
    wcagCriteria: 'WCAG 1.4.3 (Level AA)',
    severity: 'warning',
    description: 'Text must have sufficient color contrast (4.5:1 ratio)',
    check: (code) => {
      // Check for low-contrast Tailwind pairs (gray-300 text on white bg)
      const lowContrastPatterns = [
        /text-gray-300/, /text-gray-200/, /text-gray-100/,
        /text-yellow-200/, /text-blue-200/,
      ];
      for (const pattern of lowContrastPatterns) {
        if (pattern.test(code)) {
          return {
            passed: false,
            element: 'Text element',
            detail: `Potential low-contrast color: ${pattern.source}`,
          };
        }
      }
      return { passed: true };
    },
    suggestion: 'Use at least text-gray-700 on white backgrounds to meet 4.5:1 contrast ratio',
  },
  {
    id: 'focus-visible',
    wcagCriteria: 'WCAG 2.4.7 (Level AA)',
    severity: 'warning',
    description: 'Focused elements must have a visible focus indicator',
    check: (code) => {
      // Check if outline is removed without a replacement
      if (/outline-none/.test(code) && !/focus-visible:ring/.test(code) && !/focus:ring/.test(code)) {
        return {
          passed: false,
          element: 'Focusable element',
          detail: 'outline-none used without focus:ring replacement',
        };
      }
      return { passed: true };
    },
    suggestion: 'Replace outline-none with focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  },
];

// ─── Main Validator Function ──────────────────────────────────────────────────

export function validateAccessibility(code: string): A11yReport {
  const violations: A11yViolation[] = [];

  for (const rule of A11Y_RULES) {
    const result = rule.check(code);
    if (!result.passed) {
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        element: result.element ?? 'Unknown element',
        description: result.detail ?? rule.description,
        suggestion: rule.suggestion,
        wcagCriteria: rule.wcagCriteria,
      });
    }
  }

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  // Score: Start at 100, deduct 15 per error, 5 per warning
  const score = Math.max(0, 100 - errorCount * 15 - warningCount * 5);
  const passed = errorCount === 0;

  const suggestions = violations.map(v => `[${v.ruleId}] ${v.suggestion}`);

  return {
    passed,
    score,
    violations,
    suggestions,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Auto-repair common accessibility issues in generated code.
 * Returns the repaired code and a list of applied fixes.
 */
export function autoRepairA11y(code: string): { code: string; appliedFixes: string[] } {
  let repaired = code;
  const appliedFixes: string[] = [];

  // Fix 1: Replace outline-none without focus ring
  if (/outline-none/.test(repaired) && !/focus:ring/.test(repaired)) {
    repaired = repaired.replace(/outline-none/g, 'outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2');
    appliedFixes.push('Added focus:ring to elements with outline-none');
  }

  // Fix 2: Add role="alert" to error message containers
  if (/className="[^"]*text-red[^"]*"/.test(repaired) && !/role="alert"/.test(repaired)) {
    repaired = repaired.replace(
      /(<(?:p|span|div)\s+className="[^"]*text-red[^"]*")/g,
      '$1 role="alert" aria-live="polite"'
    );
    appliedFixes.push('Added role="alert" aria-live="polite" to error message elements');
  }

  return { code: repaired, appliedFixes };
}
