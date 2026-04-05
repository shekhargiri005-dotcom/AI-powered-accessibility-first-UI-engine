import type { SandpackFiles, SandpackFile } from '@codesandbox/sandpack-react';
import uiEcosystem from './ui-ecosystem.json';

/**
 * Narrows a SandpackFiles entry (which can be a string OR a SandpackFile object)
 * and returns its code string. Returns '' when the value is not a code-bearing object.
 */
function resolveFileCode(entry: string | SandpackFile): string {
  if (typeof entry === 'string') return entry;
  return entry.code;
}

/**
 * Builds the Sandpack file tree for live preview.
 * Injects the generated component and bootstraps it in App.tsx using Vite structure.
 */
export function buildSandpackFiles(
  componentCode: string | Record<string, string>,
  componentName: string,
): SandpackFiles {
  const isMultiFile = typeof componentCode !== 'string';
  const mainCode = isMultiFile ? (componentCode['App.tsx'] as string) || '' : componentCode;

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
  };

  if (codeString.includes('lucide-react')) deps['lucide-react'] = '^0.378.0';
  if (codeString.includes('framer-motion')) deps['framer-motion'] = '^11.2.10';
  if (codeString.includes('react-router-dom')) deps['react-router-dom'] = '^6.22.3';
  if (codeString.includes('react-icons')) deps['react-icons'] = '^5.0.1';
  if (codeString.includes('recharts')) deps['recharts'] = '^2.12.7';
  if (codeString.includes('cva') || codeString.includes('class-variance-authority')) deps['class-variance-authority'] = '^0.7.0';
  if (codeString.includes('clsx')) deps['clsx'] = '^2.1.1';
  if (codeString.includes('tailwind-merge')) deps['tailwind-merge'] = '^2.3.0';
  if (codeString.includes('@radix-ui/react-slot')) deps['@radix-ui/react-slot'] = '^1.0.2';
  if (codeString.includes('@radix-ui/react-dialog')) deps['@radix-ui/react-dialog'] = '^1.0.5';
  if (codeString.includes('cmdk')) deps['cmdk'] = '^1.0.0';
  deps['html2canvas'] = '^1.4.1'; // Always include for CaptureWrapper

  if (codeString.includes('three') || codeString.includes('@react-three')) {
    deps['three'] = '0.164.0';
    deps['@types/three'] = '0.164.0';
    deps['@react-three/fiber'] = '8.17.10';
    deps['@react-three/drei'] = '9.114.3';
    deps['maath'] = '^0.10.8';
  }

  if (codeString.includes('@react-spring')) {
    deps['@react-spring/three'] = '^9.7.3';
    deps['@react-spring/web'] = '^9.7.3';
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
