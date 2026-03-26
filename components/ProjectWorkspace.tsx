'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Eye, Code, FileCode, Layers, Clock,
} from 'lucide-react';
import { type UIIntent, type A11yReport } from '@/lib/validation/schemas';
import type { ProjectVersion } from '@/lib/projects/projectStore';
import VersionTimeline from './VersionTimeline';
import dynamic from 'next/dynamic';

const SandpackPreview = dynamic(() => import('./SandpackPreview'), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 h-48 flex items-center justify-center">
      <span className="text-gray-500 text-sm">Loading live preview...</span>
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

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
  onRefine: (prompt: string) => Promise<void>;
  isRefining: boolean;
  projectId?: string | null;
}

// ─── Quick Refinement Chips ───────────────────────────────────────────────────

const QUICK_REFINEMENTS = [
  'Make it mobile responsive',
  'Use a dark editorial aesthetic',
  'Add smooth micro-animations',
  'Improve accessibility',
  'Make colors more vibrant',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectWorkspace({
  initialProject,
  onRefine,
  isRefining,
  projectId,
}: ProjectWorkspaceProps) {
  const [versions, setVersions] = useState<ProjectVersion[]>([
    {
      version: 1,
      timestamp: initialProject.timestamp,
      code: initialProject.code,
      intent: initialProject.intent,
      a11yReport: initialProject.a11yReport,
      changeDescription: 'Initial generation',
    },
  ]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);

  const activeVersion = versions.find(v => v.version === currentVersion) ?? versions[versions.length - 1];

  // Sync new project changes from parent
  useEffect(() => {
    if (initialProject.id !== (versions[0]?.intent?.componentName ?? '')) {
      setVersions([{
        version: 1,
        timestamp: initialProject.timestamp,
        code: initialProject.code,
        intent: initialProject.intent,
        a11yReport: initialProject.a11yReport,
        changeDescription: 'Initial generation',
      }]);
      setCurrentVersion(1);
    }
  }, [initialProject.id, initialProject.timestamp, initialProject.code, initialProject.intent, initialProject.a11yReport, versions]);

  // When parent generates a new output (refinement), append as new version
  useEffect(() => {
    // Only track new outputs after the initial load
    if (!isRefining) {
      const exists = versions.some(
        v => v.timestamp === initialProject.timestamp && v.code === initialProject.code,
      );
      if (!exists && versions.length > 0) {
        const newVer: ProjectVersion = {
          version: versions.length + 1,
          timestamp: initialProject.timestamp,
          code: initialProject.code,
          intent: initialProject.intent,
          a11yReport: initialProject.a11yReport,
          changeDescription: initialProject.intent.description || 'Refined version',
        };
        setVersions(prev => [...prev, newVer]);
        setCurrentVersion(newVer.version);
      }
    }
  }, [initialProject.timestamp, isRefining, initialProject.code, initialProject.intent, initialProject.a11yReport, versions]);

  const handleRollback = useCallback(async (version: number) => {
    if (!projectId) {
      // Local-only rollback
      setCurrentVersion(version);
      return;
    }
    setIsRollingBack(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      const data = await res.json();
      if (data.success && data.project) {
        const proj = data.project;
        setVersions(proj.versions);
        setCurrentVersion(proj.currentVersion);
      }
    } catch { /* ignore */ } finally {
      setIsRollingBack(false);
    }
  }, [projectId]);

  const handleQuickRefine = (suggestion: string) => {
    setRefinementPrompt(suggestion);
  };

  const handleRefineSubmit = async () => {
    if (!refinementPrompt.trim() || isRefining) return;
    const prompt = refinementPrompt.trim();
    setRefinementPrompt('');
    await onRefine(prompt);
  };

  return (
    <div className="flex flex-col bg-gray-950/20 rounded-2xl border border-gray-700/30 overflow-hidden backdrop-blur-md">
      {/* Workspace Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700/30 bg-gray-900/60 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Layers className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">
              {activeVersion.intent.componentName}
            </h2>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3" />
              v{currentVersion} of {versions.length}
              {' · '}
              {new Date(activeVersion.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 bg-gray-950/40 p-1 rounded-xl border border-gray-800">
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'preview'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'code'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Code
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0" style={{ minHeight: '500px' }}>
        {/* Version Timeline Sidebar */}
        <VersionTimeline
          versions={versions}
          currentVersion={currentVersion}
          onSelectVersion={(ver) => setCurrentVersion(ver.version)}
          onRollback={handleRollback}
          isRollingBack={isRollingBack}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative bg-gray-950/40 overflow-hidden">
          {/* Preview / Code Area */}
          <div className="flex-1 overflow-auto p-6">
            {viewMode === 'preview' ? (
              <div className="h-full min-h-[400px] rounded-2xl border border-gray-700/50 bg-white/5 overflow-hidden relative group">
                <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="px-3 py-1 bg-gray-900/90 rounded-full border border-gray-700 text-[10px] text-gray-300 flex items-center gap-2">
                    <Eye className="w-3 h-3" /> Live Sandpack Runtime
                  </div>
                </div>
                <SandpackPreview
                  code={activeVersion.code as string | Record<string, string>}
                  componentName={activeVersion.intent.componentName}
                />
              </div>
            ) : (
              <div className="h-full min-h-[400px] rounded-2xl border border-gray-700/50 bg-gray-950 overflow-hidden font-mono text-xs">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/40">
                  <FileCode className="w-3 h-3 text-blue-400" />
                  <span className="text-gray-300">{activeVersion.intent.componentName}.tsx</span>
                  <span className="ml-auto text-[10px] text-gray-500">
                    {typeof activeVersion.code === 'string'
                      ? `${activeVersion.code.split('\n').length} lines`
                      : `${Object.keys(activeVersion.code).length} files`}
                  </span>
                </div>
                <pre className="p-6 text-gray-300 overflow-auto h-[calc(100%-40px)] leading-relaxed">
                  {typeof activeVersion.code === 'string'
                    ? activeVersion.code
                    : JSON.stringify(activeVersion.code, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Refinement Bar */}
          <div className="flex-shrink-0 p-5 border-t border-gray-700/30 bg-gray-900/40 backdrop-blur-xl">
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Refine this project</span>
                </div>
                <span className="text-[10px] text-gray-500">
                  A11y: {activeVersion.a11yReport.score}/100
                </span>
              </div>

              {/* Refinement Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refinementPrompt}
                  onChange={e => setRefinementPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRefineSubmit()}
                  placeholder="Describe what to change… e.g. 'Make the sidebar dark with icons'"
                  disabled={isRefining}
                  className="flex-1 px-4 py-2.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 transition"
                />
                <button
                  onClick={handleRefineSubmit}
                  disabled={!refinementPrompt.trim() || isRefining}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20"
                >
                  {isRefining ? 'Refining…' : 'Refine'}
                </button>
              </div>

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-2">
                {QUICK_REFINEMENTS.map(sug => (
                  <button
                    key={sug}
                    onClick={() => handleQuickRefine(sug)}
                    className="px-3 py-1 rounded-full border border-gray-700/50 bg-gray-800/30 text-[11px] text-gray-400 hover:bg-gray-700/60 hover:text-gray-200 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Refining Overlay */}
          {isRefining && (
            <div className="absolute inset-0 z-50 bg-gray-950/70 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Evolving Design</h3>
                  <p className="text-sm text-gray-400">Applying intelligent patches...</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
