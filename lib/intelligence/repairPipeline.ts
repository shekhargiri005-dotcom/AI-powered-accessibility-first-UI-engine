/**
 * Repair Pipeline — auto-repairs common generation failures before preview.
 * Applies rule-based patches first, then falls back to AI repair if needed.
 */
import { validateGeneratedCode, type ValidationError } from './codeValidator';

export interface RepairResult {
  success: boolean;
  code: string;
  repairsApplied: string[];
  unrepairedErrors: ValidationError[];
}

// ─── Rule-Based Repairs ───────────────────────────────────────────────────────

type RepairFn = (code: string) => { code: string; applied: boolean; description: string };

const RULE_BASED_REPAIRS: RepairFn[] = [
  // 1. Strip browser-unsafe imports
  (code) => {
    const unsafe = ['fs', 'path', 'readline', 'child_process', 'tty', 'os', 'stream'];
    let changed = false;
    let result = code;
    for (const mod of unsafe) {
      const before = result;
      result = result
        .replace(new RegExp(`import\\s+[^;]+from\\s+['"]${mod}['"];?\\n?`, 'g'), `// [REPAIRED] Removed browser-unsafe import: ${mod}\n`)
        .replace(new RegExp(`const\\s+[^=]+=\\s*require\\s*\\(\\s*['"]${mod}['"]\\s*\\);?\\n?`, 'g'), `// [REPAIRED] Removed browser-unsafe require: ${mod}\n`);
      if (result !== before) changed = true;
    }
    return { code: result, applied: changed, description: 'Stripped browser-unsafe Node.js module imports' };
  },

  // 2. Strip TTY / process.stdout calls
  (code) => {
    const before = code;
    const result = code
      .replace(/process\.stdout\.write\s*\([^)]*\);?\n?/g, '// [REPAIRED] Removed process.stdout.write\n')
      .replace(/process\.stderr\.write\s*\([^)]*\);?\n?/g, '// [REPAIRED] Removed process.stderr.write\n')
      .replace(/clearScreenDown\s*\([^)]*\);?\n?/g, '// [REPAIRED] Removed clearScreenDown\n')
      .replace(/readline\.createInterface\s*\([^)]*\);?\n?/g, '// [REPAIRED] Removed readline.createInterface\n');
    return { code: result, applied: result !== before, description: 'Stripped TTY and process.stdout API calls' };
  },

  // 3. Replace @heroicons/react imports with lucide-react
  (code) => {
    if (!code.includes('@heroicons/react')) return { code, applied: false, description: '' };
    const result = code
      .replace(/from\s+['"]@heroicons\/react\/[^'"]+['"]/g, "from 'lucide-react'")
      .replace(/from\s+['"]@heroicons\/react['"]/g, "from 'lucide-react'");
    return { code: result, applied: result !== code, description: 'Replaced @heroicons/react with lucide-react' };
  },

  // 4. Add missing export default
  (code) => {
    if (code.includes('export default')) return { code, applied: false, description: '' };
    // Try to find the main function component
    const funcMatch = code.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Z][A-Za-z]*)\s*\(/m);
    const arrowMatch = code.match(/^const\s+([A-Z][A-Za-z]*)\s*[:=]/m);
    const name = funcMatch?.[1] || arrowMatch?.[1];
    if (name) {
      return {
        code: code + `\n\nexport default ${name};\n`,
        applied: true,
        description: `Added missing "export default ${name}"`,
      };
    }
    // Fallback: wrap entire code in a default export
    return {
      code: code + `\n\n// [REPAIRED] Added fallback default export\nexport default function GeneratedComponent() { return null; }\n`,
      applied: true,
      description: 'Added fallback default export',
    };
  },

  // 5. Fix CSS @import ordering (move @import before @tailwind)
  (code) => {
    if (!code.includes('@import') || !code.includes('@tailwind')) return { code, applied: false, description: '' };
    const importLines: string[] = [];
    const otherLines: string[] = [];
    for (const line of code.split('\n')) {
      if (line.trim().startsWith('@import')) importLines.push(line);
      else otherLines.push(line);
    }
    const result = [...importLines, ...otherLines].join('\n');
    return { code: result, applied: result !== code, description: 'Reordered CSS @import before @tailwind directives' };
  },

  // 6. Fix multi-line template literals in JSX (flatten to single line strings)
  (code) => {
    // Template literals spanning multiple lines in JSX attributes can break Sandpack Babel parser
    const before = code;
    const result = code.replace(/`([^`]*?\n[^`]*?)`/g, (match, inner) => {
      const flattened = inner.replace(/\n\s*/g, ' ').trim();
      return `\`${flattened}\``;
    });
    return { code: result, applied: result !== before, description: 'Flattened multi-line template literals' };
  },

  // 7. Remove duplicate export defaults
  (code) => {
    const matches = code.match(/export\s+default/g);
    if (!matches || matches.length <= 1) return { code, applied: false, description: '' };
    // Keep only the last export default
    let count = 0;
    const result = code.replace(/export\s+default/g, (match) => {
      count++;
      if (count < matches.length) return '// [REPAIRED] Duplicate export removed';
      return match;
    });
    return { code: result, applied: true, description: 'Removed duplicate export default statements' };
  },
];

/**
 * Apply all rule-based repairs to a code string.
 * Returns the repaired code and a log of applied repairs.
 */
export function applyRuleBasedRepairs(code: string): { code: string; repairsApplied: string[] } {
  let current = code;
  const repairsApplied: string[] = [];

  for (const repairFn of RULE_BASED_REPAIRS) {
    const result = repairFn(current);
    if (result.applied) {
      current = result.code;
      if (result.description) repairsApplied.push(result.description);
    }
  }

  return { code: current, repairsApplied };
}

/**
 * Full repair pipeline:
 * 1. Run rule-based repairs
 * 2. Re-validate
 * 3. Return result with all repairs logged
 */
export async function runRepairPipeline(
  code: string,
  aiRepairFn?: (code: string, instructions: string) => Promise<string>,
): Promise<RepairResult> {
  // Step 1: Rule-based repairs
  const { code: patchedCode, repairsApplied } = applyRuleBasedRepairs(code);

  // Step 2: Re-validate
  const postRepairValidation = validateGeneratedCode(patchedCode);
  if (postRepairValidation.valid) {
    return {
      success: true,
      code: patchedCode,
      repairsApplied,
      unrepairedErrors: [],
    };
  }

  // Step 3: AI-based repair fallback
  if (aiRepairFn && postRepairValidation.errors.length > 0) {
    const instructions = postRepairValidation.errors
      .map(e => `- ${e.code}: ${e.message}`)
      .join('\n');
    try {
      const aiRepairedCode = await aiRepairFn(patchedCode, `Fix these specific issues:\n${instructions}`);
      const finalValidation = validateGeneratedCode(aiRepairedCode);
      if (finalValidation.valid) {
        repairsApplied.push('AI repair agent applied fixes for remaining errors');
        return { success: true, code: aiRepairedCode, repairsApplied, unrepairedErrors: [] };
      }
      // Partial success — return AI-repaired code even with remaining warnings
      return {
        success: finalValidation.errors.length < postRepairValidation.errors.length,
        code: aiRepairedCode,
        repairsApplied,
        unrepairedErrors: finalValidation.errors,
      };
    } catch {
      // AI repair failed — return best effort
    }
  }

  return {
    success: false,
    code: patchedCode,
    repairsApplied,
    unrepairedErrors: postRepairValidation.errors,
  };
}
