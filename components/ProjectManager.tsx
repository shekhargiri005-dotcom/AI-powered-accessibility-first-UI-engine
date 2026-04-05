'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderOpen, Plus, Search, Trash2, Clock, Layers, Code, Box, X,
  RefreshCw, FolderKanban,
} from 'lucide-react';
import type { ProjectSummary } from '@/lib/projects/projectStore';

export interface ProjectManagerProps {
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onClose: () => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  component: <Layers className="w-4 h-4 text-blue-400" />,
  app: <Code className="w-4 h-4 text-violet-400" />,
  webgl: <Box className="w-4 h-4 text-cyan-400" />,
};

export default function ProjectManager({ onOpenProject, onNewProject, onClose }: ProjectManagerProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** ID awaiting inline confirm — replaces the blocking window.confirm() */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.latestDescription.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // First click: show inline confirm
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setDeleteError(null);
      return;
    }
    // Second click (confirmed)
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Delete failed');
      }
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete project');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Project Manager"
    >
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <FolderKanban className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Project Manager</h2>
              <p className="text-xs text-gray-500">{projects.length} saved project{projects.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchProjects}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Refresh projects"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Close project manager"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800/60">
          <button
            onClick={() => { onNewProject(); onClose(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search saved projects"
              className="w-full pl-9 pr-4 py-2 bg-gray-800/60 border border-gray-700/40 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Project List */}
        {deleteError && (
          <div className="mx-4 mt-2 p-2.5 rounded-xl bg-red-900/20 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
            <X className="w-3.5 h-3.5 flex-shrink-0" />
            {deleteError}
            <button onClick={() => setDeleteError(null)} className="ml-auto text-red-400 hover:text-red-200" aria-label="Dismiss error">✕</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-6 h-6 text-gray-600 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading projects...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FolderOpen className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">
                {search ? 'No matching projects found' : 'No saved projects yet'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {search ? 'Try a different search term' : 'Generate a UI to create your first project'}
              </p>
            </div>
          ) : (
            filtered.map(project => (
              <button
                key={project.id}
                onClick={() => { onOpenProject(project.id); onClose(); }}
                className="w-full text-left p-4 rounded-xl border border-gray-700/30 hover:border-gray-600/60 hover:bg-gray-800/40 transition-all duration-200 group relative"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-800 rounded-lg border border-gray-700/50 flex-shrink-0 mt-0.5">
                    {TYPE_ICONS[project.componentType] || TYPE_ICONS.component}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm truncate">{project.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/50 flex-shrink-0">
                        v{project.currentVersion}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{project.latestDescription}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                      <span>{project.versionCount} version{project.versionCount !== 1 ? 's' : ''}</span>
                      <span className="capitalize">{project.componentType}</span>
                    </div>
                  </div>
                </div>

                {/* Delete / inline confirm */}
                {confirmDeleteId === project.id ? (
                  <div
                    className="absolute top-3 right-3 flex items-center gap-1.5 animate-in fade-in duration-150"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="text-[10px] text-red-400 font-semibold">Delete?</span>
                    <button
                      onClick={(e) => handleDelete(project.id, e)}
                      disabled={deletingId === project.id}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
                      aria-label={`Confirm delete ${project.name}`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold border border-gray-600 text-gray-400 hover:text-white transition-colors"
                      aria-label="Cancel delete"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    disabled={deletingId === project.id}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-30"
                    aria-label={`Delete ${project.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
