/**
 * Code Validator — pre-preview validation of generated TSX/JSX code.
 * Ensures code is browser-safe and structurally valid before Sandpack.
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

// Node.js-only / terminal-only APIs that are not browser-safe
const BROWSER_UNSAFE_PATTERNS: Array<{ pattern: RegExp; code: string; message: string }> = [
  { pattern: /import\s+.*\bfs\b.*from\s+['"]fs['"]/g, code: 'UNSAFE_FS', message: "Import from 'fs' is not browser-safe" },
  { pattern: /require\s*\(\s*['"]fs['"]\s*\)/g, code: 'UNSAFE_FS', message: "require('fs') is not browser-safe" },
  { pattern: /import\s+.*\bpath\b.*from\s+['"]path['"]/g, code: 'UNSAFE_PATH', message: "Import from 'path' is not browser-safe" },
  { pattern: /require\s*\(\s*['"]path['"]\s*\)/g, code: 'UNSAFE_PATH', message: "require('path') is not browser-safe" },
  { pattern: /import\s+.*from\s+['"]readline['"]/g, code: 'UNSAFE_READLINE', message: "readline is a Node.js TTY module — not browser-safe" },
  { pattern: /require\s*\(\s*['"]readline['"]\s*\)/g, code: 'UNSAFE_READLINE', message: "readline is a Node.js TTY module — not browser-safe" },
  { pattern: /import\s+.*from\s+['"]child_process['"]/g, code: 'UNSAFE_CHILD_PROCESS', message: "child_process is not browser-safe" },
  { pattern: /process\.stdout\.write/g, code: 'UNSAFE_TTY', message: "process.stdout is a Node.js TTY API — not browser-safe" },
  { pattern: /process\.stderr\.write/g, code: 'UNSAFE_TTY', message: "process.stderr is a Node.js TTY API — not browser-safe" },
  { pattern: /clearScreenDown/g, code: 'UNSAFE_TTY', message: "clearScreenDown is a Node.js TTY API — not browser-safe" },
  { pattern: /readline\.createInterface/g, code: 'UNSAFE_TTY', message: "readline.createInterface is a Node.js TTY API — not browser-safe" },
  { pattern: /import\s+.*from\s+['"]tty['"]/g, code: 'UNSAFE_TTY', message: "tty is a Node.js-only module — not browser-safe" },
  { pattern: /import\s+.*from\s+['"]os['"]/g, code: 'UNSAFE_OS', message: "os module is not browser-safe" },
  { pattern: /import\s+.*from\s+['"]stream['"]/g, code: 'UNSAFE_STREAM', message: "Node.js streams are not browser-safe" },
  { pattern: /import\s+.*from\s+['"]buffer['"]/g, code: 'UNSAFE_BUFFER', message: "Node.js Buffer module is not browser-safe — use browser TextEncoder instead" },
];

// Structural warnings for common mistakes
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
      const opens = (code.match(/</g) || []).length;
      const closes = (code.match(/>/g) || []).length;
      return Math.abs(opens - closes) > 20;
    },
    code: 'UNBALANCED_JSX',
    severity: 'warning',
    message: 'JSX tags appear significantly unbalanced — possible truncation or syntax error',
  },
  {
    test: code => code.includes('@heroicons/react'),
    code: 'WRONG_ICON_LIBRARY',
    severity: 'error',
    message: '@heroicons/react is not available — use lucide-react instead',
  },
  {
    test: code => code.includes('react-icons/') && !code.includes('lucide-react'),
    code: 'REACT_ICONS_RISK',
    severity: 'warning',
    message: 'react-icons may not be fully available — prefer lucide-react for icon imports',
  },
  {
    test: code => {
      const cssImports = (code.match(/@import/g) || []).length;
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

/**
 * Validate a single code string (component TSX/JSX file).
 */
export function validateGeneratedCode(code: string, _fileName = 'component.tsx'): CodeValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!code || typeof code !== 'string') {
    return {
      valid: false,
      errors: [{ code: 'EMPTY_CODE', severity: 'error', message: 'Code is null, undefined, or not a string' }],
      warnings: [],
      summary: 'Validation failed: empty code',
    };
  }

  // Browser safety checks
  for (const check of BROWSER_UNSAFE_PATTERNS) {
    if (check.pattern.test(code)) {
      errors.push({ code: check.code, severity: 'error', message: check.message });
      check.pattern.lastIndex = 0; // Reset regex state
    }
  }

  // Structural checks
  for (const check of STRUCTURAL_CHECKS) {
    if (check.test(code)) {
      const entry: ValidationError = { code: check.code, severity: check.severity, message: check.message };
      if (check.severity === 'error') errors.push(entry);
      else warnings.push(entry);
    }
  }

  const valid = errors.length === 0;
  const summary = valid
    ? `Validation passed${warnings.length > 0 ? ` (${warnings.length} warning(s))` : ''}`
    : `Validation failed: ${errors.length} error(s), ${warnings.length} warning(s)`;

  return { valid, errors, warnings, summary };
}

/**
 * Validate a multi-file project (Record<filename, code>).
 */
export function validateFileSet(files: Record<string, string>): CodeValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  for (const [fileName, code] of Object.entries(files)) {
    if (!fileName.match(/\.(tsx?|jsx?)$/)) continue;
    const result = validateGeneratedCode(code, fileName);
    allErrors.push(...result.errors.map(e => ({ ...e, message: `[${fileName}] ${e.message}` })));
    allWarnings.push(...result.warnings.map(w => ({ ...w, message: `[${fileName}] ${w.message}` })));
  }

  const valid = allErrors.length === 0;
  return {
    valid,
    errors: allErrors,
    warnings: allWarnings,
    summary: valid ? `All files passed validation` : `${allErrors.length} validation error(s) across files`,
  };
}
