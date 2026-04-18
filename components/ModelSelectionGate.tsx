'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Shield, 
  Lock, 
  ChevronRight, 
  Check,
  AlertCircle,
  Loader2,
  Zap,
  Cpu,
  Globe,
  Server
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProviderSettings {
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ProviderStatus {
  id: string;
  name: string;
  description: string;
  color: string;
  gradient: string;
  bgColor: string;
  configured: boolean;
  models: string[];
  recommended?: boolean;
  settings?: ProviderSettings;
  envVar?: string;
}

export interface ModelSelectionGateProps {
  isOpen: boolean;
  onComplete: (config: {
    provider: string;
    model: string;
    providerName: string;
  }) => void;
  onSkip?: () => void;
  hasCredentials?: Record<string, boolean>;
  preselectedProvider?: string | null;
}

type GateStep = 'loading' | 'provider' | 'confirm' | 'error';

// Icon mapping for providers
const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  openai: <Sparkles className="w-8 h-8" />,
  anthropic: <Cpu className="w-8 h-8" />,
  google: <Globe className="w-8 h-8" />,
  groq: <Zap className="w-8 h-8" />,
  ollama: <Server className="w-8 h-8" />,
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ModelSelectionGate({
  isOpen,
  onComplete,
  onSkip,
  preselectedProvider,
}: ModelSelectionGateProps) {
  const [step, setStep] = useState<GateStep>('loading');
  const [configuredProviders, setConfiguredProviders] = useState<ProviderStatus[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderStatus | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [rememberProvider, setRememberProvider] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai_remember_provider') === 'true';
    }
    return false;
  });

  // Fetch configured providers on mount
  useEffect(() => {
    if (!isOpen) return;

    const fetchProviders = async () => {
      setStep('loading');
      setError('');
      
      try {
        const res = await fetch('/api/providers/status');
        const data = await res.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to load providers');
        }

        // Set all providers — configured ones are fully clickable
        setConfiguredProviders(data.providers);

        const hasAnyConfigured = data.providers.some((p: ProviderStatus) => p.configured);
        if (!hasAnyConfigured) {
          setStep('error');
          setError(
            'No AI providers are configured. Please add API keys to your environment variables (Vercel).\n\n' +
            'Required environment variable:\n' +
            '• LLM_KEY - Universal key for all adapters\n\n' +
            'Or use specific keys:\n' +
            '• OPENAI_API_KEY, ANTHROPIC_API_KEY\n' +
            '• GOOGLE_API_KEY, GROQ_API_KEY, OLLAMA_API_KEY\n\n' +
            'After adding keys, redeploy your Vercel project.'
          );
        } else {
          setStep('provider');
        }
      } catch (err) {
        setStep('error');
        setError(err instanceof Error ? err.message : 'Failed to load providers');
      }
    };

    fetchProviders();
  }, [isOpen, preselectedProvider]);

  const handleProviderSelect = (provider: ProviderStatus) => {
    setSelectedProvider(provider);
    setSelectedModel(provider.models[0] || 'default');
    setStep('confirm');
  };

  const handleComplete = async () => {
    if (!selectedProvider) return;

    setIsSaving(true);
    
    try {
      // Save remember preference
      localStorage.setItem('ai_remember_provider', rememberProvider.toString());
      
      // Save config to localStorage (server uses env vars, no API call needed)
      localStorage.setItem('aiEngineConfig', JSON.stringify({
        provider: selectedProvider.id,
        model: selectedModel,
        providerName: selectedProvider.name,
        temperature: selectedProvider.settings?.temperature || 0.7,
        fullAppMode: false,
        multiSlideMode: false,
      }));

      onComplete({
        provider: selectedProvider.id,
        model: selectedModel,
        providerName: selectedProvider.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
      setStep('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    setSelectedProvider(null);
    setSelectedModel('');
    setStep('provider');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#0B0F19]">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative w-full max-w-4xl mx-4">


        {/* Content Card */}
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 sm:p-8">
          {/* Loading State */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-violet-400 animate-spin mb-4" />
              <p className="text-gray-400">Checking configured providers...</p>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="max-w-md mx-auto text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 mb-4">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  No Providers Configured
                </h2>
                <p className="text-gray-400 mb-4">
                  {error || 'Please add API keys to your environment variables to use the AI UI Engine.'}
                </p>
                <div className="bg-gray-950 rounded-xl p-4 text-left text-sm text-gray-400 space-y-2">
                  <p className="font-medium text-gray-300">Required environment variable:</p>
                  <ul className="space-y-1 font-mono text-xs">
                    <li>• LLM_KEY - Universal key for all adapters</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">Or use specific keys:</p>
                  <ul className="space-y-1 font-mono text-xs text-gray-500">
                    <li>• OPENAI_API_KEY, ANTHROPIC_API_KEY</li>
                    <li>• GOOGLE_API_KEY, GROQ_API_KEY, OLLAMA_API_KEY</li>
                  </ul>
                </div>
              </div>
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Skip for now →
                </button>
              )}
            </div>
          )}

          {/* Step 1: Provider Selection */}
          {step === 'provider' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
                  <Shield className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-medium text-violet-300">Available Providers</span>
                </div>
                <p className="text-sm text-gray-400">
                  Select an AI provider to power your generation engine
                </p>
              </div>

              {/* Provider Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {configuredProviders.map((provider) => {
                  const isLastUsed = preselectedProvider === provider.id;
                  const isReady = provider.configured;
                  return (
                    <button
                      key={provider.id}
                      onClick={() => isReady && handleProviderSelect(provider)}
                      disabled={!isReady}
                      className={`
                        relative group p-5 rounded-2xl border-2 transition-all duration-200 text-left
                        ${!isReady
                          ? 'bg-gray-900/20 border-gray-800/30 opacity-50 cursor-not-allowed'
                          : isLastUsed
                            ? 'bg-violet-500/10 border-violet-500/40'
                            : 'bg-gray-900/50 border-gray-700/50'
                        }
                        ${isReady ? 'hover:border-violet-500/50 hover:bg-violet-500/5 hover:scale-[1.02] active:scale-[0.98]' : ''}
                      `}
                    >
                      {/* Provider Brand Color Top Border */}
                      <div className={`absolute top-0 left-4 right-4 h-1 rounded-b-lg ${provider.bgColor} ${!isReady ? 'opacity-20' : isLastUsed ? 'opacity-100' : 'opacity-60'}`} />

                      {/* Ready / Needs Key Badge */}
                      {isReady ? (
                        isLastUsed && (
                          <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-emerald-500/30">
                            LAST USED
                          </div>
                        )
                      ) : (
                        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-gray-700 text-gray-400 text-[10px] font-bold rounded-full">
                          NEEDS KEY
                        </div>
                      )}

                    {/* Icon with provider brand color background */}
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${provider.gradient} mb-3 ${!isReady ? 'grayscale' : ''}`}>
                      <div className={provider.color}>
                        {PROVIDER_ICONS[provider.id] || <Sparkles className="w-7 h-7" />}
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className={`font-semibold mb-1 ${isReady ? 'text-white group-hover:text-violet-200' : 'text-gray-500'} transition-colors`}>{provider.name}</h3>
                    <p className={`text-xs mb-3 ${isReady ? 'text-gray-400' : 'text-gray-600'}`}>{provider.description}</p>

                    {/* Status indicator */}
                    <div className="flex items-center gap-2">
                      {isReady ? (
                        <>
                          <span className={`w-2 h-2 rounded-full ${provider.bgColor}`} />
                          <span className="text-[10px] text-gray-500 group-hover:text-violet-300/70 transition-colors">
                            Default: {provider.models[0]}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-gray-600" />
                          <span className="text-[10px] text-gray-600">
                            Add {provider.envVar} in Vercel
                          </span>
                        </>
                      )}
                    </div>

                    {/* Violet Hover Glow Effect */}
                    {isReady && (
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
                    )}
                  </button>
                );
                })}
              </div>

              {onSkip && (
                <div className="text-center pt-4 border-t border-gray-800">
                  <button
                    onClick={onSkip}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Skip for now →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === 'confirm' && selectedProvider && (
            <div className="max-w-md mx-auto text-center space-y-6">
              {/* Provider Brand Icon */}
              <div className="inline-flex items-center justify-center">
                <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${selectedProvider.gradient} flex items-center justify-center shadow-2xl`}>
                  <div className={selectedProvider.color}>
                    {PROVIDER_ICONS[selectedProvider.id] || <Sparkles className="w-12 h-12" />}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Ready to Generate!
                </h2>
                <p className="text-gray-400">
                  Your <span className={selectedProvider.color}>{selectedProvider.name}</span> engine is ready
                </p>
              </div>

              <div className="bg-gray-950 rounded-2xl p-6 text-left space-y-4 border border-violet-500/20">
                {/* Provider with brand color */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Provider</span>
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-gradient-to-br ${selectedProvider.gradient}`}>
                      <div className={selectedProvider.color}>
                        {PROVIDER_ICONS[selectedProvider.id] || <Sparkles className="w-4 h-4" />}
                      </div>
                    </div>
                    <span className="text-white font-medium">{selectedProvider.name}</span>
                  </div>
                </div>

                {/* Model Selection with violet theme */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Model</span>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {selectedProvider.models.slice(0, 3).map((model) => (
                      <button
                        key={model}
                        onClick={() => setSelectedModel(model)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedModel === model
                            ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
                            : 'bg-gray-800 text-gray-400 hover:bg-violet-500/20 hover:text-violet-300'
                        }`}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optimized Settings */}
                {selectedProvider.settings && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Optimized</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-violet-500/20 text-violet-300">
                        Temp: {selectedProvider.settings.temperature}
                      </span>
                      <span className="px-2 py-1 rounded bg-violet-500/20 text-violet-300">
                        Max: {selectedProvider.settings.maxTokens.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>
                )}

                {/* Security */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Security</span>
                  <span className="flex items-center gap-1.5 text-violet-400 text-sm">
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    Server-side
                  </span>
                </div>

                {/* Remember Provider Toggle */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                  <span className="text-gray-500 text-sm">Remember my choice</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberProvider}
                      onChange={(e) => setRememberProvider(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-500"></div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-500/25"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Start Engine
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>


      </div>
    </div>
  );
}
