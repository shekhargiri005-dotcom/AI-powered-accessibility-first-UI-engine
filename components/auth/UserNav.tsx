'use client';

import React, { useState } from 'react';
import { useSession, signOut, signIn } from 'next-auth/react';
import Image from 'next/image';
import {
  Settings2, LogOut, User as UserIcon, MoreHorizontal,
  Cpu, Lock, ShieldCheck, ChevronRight,
} from 'lucide-react';
import AIEngineConfigPanel, { type AIEngineConfig } from '@/components/AIEngineConfigPanel';

interface UserNavProps {
  onConfigSaved?: (config: AIEngineConfig) => void;
  onDeactivated?: () => void;
}

export default function UserNav({ onConfigSaved, onDeactivated }: UserNavProps) {
  const { data: session, status } = useSession();
  const [isOpen,       setIsOpen]       = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="w-full h-12 bg-gray-900/50 animate-pulse rounded-xl border border-gray-800/60" />
    );
  }

  // ── Unauthenticated ── sign-in prompt ─────────────────────────────────────
  if (!session?.user) {
    return (
      <button
        id="sign-in-prompt-btn"
        onClick={() => signIn()}
        className="
          w-full flex items-center gap-3 px-4 py-3 rounded-xl
          bg-gray-900/60 border border-gray-800/60
          hover:bg-gray-800/70 hover:border-gray-700/60
          text-sm font-medium text-gray-400 hover:text-gray-200
          transition-all duration-200 active:scale-[0.98] group
        "
        aria-label="Sign in to the AI UI Engine"
      >
        <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700/60 flex items-center justify-center shrink-0">
          <Lock className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-400 transition-colors" />
        </div>
        <div className="text-left min-w-0 flex-1">
          <p className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">
            Sign In
          </p>
          <p className="text-[10px] text-gray-600 truncate">
            Owner access required
          </p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-all group-hover:translate-x-0.5 shrink-0" />
      </button>
    );
  }

  // ── Authenticated ──────────────────────────────────────────────────────────
  const name     = session.user.name  || 'Owner';
  const email    = session.user.email || '';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative">
      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        id="user-nav-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="
          w-full flex items-center justify-between gap-3 p-2 pr-3 rounded-xl group
          hover:bg-gray-800/60 transition-all duration-200
          border border-transparent hover:border-gray-700/50
        "
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Signed in as ${name}. Open user menu.`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="
            w-9 h-9 rounded-full shrink-0 overflow-hidden
            bg-gradient-to-br from-blue-600 to-violet-600
            flex items-center justify-center
            border border-white/10 shadow-lg shadow-blue-500/10
          ">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={`${name} avatar`}
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-white">{initials}</span>
            )}
          </div>

          {/* Name + role */}
          <div className="text-left min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-gray-100 truncate">
                {name}
              </p>
              {/* Owner badge */}
              <span className="
                hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md
                bg-blue-500/15 border border-blue-500/25 text-blue-300
                text-[9px] font-bold uppercase tracking-wider shrink-0
              ">
                <ShieldCheck className="w-2.5 h-2.5" />
                Owner
              </span>
            </div>
            <p className="text-[10px] text-gray-500 truncate">{email}</p>
          </div>
        </div>

        <MoreHorizontal className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
      </button>

      {/* ── Dropdown menu ───────────────────────────────────────────────── */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            role="menu"
            className="
              absolute bottom-full left-0 right-0 mb-2 z-50
              bg-gray-900 border border-gray-800/80 rounded-2xl shadow-2xl shadow-black/60
              overflow-hidden
              animate-in fade-in slide-in-from-bottom-2 duration-150
            "
          >
            {/* User info header */}
            <div className="px-4 py-3 border-b border-gray-800/60 bg-gray-800/30">
              <div className="flex items-center gap-2.5">
                <div className="
                  w-8 h-8 rounded-full shrink-0 overflow-hidden
                  bg-gradient-to-br from-blue-600 to-violet-600
                  flex items-center justify-center border border-white/10
                ">
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-bold text-white">{initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-100 truncate">{name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{email}</p>
                </div>
                <span className="
                  ml-auto shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md
                  bg-emerald-500/15 border border-emerald-500/25 text-emerald-300
                  text-[9px] font-bold uppercase tracking-wider
                ">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
            </div>

            {/* Menu items */}
            <div className="p-1.5 space-y-0.5">
              {/* Generation Engine */}
              <button
                role="menuitem"
                onClick={() => { setIsOpen(false); setIsConfigOpen(true); }}
                className="
                  w-full flex items-center gap-2.5 px-3 py-2.5
                  text-sm text-gray-400 hover:text-gray-100
                  hover:bg-gray-800/70 rounded-xl transition-all duration-150
                  group
                "
              >
                <div className="p-1 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <span className="flex-1 text-left font-medium">Generation Engine</span>
                <Settings2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 group-hover:rotate-45 transition-all duration-300" />
              </button>

              {/* Profile Settings */}
              <button
                role="menuitem"
                className="
                  w-full flex items-center gap-2.5 px-3 py-2.5
                  text-sm text-gray-400 hover:text-gray-100
                  hover:bg-gray-800/70 rounded-xl transition-all duration-150
                  group
                "
              >
                <div className="p-1 rounded-lg bg-gray-700/40 group-hover:bg-gray-700/70 transition-colors">
                  <UserIcon className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-400" />
                </div>
                <span className="flex-1 text-left font-medium">Profile Settings</span>
              </button>

              {/* Divider */}
              <div className="h-px bg-gray-800/60 my-1.5 mx-1" />

              {/* Log out */}
              <button
                role="menuitem"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="
                  w-full flex items-center gap-2.5 px-3 py-2.5
                  text-sm text-red-400 hover:text-red-300
                  hover:bg-red-500/10 rounded-xl transition-all duration-150
                  group
                "
              >
                <div className="p-1 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                  <LogOut className="w-3.5 h-3.5 text-red-400/70 group-hover:text-red-400" />
                </div>
                <span className="flex-1 text-left font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* AI Engine Config panel */}
      <AIEngineConfigPanel
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSaved={(config) => {
          setIsConfigOpen(false);
          onConfigSaved?.(config);
        }}
        onDeactivated={() => {
          setIsConfigOpen(false);
          onDeactivated?.();
        }}
      />
    </div>
  );
}
