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
  Settings,
  Zap,
  ArrowRight
} from 'lucide-react';
import ProviderSelector, { PROVIDER_OPTIONS, PROVIDER_MODELS } from './ProviderSelector';
import type { ProviderOption } from './ProviderSelector';

// ─── Types ───────────────────────────────────────────────────────────────────

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

type GateStep = 'provider' | 'credentials' | 'model' | 'confirm';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ModelSelectionGate({
  isOpen,
  onComplete,
  onSkip,
  hasCredentials = {},
}: ModelSelectionGateProps) {
  const [step, setStep] = useState<GateStep>('provider');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setStep('provider');
      setSelectedProvider('');
      setSelectedModel('');
      setError('');
      setApiKey('');
    }
  }, [isOpen]);

  const currentProvider = PROVIDER_OPTIONS.find(p => p.id === selectedProvider);
  const needsCredentials = currentProvider?.requiresKey && !hasCredentials[selectedProvider];

  const handleProviderSelect = (providerId: string, model: string) => {
    setSelectedProvider(providerId);
    setSelectedModel(model);
    
    const provider = PROVIDER_OPTIONS.find(p => p.id === providerId);
    
    // If provider needs credentials and none exist, go to credentials step
    if (provider?.requiresKey && !hasCredentials[providerId]) {
      setStep('credentials');
    } else {
      // Skip credentials, go directly to confirm
      setStep('confirm');
    }
  };

  const handleCredentialSubmit = async () => {
    if (!apiKey.trim() && needsCredentials) {
      setError('Please enter an API key');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Save credentials to server
      const res = await fetch('/api/engine-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          apiKey: apiKey.trim() || 'ENV_FALLBACK',
          temperature: 0.6,
          fullAppMode: false,
          multiSlideMode: false,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      // Move to confirmation step
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = () => {
    if (!currentProvider) return;
    
    onComplete({
      provider: selectedProvider,
      model: selectedModel,
      providerName: currentProvider.name,
    });
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
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
            You can change this anytime in settings.
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
            { id: 'provider', label: 'Provider' },
            { id: 'credentials', label: 'Credentials' },
            { id: 'confirm', label: 'Confirm' },
          ].map((s, idx, arr) => (
            <React.Fragment key={s.id}>
              <div className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                ${step === s.id 
                  ? 'bg-violet-500 text-white' 
                  : arr.findIndex(x => x.id === step) > idx
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-gray-800 text-gray-500'
                }
              `}>
                {arr.findIndex(x => x.id === step) > idx ? (
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
          ))}
        </div>

        {/* Content Card */}
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 sm:p-8">
          {/* Step 1: Provider Selection */}
          {step === 'provider' && (
            <div className="space-y-6">
              <ProviderSelector
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onProviderSelect={handleProviderSelect}
                onConfigureCredentials={(provider) => {
                  setSelectedProvider(provider);
                  setStep('credentials');
                }}
                hasCredentials={hasCredentials}
                isLoading={isLoading}
              />

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

          {/* Step 2: Credentials */}
          {step === 'credentials' && currentProvider && (
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${currentProvider.gradient} mb-4`}>
                  <div className={currentProvider.color}>
                    {currentProvider.icon}
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Enter {currentProvider.name} API Key
                </h2>
                <p className="text-sm text-gray-400">
                  Your key is encrypted and stored securely on the server. 
                  It will never be exposed to the client.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {currentProvider.keyLabel || 'API Key'}
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={currentProvider.keyHint || 'Enter your API key...'}
                      className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('provider')}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCredentialSubmit}
                    disabled={isSaving || !apiKey.trim()}
                    className="flex-1 px-4 py-3 rounded-xl bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  Don't have an API key?{' '}
                  <a 
                    href={currentProvider.docsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300"
                  >
                    Get one from {currentProvider.name}
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && currentProvider && (
            <div className="max-w-md mx-auto text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 mb-4">
                <Check className="w-10 h-10 text-emerald-400" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Ready to Generate!
                </h2>
                <p className="text-gray-400">
                  Your AI engine is configured and ready to create beautiful UI components.
                </p>
              </div>

              <div className="bg-gray-950 rounded-2xl p-6 text-left space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Provider</span>
                  <div className="flex items-center gap-2">
                    <div className={currentProvider.color}>
                      {currentProvider.icon}
                    </div>
                    <span className="text-white font-medium">{currentProvider.name}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Model</span>
                  <span className="text-white font-mono text-sm">{selectedModel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Security</span>
                  <span className="flex items-center gap-1 text-emerald-400 text-sm">
                    <Shield className="w-3 h-3" />
                    Server-side
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('provider')}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Change
                </button>
                <button
                  onClick={handleComplete}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Start Generating
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-gray-600">
          <p>
            You can change your AI provider anytime in{' '}
            <Settings className="w-3 h-3 inline" />
            {' '}Settings → AI Engine Config
          </p>
        </div>
      </div>
    </div>
  );
}
