import type { SandpackFiles } from '@codesandbox/sandpack-react';

/**
 * Builds the Sandpack file tree for live preview.
 * Injects the generated component and bootstraps it in App.tsx using Vite structure.
 */
export function buildSandpackFiles(
  componentCode: string | Record<string, string>,
  componentName: string,
): SandpackFiles {
  const isMultiFile = typeof componentCode !== 'string';
  const mainCode = isMultiFile ? componentCode['App.tsx'] || '' : componentCode;

  const files: SandpackFiles = {
    '/index.html': {
      code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI UI Engine</title>
    <script src="https://cdn.tailwindcss.com"></script>
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

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<React.StrictMode><App /></React.StrictMode>);`,
      active: false,
    },
    '/src/styles.css': {
      code: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

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
  };

  if (isMultiFile) {
    let hasApp = false;
    for (const [filename, code] of Object.entries(componentCode)) {
      const cleanName = filename.replace(/^\/+/, '');
      if (cleanName === 'App.tsx' || cleanName === 'App.jsx') hasApp = true;
      files[`/src/${cleanName}`] = { code: typeof code === 'string' ? code : '', active: cleanName === 'App.tsx' };
    }
    
    // Safety fallback: Sandpack crashes if activeFile '/src/App.tsx' does not exist
    if (!hasApp) {
      const keys = Object.keys(componentCode);
      if (keys.length === 0) {
        files['/src/App.tsx'] = {
          code: `import React from 'react';\nexport default function App() {\n  return <div className="p-8 text-red-500 font-mono text-center">Generation Error: The AI failed to yield any file chunks. Try again.</div>;\n}`,
          active: true
        };
      } else {
        const firstKey = keys[0].replace(/^\/+/, '');
        const importName = firstKey.replace(/\.[tj]sx?$/, '');
        files['/src/App.tsx'] = {
          code: `import React from 'react';\nimport FallbackComponent from './${importName}';\n\nexport default function App() {\n  return <FallbackComponent />;\n}`,
          active: true
        };
      }
    }
  } else {
    files['/src/App.tsx'] = {
      code: `import React from 'react';\nimport GeneratedComponent from './${componentName}';\n\nexport default function App() {\n  return (\n    <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center">\n      <GeneratedComponent />\n    </div>\n  );\n}`,
      active: false,
    };
    files[`/src/${componentName}.tsx`] = {
      code: mainCode as string,
      active: true,
    };
  }

  return files;
}

export const SANDPACK_DEPENDENCIES = {
  react: '^18.3.1',
  'react-dom': '^18.3.1',
  'lucide-react': 'latest',
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
} as const;

export const SANDPACK_DEV_DEPENDENCIES = {
  '@types/react': '^18.2.0',
  '@types/react-dom': '^18.2.0',
  typescript: '^5.0.0',
  '@types/react-router-dom': '^5.3.3',
} as const;

export const SANDPACK_TAILWIND_CDN = `
  <link href="https://cdn.tailwindcss.com" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
`;
