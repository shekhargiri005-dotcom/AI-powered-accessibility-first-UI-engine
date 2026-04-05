'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Eye, EyeOff, Thermometer, CheckCircle, AlertCircle,
  Loader2, Settings2, Layers, RefreshCw, Wifi, WifiOff,
  Cpu, KeyRound, Zap, Globe, HardDrive,
} from 'lucide-react';

// ─── Provider Detection From API Key ─────────────────────────────────────────

export interface ProviderInfo {
  id: string;
  name: string;
  color: string;       // Tailwind gradient classes
  accent: string;      // Tailwind text colour
  icon: string;
  baseUrl?: string;    // Only set for OpenAI-compatible 3rd-parties
  modelHint: string;   // Placeholder for the model text input
  docsUrl: string;
  noKey?: boolean;     // true for local providers
}

const PROVIDERS: Record<string, ProviderInfo> = {
  openai: {
    id: 'openai', name: 'OpenAI',
    color: 'from-emerald-500 to-teal-500', accent: 'text-emerald-400', icon: '⬡',
    modelHint: 'e.g. gpt-4o, gpt-4-turbo, gpt-3.5-turbo',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic', name: 'Anthropic',
    color: 'from-amber-500 to-orange-500', accent: 'text-amber-400', icon: '◎',
    modelHint: 'e.g. claude-3-5-sonnet-20241022, claude-3-haiku-20240307',
    docsUrl: 'https://console.anthropic.com/keys',
  },
  google: {
    id: 'google', name: 'Google Gemini',
    color: 'from-blue-400 to-red-400', accent: 'text-blue-400', icon: '✦',
    modelHint: 'e.g. gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  groq: {
    id: 'groq', name: 'Groq',
    color: 'from-orange-500 to-red-500', accent: 'text-orange-400', icon: '⚡',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelHint: 'e.g. llama-3.3-70b-versatile, mixtral-8x7b-32768, gemma2-9b-it',
    docsUrl: 'https://console.groq.com/keys',
  },
  openrouter: {
    id: 'openrouter', name: 'OpenRouter',
    color: 'from-violet-500 to-purple-600', accent: 'text-violet-400', icon: '◉',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelHint: 'e.g. openai/gpt-4o, anthropic/claude-3.5-sonnet, meta-llama/llama-3-70b',
    docsUrl: 'https://openrouter.ai/keys',
  },
  together: {
    id: 'together', name: 'Together AI',
    color: 'from-cyan-500 to-blue-600', accent: 'text-cyan-400', icon: '◆',
    baseUrl: 'https://api.together.xyz/v1',
    modelHint: 'e.g. meta-llama/Llama-3-70b-chat-hf, mistralai/Mixtral-8x7B-Instruct-v0.1',
    docsUrl: 'https://api.together.ai/settings/api-keys',
  },
  ollama: {
    id: 'ollama', name: 'Ollama (Local)',
    color: 'from-lime-500 to-green-600', accent: 'text-lime-400', icon: '🦙',
    noKey: true,
    modelHint: '',
    docsUrl: 'https://ollama.com/library',
  },
  lmstudio: {
    id: 'lmstudio', name: 'LM Studio (Local)',
    color: 'from-teal-500 to-cyan-600', accent: 'text-teal-400', icon: '🖥️',
    noKey: true,
    modelHint: '',
    docsUrl: 'https://lmstudio.ai',
  },
  custom: {
    id: 'custom', name: 'Custom / Other',
    color: 'from-gray-500 to-gray-600', accent: 'text-gray-400', icon: '⚙',
    modelHint: 'Enter exact model name as expected by your API',
    docsUrl: 'https://openai.com/api/',
  },
};

/**
 * Detect provider from the API key prefix (zero network calls).
 * Returns null if unrecognized — UI shows a "Custom" state.
 */
function detectFromKey(key: string): ProviderInfo | null {
  const k = key.trim();
  if (!k) return null;
  if (k.startsWith('sk-ant-'))                 return PROVIDERS.anthropic;
  if (k.startsWith('AIzaSy'))                  return PROVIDERS.google;
  if (k.startsWith('gsk_'))                    return PROVIDERS.groq;
  if (k.startsWith('sk-or-'))                  return PROVIDERS.openrouter;
  if (k.startsWith('sk-') || k.startsWith('sk-proj-')) return PROVIDERS.openai;
  // Together AI keys are long alphanumeric, no sk- prefix
  if (k.length >= 32 && /^[a-f0-9]+$/i.test(k)) return PROVIDERS.together;
  return PROVIDERS.custom;
}

// ─── Stored Config Shape ──────────────────────────────────────────────────────

export interface AIEngineConfig {
  provider: string;       // provider id ('openai' | 'anthropic' | 'groq' | 'ollama' etc.)
  providerName: string;   // Display name
  model: string;          // Exact model name
  apiKey: string;         // Raw user key (client-side only; also sent per-request over HTTPS)
  baseUrl?: string;       // For OpenAI-compat providers
  temperature: number;
  fullAppMode: boolean;
  multiSlideMode: boolean;
  isLocal: boolean;
}

const STORAGE_KEY = 'aiEngineConfig';

export function loadAIEngineConfig(): AIEngineConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AIEngineConfig) : null;
  } catch { return null; }
}

// ─── Local Model type ─────────────────────────────────────────────────────────

interface LocalModel {
  id: string;
  label: string;
  size?: string;
  temperature: number;
}

interface LocalSource {
  name: string;
  provider: string;
  v1BaseUrl: string;
  running: boolean;
  models: LocalModel[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({
  id, checked, onChange, colorOn = 'bg-violet-600',
}: { id: string; checked: boolean; onChange: (v: boolean) => void; colorOn?: string }) {
  return (
    <button
      id={id} role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-2 focus:ring-offset-gray-950
        ${checked ? colorOn : 'bg-gray-700'}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: React.FC<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 flex items-center gap-1.5">
      <Icon className="w-3 h-3" />{children}
    </p>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (config: AIEngineConfig) => void;
}

type PanelMode = 'cloud' | 'local';

export default function AIEngineConfigPanel({ isOpen, onClose, onSaved }: Props) {
  const [mode, setMode]                   = useState<PanelMode>('cloud');

  // Cloud mode state
  const [apiKey, setApiKey]               = useState('');
  const [showKey, setShowKey]             = useState(false);
  const [detectedProvider, setDetected]   = useState<ProviderInfo | null>(null);
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [modelInput, setModelInput]       = useState('');
  const [temperature, setTemperature]     = useState(0.6);

  // Local mode state
  const [localSources, setLocalSources]   = useState<LocalSource[]>([]);
  const [localLoading, setLocalLoading]   = useState(false);
  const [localFetched, setLocalFetched]   = useState(false);
  const [selectedLocalSource, setSelectedLocalSource] = useState<LocalSource | null>(null);
  const [selectedLocalModel, setSelectedLocalModel]   = useState<LocalModel | null>(null);

  // Shared
  const [fullAppMode, setFullAppMode]     = useState(false);
  const [multiSlideMode, setMultiSlide]   = useState(false);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [error, setError]                 = useState('');

  // ── Session-persistent "engine is working" state ─────────────────────────
  // Survives panel close/re-open within the same browser tab.
  // Cleared automatically when the tab/window is closed (sessionStorage).
  const [sessionActive, setSessionActive] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('uiEngine_active') === '1';
  });

  const keyInputRef = useRef<HTMLInputElement>(null);

  // ── Detect provider as user types ──────────────────────────────────────────
  useEffect(() => {
    const p = detectFromKey(apiKey);
    setDetected(p);
    if (p && p.id !== 'custom') setCustomBaseUrl(p.baseUrl ?? '');
    setError('');
  }, [apiKey]);

  // ── Restore from localStorage ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setSaved(false);
    setError('');

    const stored = loadAIEngineConfig();
    if (stored) {
      if (stored.isLocal) {
        setMode('local');
        fetchLocalModels();
      } else {
        setMode('cloud');
        // Don't pre-fill API key (security), but restore everything else
        setModelInput(stored.model);
        setTemperature(stored.temperature);
        setCustomBaseUrl(stored.baseUrl ?? '');
      }
      setFullAppMode(stored.fullAppMode ?? false);
      setMultiSlide(stored.multiSlideMode ?? false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Escape key ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // ── Fetch local models ──────────────────────────────────────────────────────
  const fetchLocalModels = useCallback(async () => {
    setLocalLoading(true);
    setLocalSources([]);
    setSelectedLocalSource(null);
    setSelectedLocalModel(null);
    try {
      const res  = await fetch('/api/local-models');
      const data = await res.json() as { anyRunning: boolean; sources: LocalSource[] };
      setLocalSources(data.sources ?? []);
      // Auto-select the first running source + first model
      const first = (data.sources ?? []).find(s => s.running);
      if (first) {
        setSelectedLocalSource(first);
        setSelectedLocalModel(first.models[0] ?? null);
      }
    } catch {
      setLocalSources([]);
    } finally {
      setLocalLoading(false);
      setLocalFetched(true);
    }
  }, []);

  const handleModeSwitch = (m: PanelMode) => {
    setMode(m);
    setError('');
    if (m === 'local' && !localFetched) fetchLocalModels();
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError('');

    if (mode === 'cloud') {
      if (!apiKey.trim()) { setError('Paste your API key above.'); return; }
      if (!modelInput.trim()) { setError('Enter the model name exactly as the provider expects.'); return; }
    } else {
      if (!selectedLocalSource) { setError('No local runtime selected.'); return; }
      if (!selectedLocalModel) { setError('Select a model from the list.'); return; }
      if (!selectedLocalSource.running) { setError(`${selectedLocalSource.name} is not running. Start it and refresh.`); return; }
    }

    setSaving(true);
    await new Promise(r => setTimeout(r, 500));

    let config: AIEngineConfig;

    if (mode === 'cloud') {
      const prov = detectedProvider ?? PROVIDERS.custom;
      config = {
        provider: prov.id,
        providerName: prov.name,
        model: modelInput.trim(),
        apiKey: apiKey.trim(),
        baseUrl: customBaseUrl.trim() || prov.baseUrl,
        temperature,
        fullAppMode,
        multiSlideMode,
        isLocal: false,
      };
    } else {
      config = {
        provider: selectedLocalSource!.provider,
        providerName: selectedLocalSource!.name,
        model: selectedLocalModel!.id,
        apiKey: 'local',
        baseUrl: selectedLocalSource!.v1BaseUrl,
        temperature: selectedLocalModel!.temperature,
        fullAppMode,
        multiSlideMode,
        isLocal: true,
      };
    }

    try {
      // Persist config but mask the raw key
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, apiKey: config.isLocal ? 'local' : '••••' }));
      localStorage.setItem('uiEngine_fullAppMode', String(fullAppMode));
      localStorage.setItem('uiEngine_multiSlideMode', String(multiSlideMode));
      // Mark engine as active for this browser session
      sessionStorage.setItem('uiEngine_active', '1');
      setSessionActive(true);
      setSaved(true);
      onSaved(config);
      setTimeout(onClose, 1100);
    } catch {
      setError('Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const provider = detectedProvider ?? PROVIDERS.custom;
  const isLocal  = mode === 'local';
  const anyLocalRunning = localSources.some(s => s.running);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        role="dialog" aria-modal="true" aria-labelledby="aec-title"
        className="fixed z-50 bottom-0 left-0 w-full sm:w-[520px] max-h-[94vh] flex flex-col
          bg-gray-950 border border-gray-800/80 rounded-t-3xl sm:rounded-3xl
          sm:bottom-6 sm:left-4 shadow-2xl shadow-black/80
          animate-in slide-in-from-bottom-6 duration-300"
      >
        {/* Top colour bar — changes with detected provider */}
        <div className={`h-1 w-full bg-gradient-to-r ${isLocal ? 'from-lime-500 to-green-600' : provider.color} rounded-t-3xl sm:rounded-t-3xl flex-shrink-0`} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${isLocal ? 'from-lime-500 to-green-600' : provider.color} bg-opacity-20 border border-white/5 shadow-lg`}>
              <Settings2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 id="aec-title" className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                AI Engine Config
                {sessionActive && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Working
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-gray-500 mt-0.5">API key · model · generation settings</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-500 hover:text-white hover:bg-gray-800 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode tabs — Cloud vs Local */}
        <div className="flex-shrink-0 flex gap-1 px-6 pt-4">
          <button
            onClick={() => handleModeSwitch('cloud')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all
              ${mode === 'cloud'
                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}
          >
            <Globe className="w-3.5 h-3.5" /> Cloud / API Key
          </button>
          <button
            onClick={() => handleModeSwitch('local')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all
              ${mode === 'local'
                ? 'bg-lime-500/15 text-lime-300 border border-lime-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}
          >
            <HardDrive className="w-3.5 h-3.5" /> Local AI
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">

          {/* ══ CLOUD MODE ══════════════════════════════════════════════════ */}
          {mode === 'cloud' && (
            <>
              <div className="space-y-4">
                <SectionLabel icon={KeyRound}>API Key</SectionLabel>

                {/* Key input */}
                <div className="space-y-1.5">
                  <div className="relative group">
                    <input
                      ref={keyInputRef}
                      id="aec-apikey"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="Paste your API key here…"
                      autoComplete="off" spellCheck={false}
                      className="w-full px-4 py-3 pr-12 bg-gray-900 border border-gray-700/60 rounded-2xl text-sm text-white
                        placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40
                        focus:border-blue-500/40 group-hover:border-gray-600 transition-all"
                    />
                    <button
                      type="button" onClick={() => setShowKey(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300 rounded-lg transition-colors"
                      aria-label={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Detected provider badge */}
                  {apiKey.trim() && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all
                      ${detectedProvider ? 'bg-gray-900/60 border-gray-700/40' : 'bg-red-900/20 border-red-500/30'}`}>
                      <span className="text-base">{detectedProvider?.icon ?? '⚠️'}</span>
                      <span className={`text-xs font-semibold ${detectedProvider?.accent ?? 'text-red-400'}`}>
                        {detectedProvider?.name ?? 'Unrecognized key pattern — use Custom below'}
                      </span>
                      {detectedProvider && (
                        <a href={detectedProvider.docsUrl} target="_blank" rel="noopener noreferrer"
                          className="ml-auto text-[9px] text-gray-600 hover:text-gray-400 transition-colors">
                          docs ↗
                        </a>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-gray-600">
                    Key travels over HTTPS per-request only — never stored on our servers.
                  </p>
                </div>

                {/* Custom base URL — revealed when Custom provider selected */}
                {detectedProvider?.id === 'custom' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-500">
                      API Base URL (OpenAI-compatible endpoint)
                    </label>
                    <input
                      type="url"
                      value={customBaseUrl}
                      onChange={e => setCustomBaseUrl(e.target.value)}
                      placeholder="https://your-api-endpoint.com/v1"
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700/60 rounded-2xl text-sm text-white
                        placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Model name input */}
              <div className="space-y-1.5">
                <SectionLabel icon={Zap}>Model</SectionLabel>
                <input
                  id="aec-model"
                  type="text"
                  value={modelInput}
                  onChange={e => setModelInput(e.target.value)}
                  placeholder={detectedProvider?.modelHint || 'Enter exact model name…'}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700/60 rounded-2xl text-sm text-white
                    placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40
                    focus:border-blue-500/40 hover:border-gray-600 transition-all"
                />
                <p className="text-[10px] text-gray-600">
                  Enter the model name exactly as the provider API expects it. Any model works — including future ones.
                </p>
              </div>
            </>
          )}

          {/* ══ LOCAL MODE ══════════════════════════════════════════════════ */}
          {mode === 'local' && (
            <div className="space-y-4">
              <SectionLabel icon={Cpu}>Detected Local Runtimes</SectionLabel>

              {/* Scan status row */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gray-900/60 border border-gray-700/40">
                <div className="flex items-center gap-2">
                  {localLoading ? (
                    <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  ) : anyLocalRunning ? (
                    <Wifi className="w-3.5 h-3.5 text-lime-400" />
                  ) : localFetched ? (
                    <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  )}
                  <span className="text-xs font-semibold text-gray-300">
                    {localLoading  ? 'Scanning localhost…' :
                     anyLocalRunning ? `${localSources.filter(s => s.running).length} runtime(s) found` :
                     localFetched ? 'No local AI runtime detected' :
                     'Starting scan…'}
                  </span>
                </div>
                <button
                  onClick={fetchLocalModels} disabled={localLoading}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-lime-400 hover:bg-lime-500/10 transition-colors disabled:opacity-50"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${localLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Runtime list */}
              {localSources.length > 0 && localSources.map(source => (
                <div key={source.provider} className="space-y-2">
                  <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border cursor-pointer transition-all
                    ${source.running
                      ? selectedLocalSource?.provider === source.provider
                        ? 'bg-lime-500/15 border-lime-500/30'
                        : 'bg-gray-900/60 border-gray-700/40 hover:border-gray-600'
                      : 'bg-gray-900/30 border-gray-800/40 opacity-50 cursor-not-allowed'}`}
                    onClick={() => {
                      if (!source.running) return;
                      setSelectedLocalSource(source);
                      setSelectedLocalModel(source.models[0] ?? null);
                      setError('');
                    }}
                  >
                    {source.running
                      ? <Wifi className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                      : <WifiOff className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    <span className="text-sm font-semibold text-white">{source.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ml-1 ${source.running ? 'bg-lime-500/15 text-lime-400' : 'bg-red-500/15 text-red-400'}`}>
                      {source.running ? `${source.models.length} model${source.models.length !== 1 ? 's' : ''}` : 'offline'}
                    </span>
                    {selectedLocalSource?.provider === source.provider && source.running && (
                      <CheckCircle className="w-3.5 h-3.5 text-lime-400 ml-auto" />
                    )}
                  </div>

                  {/* Show models for selected (running) source */}
                  {selectedLocalSource?.provider === source.provider && source.running && source.models.length > 0 && (
                    <div className="ml-2 space-y-1 max-h-44 overflow-y-auto">
                      {source.models.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedLocalModel(m); setError(''); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-left transition-colors
                            ${selectedLocalModel?.id === m.id
                              ? 'bg-lime-500/15 border border-lime-500/30 text-white'
                              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'}`}
                        >
                          <span className="font-mono text-xs flex-1 truncate">{m.id}</span>
                          {m.size && <span className="text-[9px] text-gray-600 font-mono shrink-0">{m.size}</span>}
                          {selectedLocalModel?.id === m.id && <CheckCircle className="w-3.5 h-3.5 text-lime-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedLocalSource?.provider === source.provider && source.running && source.models.length === 0 && (
                    <p className="text-[10px] text-gray-500 px-4 pb-1">
                      No models found. Download one first (e.g. <code className="text-lime-400 font-mono">ollama pull llama3</code>).
                    </p>
                  )}
                </div>
              ))}

              {/* Not running help */}
              {localFetched && !localLoading && !anyLocalRunning && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-gray-900/60 border border-gray-700/40">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-400 leading-relaxed space-y-1">
                    <p><span className="font-semibold text-white">Ollama:</span> run <code className="text-lime-400 font-mono text-[10px] bg-lime-900/20 px-1 py-0.5 rounded">ollama serve</code>, then <code className="text-lime-400 font-mono text-[10px] bg-lime-900/20 px-1 py-0.5 rounded">ollama pull &lt;model&gt;</code></p>
                    <p><span className="font-semibold text-white">LM Studio:</span> open the app and start the local server on port 1234</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Temperature ── (shared) */}
          <div className="border-t border-gray-800/60 pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="aec-temp" className="text-[10px] font-semibold text-gray-500 flex items-center gap-1.5">
                <Thermometer className="w-3 h-3" /> Temperature
              </label>
              <span className={`text-sm font-bold tabular-nums ${isLocal ? 'text-lime-400' : provider.accent}`}>
                {(isLocal && selectedLocalModel ? selectedLocalModel.temperature : temperature).toFixed(2)}
              </span>
            </div>
            <input
              id="aec-temp" type="range" min={0} max={1} step={0.05}
              value={isLocal && selectedLocalModel ? selectedLocalModel.temperature : temperature}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (isLocal && selectedLocalModel) {
                  setSelectedLocalModel({ ...selectedLocalModel, temperature: v });
                } else {
                  setTemperature(v);
                }
              }}
              className="w-full h-1.5 appearance-none rounded-full bg-gray-800 cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(isLocal && selectedLocalModel ? selectedLocalModel.temperature : temperature) * 100}%, #1f2937 ${(isLocal && selectedLocalModel ? selectedLocalModel.temperature : temperature) * 100}%, #1f2937 100%)`
              }}
            />
            <div className="flex justify-between">
              <span className="text-[9px] text-gray-600">0.0 — Deterministic</span>
              <span className="text-[9px] text-gray-600">1.0 — Creative</span>
            </div>
          </div>

          {/* ── Generation Settings ── */}
          <div className="border-t border-gray-800/60 pt-4 space-y-3">
            <SectionLabel icon={Layers}>Generation Settings</SectionLabel>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-gray-900/60 border border-gray-700/40 rounded-2xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Settings2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <p className="text-sm font-semibold text-white">Full App Mode</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/20">Chunking</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Bypasses token limits — generates a file manifest then builds each file separately.
                </p>
              </div>
              <Toggle id="gen-full-app" checked={fullAppMode} onChange={setFullAppMode} colorOn="bg-violet-600" />
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-gray-900/60 border border-gray-700/40 rounded-2xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <p className="text-sm font-semibold text-white">Multi-slide Mode</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Paginated</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  AI outputs a multi-view / multi-slide architecture instead of a single static component.
                </p>
              </div>
              <Toggle id="gen-multi-slide" checked={multiSlideMode} onChange={setMultiSlide} colorOn="bg-emerald-600" />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-800/60 flex items-center gap-3 bg-gray-950/60 backdrop-blur">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-700/60 text-gray-400 hover:text-white hover:bg-gray-800 text-sm font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-[0.98] disabled:cursor-not-allowed
              ${saved
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : sessionActive && !saving
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90'
                  : isLocal
                    ? 'bg-gradient-to-r from-lime-500 to-green-600 text-white hover:opacity-90'
                    : `bg-gradient-to-r ${provider.color} text-white hover:opacity-90`
              }`}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved  && <CheckCircle className="w-4 h-4" />}
            {!saving && !saved && sessionActive && (
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            )}
            {saving ? 'Saving…' : saved ? 'Saved! Starting…' : sessionActive ? 'Working — Update Config' : 'Save & Start'}
          </button>
        </div>
      </div>
    </>
  );
}
