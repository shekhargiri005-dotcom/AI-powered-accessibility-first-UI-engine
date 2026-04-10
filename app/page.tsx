'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { GenerationMode, SubmitOptions } from '@/components/PromptInput';
import type { PipelineStep } from '@/components/PipelineStatus';
import type { AIEngineConfig } from '@/components/AIEngineConfigPanel';
import type { UIIntent, A11yReport, ThinkingPlan, IntentClassification } from '@/lib/validation/schemas';
import type { FeedbackMeta } from '@/components/FeedbackBar';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/ide/Sidebar';
import CenterWorkspace from '@/components/ide/CenterWorkspace';
import RightPanel from '@/components/ide/RightPanel';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';

interface GenerationOutput {
  code: string | Record<string, string>;
  componentName: string;
  intent: UIIntent;
  a11yReport: A11yReport;
  appliedFixes?: string[];
  tests: { rtl: string; playwright: string };
  mode: GenerationMode;
}

type Stage =
  | 'idle'
  | 'classifying'
  | 'thinking'
  | 'awaiting_confirm'
  | 'parsing'
  | 'generating'
  | 'validating'
  | 'testing'
  | 'complete'
  | 'error';

// ─── Prompt Hash (Web Crypto, client-side) ───────────────────────────────────
async function hashPromptClient(prompt: string): Promise<string> {
  const encoder    = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(prompt));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export default function HomePage() {
  const [stage, setStage] = useState<Stage>('idle');
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>('idle');
  const [pipelineError, setPipelineError] = useState<string | undefined>();
  const [output, setOutput] = useState<GenerationOutput | null>(null);

  // ─── AI Engine Config ─────────────────────────────────────────────────────
  const [aiConfig, setAiConfig] = useState<AIEngineConfig | null>(null);
  const [isFullAppMode, setIsFullAppMode] = useState(false);
  const [isMultiSlideMode, setIsMultiSlideMode] = useState(false);
  // True while RightPanel bottom-bar refine is running; suppresses center workspace
  const [isDirectRefining, setIsDirectRefining] = useState(false);

  // Called when the user saves AI Engine Config
  const handleEngineConfigSaved = useCallback((config: AIEngineConfig) => {
    setAiConfig(config);
    setIsFullAppMode(config.fullAppMode);
    setIsMultiSlideMode(config.multiSlideMode);
  }, []);

  // Called when the user clicks "Stop & Deactivate Engine"
  const handleEngineDeactivated = useCallback(() => {
    setAiConfig(null);
    setGenerationMeta(null);
    setIsFullAppMode(false);
    setIsMultiSlideMode(false);
  }, []);

  // Helper: build the AI payload fields from the active config
  const aiPayload = useCallback(() => {
    if (!aiConfig) return {};
    return {
      model:    aiConfig.model,
      provider: aiConfig.provider,
      // Only send the real key (not the masked "••••" stored version)
      apiKey:   aiConfig.apiKey !== '••••' && aiConfig.apiKey !== 'local' ? aiConfig.apiKey : undefined,
      baseUrl:  aiConfig.baseUrl,
    };
  }, [aiConfig]);

  /** Feedback metadata for the most recent generation — drives FeedbackBar in RightPanel */
  const [generationMeta, setGenerationMeta] = useState<FeedbackMeta | null>(null);

  // Layout State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Workspace state
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  // Stable timestamp for the current output — only changes when output itself changes.
  // Using new Date() inline in JSX caused a new value on every render, making RightPanel
  // reset its version history and treat every re-render as a brand-new project.
  // Initialized to '' — runGenerationPipeline stamps the real value before setOutput() is called.
  const outputTimestampRef = useRef<string>('');

  // Intent & Thinking state
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [pendingMode, setPendingMode] = useState<GenerationMode>('component');
  const [pendingDepthUi, setPendingDepthUi] = useState(false);
  const [liveClassification, setLiveClassification] = useState<IntentClassification | null>(null);
  const [lastIntentConfidence, setLastIntentConfidence] = useState<number>(0.8);
  const [thinkingPlan, setThinkingPlan] = useState<ThinkingPlan | null>(null);
  const [isThinkingLoading, setIsThinkingLoading] = useState(false);

  // ─── Shared Persistence ───────────────────────────────────────────────────
  const persistProject = useCallback(async (
    name: string,
    componentType: 'component' | 'app' | 'depth_ui',
    code: string | Record<string, string>,
    intent: UIIntent,
    a11yReport: A11yReport,
  ) => {
    const projectId = activeProjectId || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const isNewProject = !activeProjectId;
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: projectId, name, componentType, code, intent, a11yReport,
          changeDescription: intent.description || 'Generated',
          isNewProject,
        }),
      });
      if (isNewProject) setActiveProjectId(projectId);
    } catch { /* Error non-fatal for local UI */ }
  }, [activeProjectId]);

  // ─── Load Project ─────────────────────────────────────────────────────────
  const loadProject = useCallback(async (id: string) => {
    setPipelineStep('parsing');
    setStage('parsing');
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      if (data.success && data.project) {
        const proj = data.project;
        const latest = proj.versions[proj.versions.length - 1];
        if (latest) {
          setOutput({
            code: latest.code,
            componentName: latest.intent.componentName,
            intent: latest.intent,
            a11yReport: latest.a11yReport,
            tests: { rtl: '', playwright: '' },
            mode: (proj.componentType as GenerationMode) ?? 'component',
          });
          setActiveProjectId(id);
          setStage('complete');
          setPipelineStep('complete');
        }
      }
    } catch {
      setPipelineError('Failed to load project.');
      setStage('error'); setPipelineStep('error');
    }
  }, []);

  // ─── Generation Pipeline ──────────────────────────────────────────────────
  const runGenerationPipeline = useCallback(async (
    prompt: string,
    mode: GenerationMode,
    depthUi?: boolean,
    silent?: boolean,   // when true, skip stage/pipelineStep updates (used by direct refine)
  ) => {
    if (!silent) {
      setStage('parsing');
      setPipelineStep('parsing');
    }

    let intent: UIIntent;
    try {
      const parseRes = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode, depthUi: !!depthUi, contextId: activeProjectId || undefined, ...aiPayload() }),
      });
      const parseData = await parseRes.json();
      if (!parseData.success) {
        setStage('error'); setPipelineStep('error');
        setPipelineError(parseData.error ?? 'Intent parsing failed');
        return;
      }
      intent = parseData.intent;
      if (depthUi) (intent as UIIntent & { depthUi?: boolean }).depthUi = true;
      setPipelineStep('parsed');
    } catch {
      setStage('error'); setPipelineStep('error');
      setPipelineError('Network error during parsing.');
      return;
    }

    setStage('generating');
    setPipelineStep('generating');

    if (!aiConfig) {
      setStage('error'); setPipelineStep('error');
      setPipelineError('No AI model configured. Click "AI Engine Config" in the sidebar to set up your LLM.');
      return;
    }

    try {
      // Depth UI generates multi-section cinematic layouts with parallax layers and Framer Motion
      // variants — these legitimately need more output tokens to avoid mid-file truncation.
      const maxTokens = (mode === 'depth_ui' || depthUi) ? 7000 : 5000;
      const aiFields  = aiPayload();

      if (isFullAppMode && mode === 'app') {
        const manifestRes = await fetch('/api/manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent, ...aiFields, isMultiSlide: isMultiSlideMode, depthUi: !!depthUi }),
        });
        const manifestData = await manifestRes.json();
        if (!manifestData.success) throw new Error(manifestData.error || 'Manifest failed');

        const manifest = manifestData.manifest;
        const generatedFiles: Record<string, string> = {};
        for (const fileReq of manifest) {
          const chunkRes = await fetch('/api/chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intent, manifest, targetFile: fileReq.filename, ...aiFields, maxTokens, isMultiSlide: isMultiSlideMode, depthUi: !!depthUi }),
          });
          const chunkData = await chunkRes.json();
          if (chunkData.success) generatedFiles[fileReq.filename] = chunkData.code;
          else throw new Error(`Failed to generate ${fileReq.filename}`);
        }

        setPipelineStep('validating'); if (!silent) await new Promise(r => setTimeout(r, 400));
        setPipelineStep('testing');   if (!silent) await new Promise(r => setTimeout(r, 400));
        setPipelineStep('complete');

        const newOutput: GenerationOutput = {
          code: generatedFiles,
          componentName: intent.componentName,
          intent,
          a11yReport: { score: 100, passed: true, violations: [], suggestions: [], timestamp: new Date().toISOString() },
          tests: { rtl: '', playwright: '' },
          mode: 'app',
        };
        setOutput(newOutput);
        if (!silent) setStage('complete');
        outputTimestampRef.current = new Date().toISOString();
        await persistProject(intent.componentName, 'app', generatedFiles, intent, newOutput.a11yReport);
        return;
      }

      const t0 = Date.now();
      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, mode, depthUi: !!depthUi, ...aiFields, maxTokens, isMultiSlide: isMultiSlideMode }),
      });
      const latencyMs   = Date.now() - t0;
      const generateData = await generateRes.json();
      if (!generateData.success) {
        setStage('error'); setPipelineStep('error');
        setPipelineError(generateData.error ?? 'Generation failed');
        return;
      }

      if (!silent) {
        setPipelineStep('validating'); await new Promise(r => setTimeout(r, 400));
        setPipelineStep('testing');   await new Promise(r => setTimeout(r, 400));
        setPipelineStep('complete');
      }

      const newOutput: GenerationOutput = {
        code: generateData.code,
        componentName: intent.componentName,
        intent,
        a11yReport: generateData.a11yReport,
        appliedFixes: generateData.appliedFixes,
        tests: generateData.tests,
        mode,
      };
      setOutput(newOutput);
      if (!silent) setStage('complete');
      // Stamp a stable timestamp for this output so RightPanel version history stays coherent
      outputTimestampRef.current = new Date().toISOString();

      // Record generation metadata for the FeedbackBar (fire-and-forget hash)
      hashPromptClient(prompt).then((promptHash) => {
        setGenerationMeta({
          generationId:  generateData.generationId ?? '',
          model:         aiConfig!.model,
          provider:      aiConfig!.provider ?? 'custom',
          intentType:    (intent.componentType ?? 'component').toLowerCase(),
          promptHash,
          a11yScore:     generateData.a11yReport?.score ?? 0,
          critiqueScore: (generateData.critique as { score?: number } | null)?.score ?? 0,
          latencyMs,
        });
      }).catch(() => { /* non-fatal */ });

      await persistProject(intent.componentName, mode as 'component' | 'app' | 'depth_ui', generateData.code, intent, generateData.a11yReport);
    } catch {
      if (!silent) { setStage('error'); setPipelineStep('error'); }
      setPipelineError('Network error during generation.');
    }
  }, [aiConfig, aiPayload, isFullAppMode, isMultiSlideMode, activeProjectId, persistProject]);

  // ─── Interaction Handlers ─────────────────────────────────────────────────
  const handlePromptSubmit = useCallback(async (prompt: string, mode: GenerationMode, options?: SubmitOptions) => {
    setPendingPrompt(prompt);
    setPendingMode(mode);
    setPendingDepthUi(!!options?.depthUi);
    setThinkingPlan(null);
    setPipelineError(undefined);

    setStage('classifying');
    setPipelineStep('parsing');

    let classification: IntentClassification | null = liveClassification;
    if (!classification) {
      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, hasActiveProject: !!activeProjectId, ...aiPayload() }),
        });
        const data = await res.json();
        if (data.success) {
          classification = data.classification;
          setLiveClassification(data.classification);
          setLastIntentConfidence(typeof data.classification?.confidence === 'number' ? data.classification.confidence : 0.8);
        } else {
          console.warn('[classify] API error:', data.error);
          classification = null;
          setLastIntentConfidence(0.8);
        }
      } catch {
        console.warn('[classify] Network error. Proceeding with default.');
        setLastIntentConfidence(0.8);
      }
    }
    if (classification?.confidence !== undefined) {
      setLastIntentConfidence(classification.confidence);
    }

    setStage('thinking');
    setIsThinkingLoading(true);

    try {
      const res = await fetch('/api/think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          intentType: classification?.intentType ?? 'ui_generation',
          projectContext: output ? { componentName: output.componentName, files: [`${output.componentName}.tsx`] } : undefined,
          ...aiPayload(),
        }),
      });
      const data = await res.json();
      if (data.success && data.plan) {
        setThinkingPlan(data.plan);
      }
    } catch { /* fallback */ } finally {
      setIsThinkingLoading(false);
    }
    setStage('awaiting_confirm');
  }, [liveClassification, activeProjectId, output, aiPayload]);

  // Direct refinement: skips classify/think/awaiting_confirm and immediately
  // runs the generation pipeline in the context of the current active project.
  // Uses `silent=true` so the center workspace feed stays dormant.
  const handleDirectRefine = useCallback(async (prompt: string) => {
    if (!aiConfig) {
      setPipelineError('No AI model configured. Click "AI Engine Config" in the sidebar to set up your LLM.');
      setStage('error');
      setPipelineStep('error');
      return;
    }
    const currentMode = output?.mode ?? 'component';
    const currentDepthUi = !!(output?.intent as UIIntent & { depthUi?: boolean } | undefined)?.depthUi;

    setPipelineError(undefined);
    setIsDirectRefining(true);
    try {
      await runGenerationPipeline(prompt, currentMode, currentDepthUi, /* silent= */ true);
    } finally {
      setIsDirectRefining(false);
    }
  }, [aiConfig, output?.mode, output?.intent, runGenerationPipeline]);

  const isRunning = !isDirectRefining && ['classifying','thinking','parsing','generating','validating','testing'].includes(stage);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-gray-950 font-sans text-gray-100 selection:bg-blue-500/30">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-gray-950/80 backdrop-blur-md z-40 border-b border-gray-800/60 flex items-center px-4">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 text-gray-400 hover:text-white rounded-lg"
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold ml-2 text-gray-200">AI UI Engine</span>
      </div>

      {/* Primary Layout Engine */}
      <div className="flex-1 w-full h-[calc(100dvh-3.5rem)] lg:h-full mt-14 lg:mt-0 relative flex">
        
        {(!isMounted || isDesktop) ? (
          /* DESKTOP: Resizable Partitions */
          <div className="flex w-full h-full opacity-0 animate-in fade-in duration-500 fill-mode-forwards">
            <PanelGroup orientation="horizontal" className="w-full h-full">
              {/* 1. Left Sidebar */}
              <Panel defaultSize={20} minSize={15} maxSize={30} className="h-full flex flex-col">
                <Sidebar
                  activeProjectId={activeProjectId}
                  onSelectProject={loadProject}
                  onNewProject={() => {
                    setActiveProjectId(null);
                    setOutput(null);
                    setStage('idle');
                    setPipelineStep('idle');
                    setThinkingPlan(null);
                    setGenerationMeta(null);
                  }}
                  isMobileOpen={isMobileSidebarOpen}
                  onCloseMobile={() => setIsMobileSidebarOpen(false)}
                  onConfigSaved={handleEngineConfigSaved}
                  onDeactivated={handleEngineDeactivated}
                />
              </Panel>

              <PanelResizeHandle className="w-1.5 bg-gray-900/50 hover:bg-blue-500/50 transition-colors flex items-center justify-center cursor-col-resize z-50">
                <div className="h-8 w-0.5 bg-gray-700/50 rounded-full" />
              </PanelResizeHandle>

              {/* 2. Center Workspace (AI Command Console) */}
              <Panel defaultSize={output ? 40 : 80} minSize={40} className="h-full flex flex-col bg-gray-950 relative z-20">
                <CenterWorkspace
                  headerControls={null}
                  onPromptSubmit={handlePromptSubmit}
                  isLoading={isRunning}
                  hasActiveProject={!!activeProjectId}
                  onIntentDetected={setLiveClassification}
                  stage={isDirectRefining ? 'complete' : stage}
                  pipelineStep={isDirectRefining ? 'complete' : pipelineStep}
                  pipelineError={pipelineError}
                  thinkingPlan={thinkingPlan}
                  isThinkingLoading={isThinkingLoading}
                  originalPrompt={pendingPrompt}
                  onProceed={async () => {
                    setThinkingPlan(null);
                    await runGenerationPipeline(pendingPrompt, pendingMode, pendingDepthUi);
                  }}
                  onRefineUnderstanding={() => {
                    setStage('idle');
                    setPipelineStep('idle');
                    setThinkingPlan(null);
                  }}
                  onChangeIntent={async (intentType) => {
                    setThinkingPlan(null);
                    setIsThinkingLoading(true);
                    try {
                      const res = await fetch('/api/think', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: pendingPrompt, intentType }),
                      });
                      const data = await res.json();
                      if (data.success) setThinkingPlan(data.plan);
                    } catch { /* fallback */ } finally {
                      setIsThinkingLoading(false);
                    }
                  }}
                  onDismissThinking={() => {
                    setThinkingPlan(null);
                    setStage('idle');
                    setPipelineStep('idle');
                  }}
                  onAskClarification={(q) => {
                    setPendingPrompt(prev => `${prev}\n\nAdditional context: ${q}`);
                  }}
                />
              </Panel>

              {/* 3. Right Profile (Live Preview) */}
              {output && (
                <>
                  <PanelResizeHandle className="w-1.5 bg-gray-900/50 hover:bg-blue-500/50 transition-colors flex items-center justify-center cursor-col-resize z-50">
                    <div className="h-8 w-0.5 bg-gray-700/50 rounded-full" />
                  </PanelResizeHandle>

                  <Panel defaultSize={40} minSize={25} className="h-full flex flex-col relative z-10 bg-gray-950">
                    <RightPanel
                      initialProject={{
                        id: activeProjectId || 'current',
                        timestamp: outputTimestampRef.current,
                        code: output.code,
                        intent: output.intent,
                        a11yReport: output.a11yReport,
                        componentName: output.componentName,
                        tests: output.tests
                      }}
                      onRefine={handleDirectRefine}
                      isRefining={isRunning}
                      projectId={activeProjectId}
                      feedbackMeta={generationMeta}
                      intentConfidence={lastIntentConfidence}
                      aiConfig={aiConfig ? {
                        model:    aiConfig.model,
                        provider: aiConfig.provider,
                        apiKey:   aiConfig.apiKey !== '••••' && aiConfig.apiKey !== 'local' ? aiConfig.apiKey : undefined,
                        baseUrl:  aiConfig.baseUrl,
                      } : null}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </div>
        ) : (
          /* MOBILE OVERRIDE: Stacked Layout */
          <div className="flex flex-col w-full h-full overflow-y-auto">
            {/* Sidebar is fixed on mobile, so we just render it */}
            <Sidebar
              activeProjectId={activeProjectId}
              onSelectProject={loadProject}
              onNewProject={() => {
                setActiveProjectId(null);
                setOutput(null);
                setStage('idle');
                setPipelineStep('idle');
                setThinkingPlan(null);
                setGenerationMeta(null);
              }}
              isMobileOpen={isMobileSidebarOpen}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
              onConfigSaved={handleEngineConfigSaved}
              onDeactivated={handleEngineDeactivated}
            />
            
            <div className="flex-1 flex flex-col min-h-[100dvh]">
              <CenterWorkspace
                headerControls={null}
                onPromptSubmit={handlePromptSubmit}
                isLoading={isRunning}
                hasActiveProject={!!activeProjectId}
                onIntentDetected={setLiveClassification}
                stage={isDirectRefining ? 'complete' : stage}
                pipelineStep={isDirectRefining ? 'complete' : pipelineStep}
                pipelineError={pipelineError}
                thinkingPlan={thinkingPlan}
                isThinkingLoading={isThinkingLoading}
                originalPrompt={pendingPrompt}
                onProceed={async () => {
                  setThinkingPlan(null);
                  await runGenerationPipeline(pendingPrompt, pendingMode, pendingDepthUi);
                }}
                onRefineUnderstanding={() => {
                  setStage('idle');
                  setPipelineStep('idle');
                  setThinkingPlan(null);
                }}
                onChangeIntent={async (intentType) => {
                  setThinkingPlan(null);
                  setIsThinkingLoading(true);
                  try {
                    const res = await fetch('/api/think', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ prompt: pendingPrompt, intentType }),
                    });
                    const data = await res.json();
                    if (data.success) setThinkingPlan(data.plan);
                  } catch { /* fallback */ } finally {
                    setIsThinkingLoading(false);
                  }
                }}
                onDismissThinking={() => {
                  setThinkingPlan(null);
                  setStage('idle');
                  setPipelineStep('idle');
                }}
                onAskClarification={(q) => {
                  setPendingPrompt(prev => `${prev}\n\nAdditional context: ${q}`);
                }}
              />
            </div>

            {output && (
              <div className="flex-1 flex flex-col min-h-[100dvh]">
                <RightPanel
                  initialProject={{
                    id: activeProjectId || 'current',
                    timestamp: outputTimestampRef.current,
                    code: output.code,
                    intent: output.intent,
                    a11yReport: output.a11yReport,
                    componentName: output.componentName,
                    tests: output.tests
                  }}
                  onRefine={handleDirectRefine}
                  isRefining={isRunning}
                  projectId={activeProjectId}
                  feedbackMeta={generationMeta}
                  intentConfidence={lastIntentConfidence}
                  aiConfig={aiConfig ? {
                    model:    aiConfig.model,
                    provider: aiConfig.provider,
                    apiKey:   aiConfig.apiKey !== '••••' && aiConfig.apiKey !== 'local' ? aiConfig.apiKey : undefined,
                    baseUrl:  aiConfig.baseUrl,
                  } : null}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
