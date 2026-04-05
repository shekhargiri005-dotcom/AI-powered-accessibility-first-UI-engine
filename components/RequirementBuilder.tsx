'use client';

import React from 'react';
import {
  Package, Zap, ArrowRight, Layout, Palette, Users, Target, Puzzle,
} from 'lucide-react';
import type { RequirementBreakdown } from '@/lib/validation/schemas';

export interface RequirementBuilderProps {
  breakdown: RequirementBreakdown;
  onProceedWithRequirements?: (breakdown: RequirementBreakdown) => void;
}

const SECTION_CONFIG = [
  {
    key: 'productSummary' as const,
    icon: <Package className="w-4 h-4" />,
    label: 'Product Summary',
    color: 'text-blue-400',
    type: 'text' as const,
  },
  {
    key: 'coreFeatures' as const,
    icon: <Zap className="w-4 h-4" />,
    label: 'Core Features',
    color: 'text-violet-400',
    type: 'list' as const,
  },
  {
    key: 'userFlow' as const,
    icon: <ArrowRight className="w-4 h-4" />,
    label: 'User Flow',
    color: 'text-cyan-400',
    type: 'list' as const,
  },
  {
    key: 'uiSections' as const,
    icon: <Layout className="w-4 h-4" />,
    label: 'UI Sections',
    color: 'text-emerald-400',
    type: 'list' as const,
  },
  {
    key: 'designStyle' as const,
    icon: <Palette className="w-4 h-4" />,
    label: 'Design Style',
    color: 'text-pink-400',
    type: 'text' as const,
  },
  {
    key: 'targetAudience' as const,
    icon: <Users className="w-4 h-4" />,
    label: 'Target Audience',
    color: 'text-amber-400',
    type: 'text' as const,
  },
  {
    key: 'uxPriorities' as const,
    icon: <Target className="w-4 h-4" />,
    label: 'UX Priorities',
    color: 'text-orange-400',
    type: 'list' as const,
  },
  {
    key: 'componentSuggestions' as const,
    icon: <Puzzle className="w-4 h-4" />,
    label: 'Component Suggestions',
    color: 'text-indigo-400',
    type: 'list' as const,
  },
];

export default function RequirementBuilder({ breakdown, onProceedWithRequirements }: RequirementBuilderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
            Structured Requirement Breakdown
          </span>
          <span className="text-[10px] text-gray-500 ml-2">— validate before generating</span>
        </div>
        {onProceedWithRequirements && (
          <button
            onClick={() => onProceedWithRequirements(breakdown)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            <ArrowRight className="w-3 h-3" />
            Proceed with this plan
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTION_CONFIG.map(({ key, icon, label, color, type }) => {
          const value = breakdown[key];
          const isEmpty = !value || (Array.isArray(value) && value.length === 0) || value === '';
          if (isEmpty) return null;

          return (
            <div
              key={key}
              className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-3 group hover:border-gray-600/60 transition-all duration-200"
            >
              <div className={`flex items-center gap-2 mb-2 ${color}`}>
                {icon}
                <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
              </div>

              {type === 'text' ? (
                <p className="text-xs text-gray-300 leading-relaxed">{value as string}</p>
              ) : (
                <ul className="space-y-1">
                  {(value as string[]).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-gray-300">
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.replace('text-', 'bg-')}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
