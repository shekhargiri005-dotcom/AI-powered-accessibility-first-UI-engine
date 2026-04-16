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
  localOnly?: boolean;
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
}: ModelSelectionGateProps) {
  const [step, setStep] = useState<GateStep>('loading');
  const [configuredProviders, setConfiguredProviders] = useState<ProviderStatus[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderStatus | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

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

        // Filter to only configured providers
        const configured = data.providers.filter((p: ProviderStatus) => p.configured);
        setConfiguredProviders(configured);

        if (configured.length === 0) {
          setStep('error');
          setError('No AI providers are configured. Please add API keys to your environment variables (Vercel).');
        } else {
          setStep('provider');
        }
      } catch (err) {
        setStep('error');
        setError(err instanceof Error ? err.message : 'Failed to load providers');
      }
    };

    fetchProviders();
  }, [isOpen]);

  const handleProviderSelect = (provider: ProviderStatus) => {
    setSelectedProvider(provider);
    setSelectedModel(provider.models[0] || 'default');
    setStep('confirm');
  };

  const handleComplete = async () => {
    if (!selectedProvider) return;

    setIsSaving(true);
    
    try {
      // Save the selection to server
      const res = await fetch('/api/engine-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider.id,
          model: selectedModel,
          apiKey: 'ENV_FALLBACK', // Server will use env var
          temperature: 0.6,
          fullAppMode: false,
          multiSlideMode: false,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save configuration');
      }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative w-full max-w-4xl mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-violet-300">Welcome to AI UI Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Choose Your AI Engine
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Select the AI provider that will power your UI generation. 
            Only providers configured in your environment variables are shown.
          </p>
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-6 mb-8 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            Secure server-side credentials
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-emerald-400" />
            API keys never exposed
          </span>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[
            { id: 'provider', label: 'Select Provider' },
            { id: 'confirm', label: 'Confirm' },
          ].map((s, idx, arr) => {
            const isActive = step === s.id || (step === 'loading' && s.id === 'provider') || (step === 'error' && s.id === 'provider');
            const isCompleted = (step === 'confirm' && s.id === 'provider');
            
            return (
              <React.Fragment key={s.id}>
                <div className={`
                  flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${isActive 
                    ? 'bg-violet-500 text-white' 
                    : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-gray-800 text-gray-500'
                  }
                `}>
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                  )}
                  {s.label}
                </div>
                {idx < arr.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
              </React.Fragment>
            );
          })}
        </div>

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
                  <p className="font-medium text-gray-300">Required environment variables:</p>
                  <ul className="space-y-1 font-mono text-xs">
                    <li>• OPENAI_API_KEY - for OpenAI GPT models</li>
                    <li>• ANTHROPIC_API_KEY - for Claude models</li>
                    <li>• GOOGLE_API_KEY - for Gemini models</li>
                    <li>• GROQ_API_KEY - for Groq fast inference</li>
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
                  These providers have API keys configured in your environment
                </p>
              </div>

              {/* Provider Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {configuredProviders.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderSelect(provider)}
                    className={`
                      relative group p-5 rounded-2xl border-2 transition-all duration-200 text-left
                      bg-gray-900/50 border-gray-700/50 
                      hover:border-violet-500/50 hover:bg-violet-500/5
                      hover:scale-[1.02] active:scale-[0.98]
                    `}
                  >
                    {/* Provider Brand Color Top Border */}
                    <div className={`absolute top-0 left-4 right-4 h-1 rounded-b-lg ${provider.bgColor} opacity-60`} />

                    {/* Recommended Badge */}
                    {provider.recommended && (
                      <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-violet-500/30">
                        RECOMMENDED
                      </div>
                    )}

                    {/* Icon with provider brand color background */}
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${provider.gradient} mb-3`}>
                      <div className={provider.color}>
                        {PROVIDER_ICONS[provider.id] || <Sparkles className="w-7 h-7" />}
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="font-semibold text-white mb-1 group-hover:text-violet-200 transition-colors">{provider.name}</h3>
                    <p className="text-xs text-gray-400 mb-3">{provider.description}</p>

                    {/* Features - show first model as default with provider color */}
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${provider.bgColor}`} />
                      <span className="text-[10px] text-gray-500 group-hover:text-violet-300/70 transition-colors">
                        Default: {provider.models[0]}
                      </span>
                    </div>

                    {/* Violet Hover Glow Effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
                  </button>
                ))}
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

                {/* Security */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Security</span>
                  <span className="flex items-center gap-1.5 text-violet-400 text-sm">
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    Server-side
                  </span>
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

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-violet-400/50">
          <p className="flex items-center justify-center gap-2">
            <Sparkles className="w-3 h-3" />
            Secure server-side AI generation
          </p>
        </div>
      </div>
    </div>
  );
}
