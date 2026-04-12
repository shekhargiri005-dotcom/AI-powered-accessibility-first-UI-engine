'use client';

import React, { useRef, useEffect } from 'react';
import { Sparkles, Brain, Cpu, MessageSquare, RefreshCw } from 'lucide-react';
import PromptInput, { type GenerationMode, type SubmitOptions } from '@/components/PromptInput';
import ThinkingPanel from '@/components/ThinkingPanel';
import PipelineStatus from '@/components/PipelineStatus';
import type {
  ThinkingPlan,
  IntentClassification
} from '@/lib/validation/schemas';
import type { PipelineStep } from '@/components/PipelineStatus';

interface CenterWorkspaceProps {
  onPromptSubmit: (prompt: string, mode: GenerationMode, options?: SubmitOptions) => void;
  isLoading: boolean;
  hasActiveProject: boolean;
  aiPayload?: Record<string, any>;
  onIntentDetected: (classification: IntentClassification | null) => void;
  stage: string;
  pipelineStep: PipelineStep;
  pipelineError?: string;
  thinkingPlan: ThinkingPlan | null;
  isThinkingLoading: boolean;
  onProceed: () => void;
  onRefineUnderstanding: () => void;
  onChangeIntent: (intentType: string) => void;
  onDismissThinking: () => void;
  onAskClarification: (q: string) => void;
  originalPrompt: string;
  headerControls?: React.ReactNode;
}

export default function CenterWorkspace({
  onPromptSubmit,
  isLoading,
  hasActiveProject,
  aiPayload,
  onIntentDetected,
  stage,
  pipelineStep,
  pipelineError,
  thinkingPlan,
  isThinkingLoading,
  onProceed,
  onRefineUnderstanding,
  onChangeIntent,
  onDismissThinking,
  onAskClarification,
  originalPrompt,
  headerControls
}: CenterWorkspaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when feed content changes
  useEffect(() => {
    if (scrollRef.current && (isThinkingLoading || thinkingPlan || stage !== 'idle')) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [isThinkingLoading, thinkingPlan, stage, pipelineStep]);

  const showFeed = stage !== 'idle' || isThinkingLoading || thinkingPlan !== null;

  // Prompt is visible inside the feed when waiting for user action (not while pipeline is running)
  const showPromptInFeed = showFeed && ['idle', 'awaiting_confirm', 'error', 'complete'].includes(stage);

  const promptBlock = (
    <div className="w-full max-w-3xl mx-auto">
      <PromptInput
        onSubmit={onPromptSubmit}
        isLoading={isLoading}
        aiPayload={aiPayload}
        onIntentDetected={onIntentDetected}
        hasActiveProject={hasActiveProject}
      />
      <div className="text-center mt-3">
        <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1.5">
          <Brain className="w-3 h-3 text-violet-500/50" />
          AI UI Engine intelligently classifies requests. Use <b>Shift + Enter</b> for new lines.
        </p>
      </div>
    </div>
  );

  return (
    <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#0B0F19]/70 relative">
      {/* Violet orb glow â€” primary focal area */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-8%] left-[10%] w-[600px] h-[600px] stitch-parallax-layer"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0.03) 50%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] stitch-parallax-layer"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(109,40,217,0.08) 0%, transparent 65%)',
          }}
        />
      </div>

      {/* Header */}
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#0B0F19]/80 backdrop-blur-xl z-30 gap-4 relative">
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2 border border-violet-500/20 bg-violet-500/10 rounded-xl">
            <Cpu className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-200">AI Command Console</h1>
            <p className="text-[10px] text-slate-600">Interactive Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end flex-1">
          {headerControls}
          {stage === 'generating' && (
            <span className="flex items-center gap-2 text-xs text-violet-400 bg-violet-500/10 px-3 py-1.5 rounded-full border border-violet-500/20 animate-pulse shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              Synthesizing UI...
            </span>
          )}
        </div>
      </header>

      {/* Scrollable Feed â€” contains all content including prompt input */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 p-6 scrollbar-hide flex flex-col relative z-0"
      >
        {!showFeed ? (
          /* â”€â”€ Idle / Empty State: "Welcome Home, Buddy" greeting â”€â”€ */
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto gap-6">
            <div>
              {/* Greeting with status dot */}
              <div className="flex items-center justify-center gap-2.5 mb-5">
                <span className="stitch-status-dot" aria-label="Online" />
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Welcome Home, <span className="text-violet-400">Buddy</span>
                </h2>
              </div>

              {/* Icon orb */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-900/60 to-purple-900/40 border border-violet-500/20 flex items-center justify-center mb-6 shadow-2xl shadow-violet-500/10 mx-auto">
                <Sparkles className="w-8 h-8 text-violet-400/80" />
              </div>

              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Describe a new app idea, a complex UI component, or select a workspace to continue engineering.
              </p>

              {/* Suggestion cards â€” frosted glass with hover translate */}
              <div className="grid grid-cols-2 gap-3 w-full mb-8">
                {[
                  "Build a modern SaaS dashboard",
                  "Create a dark-mode portfolio",
                  "Design a crypto trading hero",
                  "Generate a visually rich Depth UI landing page"
                ].map(sug => (
                  <button
                    key={sug}
                    onClick={() => onPromptSubmit(sug, 'component')}
                    className="
                      p-3 text-left rounded-2xl border border-white/[0.08]
                      bg-white/[0.03] backdrop-blur-sm
                      hover:bg-violet-500/10 hover:border-violet-500/25
                      hover:-translate-y-1 hover:shadow-lg hover:shadow-violet-500/10
                      active:scale-[0.98]
                      text-xs text-slate-500 hover:text-slate-200
                      transition-all duration-300 ease-out
                    "
                  >
                    <MessageSquare className="w-3.5 h-3.5 mb-2 text-violet-500/50" />
                    {sug}
                  </button>
                ))}
              </div>
            </div>
            {/* Prompt box flows under the suggestions on the idle screen */}
            {promptBlock}
          </div>
        ) : (
          /* â”€â”€ Active Feed: prompt flows at the bottom below thinking panel â”€â”€ */
          <div className="max-w-3xl mx-auto w-full space-y-6 pb-4">
            {/* User Prompt Bubble */}
            {originalPrompt && (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-violet-600/10 border border-violet-500/20 text-violet-100 px-5 py-3.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                  {originalPrompt}
                </div>
              </div>
            )}

            {/* Error Message */}
            {stage === 'error' && pipelineError && (
              <div className="p-4 rounded-2xl border border-red-500/25 bg-red-500/[0.08] backdrop-blur-sm text-sm text-red-300 shadow-lg flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="font-semibold text-red-400 mb-1 tracking-wide uppercase text-[10px]">Pipeline Error</div>
                  {pipelineError}
                </div>
                <button
                  onClick={() => onPromptSubmit(originalPrompt, 'component')}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-100 text-xs font-semibold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            )}

            {/* AI Thinking Panel */}
            {(isThinkingLoading || thinkingPlan) && !['complete', 'error'].includes(stage) && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ThinkingPanel
                  plan={thinkingPlan}
                  isLoading={isThinkingLoading}
                  onProceed={onProceed}
                  onRefineUnderstanding={onRefineUnderstanding}
                  onChangeIntent={onChangeIntent}
                  onDismiss={onDismissThinking}
                  onAskClarification={onAskClarification}
                  originalPrompt={originalPrompt}
                />
              </div>
            )}

            {/* Generating / Pipeline Status */}
            {pipelineStep !== 'idle' && !isThinkingLoading && !['complete', 'error', 'awaiting_confirm'].includes(stage) && (
              <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <PipelineStatus currentStep={pipelineStep} errorMessage={pipelineError} />
              </div>
            )}

            {/* Prompt input â€” visible below the thinking panel when awaiting user action */}
            {showPromptInFeed && (
              <div className="pt-2 animate-in fade-in duration-300">
                {promptBlock}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

