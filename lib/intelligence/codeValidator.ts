/**
 * Code Validator — pre-preview validation of generated TSX/JSX code.
 * Ensures code is browser-safe and structurally valid before Sandpack.
 *
 * Phase 6 Update:
 *  - Added REGISTRY_HALLUCINATION_CHECKS (error): catches three.js, react-spring, etc.
 *  - Added A11Y_CHECKS (warning): catches missing alt, missing aria-label, role issues.
 */

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationError {
  code: string;
  severity: ValidationSeverity;
  message: string;
  line?: number;
}

export interface CodeValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: string;
}

// ─── Browser-Unsafe Patterns ──────────────────────────────────────────────────
// Node.js-only / terminal-only APIs that are not browser-safe

const BROWSER_UNSAFE_PATTERNS: Array<{ pattern: RegExp; code: string; message: string }> = [
  { pattern: /import\s+.*\bfs\b.*from\s+['"]fs['"]/g,            code: 'UNSAFE_FS',           message: "Import from 'fs' is not browser-safe" },
  { pattern: /require\s*\(\s*['"]fs['"]\s*\)/g,                  code: 'UNSAFE_FS',           message: "require('fs') is not browser-safe" },
  { pattern: /import\s+.*\bpath\b.*from\s+['"]path['"]/g,        code: 'UNSAFE_PATH',         message: "Import from 'path' is not browser-safe" },
  { pattern: /require\s*\(\s*['"]path['"]\s*\)/g,                code: 'UNSAFE_PATH',         message: "require('path') is not browser-safe" },
  { pattern: /import\s+.*from\s+['"]readline['"]/g,              code: 'UNSAFE_READLINE',     message: "readline is a Node.js TTY module — not browser-safe" },
  { pattern: /require\s*\(\s*['"]readline['"]\s*\)/g,            code: 'UNSAFE_READLINE',     message: "readline is a Node.js TTY module — not browser-safe" },
  { pattern: /import\s+.*from\s+['"]child_process['"]/g,         code: 'UNSAFE_CHILD_PROCESS',message: "child_process is not browser-safe" },
  { pattern: /process\.stdout\.write/g,                          code: 'UNSAFE_TTY',          message: "process.stdout is a Node.js TTY API — not browser-safe" },
  { pattern: /process\.stderr\.write/g,                          code: 'UNSAFE_TTY',          message: "process.stderr is a Node.js TTY API — not browser-safe" },
  { pattern: /clearScreenDown/g,                                 code: 'UNSAFE_TTY',          message: "clearScreenDown is a Node.js TTY API — not browser-safe" },
  { pattern: /readline\.createInterface/g,                       code: 'UNSAFE_TTY',          message: "readline.createInterface is a Node.js TTY API — not browser-safe" },
  { pattern: /import\s+.*from\s+['"]tty['"]/g,                  code: 'UNSAFE_TTY',          message: "tty is a Node.js-only module — not browser-safe" },
  { pattern: /import\s+.*from\s+['"]os['"]/g,                   code: 'UNSAFE_OS',           message: "os module is not browser-safe" },
  { pattern: /import\s+.*from\s+['"]stream['"]/g,               code: 'UNSAFE_STREAM',       message: "Node.js streams are not browser-safe" },
  { pattern: /import\s+.*from\s+['"]buffer['"]/g,               code: 'UNSAFE_BUFFER',       message: "Node.js Buffer module is not browser-safe — use browser TextEncoder instead" },
];

// ─── Registry Hallucination Checks ────────────────────────────────────────────
// Libraries the model commonly hallucinates that are NOT available in Sandpack.
// These are hard errors — the component will crash at runtime if not caught.

const REGISTRY_HALLUCINATION_CHECKS: Array<{ pattern: RegExp; code: string; message: string }> = [
  {
    pattern: /import\s+.*from\s+['"]three['"]/g,
    code: 'HALLUCINATED_THREE',
    message: "Import from 'three' detected — Three.js is not available. Use framer-motion for depth/motion effects instead.",
  },
  {
    pattern: /import\s+.*from\s+['"]@react-three\/fiber['"]/g,
    code: 'HALLUCINATED_R3F',
    message: "@react-three/fiber is not available — use CSS transforms and framer-motion for 3D-like depth effects.",
  },
  {
    pattern: /import\s+.*from\s+['"]@react-three\/drei['"]/g,
    code: 'HALLUCINATED_DREI',
    message: "@react-three/drei is not available — remove this import and use framer-motion instead.",
  },
  {
    pattern: /import\s+.*from\s+['"]react-spring['"]/g,
    code: 'HALLUCINATED_REACT_SPRING',
    message: "react-spring is not in our dependency stack — use framer-motion for spring animations instead.",
  },
  {
    pattern: /import\s+.*from\s+['"]@react-spring\/[^'"]+['"]/g,
    code: 'HALLUCINATED_REACT_SPRING',
    message: "@react-spring/* is not available — use framer-motion for spring animations instead.",
  },
  {
    pattern: /import\s+.*from\s+['"]gsap['"]/g,
    code: 'HALLUCINATED_GSAP',
    message: "GSAP is not available in this environment — use framer-motion for animations.",
  },
  {
    pattern: /import\s+.*from\s+['"]@gsap\/[^'"]+['"]/g,
    code: 'HALLUCINATED_GSAP',
    message: "@gsap/* is not available — use framer-motion for animations.",
  },
  {
    pattern: /import\s+.*from\s+['"]lottie-react['"]/g,
    code: 'HALLUCINATED_LOTTIE',
    message: "lottie-react is not available — use framer-motion for animations instead.",
  },
  {
    pattern: /import\s+.*from\s+['"]@heroicons\/react[^'"]*['"]/g,
    code: 'HALLUCINATED_HEROICONS',
    message: "@heroicons/react is not available — use lucide-react for icons instead.",
  },
  {
    pattern: /import\s+.*from\s+['"]@mui\/[^'"]+['"]/g,
    code: 'HALLUCINATED_MUI',
    message: "@mui/* (Material UI) is not available — use Tailwind CSS utility classes instead.",
  },
  {
    pattern: /import\s+.*from\s+['"]antd['"]/g,
    code: 'HALLUCINATED_ANTD',
    message: "antd (Ant Design) is not available — use Tailwind CSS utility classes instead.",
  },
  {
    pattern: /import\s+.*from\s+['"]@chakra-ui\/[^'"]+['"]/g,
    code: 'HALLUCINATED_CHAKRA',
    message: "@chakra-ui/* is not available — use Tailwind CSS utility classes instead.",
  },
];

// ─── Structural Checks ────────────────────────────────────────────────────────

const STRUCTURAL_CHECKS: Array<{ test: (code: string) => boolean; code: string; severity: ValidationSeverity; message: string }> = [
  {
    test: code => !code.includes('export default'),
    code: 'MISSING_DEFAULT_EXPORT',
    severity: 'error',
    message: 'No "export default" found — Sandpack requires a default export for the main component',
  },
  {
    test: code => !code.includes('return') && !code.includes('=>'),
    code: 'NO_RETURN',
    severity: 'error',
    message: 'No return statement found — component likely does not render anything',
  },
  {
    test: code => code.length < 100,
    code: 'TOO_SHORT',
    severity: 'error',
    message: 'Generated code is suspiciously short — likely truncated or empty',
  },
  {
    test: code => (code.match(/<[A-Z]/g) || []).length === 0 && (code.match(/<[a-z]+[\s/>]/g) || []).length === 0,
    code: 'NO_JSX',
    severity: 'error',
    message: 'No JSX detected — component does not appear to render any UI elements',
  },
  {
    test: code => {
      const opens  = (code.match(/</g) || []).length;
      const closes = (code.match(/>/g) || []).length;
      return Math.abs(opens - closes) > 20;
    },
    code: 'UNBALANCED_JSX',
    severity: 'warning',
    message: 'JSX tags appear significantly unbalanced — possible truncation or syntax error',
  },
  {
    test: code => code.includes('react-icons/') && !code.includes('lucide-react'),
    code: 'REACT_ICONS_RISK',
    severity: 'warning',
    message: 'react-icons may not be fully available — prefer lucide-react for icon imports',
  },
  {
    test: code => {
      const cssImports        = (code.match(/@import/g) || []).length;
      const tailwindDirectives = (code.match(/@tailwind/g) || []).length;
      return cssImports > 0 && tailwindDirectives > 0 && code.indexOf('@import') < code.indexOf('@tailwind');
    },
    code: 'CSS_IMPORT_ORDER',
    severity: 'warning',
    message: 'CSS @import must come before @tailwind directives — reorder to fix PostCSS processing',
  },
  {
    test: code => {
      const asyncImports = (code.match(/import\(\s*['"][^'"]+['"]\s*\)/g) || []).length;
      return asyncImports > 5;
    },
    code: 'EXCESSIVE_DYNAMIC_IMPORTS',
    severity: 'warning',
    message: 'Many dynamic imports detected — Sandpack may not resolve all chunks correctly',
  },
];

// ─── Accessibility Checks ─────────────────────────────────────────────────────
// Enforces the accessibility-first mission of the engine.
// These are warnings (not errors) — they don't block preview but should be fixed.

const A11Y_CHECKS: Array<{ test: (code: string) => boolean; code: string; severity: ValidationSeverity; message: string }> = [
  {
    // Detect <img without alt= (both JSX and HTML style)
    test: code => {
      const imgTags = code.match(/<img\b[^>]*>/g) ?? [];
      return imgTags.some(tag => !tag.includes('alt='));
    },
    code: 'A11Y_IMG_ALT',
    severity: 'warning',
    message: 'One or more <img> elements are missing an alt attribute — add alt="" for decorative images or a descriptive string for meaningful images (WCAG 1.1.1)',
  },
  {
    // Detect <button> tags that appear to contain only an icon (no visible text)
    // Heuristic: <button> content has no word characters, only JSX/icon elements
    test: code => {
      // Find button elements that only contain an icon component or SVG (no text content)
      const buttonPattern = /<button\b[^>]*>([\s\S]*?)<\/button>/g;
      let match: RegExpExecArray | null;
      while ((match = buttonPattern.exec(code)) !== null) {
        const inner = match[1] ?? '';
        const hasText  = /[A-Za-z]{2,}/.test(inner.replace(/<[^>]+>/g, '').trim());
        const hasAriaLabel = match[0].includes('aria-label') || match[0].includes('aria-labelledby') || match[0].includes('title=');
        if (!hasText && !hasAriaLabel) return true;
      }
      return false;
    },
    code: 'A11Y_BUTTON_LABEL',
    severity: 'warning',
    message: 'One or more <button> elements may be icon-only without an accessible label — add aria-label="<action>" (WCAG 4.1.2)',
  },
  {
    // Detect interactive divs (onClick handlers on divs) without role
    test: code => {
      const divOnClick = code.match(/<div\b[^>]*onClick[^>]*>/g) ?? [];
      return divOnClick.some(tag => !tag.includes('role=') && !tag.includes('tabIndex') && !tag.includes('tabindex'));
    },
    code: 'A11Y_INTERACTIVE_DIV',
    severity: 'warning',
    message: 'One or more <div onClick> elements lack a role and tabIndex — use <button> or add role="button" tabIndex={0} for keyboard accessibility (WCAG 2.1.1)',
  },
  {
    // Check that inputs have associated labels
    test: code => {
      const inputs = code.match(/<input\b[^>]*>/g) ?? [];
      if (inputs.length === 0) return false;
      const hasLabels = code.includes('<label') || code.includes('aria-label') || code.includes('aria-labelledby');
      return !hasLabels;
    },
    code: 'A11Y_INPUT_LABEL',
    severity: 'warning',
    message: 'Form inputs detected with no <label> or aria-label — all inputs must have accessible labels (WCAG 1.3.1)',
  },
  {
    // Detect potential heading hierarchy issues — multiple h1 tags
    test: code => {
      const h1Count = (code.match(/<h1[\s>]/g) || []).length;
      return h1Count > 1;
    },
    code: 'A11Y_HEADING_HIERARCHY',
    severity: 'warning',
    message: 'Multiple <h1> elements detected — a page should have only one <h1> to maintain proper heading hierarchy (WCAG 1.3.1)',
  },
  {
    // Check for motion without prefers-reduced-motion fallback
    test: code => {
      const hasFramerMotion = code.includes('framer-motion') || code.includes('motion.');
      const hasReducedMotion = code.includes('prefers-reduced-motion') || code.includes('useReducedMotion');
      return hasFramerMotion && !hasReducedMotion;
    },
    code: 'A11Y_REDUCED_MOTION',
    severity: 'warning',
    message: 'framer-motion animations detected without prefers-reduced-motion handling — add useReducedMotion() hook or CSS media query fallback (WCAG 2.3.3)',
  },
];

// ─── Validator Functions ──────────────────────────────────────────────────────

/**
 * Validate a single code string (component TSX/JSX file).
 */
export function validateGeneratedCode(code: string, _fileName = 'component.tsx'): CodeValidationResult { // eslint-disable-line @typescript-eslint/no-unused-vars
  const errors:   ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!code || typeof code !== 'string') {
    return {
      valid:    false,
      errors:   [{ code: 'EMPTY_CODE', severity: 'error', message: 'Code is null, undefined, or not a string' }],
      warnings: [],
      summary:  'Validation failed: empty code',
    };
  }

  // Browser safety checks (errors)
  for (const check of BROWSER_UNSAFE_PATTERNS) {
    if (check.pattern.test(code)) {
      errors.push({ code: check.code, severity: 'error', message: check.message });
      check.pattern.lastIndex = 0; // Reset regex state
    }
  }

  // Registry hallucination checks (errors)
  for (const check of REGISTRY_HALLUCINATION_CHECKS) {
    if (check.pattern.test(code)) {
      errors.push({ code: check.code, severity: 'error', message: check.message });
      check.pattern.lastIndex = 0;
    }
  }

  // Structural checks (mixed errors/warnings)
  for (const check of STRUCTURAL_CHECKS) {
    if (check.test(code)) {
      const entry: ValidationError = { code: check.code, severity: check.severity, message: check.message };
      if (check.severity === 'error') errors.push(entry);
      else warnings.push(entry);
    }
  }

  // ─── Fast Structural Heuristic (Replaces heavy TS Compiler) ───────────────
  // Detects LLM truncation (the most common cause of syntax errors) in <1ms
  let inString: string | null = null;
  let escapeNext = false;
  let braces = 0;
  let parentheses = 0;
  let brackets = 0;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }
    
    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      continue;
    }
    
    if (char === '{') braces++;
    else if (char === '}') braces--;
    else if (char === '(') parentheses++;
    else if (char === ')') parentheses--;
    else if (char === '[') brackets++;
    else if (char === ']') brackets--;
  }

  if (braces !== 0 || parentheses !== 0 || brackets !== 0) {
    errors.push({
      code: 'SYNTAX_TRUNCATION_ERROR',
      severity: 'error',
      message: `Syntax error detected: unbalanced brackets/braces. Code appears truncated or malformed (braces offset: ${braces}).`,
    });
  }

  // Accessibility checks (warnings)
  for (const check of A11Y_CHECKS) {
    if (check.test(code)) {
      warnings.push({ code: check.code, severity: check.severity, message: check.message });
    }
  }

  const valid   = errors.length === 0;
  const summary = valid
    ? `Validation passed${warnings.length > 0 ? ` (${warnings.length} warning(s))` : ''}`
    : `Validation failed: ${errors.length} error(s), ${warnings.length} warning(s)`;

  return { valid, errors, warnings, summary };
}

/**
 * Validate a multi-file project (Record<filename, code>).
 */
export function validateFileSet(files: Record<string, string>): CodeValidationResult {
  const allErrors:   ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  for (const [fileName, code] of Object.entries(files)) {
    if (!fileName.match(/\.(tsx?|jsx?)$/)) continue;
    const result = validateGeneratedCode(code, fileName);
    allErrors.push(...result.errors.map(e   => ({ ...e, message: `[${fileName}] ${e.message}` })));
    allWarnings.push(...result.warnings.map(w => ({ ...w, message: `[${fileName}] ${w.message}` })));
  }

  const valid = allErrors.length === 0;
  return {
    valid,
    errors:   allErrors,
    warnings: allWarnings,
    summary:  valid ? `All files passed validation` : `${allErrors.length} validation error(s) across files`,
  };
}
