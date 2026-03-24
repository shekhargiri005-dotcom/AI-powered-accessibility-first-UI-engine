import type { SandpackFiles } from '@codesandbox/sandpack-react';

/**
 * Builds the Sandpack file tree for live preview.
 * Injects the generated component and bootstraps it in App.tsx using Vite structure.
 */
export function buildSandpackFiles(
  componentCode: string,
  componentName: string,
): SandpackFiles {
  return {
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
    '/src/App.tsx': {
      code: `import React from 'react';
import GeneratedComponent from './${componentName}';

export default function App() {
  return (
    <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center">
      <GeneratedComponent />
    </div>
  );
}`,
      active: false,
    },
    [`/src/${componentName}.tsx`]: {
      code: componentCode,
      active: true,
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
} as const;

export const SANDPACK_DEV_DEPENDENCIES = {
  '@types/react': '^18.2.0',
  '@types/react-dom': '^18.2.0',
  typescript: '^5.0.0',
} as const;

export const SANDPACK_TAILWIND_CDN = `
  <link href="https://cdn.tailwindcss.com" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
`;
