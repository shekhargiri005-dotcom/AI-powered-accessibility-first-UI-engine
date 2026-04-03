'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface Workspace {
  id: string;
  name: string;
  role: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  isLoading: boolean;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      if (data.success) {
        setWorkspaces(data.workspaces);
        
        // Default to the first workspace if none is active or active is not in the list
        if (!activeWorkspaceId || !data.workspaces.find((w: Workspace) => w.id === activeWorkspaceId)) {
          if (data.workspaces.length > 0) {
            setActiveWorkspaceId(data.workspaces[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    refreshWorkspaces();
  }, []);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || null;

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      setActiveWorkspaceId,
      isLoading,
      refreshWorkspaces
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
