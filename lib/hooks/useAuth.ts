'use client';

import { useSession } from 'next-auth/react';

/**
 * Thin convenience hook wrapping next-auth's useSession.
 * Provides typed helpers for common auth checks.
 */
export function useAuth() {
  const { data: session, status } = useSession();

  return {
    /** Raw session user (null if unauthenticated) */
    user:            session?.user ?? null,
    /** True while the session is being fetched */
    isLoading:       status === 'loading',
    /** True when the user has an active session */
    isAuthenticated: status === 'authenticated',
    /** True when the session is absent */
    isGuest:         status === 'unauthenticated',
    /** Helper: display name */
    displayName:     session?.user?.name ?? session?.user?.email ?? 'Owner',
    /** Helper: user email */
    email:           session?.user?.email ?? null,
  };
}
