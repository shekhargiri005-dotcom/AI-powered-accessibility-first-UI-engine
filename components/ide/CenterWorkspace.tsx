'use client';

import React, { useRef, useEffect } from 'react';
import { Sparkles, Brain, Cpu, MessageSquare, RefreshCw, User, Bot } from 'lucide-react';
import { PromptInput } from '@/components/prompt-input';
import type { GenerationMode, SubmitOptions } from '@/components/prompt-input';
import ThinkingPanel from '@/components/ThinkingPanel';
import PipelineStatus from '@/components/PipelineStatus';
import type {
  ThinkingPlan,
  IntentClassification
} from '@/lib/validation/schemas';
import type { PipelineStep } from '@/components/PipelineStatus';
import { useProviderTheme } from '@/lib/hooks/useProviderTheme';

// ─── Chat Message Types ────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type: 'prompt' | 'result' | 'error' | 'refine';
}

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
  chatMessages: ChatMessage[];
  provider?: string | null;
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
  headerControls,
  chatMessages,
  provider,
}: CenterWorkspaceProps) {
  const t = useProviderTheme(provider);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isUserScrolledUp.current = scrollTop + clientHeight < scrollHeight - 50;
  };

  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUp.current && (isThinkingLoading || thinkingPlan || stage !== 'idle')) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [isThinkingLoading, thinkingPlan, stage, pipelineStep, chatMessages]);

  const showFeed = stage !== 'idle' || isThinkingLoading || thinkingPlan !== null || chatMessages.length > 0;

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
          <Brain className={`w-3 h-3 ${t.textFaint}`} />
          AI UI Engine intelligently classifies requests. Use <b>Shift + Enter</b> for new lines.
        </p>
      </div>
    </div>
  );

  return (
    <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#0B0F19]/70 relative">
      {/* Provider-colored orb glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-8%] left-[10%] w-[600px] h-[600px] stitch-parallax-layer"
          style={{
            background: `radial-gradient(ellipse at center, ${t.radialOrb} 0%, ${t.radialOrbMid} 50%, transparent 70%)`,
          }}
        />
        <div
          className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] stitch-parallax-layer"
          style={{
            background: `radial-gradient(ellipse at center, ${t.radialOrb} 0%, transparent 65%)`,
          }}
        />
      </div>

      {/* Header */}
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#0B0F19]/80 backdrop-blur-xl z-30 gap-4 relative">
        <div className="flex items-center gap-3 shrink-0">
          <div className={`p-2 border ${t.border} ${t.bgLight} rounded-xl`}>
            <Cpu className={`w-5 h-5 ${t.textPrimary}`} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-200">AI Chat</h1>
            <p className={`text-[10px] ${t.textMuted}`}>{t.name} Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end flex-1">
          {headerControls}
          {stage === 'generating' && (
            <span className={`flex items-center gap-2 text-xs ${t.textPrimary} ${t.bgLight} px-3 py-1.5 rounded-full border ${t.border} animate-pulse shrink-0`}>
              <Sparkles className="w-3.5 h-3.5" />
              Synthesizing UI...
            </span>
          )}
        </div>
      </header>

      {/* Scrollable Feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto min-h-0 p-6 flex flex-col relative z-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:${t.scrollbar} [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:${t.scrollbarHover} transition-all`}
      >
        {!showFeed ? (
          /* ── Idle / Empty State ── */
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto gap-6">
            <div>
              <div className="flex items-center justify-center gap-2.5 mb-5">
                <span className="stitch-status-dot" aria-label="Online" />
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Welcome Home, <span className={t.textPrimary}>Buddy</span>
                </h2>
              </div>

              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${t.gradient} p-[1px] shadow-2xl ${t.shadow} mb-6 mx-auto`}>
                <div className="w-full h-full bg-[#0B0F19]/90 rounded-[15px] flex items-center justify-center">
                  <Sparkles className={`w-8 h-8 ${t.textPrimary}`} />
                </div>
              </div>

              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Describe a new app idea, a complex UI component, or select a workspace to continue engineering.
              </p>

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
                    className={`
                      p-3 text-left rounded-2xl border border-white/[0.08]
                      bg-white/[0.03] backdrop-blur-sm
                      hover:${t.bgLight} hover:${t.borderActive}
                      hover:scale-[1.03] hover:shadow-lg ${t.shadow}
                      active:scale-[0.98]
                      text-xs text-slate-500 hover:text-slate-200
                      transition-all duration-200 ease-out
                    `}
                  >
                    <MessageSquare className={`w-3.5 h-3.5 mb-2 ${t.textFaint}`} />
                    {sug}
                  </button>
                ))}
              </div>
            </div>
            {promptBlock}
          </div>
        ) : (
          /* ── Active Chat Thread ── */
          <div className="max-w-3xl mx-auto w-full space-y-4 pb-4">
            {/* Chat message history */}
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div className={`flex items-start gap-2.5 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    msg.role === 'user'
                      ? `${t.bgMedium} border ${t.border}`
                      : 'bg-slate-500/20 border border-slate-500/30'
                  }`}>
                    {msg.role === 'user'
                      ? <User className={`w-3.5 h-3.5 ${t.textPrimary}`} />
                      : <Bot className="w-3.5 h-3.5 text-slate-400" />
                    }
                  </div>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all duration-200 hover:shadow-md ${
                    msg.role === 'user'
                      ? `${t.bgLight} border ${t.border} text-slate-100 rounded-tr-sm`
                      : msg.type === 'error'
                        ? 'bg-red-500/[0.08] border border-red-500/25 text-red-300 rounded-tl-sm'
                        : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

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

            {/* Prompt input always visible at bottom of chat */}
            <div className="pt-2 animate-in fade-in duration-300">
              {promptBlock}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
