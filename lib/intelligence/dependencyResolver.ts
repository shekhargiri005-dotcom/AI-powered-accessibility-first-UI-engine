/**
 * Dependency Resolver — builds a valid file graph and detects missing imports.
 * Prevents "Failed to resolve import" errors in Sandpack.
 */

export interface FileDependencyGraph {
  files: string[];
  edges: Array<{ from: string; to: string; importPath: string }>;
}

export interface DependencyResolveResult {
  valid: boolean;
  missingFiles: string[];
  missingExports: string[];
  circularDeps: string[];
  suggestions: string[];
  patchedFiles?: Record<string, string>;
}

// Known safe external packages that don't need to be generated
const SAFE_EXTERNAL_PACKAGES = new Set([
  'react','react-dom','react/jsx-runtime',
  'lucide-react','framer-motion','react-router-dom',
  '@react-three/fiber','@react-three/drei','three',
  '@react-spring/web','@react-spring/three','maath',
  'react-icons',
]);

function isSafeExternal(importPath: string): boolean {
  if (!importPath.startsWith('.')) {
    const pkg = importPath.split('/')[0];
    const scopedPkg = importPath.startsWith('@') ? importPath.split('/').slice(0, 2).join('/') : pkg;
    return SAFE_EXTERNAL_PACKAGES.has(pkg) || SAFE_EXTERNAL_PACKAGES.has(scopedPkg);
  }
  return false;
}

function extractImports(code: string): string[] {
  const imports: string[] = [];
  // Static imports: import X from '...'  or import { X } from '...'
  const staticRe = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = staticRe.exec(code)) !== null) {
    imports.push(m[1]);
  }
  // Dynamic imports: import('...')
  const dynRe = /import\(['"]([^'"]+)['"]\)/g;
  while ((m = dynRe.exec(code)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}

function resolveRelativePath(fromFile: string, importPath: string): string {
  if (!importPath.startsWith('.')) return importPath;
  const fromDir = fromFile.includes('/') ? fromFile.split('/').slice(0, -1).join('/') : '';
  const segments = (fromDir ? fromDir + '/' + importPath : importPath).split('/');
  const resolved: string[] = [];
  for (const seg of segments) {
    if (seg === '..') resolved.pop();
    else if (seg !== '.') resolved.push(seg);
  }
  return resolved.join('/');
}

function normalizeFilePath(path: string): string {
  return path
    .replace(/^\//, '')
    .replace(/^src\//, '')
    .replace(/\.(tsx?|jsx?)$/, '');
}

/**
 * Analyses a set of generated source files, builds the import graph,
 * and returns a structured report of what's missing.
 */
export function resolveDependencies(files: Record<string, string>): DependencyResolveResult {
  const missingFiles: string[] = [];
  const missingExports: string[] = [];
  const circularDeps: string[] = [];
  const suggestions: string[] = [];

  // Normalize file keys
  const normalizedFiles: Record<string, string> = {};
  for (const [key, code] of Object.entries(files)) {
    normalizedFiles[normalizeFilePath(key)] = code;
  }
  const fileNames = new Set(Object.keys(normalizedFiles));

  // Check each file's imports
  for (const [fileName, code] of Object.entries(normalizedFiles)) {
    const imports = extractImports(code);
    for (const imp of imports) {
      if (isSafeExternal(imp)) continue;
      if (imp.startsWith('.')) {
        const resolved = normalizeFilePath(resolveRelativePath(fileName, imp));
        if (!fileNames.has(resolved)) {
          // Try with common extensions
          const variants = [resolved, resolved + '.tsx', resolved + '.ts', resolved + '/index'];
          const found = variants.some(v => fileNames.has(normalizeFilePath(v)));
          if (!found) {
            missingFiles.push(`${fileName} imports "${imp}" → resolved to "${resolved}" but file not found`);
            suggestions.push(`Generate a stub for "${resolved}.tsx" OR replace the import with an inline component`);
          }
        }
      }
    }

    // Check that there is a default export (required for component files)
    if (fileName.endsWith('tsx') || fileName.endsWith('jsx') || fileName.includes('.tsx') || fileName.includes('.jsx')) {
      if (code.length > 50 && !code.includes('export default')) {
        missingExports.push(`${fileName} is missing a "export default" statement`);
        suggestions.push(`Add "export default" to the main component in ${fileName}`);
      }
    }
  }

  return {
    valid: missingFiles.length === 0 && missingExports.length === 0,
    missingFiles,
    missingExports,
    circularDeps,
    suggestions,
  };
}

/**
 * Auto-patch: generate stub files for missing imports so preview doesn't crash.
 */
export function resolveAndPatch(files: Record<string, string>): { files: Record<string, string>; patchLog: string[] } {
  const result = resolveDependencies(files);
  const patchLog: string[] = [];
  const patched = { ...files };

  if (result.valid) return { files: patched, patchLog };

  // Add missing exports
  for (const missingExport of result.missingExports) {
    const fileMatch = missingExport.match(/^([\w/.]+)\s+is missing/);
    if (fileMatch) {
      const filePath = fileMatch[1];
      const code = patched[filePath] || patched['/src/' + filePath] || '';
      if (code) {
        const key = patched[filePath] !== undefined ? filePath : '/src/' + filePath;
        // Try to find the main function/class and add export default
        const funcMatch = code.match(/^(?:function|const)\s+(\w+)/m);
        if (funcMatch) {
          patched[key] = code + `\n\nexport default ${funcMatch[1]};`;
          patchLog.push(`Added "export default ${funcMatch[1]}" to ${key}`);
        }
      }
    }
  }

  // Create stubs for missing files
  for (const missing of result.missingFiles) {
    const pathMatch = missing.match(/resolved to "([^"]+)"/);
    if (pathMatch) {
      const stubPath = '/src/' + pathMatch[1] + '.tsx';
      const componentName = pathMatch[1].split('/').pop() || 'StubComponent';
      const pascalName = componentName.charAt(0).toUpperCase() + componentName.slice(1);
      patched[stubPath] = `import React from 'react';\n\nexport default function ${pascalName}() {\n  return <div className="p-4 text-gray-500">Component: ${pascalName}</div>;\n}\n`;
      patchLog.push(`Created stub for missing file: ${stubPath}`);
    }
  }

  return { files: patched, patchLog };
}
