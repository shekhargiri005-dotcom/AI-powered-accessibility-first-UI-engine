import type { SandpackFiles } from '@codesandbox/sandpack-react';

/**
 * Builds the Sandpack file tree for live preview.
 * Injects the generated component and bootstraps it in App.tsx.
 */
export function buildSandpackFiles(
  componentCode: string,
  componentName: string,
): SandpackFiles {
  return {
    '/App.tsx': {
      code: `import React from 'react';
import ${componentName} from './${componentName}';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <${componentName} />
    </div>
  );
}`,
      active: false,
    },
    [`/${componentName}.tsx`]: {
      code: componentCode,
      active: true,
    },
    '/index.tsx': {
      code: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<React.StrictMode><App /></React.StrictMode>);`,
      active: false,
    },
    '/styles.css': {
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
  react: '^18.2.0',
  'react-dom': '^18.2.0',
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
