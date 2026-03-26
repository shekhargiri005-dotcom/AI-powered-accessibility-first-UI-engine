'use client';

import React, { useRef, useEffect } from 'react';
import { Sparkles, Brain, Cpu, MessageSquare } from 'lucide-react';
import PromptInput, { type GenerationMode } from '@/components/PromptInput';
import ThinkingPanel from '@/components/ThinkingPanel';
import PipelineStatus from '@/components/PipelineStatus';
import type { 
  ThinkingPlan, 
  IntentClassification 
} from '@/lib/validation/schemas';
import type { PipelineStep } from '@/components/PipelineStatus';

interface CenterWorkspaceProps {
  // Input
  onPromptSubmit: (prompt: string, mode: GenerationMode) => void;
  isLoading: boolean;
  hasActiveProject: boolean;
  onIntentDetected: (classification: IntentClassification | null) => void;
  // State
  stage: string;
  pipelineStep: PipelineStep;
  pipelineError?: string;
  // Thinking
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

  // Auto-scroll to bottom of the feed when thinking or pipeline active
  useEffect(() => {
    if (scrollRef.current && (isThinkingLoading || thinkingPlan || stage !== 'idle')) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [isThinkingLoading, thinkingPlan, stage, pipelineStep]);

  const showFeed = stage !== 'idle' || isThinkingLoading || thinkingPlan !== null;

  return (
    <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-950/60 relative">
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between px-6 py-4 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-md z-30 gap-4 relative">
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2 border border-blue-500/20 bg-blue-500/10 rounded-xl">
            <Cpu className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-200">AI Command Console</h1>
            <p className="text-[10px] text-gray-500">Interactive Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end flex-1">
          {headerControls}
          {stage === 'generating' && (
            <span className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20 animate-pulse shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              Synthesizing UI...
            </span>
          )}
        </div>
      </header>

      {/* Scrollable Feed Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 scrollbar-hide flex flex-col relative z-0"
      >
        {!showFeed ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto mb-12 flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-gray-800 to-gray-900 border border-gray-700/50 flex items-center justify-center mb-6 shadow-2xl">
              <Sparkles className="w-8 h-8 text-blue-400/80" />
            </div>
            <h2 className="text-xl font-bold text-gray-200 mb-2">What are we building today?</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              Describe a new app idea, a complex UI component, or select a workspace to continue engineering.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full">
              {[
                "Build a modern SaaS dashboard",
                "Create a dark-mode portfolio",
                "Design a crypto trading hero",
                "Make an interactive WebGL scene"
              ].map(sug => (
                <button 
                  key={sug}
                  onClick={() => onPromptSubmit(sug, 'component')}
                  className="p-3 text-left rounded-xl border border-gray-800/60 bg-gray-900/30 hover:bg-gray-800 hover:border-gray-700 text-xs text-gray-400 hover:text-gray-200 transition-all duration-200"
                >
                  <MessageSquare className="w-3.5 h-3.5 mb-2 opacity-50" />
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full space-y-6 pb-4 flex-shrink-0">
            {/* User Prompt Bubble */}
            {originalPrompt && (
              <div className="flex justify-end mb-6">
                <div className="max-w-[85%] bg-blue-600/10 border border-blue-500/20 text-blue-100 px-5 py-3.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                  {originalPrompt}
                </div>
              </div>
            )}

            {/* Error Message */}
            {stage === 'error' && pipelineError && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-300 shadow-lg mb-4">
                <div className="font-semibold text-red-400 mb-1 tracking-wide uppercase text-[10px]">Pipeline Error</div>
                {pipelineError}
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
          </div>
        )}
      </div>

      {/* Input Area (Pinned to bottom) */}
      <div className="flex-shrink-0 p-6 pt-0 relative z-10 max-w-4xl mx-auto w-full">
        <PromptInput
          onSubmit={onPromptSubmit}
          isLoading={isLoading}
          onIntentDetected={onIntentDetected}
          hasActiveProject={hasActiveProject}
        />
        <div className="text-center mt-3">
          <p className="text-[10px] text-gray-600 flex items-center justify-center gap-1.5">
            <Brain className="w-3 h-3 text-blue-500/50" />
            AI UI Engine intelligently classifies requests. Use <b>Shift + Enter</b> for new lines.
          </p>
        </div>
      </div>
    </main>
  );
}
