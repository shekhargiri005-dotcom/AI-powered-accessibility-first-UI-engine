/**
 * @file lib/intelligence/codeAutoRepair.ts
 *
 * Auto-repairs common AI-generated code mistakes BEFORE validation.
 * This is a deterministic, regex-based fixer that runs immediately
 * after code extraction and BEFORE browser safety checks.
 *
 * Fixes applied:
 * 1. Invalid style prop syntax (style= ... → style={{...}})
 * 2. Missing export default
 * 3. Wrong token paths (colors.text.primary.fg → colors.text.primary)
 * 4. Incomplete/spread syntax in JSX
 * 5. Unclosed JSX tags (basic detection)
 */

export interface AutoRepairResult {
  code: string;
  fixes: string[];
  hadErrors: boolean;
}

/**
 * Main entry: apply all auto-repairs to generated code.
 */
export function autoRepairCode(code: string): AutoRepairResult {
  const fixes: string[] = [];
  let repaired = code;

  // ─── Fix 1: Spread syntax without braces in style ────────────────────────
  // Matches: style= ...text.h1, lineHeight: 1.2
  const spreadStyleRegex = /style=\s+\.\.\.\s*([\w.]+)\s*,?\s*([^>]*)?/g;
  repaired = repaired.replace(spreadStyleRegex, (match, spreadTarget, rest) => {
    const restTrimmed = rest ? rest.trim().replace(/>$/, '').trim() : '';
    const comma = restTrimmed ? ', ' : '';
    fixes.push(`Fixed spread style: "${match.trim()}" → style={{ ...${spreadTarget}${comma}${restTrimmed} }}`);
    return `style={{ ...${spreadTarget}${comma}${restTrimmed} }}`;
  });

  // ─── Fix 2: Object property assignment without braces in style ───────────
  // Matches: style= color: 'red'  or  style= backgroundImage: colors.gradient
  // Captures until > or end of tag, excluding leading/trailing whitespace
  const objectStyleRegex = /style=\s+(?!\{)([^>]+?)(?=>|\/>|\n)/g;
  repaired = repaired.replace(objectStyleRegex, (match, content) => {
    const trimmed = content.trim();
    if (!trimmed) return match;
    // Skip if already fixed by spread regex or contains valid JSX
    if (trimmed.startsWith('{')) return match;
    fixes.push(`Fixed object style: "${match.trim()}" → style={{${trimmed}}}`);
    return `style={{${trimmed}}}`;
  });

  // ─── Fix 3: Wrong token paths ─────────────────────────────────────────────
  // colors.text.primary.fg → colors.text.primary
  const wrongTextTokenRegex = /colors\.text\.(\w+)\.fg\b/g;
  repaired = repaired.replace(wrongTextTokenRegex, (match, token) => {
    fixes.push(`Fixed token path: "${match}" → colors.text.${token}`);
    return `colors.text.${token}`;
  });

  // colors.text.primary.bg → colors.text.primary (bg doesn't exist on text)
  const wrongTextBgRegex = /colors\.text\.(\w+)\.bg\b/g;
  repaired = repaired.replace(wrongTextBgRegex, (match, token) => {
    fixes.push(`Fixed token path: "${match}" → colors.text.${token}`);
    return `colors.text.${token}`;
  });

  // ─── Fix 4: Missing export default ────────────────────────────────────────
  const hasExport = /export\s+default/.test(repaired) ||
                    /export\s+const\s+\w+/.test(repaired) ||
                    /export\s+function\s+\w+/.test(repaired);

  if (!hasExport) {
    // Try to find the main component name
    const componentMatch = repaired.match(/(?:function|const)\s+([A-Z]\w+)/);
    const componentName = componentMatch ? componentMatch[1] : 'GeneratedComponent';
    repaired += `\n\nexport default ${componentName};\n`;
    fixes.push(`Added missing export default for ${componentName}`);
  }

  // ─── Fix 5: Missing closing braces for JSX expressions ───────────────────
  // style={{ color: 'red'  (missing }})
  const unclosedExpressionRegex = /style=\{\{([^}]*)\}(?!\})/g;
  repaired = repaired.replace(unclosedExpressionRegex, (match, content) => {
    fixes.push('Fixed unclosed JSX expression');
    return `style={{${content}}}`;
  });

  return {
    code: repaired,
    fixes,
    hadErrors: fixes.length > 0,
  };
}

/**
 * Quick check: does code need repair?
 */
export function needsRepair(code: string): boolean {
  const invalidStyle = /style=\s+(?!\{)/.test(code);
  const wrongTokens = /colors\.text\.\w+\.(fg|bg)\b/.test(code);
  const missingExport = !/export\s+default/.test(code) &&
                        !/export\s+const\s+\w+/.test(code) &&
                        !/export\s+function\s+\w+/.test(code);

  return invalidStyle || wrongTokens || missingExport;
}
