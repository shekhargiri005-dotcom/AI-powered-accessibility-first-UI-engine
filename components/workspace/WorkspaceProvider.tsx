'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
  role: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  isLoading: boolean;
  isCreating: boolean;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  deleteWorkspace: (id: string) => Promise<boolean>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // ── Create a new workspace ────────────────────────────────────────────────
  const createWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        console.error('[WorkspaceProvider] create failed:', data.error);
        return null;
      }
      const newWs: Workspace = data.workspace;
      setWorkspaces((prev) => [...prev, newWs]);
      setActiveWorkspaceId(newWs.id);
      return newWs;
    } catch (err) {
      console.error('[WorkspaceProvider] create error:', err);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  // ── Delete a workspace ───────────────────────────────────────────────────
  const deleteWorkspace = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/workspaces?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setWorkspaces((prev) => {
          const updated = prev.filter((w) => w.id !== id);
          // If we deleted the active workspace, switch to another one (or null)
          setActiveWorkspaceId((currentActive) => {
            if (currentActive === id) {
              return updated[0]?.id ?? null;
            }
            return currentActive;
          });
          return updated;
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[WorkspaceProvider] delete error:', error);
      return false;
    }
  }, []);

  // ── Fetch workspaces (and auto-provision if none exist) ───────────────────
  const refreshWorkspaces = useCallback(async () => {
    if (status !== 'authenticated') {
      if (status === 'unauthenticated') setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/workspaces');
      if (res.status === 401) { setIsLoading(false); return; }
      const data = await res.json();

      if (data.success) {
        const fetched: Workspace[] = data.workspaces ?? [];

        // Auto-provision: first login with zero workspaces → create "My Workspace"
        if (fetched.length === 0 && session?.user?.id) {
          const newWs = await createWorkspace('My Workspace');
          if (newWs) return; // createWorkspace already set the state
        }

        setWorkspaces(fetched);
        // Preserve the previously-selected workspace if it still exists;
        // otherwise fall back to the first one.
        setActiveWorkspaceId((prev) => {
          if (prev && fetched.find((w) => w.id === prev)) return prev;
          return fetched[0]?.id ?? null;
        });
      }
    } catch {
      // Network error — app still works without workspaces
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.id]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      setActiveWorkspaceId,
      isLoading,
      isCreating,
      refreshWorkspaces,
      createWorkspace,
      deleteWorkspace,
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
