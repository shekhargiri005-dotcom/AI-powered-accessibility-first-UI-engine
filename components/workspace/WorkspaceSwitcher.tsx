'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from './WorkspaceProvider';
import { ChevronDown, Check, Building2, Plus, Loader2, X, Trash2 } from 'lucide-react';

export default function WorkspaceSwitcher() {
  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    setActiveWorkspaceId,
    isLoading,
    isCreating,
    createWorkspace,
    deleteWorkspace,
  } = useWorkspace();

  const [isOpen, setIsOpen]           = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [newName, setNewName]         = useState('');
  const [createError, setCreateError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the "new name" input whenever the create form opens
  useEffect(() => {
    if (showCreate) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showCreate]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { setCreateError('Please enter a workspace name.'); return; }
    if (name.length > 64) { setCreateError('Max 64 characters.'); return; }
    setCreateError('');
    const ws = await createWorkspace(name);
    if (ws) {
      setNewName('');
      setShowCreate(false);
      setIsOpen(false);
    } else {
      setCreateError('Failed to create workspace. Please try again.');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete workspace "${name}"?\nThis action cannot be undone and will delete all associated projects.`)) {
      await deleteWorkspace(id);
      if (workspaces.length === 1 && activeWorkspaceId === id) {
        setIsOpen(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') { setShowCreate(false); setNewName(''); setCreateError(''); }
  };

  if (isLoading) {
    return (
      <div className="w-full h-10 bg-gray-900/50 animate-pulse rounded-xl border border-gray-800/60" />
    );
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        id="workspace-switcher-trigger"
        onClick={() => { setIsOpen(!isOpen); setShowCreate(false); setCreateError(''); }}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-gray-900/50 border border-gray-800/80 hover:bg-gray-800/50 hover:border-gray-700/50 transition-all group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-400/20 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs font-bold text-gray-200 truncate pr-1">
              {activeWorkspace?.name ?? (workspaces.length === 0 ? 'No workspace' : 'Select Workspace')}
            </p>
            {activeWorkspace && (
              <p className="text-[10px] text-gray-600 truncate capitalize">{activeWorkspace.role.toLowerCase()}</p>
            )}
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setShowCreate(false); }} />

          {/* Dropdown */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">

            {/* Workspace list */}
            {workspaces.length > 0 && (
              <>
                <p className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
                  Workspaces
                </p>
                <div className="max-h-[220px] overflow-y-auto space-y-0.5 p-1.5">
                  {workspaces.map((workspace) => (
                    <div key={workspace.id} className="relative group/ws flex items-center w-full">
                      <button
                        id={`workspace-item-${workspace.id}`}
                        onClick={() => { setActiveWorkspaceId(workspace.id); setIsOpen(false); }}
                        className={`
                          flex-1 flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors
                          ${activeWorkspaceId === workspace.id
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                          }
                        `}
                      >
                        <div className="text-left min-w-0 pr-8">
                          <span className="truncate block font-medium">{workspace.name}</span>
                          <span className="text-[10px] capitalize opacity-60">{workspace.role.toLowerCase()}</span>
                        </div>
                        {activeWorkspaceId === workspace.id && (
                          <Check className="w-3.5 h-3.5 shrink-0" />
                        )}
                      </button>
                      {workspace.role === 'OWNER' && (
                        <button
                          onClick={(e) => handleDelete(e, workspace.id, workspace.name)}
                          className="absolute right-2 opacity-0 group-hover/ws:opacity-100 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                          title="Delete Workspace"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Create workspace section */}
            <div className={`border-t border-gray-800 ${workspaces.length === 0 ? 'border-t-0' : ''}`}>
              {!showCreate ? (
                <button
                  id="create-workspace-btn"
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create new workspace
                </button>
              ) : (
                <div className="p-2 space-y-2">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">New Workspace</p>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={inputRef}
                      id="new-workspace-name"
                      type="text"
                      value={newName}
                      onChange={(e) => { setNewName(e.target.value); setCreateError(''); }}
                      onKeyDown={handleKeyDown}
                      placeholder="e.g. Design Lab"
                      maxLength={64}
                      className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <button
                      id="create-workspace-confirm"
                      onClick={handleCreate}
                      disabled={isCreating || !newName.trim()}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
                    </button>
                    <button
                      onClick={() => { setShowCreate(false); setNewName(''); setCreateError(''); }}
                      className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {createError && (
                    <p className="text-[10px] text-red-400 px-1">{createError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
