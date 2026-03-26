export interface CodeValidationResult {
  isValid: boolean;
  issues: string[];
}

export function validateBrowserSafeCode(code: string): CodeValidationResult {
  const issues: string[] = [];

  // 1. Detect Node-only or Terminal APIs
  const unsafeImportsRegex = /from\s+['"](fs|path|child_process|readline|tty|os|crypto|http|net|tls)['"]/g;
  const unsafeRequiresRegex = /require\(['"](fs|path|child_process|readline|tty|os|crypto|http|net|tls)['"]\)/g;
  
  if (unsafeImportsRegex.test(code) || unsafeRequiresRegex.test(code)) {
    issues.push('Code contains unsupported Node.js standard library imports (e.g., fs, path, child_process).');
  }

  if (/process\.exit/.test(code)) {
    issues.push('process.exit() is not supported in the browser.');
  }

  if (/console\.clear/.test(code) || /clearScreenDown/.test(code) || /readline\./.test(code)) {
    issues.push('Terminal/TTY manipulation methods are not supported in Sandpack.');
  }

  // 2. Validate React export existence (rough check)
  if (!code.includes('export default') && !code.includes('export const') && !code.includes('export function')) {
    issues.push('File does not export a valid React component (missing export default or export const/function).');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
