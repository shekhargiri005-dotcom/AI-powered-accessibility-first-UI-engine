'use client';

import React from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview as SandpackPreviewPanel,
} from '@codesandbox/sandpack-react';
import { buildSandpackFiles, getSandpackDependencies } from '@/lib/sandbox/sandpackConfig';
import { Eye, AlertTriangle, RefreshCw } from 'lucide-react';

interface SandpackPreviewProps {
  code: string | Record<string, string>;
  componentName: string;
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface EBState { hasError: boolean; errorMsg: string }
class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; componentName: string },
  EBState
> {
  constructor(props: { children: React.ReactNode; componentName: string }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, errorMsg: err.message };
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-gray-950 p-8 text-center gap-4">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <h3 className="text-white font-bold text-base">Preview crashed</h3>
          <p className="text-sm text-gray-400 max-w-sm">
            {this.state.errorMsg || 'The generated component failed to mount.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: '' })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Preview
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Sandpack Preview Component ───────────────────────────────────────────────
export default function SandpackPreviewComponent({ code, componentName }: SandpackPreviewProps) {
  const files = buildSandpackFiles(code, componentName);
  const dynamicDeps = getSandpackDependencies(code);

  return (
    <section
      aria-labelledby="preview-heading"
      className="h-full w-full flex flex-col overflow-hidden"
    >
      {/* Header bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 bg-gray-900/80 border-b border-gray-700/50">
        <Eye className="w-4 h-4 text-violet-400" aria-hidden="true" />
        <h3 id="preview-heading" className="text-sm font-semibold text-white">
          Live Preview
        </h3>
        <span className="text-xs text-gray-500 ml-auto">Powered by Vite &amp; Sandpack</span>
      </div>

      {/* Preview fills all remaining height — NO console, NO terminal panel */}
      <div className="flex-1 min-h-0 relative">
        <PreviewErrorBoundary componentName={componentName}>
          <SandpackProvider
            template="vite-react-ts"
            theme="dark"
            files={files}
            customSetup={{ dependencies: dynamicDeps }}
            options={{
              visibleFiles: Object.keys(files) as string[],
              activeFile: typeof code === 'string' ? `/src/${componentName}.tsx` : '/src/App.tsx',
            }}
          >
            {/*
              SandpackLayout must NOT have flexDirection:'column' with a console child —
              that was what caused the console to consume space and trigger clearScreenDown.
              We use a single SandpackPreviewPanel with explicit full sizing.
            */}
            <SandpackLayout
              style={{
                height: '100%',
                border: 'none',
                borderRadius: 0,
                background: 'transparent',
              }}
            >
              <SandpackPreviewPanel
                showNavigator={true}
                showRestartButton={true}
                showRefreshButton={true}
                showOpenInCodeSandbox={false}
                style={{
                  height: '100%',
                  width: '100%',
                  flex: 1,
                }}
              />
            </SandpackLayout>
          </SandpackProvider>
        </PreviewErrorBoundary>
      </div>
    </section>
  );
}
