'use client';

import React from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview as SandpackPreviewPanel,
} from '@codesandbox/sandpack-react';
import { buildSandpackFiles, SANDPACK_DEPENDENCIES } from '@/lib/sandbox/sandpackConfig';
import { Eye, Code2 } from 'lucide-react';

interface SandpackPreviewProps {
  code: string | Record<string, string>;
  componentName: string;
}

export default function SandpackPreviewComponent({ code, componentName }: SandpackPreviewProps) {
  const files = buildSandpackFiles(code, componentName);

  return (
    <section
      aria-labelledby="preview-heading"
      className="rounded-xl border border-gray-700/50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900/80 border-b border-gray-700/50">
        <Eye className="w-4 h-4 text-violet-400" aria-hidden="true" />
        <h3 id="preview-heading" className="text-sm font-semibold text-white">
          Live Preview
        </h3>
        <span className="text-xs text-gray-500 ml-auto">Powered by Vite & Sandpack</span>
      </div>

      {/* Sandpack */}
      <SandpackProvider
        template="vite-react-ts"
        theme="dark"
        files={files}
        customSetup={{
          dependencies: {
            ...SANDPACK_DEPENDENCIES,
          },
        }}
        options={{
          visibleFiles: Object.keys(files) as string[],
          activeFile: typeof code === 'string' ? `/src/${componentName}.tsx` : '/src/App.tsx',
          externalResources: [
            'https://cdn.tailwindcss.com',
          ],
        }}
      >
        <SandpackLayout>
          <SandpackPreviewPanel
            showNavigator={true}
            showRestartButton={true}
            showRefreshButton={true}
            showOpenInCodeSandbox={false}
            style={{ height: '500px' }}
          />
        </SandpackLayout>
      </SandpackProvider>
    </section>
  );
}
