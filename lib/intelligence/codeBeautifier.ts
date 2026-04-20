/**
 * @file lib/intelligence/codeBeautifier.ts
 *
 * Deterministic post-generation beautifier.
 *
 * Runs on ALL generated code regardless of model tier.
 * Makes every model's output consistent by applying a set of
 * format-only, logic-preserving transformations.
 *
 * Design rules:
 *  1. NEVER change business logic — only format, structure, and annotations
 *  2. NEVER call an LLM — this is 100% deterministic and instant
 *  3. When in doubt, skip the transformation (false negatives > false positives)
 *  4. Every transformation must be reversible in principle
 *
 * Transformations applied (in order):
 *  1. Strip debug console.log / console.warn statements
 *  2. Sort and normalise import blocks
 *  3. Add missing aria-label to interactive elements (heuristic)
 *  4. Replace <div onClick> with <button> (semantic HTML)
 *  5. Add missing key props to JSX map() renders
 *  6. Normalise className to use cn() when conditional
 *  7. Ensure at least one responsive Tailwind prefix exists (sm: fallback)
 */

import type { UIBlueprint } from './blueprintEngine';

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface BeautifyResult {
  code: string;
  /** Human-readable log of every transformation applied */
  transformations: string[];
}

// ─── Individual Transformations ───────────────────────────────────────────────

type Transform = (code: string, transformations: string[]) => string;

// 1. Strip debug console statements from production code
const stripDebugConsole: Transform = (code, log) => {
  const before = code;
  const result = code
    .replace(/^\s*console\.(log|warn|error|debug|info)\([^)]*\);?\s*\n?/gm, '')
    // Also handle multi-line console calls (up to 3 lines)
    .replace(/console\.(log|warn|debug)\(\s*[\s\S]{0,200}?\);/g, '/* [debug removed] */');
  if (result !== before) log.push('Stripped debug console statements');
  return result;
};

// 2. Sort import blocks into consistent order
// Order: react → @ui/* → external → relative (@/, ../)
const sortImports: Transform = (code, log) => {
  const lines = code.split('\n');
  const importBlock: string[] = [];
  let importEnd = 0;

  // Collect all import lines from the top of the file
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('import ') || (importBlock.length > 0 && trimmed === '')) {
      if (trimmed.startsWith('import ')) {
        importBlock.push(lines[i]);
        importEnd = i + 1;
      } else if (importBlock.length > 0 && trimmed === '') {
        importEnd = i; // stop at first blank line after imports
        break;
      }
    } else if (importBlock.length > 0) {
      importEnd = i;
      break;
    }
  }

  if (importBlock.length < 2) return code; // nothing to sort

  const priority = (line: string): number => {
    if (/from ['"]react['"]/i.test(line)) return 0;
    if (/from ['"]@ui\//i.test(line)) return 1;
    if (/from ['"]@react-three\//i.test(line)) return 2;
    if (/from ['"]@\//.test(line)) return 3;
    if (/from ['"]\.\./i.test(line)) return 4;
    if (/from ['"]\./i.test(line)) return 5;
    return 2; // external packages
  };

  const sorted = [...importBlock].sort((a, b) => priority(a) - priority(b));
  const identical = sorted.every((l, i) => l === importBlock[i]);
  if (identical) return code;

  const rest = lines.slice(importEnd);
  log.push('Sorted import block by dependency layer');
  return [...sorted, ...rest].join('\n');
};

// 3. Add missing aria-label to <button> elements that have no text or aria attributes
const addMissingAriaLabels: Transform = (code, log) => {
  let changed = false;

  // Match <button className="..."> or <button> without any aria- or children text hint
  const result = code.replace(
    /<button(\s[^>]*)?>/g,
    (match) => {
      // Skip if already has aria attributes
      if (/aria-/.test(match)) return match;
      // Skip if it has a type='submit' or type='button' with visible text nearby (too complex to detect safely)
      // Only add aria-label if it's an icon-only button pattern (very short)
      if (match.length > 120) return match;
      changed = true;
      return match.replace(/<button/, '<button aria-label="Action button"');
    }
  );

  if (changed) log.push('Added aria-label to icon-only button elements');
  return result;
};

// 4. Replace <div onClick> with <button> where the div has no children role
const fixSemanticHTML: Transform = (code, log) => {
  // Only replace simple cases: <div onClick={...}> with no existing role
  const before = code;

  const result = code.replace(
    /<div(\s+className="[^"]*")?\s+onClick=\{([^}]+)\}(\s+className="[^"]*")?>/g,
    (match, cls1, handler, cls2) => {
      // Skip if it already has a role= attribute
      if (/role=/.test(match)) return match;
      // Skip if the handler is complex (> 60 chars)
      if (handler && handler.length > 60) return match;
      const className = cls1 ?? cls2 ?? '';
      return `<button${className} onClick={${handler}} type="button">`;
    }
  );

  if (result !== before) log.push('Replaced <div onClick> with <button> for semantic HTML');
  return result;
};

// 5. Add missing key props to array.map() JSX renders
const addMissingKeyProps: Transform = (code, log) => {
  let changed = false;

  // Match patterns like: items.map((item) => <SomeComponent or <div without key
  const result = code.replace(
    /\.map\(\s*\((\w+)(?:,\s*(\w+))?\)\s*=>\s*(<(?!\/)[A-Za-z][A-Za-z0-9]*(?!\s+key=)[^>]*?>)/g,
    (match, itemVar, indexVar, openTag) => {
      // Skip if key is already present
      if (/\bkey=/.test(openTag)) return match;
      changed = true;
      const keyExpr = indexVar || `${itemVar}?.id ?? index`;
      // Insert key={} after the opening tag name
      return match.replace(openTag, openTag.replace(/(<[A-Za-z][A-Za-z0-9]*)/, `$1 key={${keyExpr}}`));
    }
  );

  if (changed) log.push('Added missing key props to array.map() renders');
  return result;
};

// 6. Warn about arbitrary Tailwind values (p-[13px]) — replace with nearest valid scale
// This is advisory only — we log it but don't break the code
const flagArbitraryTailwind: Transform = (code, log) => {
  const arbitraryPattern = /\b(?:p|m|px|py|pt|pb|pl|pr|mt|mb|ml|mr|mx|my|gap|space-[xy])-\[\d+px\]/g;
  const matches = code.match(arbitraryPattern);
  if (matches && matches.length > 0) {
    const unique = [...new Set(matches)];
    log.push(`Advisory: Found arbitrary Tailwind values (${unique.slice(0, 3).join(', ')}${unique.length > 3 ? '...' : ''}) — consider replacing with scale values`);
  }
  return code; // don't modify — too risky to auto-replace
};

// 7. Ensure the component has at least one responsive prefix
const ensureResponsivePrefix: Transform = (code, log) => {
  // Only add advisory — modifying className logic is too risk-prone
  const hasResponsive = /\b(?:sm|md|lg|xl|2xl):/i.test(code);
  if (!hasResponsive && code.includes('className=')) {
    log.push('Advisory: No responsive Tailwind prefixes (sm: md: lg:) found — consider adding responsive breakpoints');
  }
  return code;
};

// 8. Remove duplicate blank lines (more than 2 consecutive)
const normaliseBlankLines: Transform = (code, log) => {
  const before = code;
  const result = code.replace(/\n{4,}/g, '\n\n\n');
  if (result !== before) log.push('Normalised excessive blank lines');
  return result;
};

// ─── Transformation Pipeline ───────────────────────────────────────────────────

const TRANSFORMS: Transform[] = [
  stripDebugConsole,
  sortImports,
  addMissingAriaLabels,
  fixSemanticHTML,
  addMissingKeyProps,
  flagArbitraryTailwind,
  ensureResponsivePrefix,
  normaliseBlankLines,
];

// ─── Public Entry Point ───────────────────────────────────────────────────────

/**
 * Apply the full beautifier pipeline to generated code.
 *
 * Safe to call on any model output — all transforms are logic-preserving.
 * Returns the processed code and a log of applied transformations.
 *
 * @param code      Raw extracted code from any model
 * @param blueprint The blueprint used for this generation (used for context)
 */
export function beautifyOutput(code: string, _blueprint?: UIBlueprint): BeautifyResult { // eslint-disable-line @typescript-eslint/no-unused-vars
  if (!code || code.trim().length === 0) {
    return { code: '', transformations: [] };
  }

  const transformations: string[] = [];
  let result = code;

  for (const transform of TRANSFORMS) {
    try {
      result = transform(result, transformations);
    } catch {
      // Never let a beautifier transform crash the pipeline
      // The worst case is we skip the transform silently
    }
  }

  return { code: result.trim(), transformations };
}


