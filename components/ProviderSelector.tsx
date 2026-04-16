'use client';

import React, { useState } from 'react';
import { 
  Zap, 
  Cpu, 
  Sparkles, 
  Globe, 
  Server,
  Check,
  Shield,
  Lock,
  AlertCircle,
  ChevronRight
} from 'lucide-react';

// ─── Provider Definitions ────────────────────────────────────────────────────

export interface ProviderOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  features: string[];
  recommended?: boolean;
  requiresKey: boolean;
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini, o3-mini',
    icon: <Sparkles className="w-6 h-6" />,
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
    features: ['Best for UI generation', 'Multimodal vision', 'Fast inference'],
    recommended: true,
    requiresKey: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus',
    icon: <Cpu className="w-6 h-6" />,
    color: 'text-amber-400',
    gradient: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
    features: ['Excellent reasoning', 'Long context', 'Code expertise'],
    requiresKey: true,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 2.0 Flash, Gemini 1.5 Pro',
    icon: <Globe className="w-6 h-6" />,
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    features: ['Large context window', 'Fast processing', 'Vision capable'],
    requiresKey: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Llama 3.3, Mixtral - Ultra-fast inference',
    icon: <Zap className="w-6 h-6" />,
    color: 'text-orange-400',
    gradient: 'from-orange-500/20 to-red-500/20 border-orange-500/30',
    features: ['Fastest inference', 'Open source models', 'Cost effective'],
    requiresKey: true,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run models locally on your machine',
    icon: <Server className="w-6 h-6" />,
    color: 'text-gray-300',
    gradient: 'from-gray-500/20 to-gray-400/20 border-gray-500/30',
    features: ['100% private', 'No API keys', 'Offline capable'],
    requiresKey: false,
  },
];

// ─── Suggested Models per Provider ───────────────────────────────────────────

export const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-5-haiku-20241022'],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  ollama: ['llama3', 'mistral', 'codellama', 'custom'],
};

// ─── Component Props ─────────────────────────────────────────────────────────

export interface ProviderSelectorProps {
  selectedProvider?: string;
  selectedModel?: string;
  onProviderSelect: (provider: string, model: string) => void;
  onConfigureCredentials?: (provider: string) => void;
  hasCredentials?: Record<string, boolean>;
  isLoading?: boolean;
}

// ─── Provider Selector Component ─────────────────────────────────────────────

export default function ProviderSelector({
  selectedProvider,
  selectedModel,
  onProviderSelect,
  onConfigureCredentials,
  hasCredentials = {},
  isLoading = false,
}: ProviderSelectorProps) {
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);

  const handleProviderClick = (provider: ProviderOption) => {
    if (isLoading) return;

    // If provider requires credentials and none configured, prompt for config
    if (provider.requiresKey && !hasCredentials[provider.id] && onConfigureCredentials) {
      onConfigureCredentials(provider.id);
      return;
    }

    // Select first model as default
    const defaultModel = PROVIDER_MODELS[provider.id]?.[0] || 'default';
    onProviderSelect(provider.id, defaultModel);
  };

  const isSelected = (providerId: string) => selectedProvider === providerId;
  const isConfigured = (providerId: string) => {
    const provider = PROVIDER_OPTIONS.find(p => p.id === providerId);
    if (!provider?.requiresKey) return true; // Local providers don't need keys
    return hasCredentials[providerId];
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
          <Shield className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-medium text-violet-300">Secure Mode Active</span>
        </div>
        <h2 className="text-2xl font-bold text-white">Choose Your AI Engine</h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Select a provider to power your UI generation. Credentials are stored securely server-side.
        </p>
      </div>

      {/* Security Notice */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        <Lock className="w-3 h-3" />
        <span>API keys never leave the server</span>
        <span className="mx-2">•</span>
        <Shield className="w-3 h-3" />
        <span>Workspace-scoped credentials</span>
      </div>

      {/* Provider Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVIDER_OPTIONS.map((provider) => {
          const selected = isSelected(provider.id);
          const configured = isConfigured(provider.id);
          const showConfigure = provider.requiresKey && !configured && !selected;

          return (
            <button
              key={provider.id}
              onClick={() => handleProviderClick(provider)}
              onMouseEnter={() => setHoveredProvider(provider.id)}
              onMouseLeave={() => setHoveredProvider(null)}
              disabled={isLoading}
              className={`
                relative group p-5 rounded-2xl border-2 transition-all duration-200 text-left
                ${selected 
                  ? `bg-gradient-to-br ${provider.gradient} border-current ${provider.color}` 
                  : 'bg-gray-900/50 border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/50'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selected Indicator */}
              {selected && (
                <div className="absolute top-3 right-3">
                  <div className={`w-6 h-6 rounded-full bg-current ${provider.color} flex items-center justify-center`}>
                    <Check className="w-4 h-4 text-gray-900" />
                  </div>
                </div>
              )}

              {/* Recommended Badge */}
              {provider.recommended && !selected && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded-full">
                  RECOMMENDED
                </div>
              )}

              {/* Icon */}
              <div className={`mb-3 ${provider.color}`}>
                {provider.icon}
              </div>

              {/* Content */}
              <h3 className="font-semibold text-white mb-1">{provider.name}</h3>
              <p className="text-xs text-gray-400 mb-3">{provider.description}</p>

              {/* Features */}
              <ul className="space-y-1">
                {provider.features.map((feature, idx) => (
                  <li key={idx} className="text-[10px] text-gray-500 flex items-center gap-1">
                    <span className={`w-1 h-1 rounded-full ${provider.color.replace('text-', 'bg-')}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Configure Button (when not configured) */}
              {showConfigure && (
                <div className="mt-4 pt-3 border-t border-gray-700/50">
                  <div className="flex items-center gap-2 text-amber-400 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    <span>Credentials required</span>
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </div>
                </div>
              )}

              {/* Hover Effect */}
              {!selected && !showConfigure && hoveredProvider === provider.id && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>

      {/* Model Selection (when provider selected) */}
      {selectedProvider && (
        <div className="mt-6 p-4 rounded-xl bg-gray-900/50 border border-gray-700/50">
          <label className="text-sm font-medium text-gray-300 mb-3 block">
            Select Model
          </label>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_MODELS[selectedProvider]?.map((model) => (
              <button
                key={model}
                onClick={() => onProviderSelect(selectedProvider, model)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${selectedModel === model
                    ? 'bg-violet-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                  }
                `}
              >
                {model}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Compact Version for Sidebar ─────────────────────────────────────────────

export function ProviderSelectorCompact({
  selectedProvider,
  selectedModel,
  onProviderSelect,
  onConfigureCredentials,
  hasCredentials = {},
}: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentProvider = PROVIDER_OPTIONS.find(p => p.id === selectedProvider);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-900/50 border border-gray-700/50 hover:border-gray-600 transition-all"
      >
        {currentProvider ? (
          <>
            <div className={currentProvider.color}>
              {currentProvider.icon}
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-white">{currentProvider.name}</div>
              <div className="text-xs text-gray-500">{selectedModel}</div>
            </div>
            <div className="flex items-center gap-1">
              {currentProvider.requiresKey && (
                hasCredentials[currentProvider.id] 
                  ? <Shield className="w-3 h-3 text-emerald-400" />
                  : <AlertCircle className="w-3 h-3 text-amber-400" />
              )}
            </div>
          </>
        ) : (
          <>
            <div className="w-6 h-6 rounded-lg bg-gray-800 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-gray-400" />
            </div>
            <span className="text-sm text-gray-400">Select AI Provider</span>
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-50">
          {PROVIDER_OPTIONS.map((provider) => {
            const configured = provider.requiresKey ? hasCredentials[provider.id] : true;
            
            return (
              <button
                key={provider.id}
                onClick={() => {
                  if (!configured && onConfigureCredentials) {
                    onConfigureCredentials(provider.id);
                  } else {
                    const defaultModel = PROVIDER_MODELS[provider.id]?.[0] || 'default';
                    onProviderSelect(provider.id, defaultModel);
                  }
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all
                  ${selectedProvider === provider.id 
                    ? 'bg-violet-500/20 text-violet-300' 
                    : 'hover:bg-gray-800 text-gray-300'
                  }
                `}
              >
                <div className={provider.color}>{provider.icon}</div>
                <span className="text-sm flex-1 text-left">{provider.name}</span>
                {provider.requiresKey && (
                  configured 
                    ? <Shield className="w-3 h-3 text-emerald-400" />
                    : <AlertCircle className="w-3 h-3 text-amber-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
