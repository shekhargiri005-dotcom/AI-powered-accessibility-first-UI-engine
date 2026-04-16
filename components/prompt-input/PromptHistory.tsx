/**
 * @file components/prompt-input/PromptHistory.tsx
 * Generation history chips
 */

'use client';

import React from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import type { HistoryItem } from './types';

interface PromptHistoryProps {
  history: HistoryItem[];
  isLoading: boolean;
  onSelect: (prompt: string) => void;
}

export default function PromptHistory({ history, isLoading, onSelect }: PromptHistoryProps) {
  return (
    <div className="mt-4" role="group" aria-label="Prompt history">
      <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-2 font-medium">
        <Clock className="w-3 h-3 block" />
        Your Generation History
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
        {history.length > 0 ? (
          history.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.promptSnippet)}
              disabled={isLoading}
              aria-label={`Reuse history: ${item.componentName}`}
              className="
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                border border-violet-800/40 text-violet-400 bg-violet-500/10
                hover:border-violet-500/60 hover:text-violet-300 hover:bg-violet-500/20
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 focus:ring-offset-[#0B0F19]
                flex-shrink-0 whitespace-nowrap
              "
            >
              <ChevronRight className="w-3 h-3 block flex-shrink-0" aria-hidden="true" />
              <span className="font-semibold">{item.componentName}:</span>&nbsp;
              <span className="truncate max-w-[200px]">{item.promptSnippet}</span>
            </button>
          ))
        ) : (
          <div className="text-xs text-slate-600 italic flex items-center gap-2 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.06]">
            Nothing here yet. Build your first component or app!
          </div>
        )}
      </div>
    </div>
  );
}
