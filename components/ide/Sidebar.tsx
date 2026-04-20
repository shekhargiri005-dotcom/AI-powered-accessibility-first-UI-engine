'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Clock, Search, Folders,
  Code, Box, Layers, ChevronRight, Hash, X
} from 'lucide-react';
import type { ProjectSummary } from '@/lib/projects/projectStore';
import WorkspaceSettingsPanel from '@/components/WorkspaceSettingsPanel';
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import UserNav from '@/components/auth/UserNav';
import { useProviderTheme } from '@/lib/hooks/useProviderTheme';

interface SidebarProps {
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  provider?: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  component: 'component',
  app: 'app',
  depth_ui: 'depth_ui',
};

export default function Sidebar({
  activeProjectId,
  onSelectProject,
  onNewProject,
  isMobileOpen,
  onCloseMobile,
  provider,
}: SidebarProps) {
  const t = useProviderTheme(provider);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { activeWorkspaceId } = useWorkspace();

  const fetchProjects = useCallback(async () => {
    try {
      const qs = activeWorkspaceId ? `?workspaceId=${activeWorkspaceId}` : '';
      const res = await fetch(`/api/projects${qs}`);
      const data = await res.json();
      setProjects(data.projects || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects, activeProjectId, activeWorkspaceId]); // Refetch when active project OR workspace changes

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.latestDescription.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72
        bg-[#0B0F19]/80 backdrop-blur-2xl border-r border-white/[0.08]
        flex flex-col min-h-0 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header / Brand + Switcher */}
        <div className="flex-shrink-0 flex flex-col gap-3 px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Violet gradient logo mark */}
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${t.gradient} p-[1px] shadow-lg ${t.shadow}`}>
                <div className="w-full h-full bg-[#0B0F19]/90 rounded-[11px] flex items-center justify-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${t.bgSolid} shadow-[0_0_8px] ${t.shadowGlow}`} />
                </div>
              </div>
              <span className="font-bold text-slate-200 text-sm tracking-tight">AI UI Engine</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <WorkspaceSwitcher />
        </div>

        {/* Action Bar */}
        <div className="px-4 py-4 space-y-3 flex-shrink-0">
          {/* New Project â€” violet CTA */}
          <button
            onClick={onNewProject}
            className={`
              w-full flex items-center gap-2 px-4 py-2.5 rounded-2xl
              bg-gradient-to-r ${t.gradient} text-white text-sm font-semibold
              transition-all duration-200
              shadow-lg ${t.shadow}
              hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]
              border ${t.border}
              focus-visible:outline-none focus-visible:ring-2 focus-visible:${t.borderFocus} focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19]
            `}
          >
            <Plus className="w-4 h-4 ml-0.5" />
            New Project
          </button>

          {/* Search â€” frosted glass */}
          <div className="relative group">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:${t.textPrimary} transition-colors`} />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="
                w-full pl-9 pr-4 py-2 rounded-xl text-xs text-slate-200 placeholder-slate-600
                bg-white/[0.04] border border-white/[0.08]
                focus:outline-none focus:ring-1 focus:${t.borderFocus} focus:${t.borderActive}
                transition-all shadow-inner
              "
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 space-y-1 scrollbar-hide pb-6">
          <div className="px-2 pb-2 mt-2">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <Folders className="w-3.5 h-3.5" />
              Your Projects
            </p>
          </div>

          {loading ? (
            <div className="py-8 text-center space-y-3">
              <div className={`w-5 h-5 border-2 border-slate-800 ${t.bgSolid} rounded-full animate-spin mx-auto`} />
              <p className="text-xs text-slate-600 animate-pulse">Loading workspaces...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                <Hash className="w-5 h-5 text-slate-700" />
              </div>
              <p className="text-sm font-medium text-slate-500">No projects found</p>
              <p className="text-xs text-slate-700 mt-1">Create a new project to start designing.</p>
            </div>
          ) : (
            filtered.map((project) => {
              const isActive = project.id === activeProjectId;
              return (
                <button
                  key={project.id}
                  onClick={() => { onSelectProject(project.id); onCloseMobile(); }}
                  className={`
                    w-full text-left p-3 rounded-2xl border transition-all duration-200 group
                    ${isActive
                      ? `${t.bgLight} ${t.borderActive} shadow-lg ${t.shadow} scale-[1.01]`
                      : 'border-transparent hover:bg-white/[0.04] hover:border-white/[0.08] hover:scale-[1.01] hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 border transition-colors ${isActive ? `${t.bgMedium} ${t.border}` : 'bg-white/[0.04] border-white/[0.06] group-hover:bg-white/[0.07]'}`}>
                      <Layers className={`w-4 h-4 ${isActive ? t.textPrimary : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`font-semibold text-sm truncate pr-2 ${isActive ? t.textPrimary : 'text-slate-300 group-hover:text-white'}`}>
                          {project.name}
                        </span>
                        <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${isActive ? `${t.textPrimary} opacity-100` : 'text-slate-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                      </div>
                      <p className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-1.5">
                        <Clock className="w-3 h-3 text-slate-700" />
                        <span className="truncate">{new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer / User Settings */}
        <div className="p-3 mt-auto border-t border-white/[0.08] bg-white/[0.02] flex flex-col gap-2 shrink-0">
          <UserNav />
        </div>
      </aside>

      <WorkspaceSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}

