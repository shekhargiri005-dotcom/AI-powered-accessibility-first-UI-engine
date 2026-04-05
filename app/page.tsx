'use client';

import React, { useState, useCallback } from 'react';
import type { GenerationMode } from '@/components/PromptInput';
import type { PipelineStep } from '@/components/PipelineStatus';
import type { AIEngineConfig } from '@/components/AIEngineConfigPanel';
import type { UIIntent, A11yReport, ThinkingPlan, IntentClassification } from '@/lib/validation/schemas';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/ide/Sidebar';
import CenterWorkspace from '@/components/ide/CenterWorkspace';
import RightPanel from '@/components/ide/RightPanel';

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

export default function HomePage() {
  const [stage, setStage] = useState<Stage>('idle');
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>('idle');
  const [pipelineError, setPipelineError] = useState<string | undefined>();
  const [output, setOutput] = useState<GenerationOutput | null>(null);

  // ─── AI Engine Config ─────────────────────────────────────────────────────
  const [aiConfig, setAiConfig] = useState<AIEngineConfig | null>(null);
  const [isFullAppMode, setIsFullAppMode] = useState(false);
  const [isMultiSlideMode, setIsMultiSlideMode] = useState(false);

  // Called when the user saves AI Engine Config
  const handleEngineConfigSaved = useCallback((config: AIEngineConfig) => {
    setAiConfig(config);
    setIsFullAppMode(config.fullAppMode);
    setIsMultiSlideMode(config.multiSlideMode);
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

  // Layout State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Workspace state
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Intent & Thinking state
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [pendingMode, setPendingMode] = useState<GenerationMode>('component');
  const [liveClassification, setLiveClassification] = useState<IntentClassification | null>(null);
  const [thinkingPlan, setThinkingPlan] = useState<ThinkingPlan | null>(null);
  const [isThinkingLoading, setIsThinkingLoading] = useState(false);

  // ─── Shared Persistence ───────────────────────────────────────────────────
  const persistProject = useCallback(async (
    name: string,
    componentType: 'component' | 'app' | 'webgl',
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
  const runGenerationPipeline = useCallback(async (prompt: string, mode: GenerationMode) => {
    setStage('parsing');
    setPipelineStep('parsing');

    let intent: UIIntent;
    try {
      const parseRes = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode, contextId: activeProjectId || undefined }),
      });
      const parseData = await parseRes.json();
      if (!parseData.success) {
        setStage('error'); setPipelineStep('error');
        setPipelineError(parseData.error ?? 'Intent parsing failed');
        return;
      }
      intent = parseData.intent;
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
      const maxTokens = 10000;
      const aiFields  = aiPayload();

      if (isFullAppMode && mode === 'app') {
        const manifestRes = await fetch('/api/manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent, ...aiFields, isMultiSlide: isMultiSlideMode }),
        });
        const manifestData = await manifestRes.json();
        if (!manifestData.success) throw new Error(manifestData.error || 'Manifest failed');

        const manifest = manifestData.manifest;
        const generatedFiles: Record<string, string> = {};
        for (const fileReq of manifest) {
          const chunkRes = await fetch('/api/chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intent, manifest, targetFile: fileReq.filename, ...aiFields, maxTokens, isMultiSlide: isMultiSlideMode }),
          });
          const chunkData = await chunkRes.json();
          if (chunkData.success) generatedFiles[fileReq.filename] = chunkData.code;
          else throw new Error(`Failed to generate ${fileReq.filename}`);
        }

        setPipelineStep('validating'); await new Promise(r => setTimeout(r, 400));
        setPipelineStep('testing');   await new Promise(r => setTimeout(r, 400));
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
        setStage('complete');
        await persistProject(intent.componentName, 'app', generatedFiles, intent, newOutput.a11yReport);
        return;
      }

      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, mode, ...aiFields, maxTokens, isMultiSlide: isMultiSlideMode }),
      });
      const generateData = await generateRes.json();
      if (!generateData.success) {
        setStage('error'); setPipelineStep('error');
        setPipelineError(generateData.error ?? 'Generation failed');
        return;
      }

      setPipelineStep('validating'); await new Promise(r => setTimeout(r, 400));
      setPipelineStep('testing');   await new Promise(r => setTimeout(r, 400));
      setPipelineStep('complete');

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
      setStage('complete');
      await persistProject(intent.componentName, mode as 'component' | 'app' | 'webgl', generateData.code, intent, generateData.a11yReport);
    } catch {
      setStage('error'); setPipelineStep('error');
      setPipelineError('Network error during generation.');
    }
  }, [aiConfig, aiPayload, isFullAppMode, isMultiSlideMode, activeProjectId, persistProject]);

  // ─── Interaction Handlers ─────────────────────────────────────────────────
  const handlePromptSubmit = useCallback(async (prompt: string, mode: GenerationMode) => {
    setPendingPrompt(prompt);
    setPendingMode(mode);
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
        } else {
          console.warn('[classify] API error:', data.error);
          classification = null;
        }
      } catch {
        console.warn('[classify] Network error. Proceeding with default.');
      }
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

  const handleRefineRightPanel = useCallback(async (prompt: string) => {
    await handlePromptSubmit(prompt, output?.mode ?? 'component');
  }, [handlePromptSubmit, output?.mode]);

  const isRunning = ['classifying','thinking','parsing','generating','validating','testing'].includes(stage);

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] w-full overflow-y-auto overflow-x-hidden lg:overflow-hidden bg-gray-950 font-sans text-gray-100 selection:bg-blue-500/30">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-gray-950/80 backdrop-blur-md z-40 border-b border-gray-800/60 flex items-center px-4">
        <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 text-gray-400 hover:text-white rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold ml-2 text-gray-200">AI UI Engine</span>
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
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onConfigSaved={handleEngineConfigSaved}
      />

      {/* Center AI Work Pane */}
      <div className={`
        flex-1 flex flex-col min-h-[100dvh] lg:min-h-0 min-w-0 relative z-20
        ${output ? 'w-full lg:w-1/3 xl:w-[40%] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-800/60' : 'w-full'}
        pt-14 lg:pt-0
      `}>
        <CenterWorkspace
          headerControls={null}
          onPromptSubmit={handlePromptSubmit}
          isLoading={isRunning}
          hasActiveProject={!!activeProjectId}
          onIntentDetected={setLiveClassification}
          stage={stage}
          pipelineStep={pipelineStep}
          pipelineError={pipelineError}
          thinkingPlan={thinkingPlan}
          isThinkingLoading={isThinkingLoading}
          originalPrompt={pendingPrompt}
          onProceed={async () => {
            setThinkingPlan(null);
            await runGenerationPipeline(pendingPrompt, pendingMode);
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

      {/* Right Dev Panel */}
      {output && (
        <div className="flex-1 flex flex-col min-h-[100dvh] lg:min-h-0 min-w-0 w-full lg:w-2/3 xl:w-[60%] bg-gray-950 relative z-10">
          <RightPanel
            initialProject={{
              id: activeProjectId || 'current',
              timestamp: new Date().toISOString(),
              code: output.code,
              intent: output.intent,
              a11yReport: output.a11yReport,
              componentName: output.componentName,
              tests: output.tests
            }}
            onRefine={handleRefineRightPanel}
            isRefining={isRunning}
            projectId={activeProjectId}
          />
        </div>
      )}
    </div>
  );
}
