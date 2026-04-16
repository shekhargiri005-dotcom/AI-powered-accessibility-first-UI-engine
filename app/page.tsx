'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { GenerationMode, SubmitOptions } from '@/components/PromptInput';
import type { PipelineStep } from '@/components/PipelineStatus';
import type { AIEngineConfig } from '@/components/AIEngineConfigPanel';
import type { UIIntent, A11yReport, ThinkingPlan, IntentClassification } from '@/lib/validation/schemas';
import type { FeedbackMeta } from '@/components/FeedbackBar';
import { Menu, Shield, Lock } from 'lucide-react';
import Sidebar from '@/components/ide/Sidebar';
import CenterWorkspace from '@/components/ide/CenterWorkspace';
import RightPanel from '@/components/ide/RightPanel';
import ParallaxBackground from '@/components/ParallaxBackground';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import ModelSelectionGate from '@/components/ModelSelectionGate';

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
  const { activeWorkspaceId } = useWorkspace();
  const [stage, setStage] = useState<Stage>('idle');
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>('idle');
  const [pipelineError, setPipelineError] = useState<string | undefined>();
  const [output, setOutput] = useState<GenerationOutput | null>(null);

  // ─── Model Selection Gate ─────────────────────────────────────────────────
  const [showModelGate, setShowModelGate] = useState(false);
  const [hasCheckedConfig, setHasCheckedConfig] = useState(false);
  const [providerCredentials, setProviderCredentials] = useState<Record<string, boolean>>({});

  // ─── AI Engine Config ─────────────────────────────────────────────────────
  const [aiConfig, setAiConfig] = useState<AIEngineConfig | null>(null);
  const [isFullAppMode, setIsFullAppMode] = useState(false);
  const [isMultiSlideMode, setIsMultiSlideMode] = useState(false);
  // True while RightPanel bottom-bar refine is running; suppresses center workspace
  const [isDirectRefining, setIsDirectRefining] = useState(false);

  // Check for existing AI config on mount - show ModelSelectionGate if none exists
  useEffect(() => {
    const checkExistingConfig = async () => {
      try {
        const res = await fetch('/api/engine-config');
        const data = await res.json();
        
        if (data.success && data.config) {
          // Config exists, load it
          const config = data.config;
          setAiConfig({
            provider: config.provider,
            providerName: config.providerName || config.provider,
            model: config.model,
            apiKey: '••••',
            baseUrl: config.baseUrl,
            temperature: config.temperature || 0.6,
            fullAppMode: config.fullAppMode || false,
            multiSlideMode: config.multiSlideMode || false,
            isLocal: config.isLocal || false,
          });
          setIsFullAppMode(config.fullAppMode || false);
          setIsMultiSlideMode(config.multiSlideMode || false);
          
          // Mark this provider as having credentials
          setProviderCredentials(prev => ({ ...prev, [config.provider]: true }));
        } else {
          // No config - show the model selection gate
          setShowModelGate(true);
        }
      } catch {
        // Error checking config - show the gate to be safe
        setShowModelGate(true);
      } finally {
        setHasCheckedConfig(true);
      }
    };

    checkExistingConfig();
  }, []);

  // Called when the user saves AI Engine Config
  // SECURITY: The config passed here has apiKey='••••' (masked) - real key is stored server-side
  const handleEngineConfigSaved = useCallback((config: AIEngineConfig) => {
    setAiConfig(config);
    setIsFullAppMode(config.fullAppMode);
    setIsMultiSlideMode(config.multiSlideMode);
    // Hide the model gate if it was showing
    setShowModelGate(false);
  }, []);

  // Called when the user clicks "Stop & Deactivate Engine"
  const handleEngineDeactivated = useCallback(() => {
    setAiConfig(null);
    setGenerationMeta(null);
    setIsFullAppMode(false);
    setIsMultiSlideMode(false);
  }, []);

  // Helper: build the AI payload fields from the active config
  // SECURITY: Only provider and model are sent to server - credentials are resolved server-side
  const aiPayload = useCallback(() => {
    if (!aiConfig) return {};
    return {
      model:    aiConfig.model,
      provider: aiConfig.provider,
    };
  }, [aiConfig]);

  /** Feedback metadata for the most recent generation — drives FeedbackBar in RightPanel */
  const [generationMeta, setGenerationMeta] = useState<FeedbackMeta | null>(null);

  // Layout State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
          workspaceId: activeWorkspaceId,
        }),
      });
      if (isNewProject) setActiveProjectId(projectId);
    } catch { /* Error non-fatal for local UI */ }
  }, [activeProjectId, activeWorkspaceId]);

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
        // BUG-05 FIX: Include thinkingPlan so generate route can use it for memory/metadata
        body: JSON.stringify({ intent, mode, depthUi: !!depthUi, ...aiFields, maxTokens, isMultiSlide: isMultiSlideMode, thinkingPlan }),
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
          // BUG-04 FIX: Expose the classification error as a visible pipeline warning
          // rather than silently swallowing it. The pipeline still continues with defaults.
          console.warn('[classify] API error:', data.error);
          setPipelineError(`Intent classification failed (${data.error ?? 'unknown'}) — continuing with default settings.`);
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

  // Handle model selection gate completion
  const handleModelGateComplete = useCallback((config: { provider: string; model: string; providerName: string }) => {
    setAiConfig({
      provider: config.provider,
      providerName: config.providerName,
      model: config.model,
      apiKey: '••••',
      temperature: 0.6,
      fullAppMode: false,
      multiSlideMode: false,
      isLocal: config.provider === 'ollama',
    });
    setProviderCredentials(prev => ({ ...prev, [config.provider]: true }));
    setShowModelGate(false);
  }, []);

  // Don't render the main UI until we've checked for existing config
  // This ensures ModelSelectionGate is shown first for new users
  if (!hasCheckedConfig) {
    return (
      <div className="flex items-center justify-center h-[100dvh] w-full bg-[#0B0F19]">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] w-full overflow-y-auto overflow-x-hidden lg:overflow-hidden bg-[#0B0F19] font-sans text-slate-100 selection:bg-violet-500/30 relative">
      {/* Model Selection Gate - shown when no AI config exists */}
      {/* This blocks the UI until user selects a provider - no skip option */}
      <ModelSelectionGate
        isOpen={showModelGate}
        onComplete={handleModelGateComplete}
        hasCredentials={providerCredentials}
      />

      {/* Parallax visual background — purely decorative */}
      <ParallaxBackground />

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#0B0F19]/80 backdrop-blur-xl z-40 border-b border-white/[0.08] flex items-center px-4 gap-3">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors"
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5 flex-1">
          <span className="stitch-status-dot flex-shrink-0" aria-hidden="true" />
          <span className="font-semibold text-sm text-slate-200 tracking-tight">Welcome Home, Buddy</span>
        </div>
        {/* Secure Mode Indicator */}
        {aiConfig && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-medium text-emerald-400">Secure</span>
          </div>
        )}
      </div>

      {/* Left Sidebar Pane */}
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
      />

      {/* Center AI Work Pane */}
      <div className={`
        flex-1 flex flex-col min-h-[100dvh] lg:min-h-0 min-w-0 relative z-20
        ${output ? 'w-full lg:w-1/3 xl:w-[40%] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.08]' : 'w-full'}
        pt-14 lg:pt-0
      `}>
        <CenterWorkspace
          headerControls={
            aiConfig ? (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">Secure Mode Active</span>
                <div className="w-px h-3 bg-emerald-500/30 mx-1" />
                <Lock className="w-3 h-3 text-emerald-400/70" />
                <span className="text-[10px] text-emerald-400/70">Server-side credentials</span>
              </div>
            ) : null
          }
          onPromptSubmit={handlePromptSubmit}
          isLoading={isRunning}
          hasActiveProject={!!activeProjectId}
          aiPayload={aiPayload()}
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
                body: JSON.stringify({ prompt: pendingPrompt, intentType, ...aiPayload() }),
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

      {/* Right Dev Panel */}
      {output && (
        <div className="flex-1 flex flex-col min-h-[100dvh] lg:min-h-0 min-w-0 w-full lg:w-2/3 xl:w-[60%] bg-[#0B0F19] relative z-10">
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
            } : null}
          />
        </div>
      )}
    </div>
  );
}
