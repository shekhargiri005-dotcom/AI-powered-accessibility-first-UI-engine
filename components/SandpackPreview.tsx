'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview as SandpackPreviewPanel,
  SandpackCodeEditor,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { buildSandpackFiles, getSandpackDependencies } from '@/lib/sandbox/sandpackConfig';
import { Eye, AlertTriangle, RefreshCw, Code2, X } from 'lucide-react';

interface SandpackPreviewProps {
  code: string | Record<string, string>;
  componentName: string;
  /** Called when the user edits code in the inline editor — used for feedback auto-capture */
  onCodeChange?: (newCode: string) => void;
  /**
   * Called once after the preview has settled (~2s after mount).
   * Receives the iframe element's src URL so the caller can POST it to
   * /api/screenshot for a Playwright server-side capture.
   * Only fires once per generation (keyed on componentName + code identity).
   */
  onReadyForScreenshot?: (iframeSrc: string) => void;
}

// ─── Sandpack Change Observer ─────────────────────────────────────────────────
// Must live inside SandpackProvider so it can call useSandpack().
// Fires onCodeChange whenever the active file's code differs from its initial state.

interface ObserverProps {
  activeFile:   string;
  initialCode:  string;
  onCodeChange: (code: string) => void;
}

function SandpackChangeObserver({ activeFile, initialCode, onCodeChange }: ObserverProps) {
  const { sandpack }    = useSandpack();
  const lastEmittedRef  = useRef<string>(initialCode);

  const currentCode = sandpack.files[activeFile]?.code ?? '';

  useEffect(() => {
    if (
      currentCode !== lastEmittedRef.current &&
      currentCode.trim().length > 50
    ) {
      lastEmittedRef.current = currentCode;
      onCodeChange(currentCode);
    }
  }, [currentCode, onCodeChange]);

  return null;
}

// ─── Screenshot Ready Observer ────────────────────────────────────────────────
// Fires onReadyForScreenshot once after the preview iframe settles.
// Reads the iframe src from the DOM so the parent can POST it to /api/screenshot.

interface ScreenshotObserverProps {
  onReadyForScreenshot: (iframeSrc: string) => void;
}

function SandpackScreenshotObserver({ onReadyForScreenshot }: ScreenshotObserverProps) {
  const { sandpack } = useSandpack();
  const firedRef = useRef(false);

  // Listen for when the preview iframe transitions from loading to running
  const status = sandpack.status;

  useEffect(() => {
    if (firedRef.current) return;
    if (status !== 'running' && status !== 'done') return;

    // Wait for the UI to fully settle before capturing
    const timer = setTimeout(() => {
      if (firedRef.current) return;

      // Find the Sandpack preview iframe in the DOM
      const iframe = document.querySelector<HTMLIFrameElement>(
        'iframe[title="Sandpack Preview"], iframe[class*="sandpack"], .sp-preview-frame'
      );

      const iframeSrc = iframe?.src ?? '';
      const hasExternalSrc = iframeSrc.startsWith('http') && iframeSrc !== 'about:blank';

      if (hasExternalSrc) {
        firedRef.current = true;
        onReadyForScreenshot(iframeSrc);
      } else if (iframe) {
        // iframe exists but src is local blob/about:blank — use a flag URL
        // The screenshot API will handle this case by using the app's own preview URL
        firedRef.current = true;
        onReadyForScreenshot(window.location.origin + '/_sandpack_preview');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [status, onReadyForScreenshot]);

  return null;
}

// ─── Crash Detection Observer ────────────────────────────────────────────────
// Monitors Sandpack status and detects when the runtime crashes (timeout/error).
// Fires onCrashDetected so the parent can show a retry UI.

interface CrashObserverProps {
  onCrashDetected: () => void;
}

function SandpackCrashObserver({ onCrashDetected }: CrashObserverProps) {
  const { sandpack } = useSandpack();
  const firedRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  
  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (firedRef.current) return;

    // If sandpack has an error object, the runtime crashed
    if (sandpack.error) {
      firedRef.current = true;
      onCrashDetected();
      return;
    }

    // If status is 'timeout', the bundler gave up
    if (sandpack.status === 'timeout') {
      firedRef.current = true;
      onCrashDetected();
      return;
    }

    // If still 'initial' after 30s, likely crashed (Nodebox Go runtime exited)
    if (sandpack.status === 'initial') {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > 30000) {
        firedRef.current = true;
        onCrashDetected();
      }
    }
  }, [sandpack.status, sandpack.error, onCrashDetected]);

  return null;
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SandpackPreviewComponent({
  code,
  componentName,
  onCodeChange,
  onReadyForScreenshot,
}: SandpackPreviewProps) {
  // Stable callback ref so the screenshot observer doesn't re-fire on re-renders
  const screenshotCallbackRef = useRef(onReadyForScreenshot);
  useEffect(() => { screenshotCallbackRef.current = onReadyForScreenshot; }, [onReadyForScreenshot]);
  const stableScreenshotCb = useCallback((src: string) => {
    screenshotCallbackRef.current?.(src);
  }, []);
  const [editMode, setEditMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [crashDetected, setCrashDetected] = useState(false);
  const previousCodeRef = useRef<string>(typeof code === 'string' ? code : JSON.stringify(code));

  // Auto-remount Sandpack when code changes (e.g., refine, new generation)
  // This prevents sending new code to a crashed/dead iframe
  useEffect(() => {
    const codeString = typeof code === 'string' ? code : JSON.stringify(code);
    if (codeString !== previousCodeRef.current && previousCodeRef.current.length > 0) {
      // Code changed - reset crash state and force remount
      setCrashDetected(false);
      setRefreshKey((k) => k + 1);
    }
    previousCodeRef.current = codeString;
  }, [code]);

  const handleCrashDetected = useCallback(() => {
    setCrashDetected(true);
  }, []);

  // Reset crash state on refresh
  const handleRefresh = useCallback(() => {
    setCrashDetected(false);
    setRefreshKey((k) => k + 1);
  }, []);

  const files = useMemo(
    () => buildSandpackFiles(code, componentName),
    [code, componentName]
  );
  
  const dynamicDeps = useMemo(
    () => getSandpackDependencies(code),
    [code]
  );

  const activeFile   = typeof code === 'string'
    ? `/src/${componentName}.tsx`
    : '/src/App.tsx';
  
  const activeFileEntry = files[activeFile];
  const initialCode     = typeof activeFileEntry === 'string'
    ? activeFileEntry
    : (activeFileEntry?.code ?? (typeof code === 'string' ? code : ''));

  return (
    <section
      aria-labelledby="preview-heading"
      className="h-full w-full flex flex-col overflow-hidden bg-[#0c0c0e]"
    >
      {/* Header bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 bg-gray-900/80 border-b border-gray-700/50">
        <Eye className="w-4 h-4 text-violet-400" aria-hidden="true" />
        <h3 id="preview-heading" className="text-sm font-semibold text-white">
          Live Preview
        </h3>
        <span className="text-xs text-gray-500 ml-auto hidden sm:inline-block">Powered by Vite &amp; Sandpack</span>

        {/* Custom Reload Button to fix Sandpack built-in refresh issues */}
        <button
          onClick={handleRefresh}
          title="Force reload preview"
          className="ml-auto sm:ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600 hover:bg-gray-800"
        >
          <RefreshCw className="w-3 h-3" />
          Reload
        </button>

        {/* Edit mode toggle — reveals inline code editor for direct edits + auto-capture */}
        <button
          onClick={() => setEditMode((v) => !v)}
          title={editMode ? 'Close editor' : 'Edit code inline (changes auto-captured)'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all
            ${editMode
              ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25'
              : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600 hover:bg-gray-800'
            }`}
        >
          {editMode ? <X className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
          {editMode ? 'Close editor' : 'Edit'}
        </button>
      </div>

      {/* Preview (+ optional editor) fills remaining height */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        <PreviewErrorBoundary componentName={componentName}>
          <SandpackProvider
            key={`${componentName}-${editMode}-${refreshKey}`}
            template="vite-react-ts"
            theme="dark"
            files={files}
            customSetup={{ dependencies: dynamicDeps }}
            options={{
              visibleFiles: Object.keys(files) as string[],
              activeFile,
            }}
          >
            {/* Invisible observer — detects file changes from the editor */}
            {onCodeChange && (
              <SandpackChangeObserver
                activeFile={activeFile}
                initialCode={initialCode}
                onCodeChange={onCodeChange}
              />
            )}

            {/* Screenshot observer — fires once after preview settles for Final Round */}
            {onReadyForScreenshot && (
              <SandpackScreenshotObserver onReadyForScreenshot={stableScreenshotCb} />
            )}

            {/* Crash observer — detects Nodebox runtime deaths */}
            <SandpackCrashObserver onCrashDetected={handleCrashDetected} />

            {/* Crash overlay */}
            {crashDetected && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-sm p-8 text-center gap-4">
                <AlertTriangle className="w-10 h-10 text-amber-400" />
                <h3 className="text-white font-bold text-base">Preview Runtime Crashed</h3>
                <p className="text-sm text-gray-400 max-w-sm">
                  The Sandpack runtime exited unexpectedly. This is usually caused by too many npm dependencies or memory limits. Click reload to retry.
                </p>
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reload Preview
                </button>
              </div>
            )}

            <SandpackLayout
              style={{
                position: editMode ? 'relative' : 'absolute',
                inset:    editMode ? undefined : 0,
                flex:     1,
                border:   'none',
                borderRadius: 0,
                background:   'transparent',
                display:  'flex',
                flexDirection: 'column',
              }}
            >
              {/* Code editor — shown only in edit mode */}
              {editMode && (
                <SandpackCodeEditor
                  showTabs
                  showLineNumbers
                  style={{
                    height:     '40%',
                    borderBottom: '1px solid rgba(75,85,99,0.4)',
                    fontSize:   13,
                  }}
                />
              )}

              <SandpackPreviewPanel
                showNavigator={true}
                showRestartButton={false}
                showRefreshButton={false}
                showOpenInCodeSandbox={false}
                style={{
                  height:    editMode ? '60%' : '100%',
                  width:     '100%',
                  flex:      editMode ? undefined : 1,
                }}
              />
            </SandpackLayout>
          </SandpackProvider>
        </PreviewErrorBoundary>
      </div>
    </section>
  );
}
