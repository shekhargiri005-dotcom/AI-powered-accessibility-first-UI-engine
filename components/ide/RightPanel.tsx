'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Eye, Code, GitCommit, ScrollText, Sparkles, AlertCircle, Maximize2, X
} from 'lucide-react';
import type { UIIntent, A11yReport } from '@/lib/validation/schemas';
import type { ProjectVersion } from '@/lib/projects/projectStore';
import VersionTimeline from '@/components/VersionTimeline';
import GeneratedCode from '@/components/GeneratedCode';
import A11yReportComponent from '@/components/A11yReport';
import TestOutput from '@/components/TestOutput';
import IntentBadge from '@/components/IntentBadge';
import dynamic from 'next/dynamic';

const SandpackPreview = dynamic(() => import('@/components/SandpackPreview'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-gray-500 text-xs font-medium animate-pulse">Initializing Dev Environment...</span>
      </div>
    </div>
  ),
});

interface RightPanelProps {
  initialProject: {
    id: string;
    timestamp: string;
    code: string | Record<string, string>;
    intent: UIIntent;
    a11yReport: A11yReport;
    componentName: string;
    tests?: { rtl: string; playwright: string };
  };
  onRefine: (prompt: string) => Promise<void>;
  isRefining: boolean;
  projectId?: string | null;
}

type TabId = 'preview' | 'code' | 'versions' | 'metrics';

export default function RightPanel({
  initialProject,
  onRefine,
  isRefining,
  projectId,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('preview');
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
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');

  const activeV = versions.find(v => v.version === currentVersion) ?? versions[versions.length - 1];

  // Sync new project
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
      setActiveTab('preview');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject.id]);

  // Sync new refining updates
  useEffect(() => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject.timestamp, isRefining]);

  const handleRollback = useCallback(async (version: number) => {
    if (!projectId) { setCurrentVersion(version); return; }
    setIsRollingBack(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      const data = await res.json();
      if (data.success && data.project) {
        setVersions(data.project.versions);
        setCurrentVersion(data.project.currentVersion);
      }
    } catch { /* ignore */ } finally {
      setIsRollingBack(false);
    }
  }, [projectId]);

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'preview', label: 'Preview', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'code', label: 'Code', icon: <Code className="w-3.5 h-3.5" /> },
    { id: 'versions', label: 'History', icon: <GitCommit className="w-3.5 h-3.5" /> },
    { id: 'metrics', label: 'Metrics', icon: <ScrollText className="w-3.5 h-3.5" /> },
  ];

  const handleRefineSubmit = () => {
    if (!refinementPrompt.trim() || isRefining) return;
    onRefine(refinementPrompt.trim());
    setRefinementPrompt('');
  };

  return (
    <div className={`
      flex flex-col flex-1 min-h-0 bg-gray-950 border-t lg:border-t-0 lg:border-l border-gray-800/60 z-20
      ${isFullscreen ? 'fixed inset-0 lg:left-72 z-50' : 'relative w-full'}
    `}>
      {/* Top Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
            <h2 className="text-sm font-bold text-white tracking-tight">{activeV.intent.componentName}</h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-gray-800 text-[10px] text-gray-400 font-mono border border-gray-700/50">
            v{currentVersion}
          </span>
          <IntentBadge intentType={currentVersion > 1 ? 'ui_refinement' : 'ui_generation'} size="sm" showLabel={false} />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-gray-900/50 rounded-lg border border-gray-800">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${activeTab === t.id 
                  ? 'bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/30' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent'
                }
              `}
            >
              {t.icon}
              <span className="hidden xl:inline">{t.label}</span>
            </button>
          ))}
          <div className="w-px h-4 bg-gray-700 mx-1" />
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <X className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative min-h-0 bg-black/20">
        {activeTab === 'preview' && (
          <div className="absolute inset-0 z-0">
            <SandpackPreview 
              key={`preview-${activeV.timestamp}-${currentVersion}`}
              code={activeV.code as string | Record<string, string>} 
              componentName={activeV.intent.componentName} 
            />
          </div>
        )}

        {activeTab === 'code' && (
          <div className="absolute inset-0 overflow-y-auto z-10 bg-gray-950 pb-24">
            <GeneratedCode 
              code={typeof activeV.code === 'string' ? activeV.code : JSON.stringify(activeV.code, null, 2)} 
              componentName={activeV.intent.componentName} 
            />
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="absolute inset-0 overflow-hidden flex bg-gray-950/50">
            <div className="w-full max-w-sm border-r border-gray-800/60 bg-gray-900/30 overflow-y-auto custom-scrollbar">
              <VersionTimeline
                versions={versions}
                currentVersion={currentVersion}
                onSelectVersion={(v) => setCurrentVersion(v.version)}
                onRollback={handleRollback}
                isRollingBack={isRollingBack}
              />
            </div>
            <div className="flex-1 flex items-center justify-center p-8 bg-gray-950/80 text-center">
              <div className="max-w-md">
                <GitCommit className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-200 mb-2">Version History</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Select a version from the timeline on the left to preview it. You can rollback to any previous state non-destructively.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="absolute inset-0 overflow-y-auto bg-gray-950 p-6 space-y-6 pb-24 custom-scrollbar">
            {activeV.a11yReport && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" /> Accessibility Report
                </h3>
                <A11yReportComponent report={activeV.a11yReport} />
              </div>
            )}
            {initialProject.tests && (
              <div className="mt-8">
                <TestOutput tests={initialProject.tests} componentName={initialProject.componentName} />
              </div>
            )}
          </div>
        )}

        {/* Global Refining Overlay */}
        {isRefining && (
          <div className="absolute inset-0 z-50 bg-gray-950/80 backdrop-blur-md flex items-center justify-center">
             <div className="flex flex-col items-center gap-5 text-center p-8 rounded-3xl bg-gray-900 border border-gray-800 shadow-2xl">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight mb-1">Evolving UI</h3>
                  <p className="text-sm text-gray-400">Applying intelligent targeted patches...</p>
                </div>
              </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Editing Bar */}
      <div className="flex-shrink-0 p-4 bg-gray-950 border-t border-gray-800/80 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
        <div className="flex items-center gap-3 w-full bg-gray-900/60 p-2 rounded-2xl border border-gray-700/50 focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500/50 transition-all">
          <input
            type="text"
            value={refinementPrompt}
            onChange={(e) => setRefinementPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRefineSubmit()}
            placeholder="Targeted edit... (e.g. 'Make the hero title larger and add a violet glow')"
            disabled={isRefining}
            className="flex-1 bg-transparent px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={handleRefineSubmit}
            disabled={!refinementPrompt.trim() || isRefining}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-30 shadow-lg shadow-blue-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isRefining ? 'Applying' : 'Refine'}
          </button>
        </div>
      </div>
    </div>
  );
}
