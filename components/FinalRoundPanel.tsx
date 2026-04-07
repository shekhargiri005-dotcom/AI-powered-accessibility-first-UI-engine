'use client';

/**
 * @file components/FinalRoundPanel.tsx
 *
 * "Holy Grail" Final Round Panel — the visual layer of the vision-in-the-loop quality gate.
 *
 * Renders as a floating badge in the bottom-right corner of the preview pane.
 * Expands into a drawer showing the AI designer's critique and any changes applied.
 *
 * States:
 *  idle    — not shown
 *  running — animated spinner + "AI Designer Reviewing…"
 *  passed  — green badge "Design Approved ✓"
 *  fixed   — amber/violet badge "Design Elevated ✨" with improvement count
 *  skipped — muted badge "Vision check skipped" with reason
 *  error   — red badge "Final Round error" (non-blocking)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, CheckCircle2, Wand2, Eye, ChevronDown, ChevronUp,
  AlertCircle, Loader2, Zap, X,
} from 'lucide-react';
import type { FinalRoundStatus, FinalRoundResult } from '@/lib/ai/finalRoundCritic';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface FinalRoundPanelProps {
  status: FinalRoundStatus;
  result?: FinalRoundResult;
  /** True when the suggested code replaced the original */
  codeWasReplaced?: boolean;
  /** Called if the user dismisses the panel */
  onDismiss?: () => void;
  /** Error message (only on status='error' or 'skipped') */
  errorMessage?: string;
}

// ─── Score ring component ──────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 65 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        {/* Track */}
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
        {/* Progress */}
        <circle
          cx="24" cy="24" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <span
        className="absolute text-[11px] font-bold tabular-nums"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

// ─── Status badge config ───────────────────────────────────────────────────────

interface BadgeConfig {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  borderClass: string;
  glowClass: string;
  bgClass: string;
  textClass: string;
  pulseColor: string;
}

function getBadgeConfig(
  status: FinalRoundStatus,
  codeWasReplaced?: boolean,
  errorMessage?: string,
): BadgeConfig {
  switch (status) {
    case 'running':
      return {
        label: 'Final Round',
        sublabel: 'AI Designer reviewing…',
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        borderClass: 'border-blue-500/40',
        glowClass: 'shadow-[0_0_20px_rgba(59,130,246,0.25)]',
        bgClass: 'bg-gray-900/95',
        textClass: 'text-blue-400',
        pulseColor: 'bg-blue-500',
      };
    case 'passed':
      return {
        label: 'Design Approved',
        sublabel: 'Passed AI designer review',
        icon: <CheckCircle2 className="w-4 h-4" />,
        borderClass: 'border-emerald-500/50',
        glowClass: 'shadow-[0_0_24px_rgba(16,185,129,0.3)]',
        bgClass: 'bg-gray-900/95',
        textClass: 'text-emerald-400',
        pulseColor: 'bg-emerald-500',
      };
    case 'fixed':
      return {
        label: codeWasReplaced ? 'Design Elevated ✨' : 'Improvements Found',
        sublabel: codeWasReplaced ? 'UI upgraded by AI designer' : 'AI designer suggested fixes',
        icon: <Wand2 className="w-4 h-4" />,
        borderClass: 'border-violet-500/50',
        glowClass: 'shadow-[0_0_28px_rgba(139,92,246,0.35)]',
        bgClass: 'bg-gray-900/95',
        textClass: 'text-violet-400',
        pulseColor: 'bg-violet-500',
      };
    case 'skipped':
      return {
        label: 'Vision check skipped',
        sublabel: errorMessage?.includes('does not support')
          ? 'Model lacks vision capability'
          : 'Final Round unavailable',
        icon: <Eye className="w-4 h-4 opacity-50" />,
        borderClass: 'border-gray-700/50',
        glowClass: '',
        bgClass: 'bg-gray-900/80',
        textClass: 'text-gray-500',
        pulseColor: 'bg-gray-600',
      };
    case 'error':
      return {
        label: 'Final Round error',
        sublabel: 'Review skipped (non-blocking)',
        icon: <AlertCircle className="w-4 h-4" />,
        borderClass: 'border-red-500/40',
        glowClass: 'shadow-[0_0_20px_rgba(239,68,68,0.2)]',
        bgClass: 'bg-gray-900/95',
        textClass: 'text-red-400',
        pulseColor: 'bg-red-500',
      };
    default:
      return {
        label: 'Final Round',
        sublabel: 'Idle',
        icon: <Zap className="w-4 h-4" />,
        borderClass: 'border-gray-700',
        glowClass: '',
        bgClass: 'bg-gray-900/95',
        textClass: 'text-gray-400',
        pulseColor: 'bg-gray-600',
      };
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function FinalRoundPanel({
  status,
  result,
  codeWasReplaced,
  onDismiss,
  errorMessage,
}: FinalRoundPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const prevStatusRef = useRef<FinalRoundStatus>('idle');

  // Animate in when status changes from idle to something
  useEffect(() => {
    if (status !== 'idle' && prevStatusRef.current === 'idle') {
      // Small delay before showing to not compete with render animation
      const t = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(t);
    }
    if (status === 'idle') {
      setIsVisible(false);
      setIsExpanded(false);
    }
    prevStatusRef.current = status;
  }, [status]);

  // Auto-expand when fixed (to show the user what changed)
  useEffect(() => {
    if (status === 'fixed' && codeWasReplaced) {
      const t = setTimeout(() => setIsExpanded(true), 600);
      return () => clearTimeout(t);
    }
  }, [status, codeWasReplaced]);

  if (status === 'idle' || !isVisible) return null;

  const badge = getBadgeConfig(status, codeWasReplaced, errorMessage);
  const hasDetails = !!result?.critique;
  const isInteractive = status !== 'running' && hasDetails;

  return (
    <div
      className={`
        absolute bottom-4 right-4 z-30
        flex flex-col
        rounded-2xl border backdrop-blur-xl
        transition-all duration-500
        ${badge.borderClass} ${badge.glowClass} ${badge.bgClass}
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        max-w-[340px] min-w-[240px]
        overflow-hidden
      `}
      style={{ transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      {/* ── Badge header ──────────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${isInteractive ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
        onClick={isInteractive ? () => setIsExpanded((v) => !v) : undefined}
        role={isInteractive ? 'button' : undefined}
        aria-expanded={isInteractive ? isExpanded : undefined}
      >
        {/* Animated pulse dot */}
        <div className="relative flex-shrink-0">
          {status === 'running' && (
            <span className={`absolute inset-0 rounded-full ${badge.pulseColor} opacity-40 animate-ping`} />
          )}
          <span className={`w-2 h-2 rounded-full ${badge.pulseColor} flex-shrink-0 block`} />
        </div>

        {/* Icon */}
        <span className={badge.textClass}>
          {badge.icon}
        </span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold leading-tight ${badge.textClass}`}>
            {badge.label}
          </p>
          <p className="text-[10px] text-gray-500 leading-tight mt-0.5 truncate">
            {badge.sublabel}
          </p>
        </div>

        {/* Score ring (only when we have a result) */}
        {result?.score !== undefined && (
          <ScoreRing score={result.score} />
        )}

        {/* Expand toggle */}
        {isInteractive && (
          <span className="text-gray-600 flex-shrink-0">
            {isExpanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronUp className="w-3.5 h-3.5" />
            }
          </span>
        )}

        {/* Dismiss button (skipped / error states) */}
        {(status === 'skipped' || status === 'error') && onDismiss && (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="flex-shrink-0 p-1 text-gray-600 hover:text-gray-400 rounded-lg hover:bg-white/5 transition"
            aria-label="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── Expanded critique drawer ───────────────────────────────────────── */}
      <div
        className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96' : 'max-h-0'}`}
        aria-hidden={!isExpanded}
      >
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800/60">

          {/* AI Designer label */}
          <div className="flex items-center gap-1.5 pt-3">
            <Sparkles className="w-3 h-3 text-violet-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              AI Designer Verdict
            </span>
          </div>

          {/* Critique text */}
          {result?.critique && (
            <p className="text-xs text-gray-300 leading-relaxed bg-gray-800/40 rounded-xl px-3 py-2.5 border border-gray-700/40">
              {result.critique}
            </p>
          )}

          {/* Code replaced banner */}
          {status === 'fixed' && codeWasReplaced && (
            <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-xl px-3 py-2">
              <Wand2 className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
              <p className="text-xs text-violet-300 leading-tight">
                Design has been automatically elevated with the AI designer&apos;s improvements.
              </p>
            </div>
          )}

          {/* Skipped reason */}
          {status === 'skipped' && errorMessage && (
            <p className="text-[11px] text-gray-600 leading-relaxed italic">
              {errorMessage}
            </p>
          )}

          {/* Error details */}
          {status === 'error' && errorMessage && (
            <p className="text-[11px] text-red-400/70 leading-relaxed">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
