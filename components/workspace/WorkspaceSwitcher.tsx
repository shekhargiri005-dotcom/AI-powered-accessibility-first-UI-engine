'use client';

import React, { useState } from 'react';
import { useWorkspace } from './WorkspaceProvider';
import { ChevronDown, Check, Building2, Plus } from 'lucide-react';

export default function WorkspaceSwitcher() {
  const { workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspaceId, isLoading } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="w-full h-10 bg-gray-900/50 animate-pulse rounded-xl border border-gray-800/60" />
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-gray-900/50 border border-gray-800/80 hover:bg-gray-800/50 hover:border-gray-700/50 transition-all group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-400/20 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs font-bold text-gray-200 truncate pr-1">
              {activeWorkspace?.name || 'Select Workspace'}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 right-0 mt-2 p-1.5 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-1">
            <p className="px-2.5 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Workspaces
            </p>
            <div className="space-y-0.5 max-h-[300px] overflow-y-auto mt-1">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => {
                    setActiveWorkspaceId(workspace.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors
                    ${activeWorkspaceId === workspace.id 
                      ? 'bg-blue-500/10 text-blue-400' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }
                  `}
                >
                  <span className="truncate pr-4">{workspace.name}</span>
                  {activeWorkspaceId === workspace.id && (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-gray-800">
              <button className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-200 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" />
                Create Workspace
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
