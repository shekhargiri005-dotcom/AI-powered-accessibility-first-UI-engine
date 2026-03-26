'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, History, Edit3, Save, ChevronRight, 
  FileCode, CheckCircle2, RotateCcw, Send, Layers, 
  Code, Eye, Info, AlertCircle, Clock
} from 'lucide-react';
import { type UIIntent, type A11yReport } from '@/lib/validation/schemas';
import PromptInput from './PromptInput';
import dynamic from 'next/dynamic';

const SandpackPreview = dynamic(() => import('./SandpackPreview'), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 h-48 flex items-center justify-center">
      <span className="text-gray-500 text-sm">Loading live preview...</span>
    </div>
  ),
});

interface ProjectIteration {
  id: string;
  timestamp: string;
  code: string | Record<string, string>;
  intent: UIIntent;
  a11yReport: A11yReport;
  componentName: string;
}

interface ProjectWorkspaceProps {
  initialProject: ProjectIteration;
  onRefine: (prompt: string, projectId: string) => Promise<void>;
  isRefining: boolean;
}

export default function ProjectWorkspace({ 
  initialProject, 
  onRefine, 
  isRefining 
}: ProjectWorkspaceProps) {
  const [iterations, setIterations] = useState<ProjectIteration[]>([initialProject]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  
  const current = iterations[activeIndex];

  // Auto-append new initial project if it changes (when coming from main page)
  useEffect(() => {
    if (initialProject.id !== iterations[0].id) {
      setIterations([initialProject]);
      setActiveIndex(0);
    }
  }, [initialProject.id]);

  const handleRefine = async (prompt: string) => {
    await onRefine(prompt, current.id);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950/20 rounded-2xl border border-gray-700/30 overflow-hidden backdrop-blur-md">
      {/* Workspace Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700/30 bg-gray-900/60">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Layers className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">
              {current.intent.componentName}
            </h2>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3" />
              Iteration {activeIndex + 1} of {iterations.length} · {new Date(current.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-950/40 p-1 rounded-xl border border-gray-800">
          <button
            onClick={() => setViewMode('preview')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'preview' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Live Preview
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'code' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Code Editor
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Version History */}
        <aside className="w-64 border-r border-gray-700/30 bg-gray-900/20 overflow-y-auto hidden md:block">
          <div className="p-4 border-b border-gray-700/20">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <History className="w-3 h-3" />
              Project History
            </h3>
          </div>
          <div className="p-2 space-y-1">
            {iterations.map((it, idx) => (
              <button
                key={it.id}
                onClick={() => setActiveIndex(idx)}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  activeIndex === idx
                    ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20'
                    : 'border-transparent hover:bg-gray-800/40 text-gray-400 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    activeIndex === idx ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'
                  }`}>
                    v{idx + 1}
                  </span>
                  <span className="text-[10px] opacity-60">
                    {new Date(it.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs font-medium line-clamp-1">
                  {idx === 0 ? 'Initial Generation' : it.intent.description}
                </p>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Workspace Area */}
        <main className="flex-1 flex flex-col relative bg-gray-950/40">
          <div className="flex-1 overflow-auto p-6">
            {viewMode === 'preview' ? (
              <div className="h-full rounded-2xl border border-gray-700/50 bg-white/5 overflow-hidden relative group">
                <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="px-3 py-1 bg-gray-900/90 rounded-full border border-gray-700 text-[10px] text-gray-300 flex items-center gap-2">
                    <Eye className="w-3 h-3" /> Live Sandpack Runtime
                  </div>
                </div>
                <SandpackPreview 
                  code={current.code as any} 
                  componentName={current.componentName} 
                />
              </div>
            ) : (
              <div className="h-full rounded-2xl border border-gray-700/50 bg-gray-950 overflow-hidden font-mono text-xs">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/40">
                  <FileCode className="w-3 h-3 text-blue-400" />
                  <span className="text-gray-300">{current.componentName}.tsx</span>
                </div>
                <pre className="p-6 text-gray-300 overflow-auto h-[calc(100%-40px)] leading-relaxed">
                  {typeof current.code === 'string' ? current.code : JSON.stringify(current.code, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Prompt Refinement Bar */}
          <div className="p-6 border-t border-gray-700/30 bg-gray-900/40 backdrop-blur-xl">
            <div className="max-w-3xl mx-auto flex flex-col gap-4">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>How can I refine this project?</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <span className="text-[10px] text-gray-500">A11y Score: {current.a11yReport.score}%</span>
                   <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500 rounded-full" style={{ width: `${current.a11yReport.score}%` }} />
                   </div>
                 </div>
               </div>
               
               <PromptInput 
                 onSubmit={handleRefine}
                 isLoading={isRefining}
               />
               
               <div className="flex gap-2">
                 {['Make it mobile responsive', 'Use dark editorial aesthetic', 'Add heavy micro-animations'].map(sug => (
                   <button 
                    key={sug}
                    onClick={() => handleRefine(sug)}
                    className="px-3 py-1 rounded-full border border-gray-700/50 bg-gray-800/30 text-[10px] text-gray-400 hover:bg-gray-700 transition-colors"
                   >
                     {sug}
                   </button>
                 ))}
               </div>
            </div>
          </div>
          
          {/* Refining Overlay */}
          {isRefining && (
            <div className="absolute inset-0 z-50 bg-gray-950/60 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Evolving Design</h3>
                  <p className="text-sm text-gray-400">Applying intelligent patches and refinement rules...</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
