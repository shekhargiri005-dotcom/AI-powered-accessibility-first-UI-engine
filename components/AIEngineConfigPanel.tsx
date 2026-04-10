'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Eye, EyeOff, Thermometer, CheckCircle, AlertCircle,
  Loader2, Settings2, Layers, RefreshCw, Wifi, WifiOff,
  Cpu, KeyRound, Zap, Globe, HardDrive, ChevronDown,
  ChevronRight, FlaskConical, Sparkles,
} from 'lucide-react';
import { MODEL_REGISTRY } from '@/lib/ai/modelRegistry';

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
  keyLabel: string;    // Human-readable label for the API key field
  keyHint: string;     // Placeholder for the key input
  noKey?: boolean;     // true for local providers
}

const PROVIDERS: Record<string, ProviderInfo> = {
  openai: {
    id: 'openai', name: 'OpenAI',
    color: 'from-emerald-500 to-teal-500', accent: 'text-emerald-400', icon: '⬡',
    modelHint: 'gpt-4o, gpt-4o-mini, gpt-4-turbo…',
    keyLabel: 'OpenAI API Key',
    keyHint: 'sk-proj-… — get one at platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic', name: 'Anthropic',
    color: 'from-amber-500 to-orange-500', accent: 'text-amber-400', icon: '◎',
    modelHint: 'claude-3-5-sonnet-20241022, claude-3-haiku-20240307…',
    keyLabel: 'Anthropic API Key',
    keyHint: 'sk-ant-… — get one at console.anthropic.com/keys',
    docsUrl: 'https://console.anthropic.com/keys',
  },
  google: {
    id: 'google', name: 'Google Gemini',
    color: 'from-blue-400 to-red-400', accent: 'text-blue-400', icon: '✦',
    modelHint: 'gemini-2.0-flash, gemini-1.5-pro…',
    keyLabel: 'Google AI API Key',
    keyHint: 'AIzaSy… — get one at aistudio.google.com/apikey',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  groq: {
    id: 'groq', name: 'Groq',
    color: 'from-orange-500 to-red-500', accent: 'text-orange-400', icon: '⚡',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelHint: 'llama-3.3-70b-versatile, mixtral-8x7b-32768…',
    keyLabel: 'Groq API Key',
    keyHint: 'gsk_… — get one at console.groq.com/keys',
    docsUrl: 'https://console.groq.com/keys',
  },
  openrouter: {
    id: 'openrouter', name: 'OpenRouter',
    color: 'from-violet-500 to-purple-600', accent: 'text-violet-400', icon: '◉',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelHint: 'openai/gpt-4o, anthropic/claude-3.5-sonnet…',
    keyLabel: 'OpenRouter API Key',
    keyHint: 'sk-or-… — get one at openrouter.ai/keys',
    docsUrl: 'https://openrouter.ai/keys',
  },
  together: {
    id: 'together', name: 'Together AI',
    color: 'from-cyan-500 to-blue-600', accent: 'text-cyan-400', icon: '◆',
    baseUrl: 'https://api.together.xyz/v1',
    modelHint: 'meta-llama/Llama-3-70b-chat-hf, mistralai/Mixtral-8x7B…',
    keyLabel: 'Together AI API Key',
    keyHint: 'Get one at api.together.ai/settings/api-keys',
    docsUrl: 'https://api.together.ai/settings/api-keys',
  },
  deepseek: {
    id: 'deepseek', name: 'DeepSeek',
    color: 'from-sky-500 to-indigo-500', accent: 'text-sky-400', icon: '🔭',
    baseUrl: 'https://api.deepseek.com/v1',
    modelHint: 'deepseek-chat, deepseek-coder…',
    keyLabel: 'DeepSeek API Key',
    keyHint: 'Get one at platform.deepseek.com/api_keys',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  mistral: {
    id: 'mistral', name: 'Mistral AI',
    color: 'from-fuchsia-500 to-pink-600', accent: 'text-fuchsia-400', icon: '🌊',
    baseUrl: 'https://api.mistral.ai/v1',
    modelHint: 'mistral-large-latest, mistral-medium…',
    keyLabel: 'Mistral API Key',
    keyHint: 'Get one at console.mistral.ai/api-keys',
    docsUrl: 'https://console.mistral.ai/api-keys',
  },
  ollama: {
    id: 'ollama', name: 'Ollama (Local)',
    color: 'from-lime-500 to-green-600', accent: 'text-lime-400', icon: '🦙',
    noKey: true,
    modelHint: '',
    keyLabel: '',
    keyHint: '',
    docsUrl: 'https://ollama.com/library',
  },
  lmstudio: {
    id: 'lmstudio', name: 'LM Studio (Local)',
    color: 'from-teal-500 to-cyan-600', accent: 'text-teal-400', icon: '🖥️',
    noKey: true,
    modelHint: '',
    keyLabel: '',
    keyHint: '',
    docsUrl: 'https://lmstudio.ai',
  },
  huggingface: {
    id: 'huggingface', name: 'Hugging Face',
    color: 'from-amber-400 to-yellow-600', accent: 'text-amber-400', icon: '🤗',
    baseUrl: 'https://router.huggingface.co/v1',
    modelHint: 'meta-llama/Meta-Llama-3-8B-Instruct',
    keyLabel: 'Hugging Face Token',
    keyHint: 'hf_… — get one at huggingface.co/settings/tokens',
    docsUrl: 'https://huggingface.co/settings/tokens',
  },
  // ── Dedicated adapter slots ──────────────────────────────────────────────
  meta: {
    id: 'meta', name: 'Meta / Llama',
    color: 'from-blue-600 to-indigo-600', accent: 'text-blue-400', icon: '🦙',
    baseUrl: 'https://api.together.xyz/v1',
    modelHint: 'meta-llama/Llama-3.3-70B-Instruct, Llama-3.1-8B…',
    keyLabel: 'Together AI or Groq API Key',
    keyHint: 'Get one at api.together.ai or console.groq.com/keys',
    docsUrl: 'https://api.together.ai/settings/api-keys',
  },
  qwen: {
    id: 'qwen', name: 'Qwen (DashScope)',
    color: 'from-violet-500 to-purple-600', accent: 'text-violet-400', icon: '🔮',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelHint: 'qwen-turbo, qwen-plus, qwen-coder-turbo…',
    keyLabel: 'DashScope API Key',
    keyHint: 'Get one at dashscope.aliyun.com',
    docsUrl: 'https://dashscope.aliyun.com/',
  },
  gemma: {
    id: 'gemma', name: 'Gemma (Google)',
    color: 'from-sky-400 to-cyan-500', accent: 'text-sky-400', icon: '💎',
    baseUrl: 'https://api.together.xyz/v1',
    modelHint: 'google/gemma-2-27b-it, google/gemma-2-9b-it…',
    keyLabel: 'Together AI or Groq API Key',
    keyHint: 'Get one at api.together.ai or console.groq.com/keys',
    docsUrl: 'https://api.together.ai/settings/api-keys',
  },
  custom: {
    id: 'custom', name: 'Advanced / Custom',
    color: 'from-gray-500 to-gray-600', accent: 'text-gray-400', icon: '⚙',
    modelHint: 'Enter exact model name as expected by your API',
    keyLabel: 'API Key',
    keyHint: 'Enter your API key — used to generate UI components',
    docsUrl: 'https://openai.com/api/',
  },
};

// Provider order for the picker (local providers handled separately via tabs)
// Row 1: major cloud · Row 2: open-model hosts · Row 3: adapter-specific · Row 4: utilities
const CLOUD_PROVIDER_ORDER = [
  // Major cloud APIs
  'openai', 'anthropic', 'google', 'deepseek',
  // Dedicated adapter providers
  'mistral', 'meta', 'qwen', 'gemma',
  // Aggregators / fast inference
  'groq', 'openrouter', 'together', 'huggingface',
  // Catch-all
  'custom',
];

// ── All 24 models across 9 adapters ──────────────────────────────────────────
const PROVIDER_SUGGESTED_MODELS: Record<string, string[]> = {
  // ── OpenAI (4 models) ───────────────────────────────────────────────────
  openai:      ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
  // ── Anthropic (4 models) ────────────────────────────────────────────────
  anthropic:   ['claude-sonnet-4-5', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  // ── Google Gemini (3 models) ─────────────────────────────────────────────
  google:      ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  // ── DeepSeek (2 models) ─────────────────────────────────────────────────
  deepseek:    ['deepseek-chat', 'deepseek-coder'],
  // ── Mistral AI (3 models) ───────────────────────────────────────────────
  mistral:     ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  // ── Meta / Llama (3 models via Together) ────────────────────────────────
  meta:        ['meta-llama/Llama-3.3-70B-Instruct', 'meta-llama/Llama-3.1-8B-Instruct', 'meta-llama/Llama-3.2-3B-Instruct'],
  // ── Qwen / DashScope (3 models) ─────────────────────────────────────────
  qwen:        ['qwen-turbo', 'qwen-plus', 'qwen-coder-turbo'],
  // ── Gemma / Google (2 models via Together/Groq) ─────────────────────────
  gemma:       ['google/gemma-2-27b-it', 'google/gemma-2-9b-it'],
  // ── Groq fast inference (3 models) ──────────────────────────────────────
  groq:        ['llama-3.3-70b-versatile', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
  // ── Aggregators — curated picks (free text also supported) ───────────────
  openrouter:  ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct'],
  together:    ['meta-llama/Llama-3.3-70B-Instruct', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'Qwen/Qwen2.5-Coder-32B-Instruct'],
  huggingface: ['meta-llama/Meta-Llama-3-8B-Instruct'],
  custom:      [],
};

/**
 * Detect provider from the API key prefix (zero network calls).
 * Returns null if unrecognized — UI shows a "Custom" state.
 */
function detectFromKey(key: string): ProviderInfo | null {
  const k = key.trim();
  if (!k) return null;
  if (k.startsWith('sk-ant-'))                   return PROVIDERS.anthropic;
  if (k.startsWith('AIzaSy'))                    return PROVIDERS.google;
  if (k.startsWith('gsk_'))                      return PROVIDERS.groq;
  if (k.startsWith('sk-or-'))                    return PROVIDERS.openrouter;
  if (k.startsWith('hf_'))                       return PROVIDERS.huggingface;
  if (k.startsWith('sk-proj-') || k.startsWith('sk-svcacct-')) return PROVIDERS.openai;
  // DeepSeek keys are specifically sk- followed by 32 hex chars
  if (/^sk-[a-f0-9]{32}$/.test(k))               return PROVIDERS.deepseek;
  if (k.length >= 32 && /^[a-f0-9]+$/i.test(k))  return PROVIDERS.together;
  
  // Ambiguous `sk-...` keys (legacy OpenAI, Mistral, etc.) won't force an auto-switch
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

// Step indicator pill
function StepPill({
  step, label, active, done, onClick,
}: { step: number; label: string; active: boolean; done: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!done && !active}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all
        ${active
          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          : done
            ? 'text-gray-400 hover:text-gray-200 cursor-pointer border border-transparent hover:border-gray-700'
            : 'text-gray-600 cursor-default border border-transparent'
        }`}
    >
      <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black
        ${active ? 'bg-blue-500 text-white' : done ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-600'}`}>
        {done && !active ? <CheckCircle className="w-3 h-3" /> : step}
      </span>
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (config: AIEngineConfig) => void;
  onDeactivated?: () => void;
}

type PanelMode = 'cloud' | 'local';
type CloudStep = 1 | 2 | 3;

export default function AIEngineConfigPanel({ isOpen, onClose, onSaved, onDeactivated }: Props) {
  const [mode, setMode]                   = useState<PanelMode>('cloud');

  // Cloud mode — 3-step wizard state
  const [cloudStep, setCloudStep]         = useState<CloudStep>(1);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('openai');
  const [apiKey, setApiKey]               = useState('');
  const [showKey, setShowKey]             = useState(false);
  const [keyDetectedProvider, setKeyDetectedProvider] = useState<ProviderInfo | null>(null);
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  // Model selection
  const [selectedModelId, setSelectedModelId]   = useState<string>('');
  const [customModelText, setCustomModelText]   = useState('');
  const [useCustomModel, setUseCustomModel]     = useState(false);
  // Dynamic model fetching
  const [fetchedModels,    setFetchedModels]    = useState<{ id: string; name: string; contextWindow?: number; isFeatured?: boolean }[]>([]);
  const [modelsFetching,   setModelsFetching]   = useState(false);
  const [modelsFetched,    setModelsFetched]    = useState(false);
  const [modelsFetchError, setModelsFetchError] = useState('');
  const [modelSearch,      setModelSearch]      = useState('');
  const [temperature, setTemperature]     = useState(0.6);
  const [advancedOpen, setAdvancedOpen]   = useState(false);
  const [testingConn, setTestingConn]     = useState(false);
  const [connStatus, setConnStatus]       = useState<'idle' | 'ok' | 'fail'>('idle');

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
  const [sessionActive, setSessionActive] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('uiEngine_active') === '1';
  });

  const keyInputRef = useRef<HTMLInputElement>(null);

  // Derived
  const provider = PROVIDERS[selectedProviderId] ?? PROVIDERS.custom;
  const suggestedModels = PROVIDER_SUGGESTED_MODELS[selectedProviderId] ?? [];
  const isLocal  = mode === 'local';
  const anyLocalRunning = localSources.some(s => s.running);

  // The final model value
  const effectiveModel = useCustomModel ? customModelText.trim() : selectedModelId;

  // ── When provider changes, reset model + fetch state ────────────────────
  useEffect(() => {
    setSelectedModelId('');
    setCustomModelText('');
    setUseCustomModel(false);
    setFetchedModels([]);
    setModelsFetched(false);
    setModelsFetchError('');
    setModelSearch('');
    setConnStatus('idle');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProviderId]);

  // ── Detect provider from key as user types (secondary shortcut) ─────────
  useEffect(() => {
    const p = detectFromKey(apiKey);
    setKeyDetectedProvider(p);
    // Auto-jump provider selector if confident detection
    if (p && p.id !== 'custom' && p.id !== selectedProviderId) {
      setSelectedProviderId(p.id);
    }
    if (p && p.id !== 'custom') setCustomBaseUrl(p.baseUrl ?? '');
    setConnStatus('idle');
    setError('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // ── Restore from localStorage ───────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setSaved(false);
    setError('');
    setCloudStep(1);

    const stored = loadAIEngineConfig();
    if (stored) {
      if (stored.isLocal) {
        setMode('local');
        fetchLocalModels();
      } else {
        setMode('cloud');
        if (stored.provider && PROVIDERS[stored.provider]) {
          setSelectedProviderId(stored.provider);
        }
        setCustomModelText(stored.model ?? '');
        setUseCustomModel(true);
        setTemperature(stored.temperature ?? 0.6);
        setCustomBaseUrl(stored.baseUrl ?? '');
      }
      setFullAppMode(stored.fullAppMode ?? false);
      setMultiSlide(stored.multiSlideMode ?? false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Escape key ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // ── Fetch local models ─────────────────────────────────────────────────
  const fetchLocalModels = useCallback(async () => {
    setLocalLoading(true);
    setLocalSources([]);
    setSelectedLocalSource(null);
    setSelectedLocalModel(null);
    
    let activeSources: LocalSource[] = [];

    try {
      // 1. First attempt Next.js backend detection (Works if Next is run natively on host)
      const res  = await fetch('/api/local-models?t=' + Date.now());
      const data = await res.json() as { anyRunning: boolean; sources: LocalSource[] };
      activeSources = data.sources || [];
    } catch {
      activeSources = [];
    }

    // 2. Direct Browser fallback: Bypasses Docker/WSL Network boundaries
    // If backend found nothing, the Next.js process might be in an isolated container. 
    // We can ping Ollama natively from the host's actual browser!
    if (!activeSources.some(s => s.running)) {
      try {
        const directRes = await fetch('http://127.0.0.1:11434/api/tags');
        if (directRes.ok) {
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           const data = await directRes.json() as any;
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           const models = (data.models || []).map((m: any) => {
              const rawName = m.name || m.id || 'unknown';
              const [base, tag] = rawName.split(':');
              const pretty = base.split(/[-_]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              
              let t = 0.6;
              const n = rawName.toLowerCase();
              if (n.includes('coder') || n.includes('code')) t = 0.3;
              else if (n.includes('instruct') || n.includes('chat')) t = 0.5;

              return {
                 id: rawName,
                 label: tag ? `${pretty} (${tag})` : pretty,
                 size: m.size ? `${(m.size / 1073741824).toFixed(1)} GB` : undefined,
                 temperature: t
              };
           });
           
           activeSources = [{
             name: 'Ollama',
             provider: 'ollama',
             v1BaseUrl: 'http://127.0.0.1:11434/v1',
             running: true,
             models
           }];
        }
      } catch {
        // Direct browser ping failed (CORS or genuinely offline)
      }
    }

    setLocalSources(activeSources);
    const first = activeSources.find(s => s.running);
    if (first) {
      setSelectedLocalSource(first);
      setSelectedLocalModel(first.models[0] ?? null);
    }

    setLocalLoading(false);
    setLocalFetched(true);
  }, []);

  const handleModeSwitch = (m: PanelMode) => {
    setMode(m);
    setError('');
    setCloudStep(1);
    if (m === 'local' && !localFetched) fetchLocalModels();
  };

  // ── Fetch Models from provider API ─────────────────────────────────────
  const fetchModels = useCallback(async () => {
    if (modelsFetching) return;
    const key = provider.noKey ? 'local' : apiKey.trim();
    setModelsFetching(true);
    setModelsFetchError('');
    setFetchedModels([]);
    try {
      const params = new URLSearchParams({ provider: selectedProviderId });
      if (key && key !== 'local') params.set('apiKey', key);
      if (customBaseUrl.trim()) params.set('baseUrl', customBaseUrl.trim());
      else if (provider.baseUrl) params.set('baseUrl', provider.baseUrl);
      const res  = await fetch(`/api/models?${params}`);
      const data = await res.json();
      if (data.success && data.models?.length) {
        setFetchedModels(data.models);
        setModelsFetched(true);
        // Auto-select the first featured model
        const firstFeatured = data.models.find((m: { isFeatured?: boolean; id: string }) => m.isFeatured);
        if (firstFeatured && !selectedModelId) setSelectedModelId(firstFeatured.id);
      } else {
        setModelsFetchError(data.error ?? 'No models returned.');
      }
    } catch (err) {
      setModelsFetchError(err instanceof Error ? err.message : 'Failed to fetch models.');
    } finally {
      setModelsFetching(false);
    }
  }, [provider, apiKey, selectedProviderId, customBaseUrl, modelsFetching, selectedModelId]);

  // ── Test Connection ─────────────────────────────────────────────────────
  const handleTestConnection = async () => {
    if (!apiKey.trim()) { setError('Add your API key to test the connection.'); return; }
    setTestingConn(true);
    setConnStatus('idle');
    try {
      const base = customBaseUrl.trim() || provider.baseUrl || 'https://api.openai.com/v1';
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });
      setConnStatus(res.ok ? 'ok' : 'fail');
    } catch {
      setConnStatus('fail');
    } finally {
      setTestingConn(false);
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError('');

    if (mode === 'cloud') {
      if (!selectedProviderId || !PROVIDERS[selectedProviderId]) {
        setError('Choose a provider first.');
        setCloudStep(1);
        return;
      }
      if (!apiKey.trim() && !provider.noKey) {
        setError('Enter API credentials before choosing a model.');
        setCloudStep(2);
        return;
      }
      if (!effectiveModel) {
        setError('Choose a generation model or enter a custom one.');
        setCloudStep(3);
        return;
      }
    } else {
      if (!selectedLocalSource) { setError('No local runtime selected.'); return; }
      if (!selectedLocalModel) { setError('Select a model from the list.'); return; }
      if (!selectedLocalSource.running) {
        setError(`${selectedLocalSource.name} is not running. Start it and refresh.`);
        return;
      }
    }

    setSaving(true);
    await new Promise(r => setTimeout(r, 500));

    let config: AIEngineConfig;

    if (mode === 'cloud') {
      config = {
        provider: provider.id,
        providerName: provider.name,
        model: effectiveModel,
        apiKey: apiKey.trim(),
        baseUrl: customBaseUrl.trim() || provider.baseUrl,
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, apiKey: config.isLocal ? 'local' : '••••' }));
      localStorage.setItem('uiEngine_fullAppMode', String(fullAppMode));
      localStorage.setItem('uiEngine_multiSlideMode', String(multiSlideMode));
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

  // ── Deactivate (stop the engine) ──────────────────────────────────────────
  const handleDeactivate = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('uiEngine_fullAppMode');
      localStorage.removeItem('uiEngine_multiSlideMode');
      sessionStorage.removeItem('uiEngine_active');
    } catch { /* ignore */ }
    // Reset all local state
    setSessionActive(false);
    setSaved(false);
    setApiKey('');
    setConnStatus('idle');
    setSelectedLocalSource(null);
    setSelectedLocalModel(null);
    setError('');
    setCloudStep(1);
    onDeactivated?.();
    onClose();
  };

  if (!isOpen) return null;

  // ── Determine gradient for top bar / header icon ─────────────────────────
  const headerGradient = isLocal ? 'from-lime-500 to-green-600' : provider.color;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        role="dialog" aria-modal="true" aria-labelledby="ges-title"
        className="fixed z-50 bottom-0 left-0 w-full sm:w-[440px] max-h-[94vh] flex flex-col
          bg-gray-950 border border-gray-800/80 rounded-t-3xl sm:rounded-3xl
          sm:bottom-6 sm:left-4 shadow-2xl shadow-black/80
          animate-in slide-in-from-bottom-6 duration-300"
      >
        {/* Top colour bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${headerGradient} rounded-t-3xl sm:rounded-t-3xl flex-shrink-0`} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${headerGradient} bg-opacity-20 border border-white/5 shadow-lg`}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 id="ges-title" className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Generation Engine Setup
                {sessionActive && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Powers prompt-to-UI generation and refinement</p>
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
            <Globe className="w-3.5 h-3.5" /> Cloud / API
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

          {/* ══ CLOUD MODE ════════════════════════════════════════════════════ */}
          {mode === 'cloud' && (
            <>
              {/* 3-step progress pills */}
              <div className="flex items-center gap-1 flex-wrap">
                <StepPill step={1} label="Provider"    active={cloudStep === 1} done={cloudStep > 1} onClick={() => setCloudStep(1)} />
                <ChevronRight className="w-3 h-3 text-gray-700 flex-shrink-0" />
                <StepPill step={2} label="Credentials" active={cloudStep === 2} done={cloudStep > 2} onClick={() => cloudStep > 2 && setCloudStep(2)} />
                <ChevronRight className="w-3 h-3 text-gray-700 flex-shrink-0" />
                <StepPill step={3} label="Model"       active={cloudStep === 3} done={false} />
              </div>

              {/* ─ Step 1: Pick Provider ─────────────────────────────────── */}
              {cloudStep === 1 && (
                <div className="space-y-3">
                  <SectionLabel icon={Globe}>Step 1 — Pick your Generation Provider</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {CLOUD_PROVIDER_ORDER.map(pid => {
                      const p = PROVIDERS[pid];
                      const isSelected = selectedProviderId === pid;
                      return (
                        <button
                          key={pid}
                          onClick={() => { setSelectedProviderId(pid); setError(''); }}
                          className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl border text-center transition-all
                            ${isSelected
                              ? `bg-gradient-to-b ${p.color} bg-opacity-10 border-white/20 shadow-md`
                              : 'bg-gray-900/60 border-gray-700/40 hover:border-gray-600 hover:bg-gray-800/60'
                            }`}
                        >
                          <span className="text-lg leading-none">{p.icon}</span>
                          <span className={`text-[10px] font-semibold leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                            {p.name}
                          </span>
                          {isSelected && (
                            <CheckCircle className="w-3 h-3 text-white/70" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─ Step 2: API Credentials ──────────────────────────────── */}
              {cloudStep === 2 && (
                <div className="space-y-4">
                  <SectionLabel icon={KeyRound}>Step 2 — Enter API Credentials</SectionLabel>

                  {/* Provider recap chip */}
                  <button
                    onClick={() => setCloudStep(1)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-700/40 bg-gray-900/60 text-xs font-semibold ${provider.accent} hover:border-gray-600 transition-all`}
                  >
                    <span>{provider.icon}</span>
                    {provider.name}
                    <span className="text-gray-600 font-normal">— change</span>
                  </button>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-500">{provider.keyLabel}</label>
                    <div className="relative group">
                      <input
                        ref={keyInputRef}
                        id="ges-apikey"
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder={provider.keyHint}
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

                    {/* Key-detected provider auto-match badge */}
                    {apiKey.trim() && keyDetectedProvider && keyDetectedProvider.id !== selectedProviderId && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-amber-900/20 border-amber-500/30">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[10px] text-amber-300">
                          Key looks like <strong>{keyDetectedProvider.name}</strong> — auto-switched provider.
                        </span>
                      </div>
                    )}

                    {/* Connection test */}
                    {apiKey.trim() && (
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={handleTestConnection}
                          disabled={testingConn}
                          className="inline-flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
                        >
                          {testingConn
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <FlaskConical className="w-3 h-3" />}
                          {testingConn ? 'Testing connection…' : '▸ Test connection'}
                        </button>
                        {connStatus === 'ok' && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Connected</span>}
                        {connStatus === 'fail' && <span className="text-[10px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Check key / network</span>}
                      </div>
                    )}

                    <p className="text-[10px] text-gray-600">
                      Key travels over HTTPS per-request only — never stored on our servers.
                      <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-gray-500 hover:text-gray-300 transition-colors">Get a key ↗</a>
                    </p>
                  </div>

                  {/* Custom base URL for custom provider */}
                  {selectedProviderId === 'custom' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-gray-500">API Base URL (OpenAI-compatible endpoint)</label>
                      <input
                        id="ges-baseurl"
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
              )}

              {cloudStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <SectionLabel icon={Zap}>Step 3 — Choose Generation Model</SectionLabel>
                    {modelsFetched && (
                      <span className="text-[10px] text-gray-500">
                        {fetchedModels.length} models available
                      </span>
                    )}
                  </div>

                  {/* Fetch models button / status */}
                  {!modelsFetched && (
                    <div className="space-y-2">
                      <button
                        id="fetch-models-btn"
                        onClick={fetchModels}
                        disabled={modelsFetching}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r ${provider.color} hover:opacity-90 disabled:opacity-60 transition-all shadow-md`}
                      >
                        {modelsFetching
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching models…</>
                          : <><RefreshCw className="w-4 h-4" /> Fetch Available Models</>}
                      </button>
                      {modelsFetchError && (
                        <p className="text-[10px] text-red-400 px-1">{modelsFetchError}</p>
                      )}
                      <p className="text-[10px] text-gray-600 text-center">
                        Your key is sent over HTTPS to query {provider.name}&apos;s model list — never stored.
                      </p>
                    </div>
                  )}

                  {/* Live model list (searchable) */}
                  {modelsFetched && fetchedModels.length > 0 && (
                    <div className="space-y-2">
                      {/* Search bar */}
                      {fetchedModels.length > 6 && (
                        <div className="relative">
                          <input
                            id="model-search"
                            type="text"
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            placeholder="Search models…"
                            className="w-full px-3 py-2 pl-8 bg-gray-900 border border-gray-700/60 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
                          />
                          <Cpu className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                        </div>
                      )}

                      {/* Model list */}
                      <div className="max-h-[220px] overflow-y-auto space-y-1 pr-0.5 rounded-xl">
                        {fetchedModels
                          .filter((m) => !modelSearch || m.id.toLowerCase().includes(modelSearch.toLowerCase()) || m.name.toLowerCase().includes(modelSearch.toLowerCase()))
                          .map((m) => {
                            const isSelected = !useCustomModel && selectedModelId === m.id;
                            return (
                              <button
                                key={m.id}
                                onClick={() => { setSelectedModelId(m.id); setUseCustomModel(false); setError(''); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all border
                                  ${isSelected
                                    ? `bg-gradient-to-r ${provider.color} bg-opacity-20 border-white/20 text-white shadow-md`
                                    : 'bg-gray-900/60 border-gray-800/60 text-gray-300 hover:border-gray-600 hover:text-white hover:bg-gray-800/60'}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {m.isFeatured && <span className="text-amber-400 text-[9px] font-black">★</span>}
                                    <span className="font-mono text-[11px] truncate">{m.id}</span>
                                  </div>
                                  {m.name !== m.id && (
                                    <span className="text-[10px] text-gray-500 truncate block">{m.name}</span>
                                  )}
                                </div>
                                {m.contextWindow && (
                                  <span className="text-[9px] text-gray-600 shrink-0 font-mono">
                                    {m.contextWindow >= 1000 ? `${Math.round(m.contextWindow / 1000)}K ctx` : `${m.contextWindow} ctx`}
                                  </span>
                                )}
                                {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white/70 shrink-0" />}
                              </button>
                            );
                          })}
                      </div>

                      {/* Refetch button */}
                      <button
                        onClick={() => { setModelsFetched(false); setFetchedModels([]); setModelSearch(''); }}
                        className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh list
                      </button>
                    </div>
                  )}

                  {/* Custom / advanced override */}
                  <div className="pt-1 border-t border-gray-800/60 space-y-1.5">
                    <button
                      onClick={() => setUseCustomModel((v) => !v)}
                      className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform ${useCustomModel ? 'rotate-0' : '-rotate-90'}`} />
                      {useCustomModel ? 'Using a custom model ID' : 'Enter model ID manually…'}
                    </button>
                    {useCustomModel && (
                      <input
                        id="ges-model"
                        type="text"
                        value={customModelText}
                        onChange={(e) => setCustomModelText(e.target.value)}
                        placeholder={provider.modelHint || 'Enter exact model ID…'}
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700/60 rounded-2xl text-sm text-white
                          placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40
                          focus:border-blue-500/40 hover:border-gray-600 transition-all"
                      />
                    )}
                    <p className="text-[10px] text-gray-600">
                      Any model works — including future ones. Use the exact ID your provider expects.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Advanced Settings (collapsed) ──────────────────────── */}
              {cloudStep === 3 && (
                <div className="border-t border-gray-800/60 pt-3">
                  <button
                    onClick={() => setAdvancedOpen(v => !v)}
                    className="flex items-center gap-2 text-[10px] font-semibold text-gray-500 hover:text-gray-300 transition-colors w-full text-left"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${advancedOpen ? 'rotate-0' : '-rotate-90'}`} />
                    ▸ Advanced Settings
                  </button>

                  {advancedOpen && (
                    <div className="mt-3 space-y-4">
                      {/* Temperature */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="ges-temp" className="text-[10px] font-semibold text-gray-500 flex items-center gap-1.5">
                            <Thermometer className="w-3 h-3" /> Temperature
                          </label>
                          <span className={`text-sm font-bold tabular-nums ${provider.accent}`}>
                            {temperature.toFixed(2)}
                          </span>
                        </div>
                        <input
                          id="ges-temp" type="range" min={0} max={1} step={0.05}
                          value={temperature}
                          onChange={e => setTemperature(parseFloat(e.target.value))}
                          className="w-full h-1.5 appearance-none rounded-full bg-gray-800 cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                            [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${temperature * 100}%, #1f2937 ${temperature * 100}%, #1f2937 100%)`
                          }}
                        />
                        <div className="flex justify-between">
                          <span className="text-[9px] text-gray-600">0.0 — Deterministic</span>
                          <span className="text-[9px] text-gray-600">1.0 — Creative</span>
                        </div>
                      </div>

                      {/* Generation toggles */}
                      <div className="space-y-2">
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
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ══ LOCAL MODE ════════════════════════════════════════════════════ */}
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
              {localSources.filter(s => s.running).length > 0 && localSources.filter(source => source.running).map(source => (
                <div key={source.name} className="space-y-2">
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

              {/* Local mode temperature (always shown) */}
              <div className="border-t border-gray-800/60 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="ges-temp-local" className="text-[10px] font-semibold text-gray-500 flex items-center gap-1.5">
                    <Thermometer className="w-3 h-3" /> Temperature
                  </label>
                  <span className="text-sm font-bold tabular-nums text-lime-400">
                    {(selectedLocalModel ? selectedLocalModel.temperature : temperature).toFixed(2)}
                  </span>
                </div>
                <input
                  id="ges-temp-local" type="range" min={0} max={1} step={0.05}
                  value={selectedLocalModel ? selectedLocalModel.temperature : temperature}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (selectedLocalModel) {
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
                    background: `linear-gradient(to right, #84cc16 0%, #84cc16 ${(selectedLocalModel ? selectedLocalModel.temperature : temperature) * 100}%, #1f2937 ${(selectedLocalModel ? selectedLocalModel.temperature : temperature) * 100}%, #1f2937 100%)`
                  }}
                />
                <div className="flex justify-between">
                  <span className="text-[9px] text-gray-600">0.0 — Deterministic</span>
                  <span className="text-[9px] text-gray-600">1.0 — Creative</span>
                </div>
              </div>

              {/* Generation toggles for local */}
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
                  <Toggle id="gen-full-app-local" checked={fullAppMode} onChange={setFullAppMode} colorOn="bg-violet-600" />
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
                  <Toggle id="gen-multi-slide-local" checked={multiSlideMode} onChange={setMultiSlide} colorOn="bg-emerald-600" />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-800/60 bg-gray-950/60 backdrop-blur space-y-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (mode === 'cloud' && cloudStep === 1) {
                  setError('');
                  setCloudStep(2);
                } else if (mode === 'cloud' && cloudStep === 2) {
                  setError('');
                  setCloudStep(3);
                  if (!modelsFetched && !modelsFetching && (!provider.noKey && apiKey.trim())) {
                    setTimeout(fetchModels, 100);
                  }
                } else {
                  handleSave();
                }
              }}
              disabled={saving || saved}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-[0.98] disabled:cursor-not-allowed
                ${saved
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : sessionActive && !saving && (mode !== 'cloud' || cloudStep === 3)
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90'
                    : isLocal
                      ? 'bg-gradient-to-r from-lime-500 to-green-600 text-white hover:opacity-90'
                      : `bg-gradient-to-r ${provider.color} text-white hover:opacity-90`
                }`}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saved  && <CheckCircle className="w-4 h-4" />}
              {!saving && !saved && sessionActive && (mode !== 'cloud' || cloudStep === 3) && (
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              )}
              {saving
                ? 'Saving…'
                : saved
                  ? 'Saved! Starting…'
                  : mode === 'cloud' && cloudStep === 1
                    ? `Continue with ${provider.name} →`
                  : mode === 'cloud' && cloudStep === 2
                    ? 'Continue to Model Selection →'
                  : sessionActive
                    ? 'Engine Active — Update'
                    : 'Activate Generation Engine'}
            </button>
          </div>

          {/* Deactivate — only shown when an engine session is active */}
          {sessionActive && (
            <button
              id="ges-deactivate"
              onClick={handleDeactivate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold
                text-red-400 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40
                hover:text-red-300 transition-all"
            >
              <WifiOff className="w-3.5 h-3.5" />
              Stop &amp; Deactivate Engine
            </button>
          )}
        </div>
      </div>
    </>
  );
}
