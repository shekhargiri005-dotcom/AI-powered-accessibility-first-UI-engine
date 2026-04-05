'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { Settings2, LogOut, User as UserIcon, MoreHorizontal, Cpu } from 'lucide-react';
import AIEngineConfigPanel, { type AIEngineConfig } from '@/components/AIEngineConfigPanel';

interface UserNavProps {
  onConfigSaved?: (config: AIEngineConfig) => void;
}

export default function UserNav({ onConfigSaved }: UserNavProps) {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  if (status === 'loading') {
    return (
      <div className="w-full h-12 bg-gray-900/50 animate-pulse rounded-full border border-gray-800/60" />
    );
  }

  // ── Unauthenticated ← replaced with AI Engine Config button ──────────────
  if (!session?.user) {
    return (
      <>
        <button
          id="ai-engine-config-btn"
          onClick={() => setIsConfigOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl
            bg-gradient-to-r from-indigo-600/80 to-blue-600/80 hover:from-indigo-500/80 hover:to-blue-500/80
            text-white font-semibold text-sm transition-all duration-200 border border-indigo-500/30
            shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] group"
          aria-label="Open AI Engine Configuration"
        >
          <div className="p-1 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <span>AI Engine Config</span>
          <Settings2 className="w-3.5 h-3.5 ml-auto opacity-60 group-hover:opacity-100 group-hover:rotate-45 transition-all duration-300" />
        </button>

        <AIEngineConfigPanel
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          onSaved={(config) => {
            setIsConfigOpen(false);
            onConfigSaved?.(config);
          }}
        />
      </>
    );
  }

  // ── Authenticated ──────────────────────────────────────────────────────────
  const initials = session.user.name
    ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : session.user.email?.[0].toUpperCase() || 'U';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 p-2 rounded-xl group hover:bg-gray-800/50 transition-all border border-transparent hover:border-gray-700/50"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center border border-white/10 shrink-0 overflow-hidden shadow-lg shadow-blue-500/10">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name || 'User avatar'}
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-white">{initials}</span>
            )}
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-gray-100 truncate pr-1">
              {session.user.name || 'User'}
            </p>
            <p className="text-[10px] text-gray-500 lowercase truncate">
              {session.user.email || 'Free Plan'}
            </p>
          </div>
        </div>
        <MoreHorizontal className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-1">
            <div className="px-2.5 py-2 border-b border-gray-800 mb-1.5">
              <p className="text-xs font-bold text-gray-200 truncate pr-1">
                {session.user.name || 'Account'}
              </p>
              <p className="text-[10px] text-gray-500 truncate pb-0.5">
                {session.user.email}
              </p>
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => { setIsOpen(false); setIsConfigOpen(true); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 rounded-lg transition-colors group"
              >
                <Cpu className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                AI Engine Config
              </button>
              <button className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 rounded-lg transition-colors group">
                <UserIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-400 transition-colors" />
                Profile Settings
              </button>
              <div className="h-px bg-gray-800 my-1.5" />
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors group"
              >
                <LogOut className="w-4 h-4 text-red-400/60 group-hover:text-red-400 transition-colors" />
                Log Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Config panel accessible for authenticated users too */}
      <AIEngineConfigPanel
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSaved={(config) => {
          setIsConfigOpen(false);
          onConfigSaved?.(config);
        }}
      />
    </div>
  );
}
