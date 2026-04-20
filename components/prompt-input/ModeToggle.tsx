/**
 * @file components/prompt-input/ModeToggle.tsx
 * Generation mode toggle (Component/App/Depth UI)
 */

'use client';

import React from 'react';
import { Command } from 'lucide-react';

interface ModeToggleProps {
  scopeMode: 'component' | 'app';
  depthUi: boolean;
  isLoading: boolean;
  onScopeChange: (mode: 'component' | 'app') => void;
  onDepthUiToggle: () => void;
}

export default function ModeToggle({
  scopeMode,
  depthUi,
  isLoading,
  onScopeChange,
  onDepthUiToggle,
}: ModeToggleProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Command className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            Describe Your UI
          </h2>
          <p className="text-xs text-slate-500">
            Natural language → accessible React {scopeMode === 'app' ? 'application' : 'component'}
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div
        role="group"
        aria-label="Generation mode"
        className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-3"
      >
        <button
          type="button"
          onClick={() => onScopeChange('component')}
          disabled={isLoading}
          className={`
            flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 focus:ring-offset-[#0B0F19]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${scopeMode === 'component'
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/25'
              : 'text-slate-400 hover:text-white'
            }
          `}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Component
        </button>
        <button
          type="button"
          onClick={() => onScopeChange('app')}
          disabled={isLoading}
          className={`
            flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-1 focus:ring-offset-[#0B0F19]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${scopeMode === 'app'
              ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-md shadow-fuchsia-500/25'
              : 'text-slate-400 hover:text-white'
            }
          `}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Full App
        </button>
        <button
          type="button"
          onClick={onDepthUiToggle}
          disabled={isLoading}
          className={`
            flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-[#0B0F19]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${depthUi
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-400 hover:text-white'
            }
          `}
        >
          <span role="img" aria-hidden="true" className="text-[14px] leading-none">✨</span>
          Depth UI
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-400/20 text-violet-300 font-semibold">NEW</span>
        </button>
      </div>

      {/* Hints */}
      {scopeMode === 'app' && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-fuchsia-400 flex-shrink-0 mt-0.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs text-fuchsia-300 leading-relaxed">
            <span className="font-semibold text-fuchsia-200">Full App Mode:</span> Generates a complete multi-screen application with navigation and mock data. Try: <span className="italic">&quot;Build an Instagram-like app&quot;</span>.
          </p>
        </div>
      )}
      {depthUi && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" aria-hidden="true">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <p className="text-xs text-indigo-300 leading-relaxed">
            <span className="font-semibold text-indigo-200">Depth UI Mode:</span> Generates visually rich, premium interfaces with functional floating elements, smooth parallax, and depth-layers. Try: <span className="italic">&quot;Build a startup hero layout with floating UI cards&quot;</span>.
          </p>
        </div>
      )}
    </div>
  );
}
