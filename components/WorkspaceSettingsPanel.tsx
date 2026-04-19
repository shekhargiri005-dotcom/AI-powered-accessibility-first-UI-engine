'use client';

import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle, AlertCircle, Key, RefreshCw, Info
} from 'lucide-react';

// ─── Simplified Provider Info ─────────────────────────────────────────────────

const PROVIDER_INFO = [
  { id: 'openai', name: 'OpenAI', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', models: 'GPT-4o, GPT-4o-mini' },
  { id: 'google', name: 'Google Gemini', color: 'text-blue-400', bgColor: 'bg-blue-500/20', models: 'Gemini 2.0 Flash, 1.5 Pro' },
  { id: 'groq', name: 'Groq', color: 'text-orange-400', bgColor: 'bg-orange-500/20', models: 'Llama 3.3 70B, Mixtral' },
];

interface WorkspaceSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProviderStatus {
  id: string;
  name: string;
  configured: boolean;
  models: string[];
}

// ─── Simplified Component ─────────────────────────────────────────────────────

export default function WorkspaceSettingsPanel({ isOpen, onClose }: WorkspaceSettingsPanelProps) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasUniversalKey, setHasUniversalKey] = useState(false);

  // Fetch which providers have keys configured
  const fetchProviderStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/providers/status');
      const data = await res.json();
      if (res.ok && data.providers) {
        setProviders(data.providers);
        setHasUniversalKey(data.configuredCount > 0);
      }
    } catch (e) {
      console.error('Failed to load provider status', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchProviderStatus();
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const configuredCount = providers.filter(p => p.configured).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-50 bottom-0 left-0 right-0 sm:right-auto sm:w-[420px] max-h-[85vh] flex flex-col
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
              <h2 id="ws-settings-title" className="text-sm font-bold text-white">Provider Status</h2>
              <p className="text-[10px] text-gray-500">
                {configuredCount} of {providers.length} providers configured
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchProviderStatus}
              disabled={loading}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              aria-label="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Universal Key Notice */}
          {hasUniversalKey && (
            <div className="p-3 rounded-xl bg-emerald-900/20 border border-emerald-500/20">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-emerald-300">LLM_KEY Configured</p>
                  <p className="text-[10px] text-emerald-600/80 mt-0.5">
                    Your universal LLM_KEY environment variable is set. You can use any of the configured providers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Provider List */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Available Providers</p>
            
            {providers.length === 0 && loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-600" />
              </div>
            ) : (
              <div className="space-y-2">
                {PROVIDER_INFO.map((info) => {
                  const provider = providers.find(p => p.id === info.id);
                  const isConfigured = provider?.configured ?? false;
                  
                  return (
                    <div
                      key={info.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors
                        ${isConfigured 
                          ? 'bg-gray-900/60 border-gray-700/40' 
                          : 'bg-gray-900/30 border-gray-800/40 opacity-60'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${info.bgColor} flex items-center justify-center`}>
                          <span className={`text-xs font-bold ${info.color}`}>
                            {info.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">{info.name}</p>
                          <p className="text-[10px] text-gray-500">{info.models}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isConfigured ? (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Ready
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-700/50 text-gray-500 text-[10px] font-medium">
                            <AlertCircle className="w-3 h-3" />
                            Not Set
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800/60 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-300">How to Configure</p>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Add your <span className="font-mono text-blue-400">LLM_KEY</span> to your Vercel environment variables. 
                  This single key works with all supported providers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
