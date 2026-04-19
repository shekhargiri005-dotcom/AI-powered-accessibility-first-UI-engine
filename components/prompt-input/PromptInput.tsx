/**
 * @file components/prompt-input/PromptInput.tsx
 * Main prompt input component (refactored)
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Mic, X, Plus } from 'lucide-react';
import IntentBadge from '../IntentBadge';
import ModeToggle from './ModeToggle';
import PromptHistory from './PromptHistory';
import type {
  GenerationMode,
  SubmitOptions,
  PromptInputProps,
  HistoryItem,
  SpeechRecognitionInstance,
  SpeechRecognitionConstructor,
} from './types';

// Re-export types for backward compatibility
export type { GenerationMode, SubmitOptions };

export default function PromptInput({
  onSubmit,
  isLoading,
  onIntentDetected,
  hasActiveProject,
  aiPayload,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [scopeMode, setScopeMode] = useState<'component' | 'app'>('component');
  const [depthUi, setDepthUi] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [liveIntent, setLiveIntent] = useState<import('@/lib/validation/schemas').IntentClassification | null>(null);
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const classifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const maxChars = 10000;
  const isPromptValid = prompt.trim().length >= 10;
  const isOverLimit = prompt.length > maxChars;

  // Load history on mount
  useEffect(() => {
    fetch('/api/history')
      .then((res) => res.json())
      .then((data) => {
        if (data.history && Array.isArray(data.history)) {
          setHistory(data.history);
        }
      })
      .catch((err) => console.error('Failed to load history', err));
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as unknown as { SpeechRecognition: SpeechRecognitionConstructor }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition: SpeechRecognitionConstructor }).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          
          recognition.onresult = (event) => {
            let finalTranscript = '';
            let currentInterim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
              } else {
                currentInterim += event.results[i][0].transcript;
              }
            }
            if (finalTranscript) {
              setPrompt((prev) => (prev ? prev.trim() + ' ' : '') + finalTranscript.trim() + ' ');
            }
            setInterimTranscript(currentInterim);
          };

          recognition.onerror = () => {
            setIsRecording(false);
            setInterimTranscript('');
          };

          recognition.onend = () => {
            setIsRecording(false);
            setInterimTranscript('');
          };
          
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn("Speech recognition initialization failed", e);
        }
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
        setIsRecording(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file to extract text from.');
      return;
    }

    setIsProcessingImage(true);
    
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/image-to-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to analyze image');
      }

      const data = await response.json();
      if (data.caption) {
        setPrompt((prev) => prev + (prev.endsWith(' ') ? '' : ' ') + `[Image Context: ${data.caption}] `);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'There was an error analyzing the image.');
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Debounced live intent classification
  // Rate-limit aware: 3s debounce + 30s cooldown after 429 errors
  const last429Ref = useRef<number>(0);
  const RATE_LIMIT_COOLDOWN_MS = 30_000;

  const scheduleClassify = useCallback((text: string) => {
    if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current);
    if (text.trim().length < 10) { 
      setLiveIntent(null); 
      setConfidenceHistory([]); 
      return; 
    }
    // Skip classify if we recently hit a rate limit — don't burn through the quota
    const timeSince429 = Date.now() - last429Ref.current;
    if (timeSince429 < RATE_LIMIT_COOLDOWN_MS) {
      return;
    }
    classifyTimerRef.current = setTimeout(async () => {
      setIsClassifying(true);
      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: text, 
            hasActiveProject: hasActiveProject ?? false, 
            ...(aiPayload || {}) 
          }),
        });
        const data = await res.json();
        if (data.success && data.classification) {
          // If we got a fallback classification, mark the cooldown
          if (data._fallback) {
            last429Ref.current = Date.now();
          }
          setLiveIntent(data.classification);
          if (typeof data.classification.confidence === 'number') {
            setConfidenceHistory((prev) => [...prev, data.classification.confidence].slice(-8));
          }
          onIntentDetected?.(data.classification);
        } else if (res.status === 429) {
          // Explicit 429 — start cooldown
          last429Ref.current = Date.now();
        }
      } catch { /* ignore */ } finally {
        setIsClassifying(false);
      }
    }, 3000); // 3s debounce — reduces API calls by ~3x vs 1s
  }, [hasActiveProject, onIntentDetected, aiPayload]);

  const validatePrompt = (text: string): string | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (trimmed.length < 10) return 'Prompt is too short — describe what you want in more detail.';
    if (/^[\W\d_\s]{8,}$/.test(trimmed)) return 'Prompt appears to be random characters or symbols.';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errMsg = validatePrompt(prompt);
    if (errMsg) {
      setValidationError(errMsg);
      return;
    }
    if (!isPromptValid || isLoading) return;
    setValidationError(null);
    // Cancel any pending live classification — submit will do its own classify call
    if (classifyTimerRef.current) {
      clearTimeout(classifyTimerRef.current);
      classifyTimerRef.current = null;
    }
    const effectiveMode: GenerationMode = scopeMode === 'component' && depthUi ? 'depth_ui' : scopeMode;
    onSubmit(prompt.trim(), effectiveMode, { depthUi });
    setPrompt('');
    setIsRecording(false);
    setLiveIntent(null);
    setConfidenceHistory([]);
  };

  const placeholder = scopeMode === 'app'
    ? 'Describe a full app in one line, e.g. "Build an Instagram-like social media app" or "Create a Spotify music player"'
    : 'Describe a UI component, e.g. "A login form with email and password" or paste a design prompt…';

  return (
    <section aria-labelledby="prompt-heading">
      <ModeToggle
        scopeMode={scopeMode}
        depthUi={depthUi}
        isLoading={isLoading}
        onScopeChange={setScopeMode}
        onDepthUiToggle={() => setDepthUi((v) => !v)}
      />

      <form onSubmit={handleSubmit} aria-label="UI generation form" className="relative group">
        <div className={`
          relative flex flex-col w-full transition-all duration-300
          bg-[#111827]/80 backdrop-blur-md border border-white/[0.08]
          ${isFocused ? 'ring-1 ring-violet-500/30 shadow-2xl shadow-violet-500/10' : 'hover:border-white/[0.12] shadow-xl'}
          ${scopeMode === 'app' ? 'ring-1 ring-fuchsia-500/20' : ''}
          ${depthUi ? 'ring-1 ring-indigo-500/20' : ''}
          rounded-2xl overflow-hidden
        `}>
          
          {/* Recording State */}
          {isRecording && (
            <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 border-b border-[#303030]/50" role="region" aria-label="Recording active">
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl py-1 px-3 text-xs text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Listening... {interimTranscript ? <span className="text-gray-300 ml-1 italic">{interimTranscript}</span> : 'Speak clearly.'}
                <button type="button" onClick={toggleRecording} className="ml-1 text-red-500 hover:text-white transition-colors" aria-label="Stop recording">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Text Area */}
          <div className="relative p-3 pb-0">
            <textarea
              id="component-prompt"
              name="component-prompt"
              rows={prompt.split('\n').length > 5 ? Math.min(prompt.split('\n').length, 15) : scopeMode === 'app' ? 4 : 5}
              className="
                w-full resize-y bg-transparent text-zinc-100
                placeholder-zinc-500 text-sm sm:text-base leading-relaxed
                outline-none focus:outline-none min-h-[100px] max-h-[35vh] overflow-y-auto
              "
              placeholder={placeholder}
              value={prompt}
              onChange={(e) => { 
                setPrompt(e.target.value); 
                setValidationError(null); 
                scheduleClassify(e.target.value); 
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={isLoading}
              maxLength={maxChars + 100}
              aria-label={scopeMode === 'app' ? 'App description' : 'Component description'}
              aria-required="true"
            />

            {/* Validation Error */}
            {validationError && (
              <p className="px-1 pt-1 pb-0.5 text-[11px] text-red-400 flex items-center gap-1">
                <span aria-hidden="true">⚠</span> {validationError}
              </p>
            )}

            {/* Live Intent */}
            {(liveIntent || isClassifying) && (
              <div className="flex items-center gap-2 px-1 py-1.5">
                {isClassifying ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    Analyzing intent…
                  </span>
                ) : liveIntent ? (
                  <>
                    <span className="text-[11px] text-gray-500">Detected:</span>
                    <IntentBadge intentType={liveIntent.intentType} confidence={liveIntent.confidence} size="sm" />
                    {!liveIntent.shouldGenerateCode && (
                      <span className="text-[11px] text-amber-400/80 italic">Will show planning panel first</span>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#212121]/50 border-t border-[#303030]/30">
            {/* Left Actions */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/jpeg,image/png,image/gif,image/webp"
                aria-label="Attach image file"
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                aria-label="Attach image for AI analysis"
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-1.5 text-xs font-medium"
              >
                {isProcessingImage ? <Loader2 className="w-4 h-4 stroke-[2] animate-spin text-blue-400" /> : <Plus className="w-4 h-4 stroke-[2]" />}
                <span className="hidden sm:inline">Attach</span>
              </button>
            </div>

            {/* Right Actions & Submit */}
            <div className="flex items-center gap-2">
              <span className={`text-xs mr-2 transition-opacity duration-300 ${prompt.length > maxChars ? 'text-red-400 opacity-100' : 'text-zinc-500 opacity-0 group-hover:opacity-100'}`}>
                {prompt.length}/{maxChars}
              </span>

              {isLoading && (
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
              )}

              <button
                type="button"
                onClick={toggleRecording}
                aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRecording ? 'bg-red-500/20 text-red-500' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
              >
                <Mic className="w-4 h-4 stroke-[2]" />
              </button>

              <button
                type="submit"
                disabled={!isPromptValid || isLoading || isOverLimit || isProcessingImage}
                aria-label={isLoading ? 'Generating, please wait' : scopeMode === 'app' ? 'Generate full app' : 'Generate component'}
                className={`
                  flex items-center justify-center px-4 py-1.5 rounded-lg
                  transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#111827]
                  ${scopeMode === 'app' ? 'focus:ring-fuchsia-500' : depthUi ? 'focus:ring-indigo-500' : 'focus:ring-violet-500'}
                  ${isLoading || !isPromptValid
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                    : scopeMode === 'app'
                      ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:from-fuchsia-500 hover:to-violet-500 shadow-md shadow-fuchsia-500/25 font-medium text-sm'
                      : depthUi
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-500/25 font-medium text-sm'
                        : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-md shadow-violet-500/25 font-medium text-sm'
                  }
                `}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <span className="mr-1.5">{scopeMode === 'app' ? 'Build App' : depthUi ? 'Depth UI' : 'Generate'}</span>
                    <Send className="w-3.5 h-3.5 block" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      <PromptHistory
        history={history}
        isLoading={isLoading}
        onSelect={setPrompt}
      />
    </section>
  );
}
