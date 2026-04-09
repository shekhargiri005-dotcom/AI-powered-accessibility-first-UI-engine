import type { SandpackFiles, SandpackFile } from '@codesandbox/sandpack-react';
import uiEcosystem from './ui-ecosystem.json';
import { sanitizeAllImports } from './importSanitizer';

/**
 * Narrows a SandpackFiles entry (which can be a string OR a SandpackFile object)
 * and returns its code string. Returns '' when the value is not a code-bearing object.
 */
function resolveFileCode(entry: string | SandpackFile): string {
  if (typeof entry === 'string') return entry;
  return entry.code;
}

/**
 * Resolve a relative import within the Sandpack virtual FS.
 * e.g. dir='/src', importPath='./Feed' → '/src/Feed'
 */
function resolveFsPath(dir: string, importPath: string): string {
  const parts = (dir + '/' + importPath).split('/');
  const result: string[] = [];
  for (const part of parts) {
    if (part === '..') result.pop();
    else if (part !== '.') result.push(part);
  }
  return result.join('/');
}

/**
 * Scan all /src/* files for relative imports.
 * For any import that has no corresponding file in the virtual FS,
 * inject a minimal stub component so Vite does not crash with
 * "Failed to resolve import './Feed' from src/App.tsx".
 */
function injectMissingFileStubs(files: SandpackFiles): void {
  const RELATIVE_IMPORT_RE = /from\s+['"](\.[^'"]+)['"]/g;
  const mounted = new Set(Object.keys(files));

  // Snapshot keys so we don't iterate over stubs we are about to add
  const srcFiles = Object.keys(files).filter((p) => p.startsWith('/src/'));

  for (const filepath of srcFiles) {
    const entry = files[filepath];
    if (!entry) continue;
    const code = resolveFileCode(typeof entry === 'string' ? entry : (entry as SandpackFile));
    const dir = filepath.substring(0, filepath.lastIndexOf('/'));

    RELATIVE_IMPORT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = RELATIVE_IMPORT_RE.exec(code)) !== null) {
      const importPath = match[1];
      // Strip trailing extension from the specifier so we can try multiple
      const resolved = resolveFsPath(dir, importPath).replace(/\.[tj]sx?$/, '');

      const candidates = [
        resolved + '.tsx',
        resolved + '.ts',
        resolved + '.jsx',
        resolved + '.js',
        resolved + '/index.tsx',
        resolved + '/index.ts',
      ];

      if (candidates.some((c) => mounted.has(c))) continue;

      // Derive a PascalCase name from the import specifier
      const raw = importPath.split('/').pop()?.replace(/\.[tj]sx?$/, '') ?? 'Stub';
      const compName = raw.charAt(0).toUpperCase() + raw.slice(1);
      const stubPath = resolved + '.tsx';

      files[stubPath] = {
        code: [
          `import React from 'react';`,
          ``,
          `// Auto-stub: the AI imported this file but did not produce its contents.`,
          `export default function ${compName}() {`,
          `  return (`,
          `    <div className="p-6 bg-gray-900/50 border border-gray-700/60 rounded-xl`,
          `      flex items-center justify-center min-h-[120px]">`,
          `      <p className="font-mono text-sm text-gray-400">[{compName} — placeholder]</p>`,
          `    </div>`,
          `  );`,
          `}`,
        ].join('\n'),
        active: false,
      };
      mounted.add(stubPath);
    }
  }
}


/**
 * Builds the Sandpack file tree for live preview.
 * Injects the generated component and bootstraps it in App.tsx using Vite structure.
 */
export function buildSandpackFiles(
  componentCode: string | Record<string, string>,
  componentName: string,
): SandpackFiles {
  // Strip / stub any imports that can't resolve in the Sandpack environment
  const safeCode = sanitizeAllImports(componentCode);
  const isMultiFile = typeof safeCode !== 'string';
  const mainCode = isMultiFile ? (safeCode['App.tsx'] as string) || '' : safeCode;

  const files: SandpackFiles = {
    '/index.html': {
      code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI UI Engine</title>
    <style>
      #root { min-height: 100vh; display: flex; flex-direction: column; }
      body { margin: 0; background: #000; color: #fff; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>`,
      active: false,
    },
    '/src/index.tsx': {
      code: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const render = () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(<React.StrictMode><App /></React.StrictMode>);
  } else {
    // Retry once in case of mount delay
    setTimeout(() => {
      const retryContainer = document.getElementById('root');
      if (retryContainer) {
        const root = createRoot(retryContainer);
        root.render(<React.StrictMode><App /></React.StrictMode>);
      }
    }, 100);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}`,
      active: false,
    },
    '/src/styles.css': {
      code: `@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', sans-serif; line-height: 1.5; color: #111827; background: #f9fafb; }

/* Base form styles */
input, textarea, select {
  font-family: inherit;
  font-size: 0.875rem;
}

/* Focus visible ring */
:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}`,
      active: false,
    },
    '/tailwind.config.js': {
      code: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
      active: false,
    },
    '/postcss.config.js': {
      code: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
      active: false,
    },
    '/tsconfig.json': {
      code: `{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "baseUrl": ".",
    "paths": {
      "@ui/*": ["./packages/*"]
    },
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "packages"]
}`,
      active: false,
    },
  };

  files['/src/CaptureWrapper.tsx'] = {
    code: `import React, { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';

export default function CaptureWrapper({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleMessage = async (e) => {
      if (e.data?.type === 'REQUEST_SNAPSHOT') {
        try {
          if (!ref.current) return;
          const canvas = await html2canvas(ref.current, { useCORS: true, allowTaint: true, scale: 0.5, logging: false });
          const base64 = canvas.toDataURL('image/jpeg', 0.5);
          window.parent.postMessage({ type: 'SNAPSHOT_RESULT', payload: base64 }, '*');
        } catch (err) {
          window.parent.postMessage({ type: 'SNAPSHOT_ERROR', payload: err.message }, '*');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return <div ref={ref} className="w-full min-h-screen bg-gray-50 flex flex-col">{children}</div>;
}`,
    active: false,
  };

  if (isMultiFile) {
    let hasApp = false;
    for (const [filename, code] of Object.entries(safeCode as Record<string, string>)) {
      const cleanName = filename.replace(/^\/+/, '');
      if (cleanName === 'App.tsx' || cleanName === 'App.jsx') hasApp = true;
      files[`/src/${cleanName}`] = { code: typeof code === 'string' ? code : '', active: cleanName === 'App.tsx' };
    }

    // Safety fallback: Sandpack crashes if activeFile '/src/App.tsx' does not exist
    if (!hasApp) {
      const keys = Object.keys(safeCode as Record<string, string>);
      if (keys.length === 0) {
        files['/src/App.tsx'] = {
          code: `import React from 'react';\nexport default function App() {\n  return <div className="p-8 text-red-500 font-mono text-center">Generation Error: The AI failed to yield any file chunks. Try again.</div>;\n}`,
          active: true
        };
      } else {
        const firstKey = keys[0].replace(/^\/+/, '');
        const importName = firstKey.replace(/\.[tj]sx?$/, '');
        files['/src/App.tsx'] = {
          code: `import React from 'react';\nimport FallbackComponent from './${importName}';\nimport CaptureWrapper from './CaptureWrapper';\n\nexport default function App() {\n  return <CaptureWrapper><FallbackComponent /></CaptureWrapper>;\n}`,
          active: true
        };
      }
    } else {
      // If it has App.tsx, wrap the user's App inside our CaptureWrapper via index.tsx.
      const rawIndex = files['/src/index.tsx'];
      const currentCode = rawIndex !== undefined ? resolveFileCode(rawIndex) : '';
      const patched = 'import CaptureWrapper from \'./CaptureWrapper\';\n' +
        currentCode.replace('<App />', '<CaptureWrapper><App /></CaptureWrapper>');
      files['/src/index.tsx'] = { code: patched, active: false };
    }
  } else {
    files['/src/App.tsx'] = {
      code: `import React from 'react';\nimport GeneratedComponent from './${componentName}';\nimport CaptureWrapper from './CaptureWrapper';\n\nexport default function App() {\n  return (\n    <CaptureWrapper>\n      <GeneratedComponent />\n    </CaptureWrapper>\n  );\n}`,
      active: false,
    };
    files[`/src/${componentName}.tsx`] = {
      code: mainCode as string,
      active: true,
    };
  }

  // ── Stub any relative imports that reference files not in the virtual FS ─────
  // Prevents: "Failed to resolve import './Feed' from src/App.tsx"
  injectMissingFileStubs(files);

  // ── Inject Vite alias config so @ui/* packages resolve at runtime ──────────
  // Vite 4 does NOT read tsconfig "paths" aliases — only vite.config.ts aliases work.
  // The files exist in the virtual FS (injected below from ui-ecosystem.json),
  // but without this config Vite throws "Failed to resolve import @ui/core".
  files['/vite.config.ts'] = {
    code: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ui/core':            '/packages/core/index.ts',
      '@ui/layout':          '/packages/layout/index.ts',
      '@ui/icons':           '/packages/icons/index.ts',
      '@ui/a11y':            '/packages/a11y/index.ts',
      '@ui/charts':          '/packages/charts/index.ts',
      '@ui/forms':           '/packages/forms/index.ts',
      '@ui/motion':          '/packages/motion/index.ts',
      '@ui/theming':         '/packages/theming/index.ts',
      '@ui/three':           '/packages/three/index.ts',
      '@ui/tokens':          '/packages/tokens/index.ts',
      '@ui/typography':      '/packages/typography/index.ts',
      '@ui/dragdrop':        '/packages/dragdrop/index.ts',
      '@ui/editor':          '/packages/editor/index.ts',
      '@ui/command-palette': '/packages/command-palette/index.ts',
      '@ui/utils':           '/packages/utils',
      // Next.js-style @/ alias used by some generated code
      '@/lib/utils':         '/packages/utils/cn.ts',
      '@/components/ui':     '/packages/core/components',
    },
  },
});
`,
    active: false,
  };

  // Inject the entire @ui ecosystem into the Sandpack virtual filesystem
  Object.entries(uiEcosystem as Record<string, string>).forEach(([filepath, code]) => {
    files[filepath] = { code, active: false };
  });

  return files;
}

export const SANDPACK_DEPENDENCIES = {
  react: '^18.3.1',
  'react-dom': '^18.3.1',
  'lucide-react': '^0.378.0',
  'three': '0.164.0',
  '@types/three': '0.164.0',
  '@react-three/fiber': '8.17.10',
  '@react-three/drei': '9.114.3',
  'maath': '^0.10.8',
  '@react-spring/three': '^9.7.3',
  '@react-spring/web': '^9.7.3',
  'framer-motion': '^11.2.10',
  'react-router-dom': '^6.22.3',
  'react-icons': '^5.0.1',
  'recharts': '^2.12.7',
  'class-variance-authority': '^0.7.0',
  'clsx': '^2.1.1',
  'tailwind-merge': '^2.3.0',
  '@radix-ui/react-slot': '^1.0.2',
  '@radix-ui/react-dialog': '^1.0.5',
  'cmdk': '^1.0.0',
  'html2canvas': '^1.4.1',
} as const;

export function getSandpackDependencies(componentCode: string | Record<string, string>) {
  const codeString = typeof componentCode === 'string'
    ? componentCode
    : Object.values(componentCode).join('\\n');

  const deps: Record<string, string> = {
    react: '^18.3.1',
    'react-dom': '^18.3.1',
    tailwindcss: '^3.4.1',
    postcss: '^8.4.35',
    autoprefixer: '^10.4.18',
    // ALWAYS include packages used by the injected ui-ecosystem files.
    // @ui/core/index.ts re-exports Modal (needs @radix-ui/react-dialog),
    // Button (needs @radix-ui/react-slot + class-variance-authority),
    // and shared utilities (clsx, tailwind-merge). These packages must be
    // present in EVERY Sandpack session regardless of user-generated imports.
    '@radix-ui/react-dialog': '^1.0.5',
    '@radix-ui/react-slot':   '^1.0.2',
    'class-variance-authority': '^0.7.0',
    'clsx': '^2.1.1',
    'tailwind-merge': '^2.3.0',
    'html2canvas': '^1.4.1', // Always for CaptureWrapper
  };

  if (codeString.includes('lucide-react'))      deps['lucide-react']       = '^0.378.0';
  if (codeString.includes('framer-motion'))      deps['framer-motion']       = '^11.2.10';
  if (codeString.includes('react-router-dom'))   deps['react-router-dom']    = '^6.22.3';
  if (codeString.includes('react-icons'))        deps['react-icons']         = '^5.0.1';
  if (codeString.includes('recharts'))           deps['recharts']            = '^2.12.7';
  if (codeString.includes('cmdk'))               deps['cmdk']                = '^1.0.0';

  if (codeString.includes('three') || codeString.includes('@react-three')) {
    deps['three']               = '0.164.0';
    deps['@types/three']        = '0.164.0';
    deps['@react-three/fiber']  = '8.17.10';
    deps['@react-three/drei']   = '9.114.3';
    deps['maath']               = '^0.10.8';
  }

  if (codeString.includes('@react-spring')) {
    deps['@react-spring/three'] = '^9.7.3';
    deps['@react-spring/web']   = '^9.7.3';
  }

  return deps;
}

export const SANDPACK_DEV_DEPENDENCIES = {
  '@types/react': '^18.2.0',
  '@types/react-dom': '^18.2.0',
  typescript: '^5.0.0',
  '@types/react-router-dom': '^5.3.3',
  tailwindcss: '^3.4.1',
  postcss: '^8.4.35',
  autoprefixer: '^10.4.18',
} as const;

export const SANDPACK_TAILWIND_CDN = ``;
