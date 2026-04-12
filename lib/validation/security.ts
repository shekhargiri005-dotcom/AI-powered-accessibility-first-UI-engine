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

/**
 * sanitizeGeneratedCode
 * 
 * Fixes common AI code generation patterns that cause Sandpack / Babel parse errors:
 * 1. Multi-line template literals in JSX attribute values (e.g. className={`...\n  ...\n`})
 *    → collapsed to single line so Babel doesn't choke on the newline inside the expression
 * 2. Strips any remaining carriage returns
 */
export function sanitizeGeneratedCode(code: string): string {
  if (!code) return code;

  // Flatten multi-line template literals so Sandpack's Babel parser can handle them.
  // Template literals that span multiple lines inside JSX attributes (e.g. className={`...\n...\n`})
  // cause Babel to throw "Missing semicolon" in nodebox environments.
  //
  // Strategy: scan character-by-character to find backtick-delimited strings and
  // collapse any newlines+leading whitespace inside them to a single space.
  let result = '';
  let i = 0;
  while (i < code.length) {
    if (code[i] === '`') {
      // Start of a template literal — collect until closing backtick (handle escapes)
      let tpl = '`';
      i++;
      while (i < code.length) {
        if (code[i] === '\\') {
          tpl += code[i] + (code[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (code[i] === '`') {
          tpl += '`';
          i++;
          break;
        }
        tpl += code[i];
        i++;
      }
      // Collapse newlines + surrounding whitespace inside the template literal
      result += tpl.replace(/\r?\n[ \t]*/g, ' ');
    } else {
      result += code[i];
      i++;
    }
  }

  // Remove any stray carriage returns
  let sanitized = result.replace(/\r/g, '');

  // ── AI Comment Artifact Sanitizer ────────────────────────────────────────────
  // Models sometimes emit debug comments as placeholders that cause Babel parse
  // errors in Sandpack's nodebox environment:
  //
  //   onClick={() => /* [debug removed] */}   ← arrow fn body is a comment = invalid
  //   onClick={() => /* handler */}
  //   onChange={/* handler */}                ← JSX attr value is a comment = invalid
  //
  // Replace:  () => /* ... */    →  () => {}
  // Replace:  ={/* ... */}       →  ={undefined}   (avoids parse error; component still renders)

  // Arrow functions whose entire body is a block comment (single-line)
  sanitized = sanitized.replace(/=>\s*\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '=> {}');

  // JSX attribute values that are solely a block comment  ={/* ... */}
  sanitized = sanitized.replace(/=\{\s*\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\/\s*\}/g, '={undefined}');

  // Inline TODO/placeholder comments left inside JSX attribute strings
  // e.g.  onClick={/* TODO */}  or  value={/* placeholder */}
  sanitized = sanitized.replace(/\{\s*\/\*\s*(?:TODO|FIXME|placeholder|debug removed|handler|stub)[^*]*\*+(?:[^/*][^*]*\*+)*\/\s*\}/gi, '{undefined}');

  // ── Multiline comment artifact repair ────────────────────────────────────────
  // When the original AI code was:
  //   onClick={() => /* [debug removed] */
  //   };
  // Our replacement gives:
  //   onClick={() => {}     ← `{` from JSX attr still open
  //   };                    ← `}` closes JSX attr, `;` is stray = Babel error
  //
  // Fix 1: collapse `=> {}\n<whitespace>};` → `=> {}}` (merges the JSX close brace back in)
  sanitized = sanitized.replace(/=>\s*\{\}\s*\n\s*\};/g, '=> {}}');

  // Fix 2: collapse `=> {}\n<whitespace>}` → `=> {}}` (same but without stray semicolon)
  // Only safe when the `}` line has ONLY whitespace + `}` (i.e., it IS the JSX attr closer)
  sanitized = sanitized.replace(/=>\s*\{\}([ \t]*)\n([ \t]*)\}(?=[^}])/g, '=> {}}\n$2');

  // Fix 3: general stray `;` after a standalone `}` line where the `}` closes a JSX expression.
  // e.g. a line that is ONLY indentation + `};` after a valid JSX attribute expression.
  // Replacing `\n<whitespace>};` with `\n<whitespace>}` is safe because in valid JSX you never
  // use `;` to separate attributes — only whitespace is legal between attributes.
  sanitized = sanitized.replace(/(\n[ \t]*)\};([ \t]*\n)/g, '$1}$2');

  return sanitized;
}
