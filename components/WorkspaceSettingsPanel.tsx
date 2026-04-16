'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Eye, EyeOff, CheckCircle, AlertCircle, Loader2,
  Key, ChevronRight, Trash2, RotateCcw, RefreshCw
} from 'lucide-react';

// ─── Provider configuration ──────────────────────────────────────────────────

interface ProviderConfig {
  id: string;
  name: string;
  color: string;
  icon: string;
  envKey: string;
  placeholder: string;
  models: string[];
  docsUrl: string;
  isLocal?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    color: 'from-emerald-500 to-teal-600',
    icon: '⬡',
    envKey: 'OPENAI_API_KEY',
    placeholder: 'sk-proj-...',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: 'from-amber-600 to-orange-600',
    icon: '◎',
    envKey: 'ANTHROPIC_API_KEY',
    placeholder: 'sk-ant-...',
    models: ['claude-3-5-sonnet', 'claude-3-haiku'],
    docsUrl: 'https://console.anthropic.com/keys',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    color: 'from-blue-400 to-red-400',
    icon: '✨',
    envKey: 'GOOGLE_API_KEY',
    placeholder: 'AIzaSy...',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'groq',
    name: 'Groq',
    color: 'from-orange-500 to-red-500',
    icon: '⚡',
    envKey: 'GROQ_API_KEY',
    placeholder: 'gsk_...',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    docsUrl: 'https://console.groq.com/keys',
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type KeyStatus = 'idle' | 'saved' | 'error' | 'testing' | 'cleared';

/** Shape returned by GET /api/workspace/settings */
interface ServerSettings {
  [provider: string]: {
    model: string | null;
    hasApiKey: boolean;
    updatedAt: string;
  };
}

interface WorkspaceSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkspaceSettingsPanel({ isOpen, onClose }: WorkspaceSettingsPanelProps) {
  const [activeProvider, setActiveProvider] = useState<string>('openai');
  const [inputKeys, setInputKeys]           = useState<Record<string, string>>({});
  const [showKey, setShowKey]               = useState<Record<string, boolean>>({});
  const [statuses, setStatuses]             = useState<Record<string, KeyStatus>>({});
  const [errors, setErrors]                 = useState<Record<string, string>>({});
  const [serverSettings, setServerSettings] = useState<ServerSettings>({});
  const [loading, setLoading]               = useState(false);

  // Load server-side saved settings whenever the panel opens
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/workspace/settings');
      const data = await res.json();
      if (res.ok) setServerSettings(data.settings ?? {});
    } catch (e) {
      console.error('Failed to load workspace settings', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchSettings();
    setInputKeys({});
    setStatuses({});
    setErrors({});
  }, [isOpen, fetchSettings]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ─── Save handler ───────────────────────────────────────────────────────────

  const handleSave = async (providerId: string) => {
    const value = inputKeys[providerId]?.trim();
    if (!value) {
      setErrors(e => ({ ...e, [providerId]: 'Please enter a value.' }));
      return;
    }

    setStatuses(s => ({ ...s, [providerId]: 'testing' }));
    setErrors(e => ({ ...e, [providerId]: '' }));

    try {
      const res = await fetch('/api/workspace/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey: value }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatuses(s => ({ ...s, [providerId]: 'saved' }));
        setInputKeys(k => ({ ...k, [providerId]: '' }));   // clear input for security
        await fetchSettings();                              // refresh server state
        setTimeout(() => setStatuses(s => ({ ...s, [providerId]: 'idle' })), 3000);
      } else {
        throw new Error(data.error || 'Validation failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not validate key';
      setErrors(e => ({ ...e, [providerId]: msg }));
      setStatuses(s => ({ ...s, [providerId]: 'error' }));
    }
  };

  // ─── Clear handler (deletes from DB via POST { clear: true }) ──────────────

  const handleClear = async (providerId: string) => {
    setStatuses(s => ({ ...s, [providerId]: 'testing' }));
    try {
      const res = await fetch('/api/workspace/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, clear: true }),
      });
      if (res.ok) {
        setStatuses(s => ({ ...s, [providerId]: 'cleared' }));
        await fetchSettings();
        setTimeout(() => setStatuses(s => ({ ...s, [providerId]: 'idle' })), 2000);
      }
    } catch {
      setStatuses(s => ({ ...s, [providerId]: 'idle' }));
    }
  };

  // ─── Derived ────────────────────────────────────────────────────────────────

  const provider        = PROVIDERS.find(p => p.id === activeProvider)!;
  const status          = statuses[activeProvider] ?? 'idle';
  const error           = errors[activeProvider]   ?? '';
  const serverEntry     = serverSettings[activeProvider];
  const hasSavedKey     = !!serverEntry?.hasApiKey;
  const isProcessing    = status === 'testing';

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-50 bottom-0 left-0 w-full sm:w-[520px] max-h-[90vh] flex flex-col
          bg-gray-950 border border-gray-800/80 rounded-t-2xl sm:rounded-2xl sm:bottom-20 sm:left-4
          shadow-2xl shadow-black/60 animate-in slide-in-from-bottom-4 duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-settings-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-600/20 border border-blue-500/20">
              <Key className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 id="ws-settings-title" className="text-sm font-bold text-white">API Key Manager</h2>
              <p className="text-[10px] text-gray-500">Keys are encrypted server-side — never exposed to the browser</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <button
              onClick={fetchSettings}
              disabled={loading}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              aria-label="Refresh settings"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Provider tabs (left) */}
          <div className="w-40 border-r border-gray-800/60 flex flex-col py-3 gap-0.5 flex-shrink-0">
            {PROVIDERS.map(p => {
              const saved = !!serverSettings[p.id]?.hasApiKey;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveProvider(p.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 text-left w-full transition-all
                    ${activeProvider === p.id
                      ? 'bg-gray-800/60 text-white border-r-2 border-blue-500'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
                    }`}
                >
                  <span className="text-base leading-none">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    {saved && (
                      <p className="text-[9px] text-emerald-400 flex items-center gap-0.5 mt-0.5">
                        <CheckCircle className="w-2.5 h-2.5" /> Saved
                      </p>
                    )}
                    {p.isLocal && !saved && (
                      <p className="text-[9px] text-orange-400 mt-0.5">No key needed</p>
                    )}
                  </div>
                  {activeProvider === p.id && <ChevronRight className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Detail area (right) */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-w-0">
            {/* Provider header */}
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center text-white text-lg`}>
                {provider.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{provider.name}</h3>
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Get your key →
                </a>
              </div>
            </div>

            {/* Server-saved status */}
            {hasSavedKey && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-900/20 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">Key saved &amp; active</p>
                    {serverEntry?.updatedAt && (
                      <p className="text-[10px] text-emerald-600">
                        Updated {new Date(serverEntry.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleClear(provider.id)}
                  disabled={isProcessing}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-900/30 border border-red-500/20
                    text-red-400 hover:text-red-300 hover:bg-red-900/50 transition-colors text-[11px] font-semibold disabled:opacity-40"
                  aria-label={`Clear ${provider.name} key`}
                >
                  {isProcessing && status === 'testing' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  Clear
                </button>
              </div>
            )}

            {/* Ollama note */}
            {provider.isLocal && (
              <div className="p-3 rounded-xl bg-orange-900/20 border border-orange-500/20">
                <p className="text-xs text-orange-300 font-semibold mb-1">🦙 No API key required</p>
                <p className="text-[11px] text-orange-400/80">
                  Ollama runs locally. Make sure the Ollama server is running at{' '}
                  <code className="text-orange-300">http://localhost:11434</code>. 
                  Set <code className="text-orange-300">OLLAMA_BASE_URL</code> in .env.local to change the URL.
                </p>
              </div>
            )}

            {/* Available models */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Available Models</p>
              <div className="flex flex-wrap gap-1.5">
                {provider.models.map(m => (
                  <span key={m} className="px-2 py-0.5 bg-gray-900 border border-gray-800 rounded-md text-[10px] text-gray-300 font-mono">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Key input — hide for local providers */}
            {!provider.isLocal && (
              <div className="space-y-2">
                <label htmlFor={`key-${provider.id}`} className="text-xs font-semibold text-gray-300">
                  {hasSavedKey ? 'Replace API Key' : 'API Key'}
                </label>
                <div className="relative group">
                  <input
                    id={`key-${provider.id}`}
                    type={showKey[provider.id] ? 'text' : 'password'}
                    value={inputKeys[provider.id] ?? ''}
                    onChange={e => setInputKeys(k => ({ ...k, [provider.id]: e.target.value }))}
                    placeholder={hasSavedKey ? 'Enter new key to replace…' : provider.placeholder}
                    autoComplete="off"
                    className="w-full px-4 py-3 pr-24 bg-gray-900 border border-gray-700/60 rounded-xl text-sm
                      text-white placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50
                      focus:border-blue-500/50 transition-all group-hover:border-gray-600/80"
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(provider.id); }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKey(s => ({ ...s, [provider.id]: !s[provider.id] }))}
                      className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                      aria-label={showKey[provider.id] ? 'Hide key' : 'Show key'}
                    >
                      {showKey[provider.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {error}
                  </p>
                )}

                {/* Save button */}
                <button
                  onClick={() => handleSave(provider.id)}
                  disabled={isProcessing || !inputKeys[provider.id]?.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                    bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
                    text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                >
                  {status === 'testing'  && <Loader2    className="w-4 h-4 animate-spin" />}
                  {status === 'saved'    && <CheckCircle className="w-4 h-4 text-emerald-300" />}
                  {status === 'error'    && <RotateCcw   className="w-4 h-4" />}
                  {status === 'testing'  ? 'Validating & Saving…'
                    : status === 'saved'  ? '✓ Saved!'
                    : status === 'error'  ? 'Retry'
                    : hasSavedKey         ? 'Replace Key'
                    : 'Save & Validate'}
                </button>
              </div>
            )}

            {/* Env var hint */}
            <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800/60 space-y-1">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Environment Variable Fallback</p>
              <p className="text-[11px] font-mono text-gray-300">
                <span className="text-blue-400">{provider.envKey}</span>
                <span className="text-gray-600"> in </span>
                <span className="text-amber-400">.env.local</span>
              </p>
              <p className="text-[10px] text-gray-600">
                Keys saved here take priority over environment variables. Remove the saved key to revert to the env var.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
