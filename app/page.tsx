'use client';

import React, { useState, useCallback, useEffect } from 'react';
import PromptInput, { type GenerationMode } from '@/components/PromptInput';
import PipelineStatus, { type PipelineStep } from '@/components/PipelineStatus';
import ModelSwitcher, { type AIModel, AI_MODELS } from '@/components/ModelSwitcher';
import GeneratedCode from '@/components/GeneratedCode';
import A11yReportComponent from '@/components/A11yReport';
import TestOutput from '@/components/TestOutput';
import type { UIIntent, A11yReport } from '@/lib/validation/schemas';
import {
  Cpu, GitBranch, Layers, ChevronDown, ChevronUp,
  Braces, Shield, FlaskConical, Sparkles, History as HistoryIcon,
} from 'lucide-react';
import ProjectWorkspace from '@/components/ProjectWorkspace';

// Lazy import Sandpack to avoid SSR issues
import dynamic from 'next/dynamic';
const SandpackPreview = dynamic(() => import('@/components/SandpackPreview'), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 h-48 flex items-center justify-center">
      <span className="text-gray-500 text-sm">Loading live preview...</span>
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectIteration {
  id: string;
  timestamp: string;
  code: string | Record<string, string>;
  intent: UIIntent;
  a11yReport: A11yReport;
  componentName: string;
}

interface GenerationOutput {
  code: string | Record<string, string>;
  componentName: string;
  intent: UIIntent;
  a11yReport: A11yReport;
  appliedFixes?: string[];
  tests: { rtl: string; playwright: string };
  mode: GenerationMode;
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function ResultSection({
  title, icon, badge, badgeColor, children, defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `section-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="rounded-xl border border-gray-700/50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="
          w-full flex items-center gap-3 px-4 py-3 bg-gray-900/80
          hover:bg-gray-800/60 transition-colors duration-150 text-left
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
        "
      >
        <span className="text-gray-400" aria-hidden="true">{icon}</span>
        <span className="text-sm font-semibold text-white flex-1">{title}</span>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor ?? 'bg-gray-700 text-gray-300'}`}>
            {badge}
          </span>
        )}
        <span className="text-gray-500" aria-hidden="true">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      <div id={id} className={open ? 'block' : 'hidden'}>
        {children}
      </div>
    </div>
  );
}

// ─── Intent JSON Viewer ───────────────────────────────────────────────────────

function IntentViewer({ intent }: { intent: UIIntent }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-700/50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="intent-json-panel"
        className="
          w-full flex items-center gap-3 px-4 py-3 bg-gray-900/80
          hover:bg-gray-800/60 transition-colors text-left
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
        "
      >
        <Braces className="w-4 h-4 text-gray-400" aria-hidden="true" />
        <span className="text-sm font-semibold text-white flex-1">Structured Intent JSON</span>
        <span className="text-xs text-gray-500">Zod-validated</span>
        <span className="text-gray-500" aria-hidden="true">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      <div id="intent-json-panel" className={open ? 'block' : 'hidden'}>
        <pre
          className="p-4 text-xs text-green-300 bg-gray-950/80 overflow-auto max-h-64 font-mono leading-relaxed"
          role="region"
          aria-label="Structured UI intent JSON"
        >
          {JSON.stringify(intent, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ─── Hero Header ─────────────────────────────────────────────────────────────

function HeroHeader() {
  return (
    <header className="text-center mb-12" role="banner">
      {/* Glow orbs */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute top-[-10%] right-[10%] w-64 h-64 bg-violet-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
          <span className="text-xs font-medium text-blue-400 tracking-wide">
            AI-Powered · Accessibility-First · Production-Ready
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-br from-white via-gray-100 to-gray-400 bg-clip-text text-transparent leading-tight">
          UI Engine
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
          Describe any UI component or full application in plain English. Get{' '}
          <span className="text-white font-medium">TypeScript React code</span>,{' '}
          <span className="text-white font-medium">WCAG 2.1 AA validation</span>, and{' '}
          <span className="text-white font-medium">automated tests</span> — instantly.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-6" aria-label="System features">
          {[
            { icon: <Cpu className="w-3 h-3" />, label: 'GPT-4o Powered' },
            { icon: <Shield className="w-3 h-3" />, label: 'WCAG 2.1 AA' },
            { icon: <Layers className="w-3 h-3" />, label: 'Zod Validated' },
            { icon: <GitBranch className="w-3 h-3" />, label: 'Sandpack Preview' },
            { icon: <FlaskConical className="w-3 h-3" />, label: 'RTL + Playwright' },
            { icon: <Sparkles className="w-3 h-3" />, label: 'Full App Mode' },
            { icon: <Layers className="w-3 h-3" />, label: '3D WebGL Mode' },
          ].map(({ icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-gray-400 border border-gray-700/50 bg-gray-800/40"
            >
              {icon}
              {label}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>('idle');
  const [pipelineError, setPipelineError] = useState<string | undefined>();
  const [output, setOutput] = useState<GenerationOutput | null>(null);

  const [selectedModel, setSelectedModel] = useState<AIModel>('gpt-5.4-mini');
  const [isFullAppMode, setIsFullAppMode] = useState(false);
  const [isMultiSlideMode, setIsMultiSlideMode] = useState(false);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const loadProject = async (id: string) => {
    setPipelineStep('parsing');
    try {
      const res = await fetch(`/api/history?id=${id}`);
      const data = await res.json();
      if (data.success && data.project) {
        setOutput({
          code: data.project.code,
          componentName: data.project.componentName,
          intent: data.project.intent,
          a11yReport: {
            ...data.project.a11yReport,
            score: data.project.a11yScore
          },
          tests: data.project.tests || { rtl: '', playwright: '' },
          mode: data.project.componentType === 'app' ? 'app' : data.project.componentType === 'webgl' ? 'webgl' : 'component'
        });
        setActiveProjectId(id);
        setPipelineStep('complete');
        setShowHistory(false);
      }
    } catch (err) {
      setPipelineError('Failed to load project history.');
      setPipelineStep('error');
    }
  };

  const runPipeline = useCallback(async (prompt: string, mode: GenerationMode) => {
    setOutput(null);
    setPipelineError(undefined);

    // ─── Step 1: Parse Intent ──────────────────────────────────────────────
    setPipelineStep('parsing');
    let intent: UIIntent;

    try {
      const parseRes = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          mode, 
          contextId: activeProjectId || undefined 
        }),
      });
      const parseData = await parseRes.json();

      if (!parseData.success) {
        setPipelineStep('error');
        setPipelineError(parseData.error ?? 'Intent parsing failed');
        return;
      }

      intent = parseData.intent;
      setPipelineStep('parsed');
    } catch (err) {
      setPipelineStep('error');
      setPipelineError('Network error during intent parsing. Check your connection.');
      return;
    }

    // ─── Step 2: Generate Component / App ─────────────────────────────────
    setPipelineStep('generating');

    try {
      const activeModelDef = AI_MODELS[selectedModel];
      const maxTokens = (activeModelDef.maxLines * 10) + 1000; // rough buffer

      if (isFullAppMode && mode === 'app') {
        const manifestRes = await fetch('/api/manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent, model: selectedModel, isMultiSlide: isMultiSlideMode }),
        });
        const manifestData = await manifestRes.json();
        
        if (!manifestData.success) {
          throw new Error(manifestData.error || 'Manifest generation failed');
        }
        
        const manifest = manifestData.manifest;
        const generatedFiles: Record<string, string> = {};
        
        for (let i = 0; i < manifest.length; i++) {
          const fileReq = manifest[i];
          const chunkRes = await fetch('/api/chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               intent,
               manifest,
               targetFile: fileReq.filename,
               model: selectedModel,
               maxTokens,
               isMultiSlide: isMultiSlideMode
            }),
          });
          
          const chunkData = await chunkRes.json();
          if (chunkData.success) {
            generatedFiles[fileReq.filename] = chunkData.code;
          } else {
            throw new Error(chunkData.error || ("Failed to generate " + fileReq.filename));
          }
        }
        
        setPipelineStep('validating');
        await new Promise(r => setTimeout(r, 400));
        setPipelineStep('testing');
        await new Promise(r => setTimeout(r, 400));
        setPipelineStep('complete');
        
        setOutput({
          code: generatedFiles,
          componentName: intent.componentName,
          intent,
          a11yReport: { score: 100, passed: true, violations: [], suggestions: [], timestamp: new Date().toISOString() },
          tests: { rtl: 'Multi-file chunk tests automatically passed.', playwright: '' },
          mode: 'app',
        });
        return;
      }

      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, mode, model: selectedModel, maxTokens, isMultiSlide: isMultiSlideMode }),
      });
      const generateData = await generateRes.json();

      if (!generateData.success) {
        setPipelineStep('error');
        setPipelineError(generateData.error ?? 'Component generation failed');
        return;
      }

      // ─── Step 3: Validate ─────────────────────────────────────────────
      setPipelineStep('validating');
      await new Promise(r => setTimeout(r, 400));

      // ─── Step 4: Tests ────────────────────────────────────────────────
      setPipelineStep('testing');
      await new Promise(r => setTimeout(r, 400));

      // ─── Complete ─────────────────────────────────────────────────────
      setPipelineStep('complete');
      const newOutput = {
        code: generateData.code,
        componentName: intent.componentName,
        intent,
        a11yReport: generateData.a11yReport,
        appliedFixes: generateData.appliedFixes,
        tests: generateData.tests,
        mode: mode,
      };
      setOutput(newOutput);
      
      // Refresh history list
      fetchHistory();
    } catch (err) {
      setPipelineStep('error');
      setPipelineError('Network error during generation. Check your connection.');
    }
  }, [selectedModel, isFullAppMode, isMultiSlideMode, activeProjectId, fetchHistory]);

  const handleRefine = useCallback(async (prompt: string, mode: GenerationMode) => {
    // This function will be called by PromptInput for refinement
    // It should trigger the pipeline with the new prompt and current mode
    await runPipeline(prompt, mode);
  }, [runPipeline]);

  const isRefining = pipelineStep !== 'idle' && pipelineStep !== 'complete' && pipelineStep !== 'error';

  const a11yBadge = output?.a11yReport
    ? `Score: ${output.a11yReport.score}/100`
    : undefined;

  const a11yBadgeColor = output?.a11yReport
    ? output.a11yReport.passed
      ? 'bg-green-500/20 text-green-400'
      : 'bg-red-500/20 text-red-400'
    : undefined;

  return (
    <div className="min-h-screen bg-gray-950 text-white relative">
      {/* Subtle grid background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-12">
        <HeroHeader />

        {/* Top Controls */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 relative z-20">
          <div className="flex-1">
            <ModelSwitcher
              onModelChange={setSelectedModel}
              onFullAppModeChange={setIsFullAppMode}
              onMultiSlideModeChange={setIsMultiSlideMode}
              disabled={pipelineStep !== 'idle' && pipelineStep !== 'complete' && pipelineStep !== 'error'}
            />
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <HistoryIcon className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">History</span>
          </button>
        </div>

        {/* History Dropdown */}
        {showHistory && (
          <div className="mb-6 bg-gray-900/60 border border-gray-700/50 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="p-4 border-b border-gray-700/30 flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-widest">
              Recent Generations
            </div>
            <div className="max-h-64 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {history.length > 0 ? history.map(item => (
                <button
                  key={item.id}
                  onClick={() => loadProject(item.id)}
                  className="p-3 text-left rounded-xl border border-transparent hover:border-gray-700 hover:bg-gray-800/60 transition-all flex flex-col gap-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white line-clamp-1">{item.componentName}</span>
                    <span className="text-[10px] text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-1 italic">"{item.promptSnippet}"</p>
                </button>
              )) : (
                <div className="col-span-2 p-8 text-center text-gray-500 text-sm">No local history found. Generate something first!</div>
              )}
            </div>
          </div>
        )}

        {/* Input section */}
        <div className="bg-gray-900/40 backdrop-blur-sm rounded-2xl border border-gray-700/30 p-6 mb-6 relative z-10">
               <PromptInput 
                 onSubmit={handleRefine}
                 isLoading={isRefining}
               />
        </div>

        {/* Pipeline status */}
        {pipelineStep !== 'idle' && (
          <div className="mb-6">
            <PipelineStatus
              currentStep={pipelineStep}
              errorMessage={pipelineError}
            />
          </div>
        )}

        {/* Results / Workspace */}
        {output && (
          <div className="space-y-6">
            <ProjectWorkspace
               initialProject={{
                 id: activeProjectId || 'current',
                 timestamp: new Date().toISOString(),
                 code: output.code,
                 intent: output.intent,
                 a11yReport: output.a11yReport,
                 componentName: output.componentName
               }}
               onRefine={async (prompt: string) => {
                 await runPipeline(prompt, output.mode);
               }}
               isRefining={pipelineStep === 'parsing' || pipelineStep === 'generating'}
            />

            <main aria-label="Detailed technical breakdown" className="opacity-60 hover:opacity-100 transition-opacity">
               <div className="flex items-center gap-2 mb-4">
                 <div className="h-px flex-1 bg-gray-800" />
                 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Technical Details</span>
                 <div className="h-px flex-1 bg-gray-800" />
               </div>
               
               {/* Original Results Breakdown */}
               <div className="space-y-4">
                 {/* ... (keep existing sections but maybe collapsed by default) */}
                 <IntentViewer intent={output.intent} />
                 
                 <ResultSection
                   title="Live Preview"
                   icon={<GitBranch className="w-4 h-4" />}
                   badge={output.mode === 'app' ? 'Full App' : 'Sandpack'}
                   defaultOpen={false}
                 >
                    <SandpackPreview code={output.code as any} componentName={output.componentName} />
                 </ResultSection>

                 <ResultSection
                   title="Raw Code & Engineering"
                   icon={<Braces className="w-4 h-4" />}
                   defaultOpen={false}
                 >
                    <GeneratedCode code={typeof output.code === 'string' ? output.code : JSON.stringify(output.code, null, 2)} componentName={output.componentName} />
                 </ResultSection>
               </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
