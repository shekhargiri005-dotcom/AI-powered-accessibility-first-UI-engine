'use client';

import React, { useState } from 'react';
import {
  Brain, CheckCircle2, Layers, ListOrdered, HelpCircle, Zap,
  ChevronDown, ChevronUp, Play, RefreshCw, Edit3, X,
  MessageSquarePlus, SlidersHorizontal, SkipForward,
} from 'lucide-react';
import type { ThinkingPlan } from '@/lib/validation/schemas';
import IntentBadge, { INTENT_CONFIG } from './IntentBadge';
import RequirementBuilder from './RequirementBuilder';

// ─── Thinking Skeleton ────────────────────────────────────────────────────────

function ThinkingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gray-800" />
        <div className="h-4 w-40 rounded bg-gray-800" />
        <div className="h-5 w-24 rounded-full bg-gray-800 ml-auto" />
      </div>
      <div className="h-3 w-full rounded bg-gray-800/80" />
      <div className="h-3 w-4/5 rounded bg-gray-800/60" />
      <div className="h-3 w-3/5 rounded bg-gray-800/40" />
      <div className="grid grid-cols-3 gap-2 pt-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-7 rounded-lg bg-gray-800/60" />
        ))}
      </div>
    </div>
  );
}

// ─── Section Block ────────────────────────────────────────────────────────────

function Block({
  icon, title, children, accent = 'blue',
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  const accentMap: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border w-fit ${accentMap[accent] ?? accentMap.blue}`}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Main ThinkingPanel ────────────────────────────────────────────────────────

interface ThinkingPanelProps {
  plan: ThinkingPlan | null;
  isLoading: boolean;
  onProceed: () => void;
  onRefineUnderstanding: () => void;
  onChangeIntent: (intentType: string) => void;
  onDismiss: () => void;
  onAskClarification: (question: string) => void;
  originalPrompt: string;
}

export default function ThinkingPanel({
  plan,
  isLoading,
  onProceed,
  onRefineUnderstanding,
  onChangeIntent,
  onDismiss,
  onAskClarification,
}: ThinkingPanelProps) {
  const [showRequirements, setShowRequirements] = useState(true);
  const [showPlan, setShowPlan] = useState(true);
  const [showScope, setShowScope] = useState(true);

  if (!isLoading && !plan) return null;

  const intentConfig = plan ? INTENT_CONFIG[plan.detectedIntent] : null;

  return (
    <div
      className="rounded-2xl border border-gray-700/40 bg-gray-900/60 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/30"
      role="region"
      aria-label="AI Thinking and Planning Panel"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700/30 bg-gray-900/80">
        <div className="flex items-center gap-3">
          <div className={`
            p-1.5 rounded-lg border
            ${isLoading
              ? 'bg-blue-500/10 border-blue-500/20'
              : intentConfig
                ? `${intentConfig.bg} ${intentConfig.border}`
                : 'bg-gray-800 border-gray-700'
            }
          `}>
            <Brain className={`w-4 h-4 ${isLoading ? 'text-blue-400 animate-pulse' : intentConfig?.color ?? 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {isLoading ? 'AI is thinking…' : 'Planning Overview'}
            </p>
            <p className="text-[10px] text-gray-500">
              {isLoading ? 'Analyzing your request…' : 'Review the plan before proceeding'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan && (
            <IntentBadge intentType={plan.detectedIntent} size="sm" />
          )}
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Dismiss thinking panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <ThinkingSkeleton />}

      {/* Plan Content */}
      {!isLoading && plan && (
        <div className="p-5 space-y-5">

          {/* 1. What I Understood */}
          <Block icon={<CheckCircle2 className="w-3 h-3" />} title="What I Understood" accent="emerald">
            <p className="text-sm text-gray-300 leading-relaxed pl-1">
              {plan.summary}
            </p>
          </Block>

          {/* 2. Execution Mode */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Execution Mode</span>
            <span className={`
              inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border
              ${plan.shouldGenerateCode
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }
            `}>
              <Zap className="w-3.5 h-3.5" />
              {plan.executionMode}
            </span>
            {!plan.shouldGenerateCode && (
              <span className="text-[11px] text-gray-500 italic">
                No code will be generated until you click Proceed after adjusting the plan
              </span>
            )}
          </div>

          {/* 3. Planned Approach */}
          <Block icon={<ListOrdered className="w-3 h-3" />} title="Planned Approach" accent="blue">
            <button
              onClick={() => setShowPlan(p => !p)}
              className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-1"
            >
              {showPlan ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showPlan ? 'Collapse' : 'Expand'}
            </button>
            {showPlan && (
              <ol className="space-y-2">
                {plan.plannedApproach.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] font-bold text-blue-400 flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-300 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </Block>

          {/* 4. Affected Scope */}
          {plan.affectedScope.length > 0 && (
            <Block icon={<Layers className="w-3 h-3" />} title="Affected Scope" accent="violet">
              <button
                onClick={() => setShowScope(p => !p)}
                className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-2"
              >
                {showScope ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showScope ? 'Collapse' : 'Expand'} — {plan.affectedScope.length} file{plan.affectedScope.length !== 1 ? 's' : ''}
              </button>
              {showScope && (
                <div className="flex flex-wrap gap-2">
                  {plan.affectedScope.map((file, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 font-mono">
                      {file}
                    </span>
                  ))}
                </div>
              )}
            </Block>
          )}

          {/* 5. Requirement Breakdown (for product_requirement / ideation) */}
          {plan.requirementBreakdown && (
            <Block icon={<SlidersHorizontal className="w-3 h-3" />} title="Requirement Breakdown" accent="amber">
              <button
                onClick={() => setShowRequirements(p => !p)}
                className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-2"
              >
                {showRequirements ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showRequirements ? 'Collapse' : 'Expand breakdown'}
              </button>
              {showRequirements && (
                <RequirementBuilder breakdown={plan.requirementBreakdown} />
              )}
            </Block>
          )}

          {/* 6. Clarification Opportunities */}
          {plan.clarificationOpportunities.length > 0 && (
            <Block icon={<HelpCircle className="w-3 h-3" />} title="Clarification Opportunities" accent="cyan">
              <div className="space-y-2">
                {plan.clarificationOpportunities.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-cyan-500/8 border border-cyan-500/15">
                    <HelpCircle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300 flex-1">{q}</span>
                    <button
                      onClick={() => onAskClarification(q)}
                      className="flex-shrink-0 text-[10px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-cyan-500/10 transition-colors"
                    >
                      <MessageSquarePlus className="w-3 h-3" />
                      Answer
                    </button>
                  </div>
                ))}
              </div>
            </Block>
          )}

          {/* 7. Action Buttons */}
          <div className="pt-2 border-t border-gray-700/30">
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Actions</p>
            <div className="flex flex-wrap gap-2">
              {/* Primary: Proceed */}
              <button
                onClick={onProceed}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30 hover:-translate-y-0.5 active:scale-95"
              >
                <Play className="w-4 h-4" />
                {plan.shouldGenerateCode ? 'Proceed & Generate' : 'Proceed to Generation'}
              </button>

              {/* Secondary: Refine */}
              <button
                onClick={onRefineUnderstanding}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-600/50 bg-gray-800/50 text-gray-300 hover:text-white hover:border-gray-500 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Refine Input
              </button>

              {/* Tertiary: Regenerate plan */}
              <button
                onClick={() => onChangeIntent(plan.detectedIntent)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700/40 bg-gray-900/40 text-gray-400 hover:text-gray-200 text-sm font-medium transition-all duration-200 active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate Plan
              </button>

              {/* Skip directly to Action  */}
              {plan.shouldGenerateCode && (
                <button
                  onClick={onDismiss}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700/40 bg-transparent text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip Plan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
