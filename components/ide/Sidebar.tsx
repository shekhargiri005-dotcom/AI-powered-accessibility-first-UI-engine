'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus, Clock, Search, Folders,
  Code, Box, Layers, ChevronRight, Hash, X
} from 'lucide-react';
import type { ProjectSummary } from '@/lib/projects/projectStore';
import WorkspaceSettingsPanel from '@/components/WorkspaceSettingsPanel';
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';
import UserNav from '@/components/auth/UserNav';
import type { AIEngineConfig } from '@/components/AIEngineConfigPanel';

interface SidebarProps {
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onConfigSaved?: (config: AIEngineConfig) => void;
  onDeactivated?: () => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  component: <Layers className="w-4 h-4 text-blue-400" />,
  app: <Code className="w-4 h-4 text-violet-400" />,
  depth_ui: <Layers className="w-4 h-4 text-cyan-400" />,
};

export default function Sidebar({
  activeProjectId,
  onSelectProject,
  onNewProject,
  isMobileOpen,
  onCloseMobile,
  onConfigSaved,
  onDeactivated,
}: SidebarProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [activeProjectId]); // Refetch when active changes (it might have been saved)

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.latestDescription.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 lg:w-full lg:h-full bg-gray-950/80 backdrop-blur-xl border-r border-gray-800/60
        flex flex-col min-h-0 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header / Brand + Switcher */}
        <div className="flex-shrink-0 flex flex-col gap-3 px-5 py-4 border-b border-gray-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 p-[1px]">
                  <div className="w-full h-full bg-gray-950/90 rounded-[11px] flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  </div>
              </div>
              <span className="font-bold text-gray-200 text-sm tracking-tight">AI UI Engine</span>
            </div>
            <button onClick={onCloseMobile} className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800">
              <X className="w-5 h-5" />
            </button>
          </div>
          <WorkspaceSwitcher />
        </div>

        {/* Action Bar */}
        <div className="px-4 py-4 space-y-4 flex-shrink-0">
          <button
            onClick={onNewProject}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all duration-200 shadow-xl shadow-blue-600/20 hover:shadow-blue-500/30 active:scale-[0.98] border border-blue-400/20"
          >
            <Plus className="w-4 h-4 ml-0.5" />
            New Workspace
          </button>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-900/50 border border-gray-800/80 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 space-y-1 scrollbar-hide pb-6">
          <div className="px-2 pb-2 mt-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Folders className="w-3.5 h-3.5" />
              Your Projects
            </p>
          </div>

          {loading ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-5 h-5 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-500 animate-pulse">Loading workspaces...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-900/50 border border-gray-800 flex items-center justify-center mx-auto mb-3">
                <Hash className="w-5 h-5 text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-400">No projects found</p>
              <p className="text-xs text-gray-600 mt-1">Create a new workspace to start designing.</p>
            </div>
          ) : (
            filtered.map((project) => {
              const isActive = project.id === activeProjectId;
              return (
                <button
                  key={project.id}
                  onClick={() => { onSelectProject(project.id); onCloseMobile(); }}
                  className={`
                    w-full text-left p-3 rounded-xl border transition-all duration-200 group
                    ${isActive 
                      ? 'bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/5' 
                      : 'border-transparent hover:bg-gray-800/40 hover:border-gray-700/50'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 border ${isActive ? 'bg-blue-500/20 border-blue-400/30' : 'bg-gray-900/80 border-gray-800/80 group-hover:bg-gray-800'}`}>
                      {TYPE_ICONS[project.componentType] || TYPE_ICONS.component}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`font-semibold text-sm truncate pr-2 ${isActive ? 'text-blue-100' : 'text-gray-200 group-hover:text-white'}`}>
                          {project.name}
                        </span>
                        <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${isActive ? 'text-blue-400 opacity-100 translate-x-0' : 'text-gray-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                      </div>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-1.5">
                        <Clock className="w-3 h-3 text-gray-600" />
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
        <div className="p-3 mt-auto border-t border-gray-800/60 bg-gray-950/80 flex flex-col gap-2 shrink-0">
          <UserNav onConfigSaved={onConfigSaved} onDeactivated={onDeactivated} />
        </div>
      </aside>

      <WorkspaceSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
