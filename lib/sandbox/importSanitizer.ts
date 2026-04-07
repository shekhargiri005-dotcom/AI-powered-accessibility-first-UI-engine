/**
 * @file lib/sandbox/importSanitizer.ts
 *
 * Strips or rewrites imports that cannot be resolved in the Sandpack environment.
 *
 * Called in buildSandpackFiles() on every generated code string before the code
 * enters the virtual filesystem. This is the safety net for cloud models (freeform)
 * that may hallucinate npm package names not available in the Sandpack sandbox.
 *
 * Strategy:
 *  1. Collect all import declarations from the code.
 *  2. For each import, check if the package is in the ALLOWED list.
 *  3. Unknown imports are replaced with inline stubs so the component still renders.
 */

// ─── Allow-list ───────────────────────────────────────────────────────────────

/** Packages that exist in the Sandpack sandbox (either as npm deps or virtual FS files). */
const ALLOWED_PREFIXES = [
  // React core
  'react',
  'react-dom',
  // @ui ecosystem (injected via ui-ecosystem.json)
  '@ui/',
  // npm packages declared in SANDPACK_DEPENDENCIES
  'lucide-react',
  'framer-motion',
  'react-router-dom',
  'react-icons',
  'recharts',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  '@radix-ui/',
  'cmdk',
  'three',
  '@react-three/',
  '@react-spring/',
  'maath',
  'html2canvas',
  // Relative imports are always fine
  './',
  '../',
  // Next.js-style @/ aliases we've aliased in vite.config.ts
  '@/lib/utils',
  '@/components/ui',
];

/** Known bad patterns — private design-system packages the AI hallucinates */
const COMMON_HALLUCINATIONS = [
  '@chakra-ui/',
  '@mui/',
  '@mantine/',
  'antd',
  '@ant-design/',
  '@shadcn/',
  'shadcn',
  '@headlessui/',
  '@heroicons/',
  'daisyui',
  '@nextui-org/',
  'flowbite',
  '@tremor/',
  '@primer/',
  'react-bootstrap',
  'semantic-ui-react',
  '@blueprintjs/',
  '@carbon/',
  '@adobe/react-spectrum',
];

// ─── Stub generator ───────────────────────────────────────────────────────────

/**
 * For a hallucinated import like:
 *   import { Button, Card } from '@chakra-ui/react';
 * Generate an inline stub:
 *   const Button = ({ children, ...p }) => <div {...p}>{children}</div>;
 *   const Card   = ({ children, ...p }) => <div {...p}>{children}</div>;
 */
function buildInlineStub(namedImports: string[], defaultImport: string | null): string {
  const lines: string[] = [];

  if (defaultImport) {
    lines.push(
      `const ${defaultImport} = ({ children, ...p }) => <div {...p}>{children}</div>;`,
    );
  }

  for (const name of namedImports) {
    // Skip `type` re-exports and side-effect-only imports
    if (!name || name.startsWith('type ')) continue;

    // Hook stubs
    if (/^use[A-Z]/.test(name)) {
      lines.push(`const ${name} = () => ({});`);
      continue;
    }
    // Context / Provider stubs
    if (name.endsWith('Provider') || name.endsWith('Context')) {
      lines.push(
        `const ${name} = ({ children }) => children;`,
      );
      continue;
    }
    // Generic component stub
    lines.push(
      `const ${name} = ({ children, className, ...p }) => <div className={className} {...p}>{children}</div>;`,
    );
  }

  return lines.join('\n');
}

// ─── Import line parser ───────────────────────────────────────────────────────

interface ParsedImport {
  fullLine: string;         // the complete import statement (may span many lines)
  source: string;           // the module specifier e.g. '@chakra-ui/react'
  namedImports: string[];   // named bindings e.g. ['Button', 'Card']
  defaultImport: string | null;
}

const IMPORT_REGEX = /^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?$/gm;

function parseImports(code: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  let match: RegExpExecArray | null;

  IMPORT_REGEX.lastIndex = 0;
  while ((match = IMPORT_REGEX.exec(code)) !== null) {
    const clause = match[1].trim();
    const source = match[2];

    const namedImports: string[] = [];
    let defaultImport: string | null = null;

    // Named: { A, B, C }
    const namedMatch = clause.match(/\{([^}]+)\}/);
    if (namedMatch) {
      namedImports.push(
        ...namedMatch[1]
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+/)[0].trim()) // drop 'as' aliases
          .filter(Boolean),
      );
    }

    // Default: import X from '...' or import X, { Y } from '...'
    const withoutNamed = clause.replace(/\{[^}]+\}/, '').trim();
    if (withoutNamed && !withoutNamed.startsWith('*')) {
      defaultImport = withoutNamed.replace(/,$/, '').trim() || null;
    }

    results.push({ fullLine: match[0], source, namedImports, defaultImport });
  }

  return results;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Sanitize a single code string by removing or stubbing unknown imports.
 * Returns the sanitized code and a list of packages that were replaced.
 */
export function sanitizeImports(code: string): { code: string; replaced: string[] } {
  const replaced: string[] = [];
  const imports = parseImports(code);

  let sanitized = code;

  for (const imp of imports) {
    const isAllowed = ALLOWED_PREFIXES.some((prefix) => imp.source.startsWith(prefix));
    if (isAllowed) continue;

    // This import is unknown — stub it out
    const stub = buildInlineStub(imp.namedImports, imp.defaultImport);
    const comment = `// [sanitized] removed unknown package: '${imp.source}'`;
    const replacement = stub ? `${comment}\n${stub}` : comment;

    sanitized = sanitized.replace(imp.fullLine, replacement);
    replaced.push(imp.source);

    if (COMMON_HALLUCINATIONS.some((h) => imp.source.startsWith(h))) {
      console.warn(`[importSanitizer] Replaced hallucinated package: ${imp.source}`);
    }
  }

  return { code: sanitized, replaced };
}

/**
 * Sanitize all files in a multi-file output object.
 */
export function sanitizeAllImports(
  componentCode: string | Record<string, string>,
): string | Record<string, string> {
  if (typeof componentCode === 'string') {
    const { code } = sanitizeImports(componentCode);
    return code;
  }

  const sanitized: Record<string, string> = {};
  for (const [filename, code] of Object.entries(componentCode)) {
    sanitized[filename] = sanitizeImports(code).code;
  }
  return sanitized;
}
