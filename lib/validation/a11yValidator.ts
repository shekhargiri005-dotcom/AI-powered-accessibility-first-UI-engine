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
      // Find all button tags
      const buttonMatches = [...code.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)];
      
      for (const match of buttonMatches) {
        const attrs = match[1];
        const content = match[2].trim();
        
        const hasAriaLabel = /aria-label\s*=/.test(attrs) || /aria-labelledby\s*=/.test(attrs);
        
        // If it has no accessible label via attributes
        if (!hasAriaLabel) {
          // Check if it has any text content (stripping tags)
          const textContent = content.replace(/<[^>]*>/g, '').trim();
          if (!textContent) {
            return { passed: false, element: `<button ${attrs.slice(0, 20)}...>`, detail: 'Button has no accessible text or aria-label' };
          }
        }
      }
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
      // Check for onClick handlers on non-interactive elements (div, span) without role or tabIndex
      const nonInteractive = code.match(/<(?:div|span)\s[^>]*onClick[^>]*(?!role=)[^>]*>/);
      if (nonInteractive) {
        const tag = nonInteractive[0];
        // Pass if it has role="button" or tabIndex
        if (/role\s*=\s*["']button["']/.test(tag) || /tabIndex/.test(tag)) {
          return { passed: true };
        }
        return {
          passed: false,
          element: tag.substring(0, 50),
          detail: 'onClick on non-interactive element without role="button"/tabIndex',
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
      // ── Comprehensive dark background detection ───────────────────────────
      // All Tailwind color families at shade 600+ provide enough background
      // darkness for light text (text-white, text-gray-100/200/300) to pass WCAG AA.
      //
      // Safe dark background families recognised:
      //   Neutrals : bg-black, bg-gray, bg-zinc, bg-slate, bg-neutral, bg-stone
      //   Blues    : bg-blue, bg-indigo, bg-sky, bg-cyan
      //   Purples  : bg-violet, bg-purple, bg-fuchsia
      //   Greens   : bg-emerald, bg-teal, bg-green, bg-lime
      //   Reds     : bg-rose, bg-red, bg-pink
      //   Warm     : bg-amber, bg-orange, bg-yellow (shade ≥700 only)
      //   Gradient : from-*/to-* dark ends
      //   Hex      : bg-[#000..#4ff] (dark hex literals)

      const DARK_BG_NEUTRALS =
        'bg-black|' +
        'bg-(?:gray|zinc|slate|neutral|stone|blueGray|coolGray|trueGray|warmGray)-(?:600|700|800|900|950)';

      const DARK_BG_COLORS =
        'bg-(?:red|orange|amber|yellow|lime|green|teal|emerald|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:600|700|800|900|950)';

      const DARK_GRADIENT =
        '(?:from|to|via)-(?:gray|zinc|slate|neutral|stone|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow|lime|green|teal|emerald|cyan|sky)-(?:700|800|900|950)';

      const DARK_HEX = 'bg-\\[#(?:[0-4][0-9a-fA-F]{5})\\]';

      const DARK_BG_RE = new RegExp(
        `${DARK_BG_NEUTRALS}|${DARK_BG_COLORS}|${DARK_GRADIENT}|${DARK_HEX}`
      );

      if (DARK_BG_RE.test(code)) return { passed: true };

      // Pass for dark-mode utility usage (Tailwind dark: strategy or wrapper class)
      if (/\bdark\b/.test(code) || /dark:bg-/.test(code) || /data-theme/.test(code)) {
        return { passed: true };
      }

      // ── Only flag genuinely light-background issues ───────────────────────
      // Light text that would be invisible on white/light-gray backgrounds.
      const LOW_CONTRAST_LIGHT = [
        /\btext-(?:gray|zinc|slate|neutral|stone)-(?:100|200|300)\b/,
        /\btext-(?:yellow|lime|green|teal|cyan|sky|blue|indigo|violet|fuchsia|pink|rose|red|orange|amber)-(?:100|200)\b/,
      ];

      for (const pattern of LOW_CONTRAST_LIGHT) {
        if (pattern.test(code)) {
          return {
            passed: false,
            element: 'Text element',
            detail: 'Light text color detected without a corresponding dark background class',
          };
        }
      }
      return { passed: true };
    },
    suggestion:
      'On light backgrounds use text-gray-700+ for contrast. ' +
      'On dark backgrounds (bg-gray-900, bg-indigo-800, bg-violet-700, etc.) text-gray-100/200/300 is WCAG compliant.',
  },
  {
    id: 'focus-visible',
    wcagCriteria: 'WCAG 2.4.7 (Level AA)',
    severity: 'warning',
    description: 'Focused elements must have a visible focus indicator',
    check: (code) => {
      // Only flag when outline-none is used AND there is no focus ring replacement
      if (
        /outline-none/.test(code) &&
        !/focus(?:-visible)?:(?:ring|outline)/.test(code) &&
        !/focus:outline/.test(code)
      ) {
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

  // Score: Start at 100, deduct 10 per hard error, 3 per warning, 1 per info
  const score = Math.max(0, 100 - errorCount * 10 - warningCount * 3);
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

  // Fix 3: Add aria-label to <input> elements missing an accessible name
  const inputMatches = [...repaired.matchAll(/<input\s+([^>]+)>/g)];
  for (const match of inputMatches) {
    const fullTag = match[0];
    const attrs = match[1];
    
    // Skip if it already has an accessible name
    if (attrs.includes('aria-label') || attrs.includes('aria-labelledby')) continue;

    const idMatch = attrs.match(/\bid\s*=\s*["'{`]([^"'}`]+)["'{`]/);
    let hasLabel = false;
    
    if (idMatch) {
      const inputId = idMatch[1];
      // Check if a matching htmlFor exists anywhere in the code
      if (new RegExp(`htmlFor\\s*=\\s*["'{${"`"}]${inputId}["'{${"`"}]`).test(repaired)) {
        hasLabel = true;
      }
    }

    if (!hasLabel) {
      // Derive a sensible label from placeholder, name, id, or default
      const placeholderMatch = attrs.match(/\bplaceholder\s*=\s*["']([^"']+)["']/);
      const nameMatch = attrs.match(/\bname\s*=\s*["']([^"'}`]+)["']/);
      
      let labelText = 'Input field';
      if (placeholderMatch) labelText = placeholderMatch[1];
      else if (nameMatch) labelText = nameMatch[1];
      else if (idMatch) labelText = idMatch[1].replace(/[-_]/g, ' ');

      // Make sure the first letter is capitalized
      labelText = labelText.charAt(0).toUpperCase() + labelText.slice(1);

      const newTag = `<input aria-label="${labelText}" ${attrs}>`;
      repaired = repaired.replace(fullTag, newTag);
      appliedFixes.push(`Added aria-label="${labelText}" to unlabelled <input>`);
    }
  }

  // Fix 4: Add aria-label to icon-only buttons
  // Regex updated to handle <button> without space
  const buttonMatches = [...repaired.matchAll(/<button(\s*[^>]*)?>(\s*<[^>]+>\s*)<\/button>/g)];
  for (const match of buttonMatches) {
    const fullTag = match[0];
    const attrs = match[1] ?? '';
    if (!attrs.includes('aria-label') && !attrs.includes('aria-labelledby')) {
      const newTag = `<button aria-label="Action button"${attrs}>${match[2]}</button>`;
      repaired = repaired.replace(fullTag, newTag);
      appliedFixes.push('Added aria-label="Action button" to icon-only <button>');
    }
  }

  return { code: repaired, appliedFixes };
}
