'use client';

import React, { useState } from 'react';
import { useSession, signOut, signIn } from 'next-auth/react';
import Image from 'next/image';
import {
  Settings2, LogOut, User as UserIcon, MoreHorizontal,
  Cpu, Lock, ShieldCheck, ChevronRight, X,
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="w-full h-12 bg-white/[0.03] animate-pulse rounded-xl border border-white/[0.06]" />
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
          bg-white/[0.03] border border-white/[0.07]
          hover:bg-violet-500/10 hover:border-violet-500/20
          text-sm font-medium text-slate-400 hover:text-slate-200
          transition-all duration-200 active:scale-[0.98] group
        "
        aria-label="Sign in to the AI UI Engine"
      >
        <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
          <Lock className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 transition-colors" />
        </div>
        <div className="text-left min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">
            Sign In
          </p>
          <p className="text-[10px] text-slate-600 truncate">
            Owner access required
          </p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 transition-all group-hover:translate-x-0.5 shrink-0" />
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
          hover:bg-white/[0.05] transition-all duration-200
          border border-transparent hover:border-white/[0.08]
        "
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Signed in as ${name}. Open user menu.`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar — glassmorphic with violet gradient ring */}
          <div className="
            w-9 h-9 rounded-full shrink-0 overflow-hidden
            bg-gradient-to-br from-violet-600 to-purple-700
            flex items-center justify-center
            border border-violet-400/20 shadow-lg shadow-violet-500/15
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
              <p className="text-sm font-semibold text-slate-100 truncate">
                {name}
              </p>
              {/* Owner badge */}
              <span className="
                hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md
                bg-violet-500/15 border border-violet-500/25 text-violet-300
                text-[9px] font-bold uppercase tracking-wider shrink-0
              ">
                <ShieldCheck className="w-2.5 h-2.5" />
                Owner
              </span>
            </div>
            <p className="text-[10px] text-slate-600 truncate">{email}</p>
          </div>
        </div>

        <MoreHorizontal className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
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
              bg-[#0B0F19]/95 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60
              overflow-hidden backdrop-blur-2xl
              animate-in fade-in slide-in-from-bottom-2 duration-150
            "
          >
            {/* User info header */}
            <div className="px-4 py-3 border-b border-white/[0.07] bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="
                  w-8 h-8 rounded-full shrink-0 overflow-hidden
                  bg-gradient-to-br from-violet-600 to-purple-700
                  flex items-center justify-center border border-violet-400/20
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
                  <p className="text-xs font-bold text-slate-100 truncate">{name}</p>
                  <p className="text-[10px] text-slate-600 truncate">{email}</p>
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
                  text-sm text-slate-400 hover:text-slate-100
                  hover:bg-white/[0.06] rounded-xl transition-all duration-150
                  group
                "
              >
                <div className="p-1 rounded-lg bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
                  <Cpu className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <span className="flex-1 text-left font-medium">Generation Engine</span>
                <Settings2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 group-hover:rotate-45 transition-all duration-300" />
              </button>

              {/* Profile Settings */}
              <button
                role="menuitem"
                onClick={() => { setIsOpen(false); setIsProfileOpen(true); }}
                className="
                  w-full flex items-center gap-2.5 px-3 py-2.5
                  text-sm text-slate-400 hover:text-slate-100
                  hover:bg-white/[0.06] rounded-xl transition-all duration-150
                  group
                "
              >
                <div className="p-1 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.09] transition-colors">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400" />
                </div>
                <span className="flex-1 text-left font-medium">Profile Settings</span>
              </button>

            </div>
          </div>
        </>
      )}

      {/* Profile Settings Modal */}
      {isProfileOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsProfileOpen(false)} aria-hidden="true" />
          <div className="fixed z-[60] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[#0B0F19]/95 border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 backdrop-blur-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b flex-shrink-0 border-white/[0.07] bg-white/[0.02]">
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/15 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-violet-400" />
                </div>
                Profile Settings
              </h2>
              <button onClick={() => setIsProfileOpen(false)} className="p-1.5 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.07] transition-colors">
                <span className="sr-only">Close</span>
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-5 space-y-6">
              {/* User Identity */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-violet-600 to-purple-700 flex flex-shrink-0 items-center justify-center border-2 border-violet-500/20 shadow-xl shadow-violet-500/10">
                  {session.user.image ? (
                    <Image src={session.user.image} alt={name} width={64} height={64} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-white">{initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">{name}</h3>
                  <p className="text-sm text-slate-500 truncate">{email}</p>
                  <span className="inline-flex mt-1.5 items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/25 text-violet-300 text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3" /> Owner
                  </span>
                </div>
              </div>
              
              {/* Actions Section */}
              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.07] p-4 space-y-3">
                <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest pl-1">Account Actions</h4>
                
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-xl text-red-500 hover:text-red-400 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-md bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                      <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-sm font-semibold">Sign Out</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
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
