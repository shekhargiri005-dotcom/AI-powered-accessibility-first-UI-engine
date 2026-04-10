'use client';

import React from 'react';
import {
  Wand2, Edit3, FileText, Lightbulb, Bug, MessageSquare,
} from 'lucide-react';
import type { IntentType } from '@/lib/validation/schemas';

// ─── Config ───────────────────────────────────────────────────────────────────

export const INTENT_CONFIG: Record<
  IntentType,
  { label: string; shortLabel: string; icon: React.ReactNode; color: string; bg: string; border: string }
> = {
  ui_generation: {
    label: 'UI Generation',
    shortLabel: 'Generate',
    icon: <Wand2 className="w-3.5 h-3.5" />,
    color: 'text-blue-300',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
  },
  ui_refinement: {
    label: 'UI Refinement',
    shortLabel: 'Refine',
    icon: <Edit3 className="w-3.5 h-3.5" />,
    color: 'text-violet-300',
    bg: 'bg-violet-500/15',
    border: 'border-violet-500/30',
  },
  product_requirement: {
    label: 'Product Requirement',
    shortLabel: 'Requirement',
    icon: <FileText className="w-3.5 h-3.5" />,
    color: 'text-amber-300',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
  },
  ideation: {
    label: 'Ideation / Strategy',
    shortLabel: 'Ideation',
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
  },
  debug_fix: {
    label: 'Debug / Fix',
    shortLabel: 'Debug',
    icon: <Bug className="w-3.5 h-3.5" />,
    color: 'text-red-300',
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
  },
  context_clarification: {
    label: 'Context / Clarification',
    shortLabel: 'Context',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-500/30',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface IntentBadgeProps {
  intentType: IntentType;
  confidence?: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export default function IntentBadge({
  intentType,
  confidence,
  size = 'md',
  showLabel = true,
}: IntentBadgeProps) {
  const config = INTENT_CONFIG[intentType];
  const isSmall = size === 'sm';

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium 
        transition-all duration-200
        ${config.bg} ${config.border} ${config.color}
        ${isSmall ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}
      `}
      title={`Detected intent: ${config.label}${confidence !== undefined ? ` (${Math.round(confidence * 100)}% confidence)` : ''}`}
    >
      {config.icon}
      {showLabel && (isSmall ? config.shortLabel : config.label)}
      {confidence !== undefined && (
        <span className={`${isSmall ? 'opacity-70 text-[9px] ml-0.5' : 'opacity-60 ml-0.5'}`}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
}
