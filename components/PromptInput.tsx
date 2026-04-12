'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, ChevronRight, Mic, X, Plus, Command, Clock, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import IntentBadge from './IntentBadge';
import type { IntentClassification } from '@/lib/validation/schemas';

export type GenerationMode = 'component' | 'app' | 'depth_ui';

export interface SubmitOptions {
  depthUi?: boolean;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { isFinal: boolean; [key: number]: { transcript: string } }[];
  error?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface PromptInputProps {
  onSubmit: (prompt: string, mode: GenerationMode, options?: SubmitOptions) => void;
  isLoading: boolean;
  onIntentDetected?: (classification: IntentClassification) => void;
  hasActiveProject?: boolean;
  aiPayload?: Record<string, any>;
}

export default function PromptInput({ onSubmit, isLoading, onIntentDetected, hasActiveProject, aiPayload }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [scopeMode, setScopeMode] = useState<'component' | 'app'>('component');
  const [depthUi, setDepthUi] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [history, setHistory] = useState<{ id: string, componentName: string, promptSnippet: string }[]>([]);
  const [liveIntent, setLiveIntent] = useState<IntentClassification | null>(null);
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const classifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // ─── Input Validation ──────────────────────────────────────────────────────
  const validatePrompt = (text: string): string | null => {
    const trimmed = text.trim();
    if (!trimmed) return null; // silent until user tries to submit
    if (trimmed.length < 10) return 'Prompt is too short — describe what you want in more detail.';
    if (/^[\W\d_\s]{8,}$/.test(trimmed)) return 'Prompt appears to be random characters or symbols.';
    return null;
  };

  const isPromptValid = prompt.trim().length >= 10;
  const [interimTranscript, setInterimTranscript] = useState('');
  const latestConfidence = confidenceHistory[confidenceHistory.length - 1];
  const firstConfidence = confidenceHistory[0];
  const confidenceDelta = confidenceHistory.length >= 2
    ? Math.round((latestConfidence - firstConfidence) * 100)
    : 0;

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

          recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
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
    if (e.target.files && e.target.files.length > 0) {
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
    }
  };

  // Debounced live intent classification
  const scheduleClassify = useCallback((text: string) => {
    if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current);
    if (text.trim().length < 10) { setLiveIntent(null); setConfidenceHistory([]); return; }
    classifyTimerRef.current = setTimeout(async () => {
      setIsClassifying(true);
      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text, hasActiveProject: hasActiveProject ?? false, ...(aiPayload || {}) }),
        });
        const data = await res.json();
        if (data.success && data.classification) {
          setLiveIntent(data.classification);
          if (typeof data.classification.confidence === 'number') {
            setConfidenceHistory((prev) => [...prev, data.classification.confidence].slice(-8));
          }
          onIntentDetected?.(data.classification);
      } catch { /* ignore */ } finally {
        setIsClassifying(false);
      }
    }, 1000); // 1000ms is the sweet spot for snappiness + quota safety
  }, [hasActiveProject, onIntentDetected, aiPayload]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errMsg = validatePrompt(prompt);
    if (errMsg) {
      setValidationError(errMsg);
      return;
    }
    if (!isPromptValid || isLoading) return;
    setValidationError(null);
    const effectiveMode: GenerationMode = scopeMode === 'component' && depthUi ? 'depth_ui' : scopeMode;
    onSubmit(prompt.trim(), effectiveMode, { depthUi });
    setPrompt('');
    setIsRecording(false);
    setLiveIntent(null);
    setConfidenceHistory([]);
  };

  const charCount = prompt.length;
  const maxChars = 10000;
  const isOverLimit = charCount > maxChars;

  const placeholder = scopeMode === 'app'
    ? 'Describe a full app in one line, e.g. &quot;Build an Instagram-like social media app&quot; or &quot;Create a Spotify music player&quot;'
    : 'Describe a UI component, e.g. &quot;A login form with email and password&quot; or paste a design prompt…';

  return (
    <section aria-labelledby="prompt-heading">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Command className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 id="prompt-heading" className="text-lg font-semibold text-white">
              Describe Your UI
            </h2>
            <p className="text-xs text-slate-500">
              Natural language → accessible React {scopeMode === 'app' ? 'application' : 'component'}
            </p>
          </div>
        </div>

        {/* ── Mode Toggle ─────────────────────────────────────────── */}
        <div
          role="group"
          aria-label="Generation mode"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-3"
        >
          <button
            type="button"
            onClick={() => setScopeMode('component')}
            disabled={isLoading}
            className={`
              flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 focus:ring-offset-[#0B0F19]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${scopeMode === 'component'
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/25'
                : 'text-slate-400 hover:text-white'
              }
            `}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Component
          </button>
          <button
            type="button"
            onClick={() => setScopeMode('app')}
            disabled={isLoading}
            className={`
              flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-1 focus:ring-offset-[#0B0F19]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${scopeMode === 'app'
                ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-md shadow-fuchsia-500/25'
                : 'text-slate-400 hover:text-white'
              }
            `}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            Full App
          </button>
          <button
            type="button"
            onClick={() => setDepthUi((v) => !v)}
            disabled={isLoading}
            className={`
              flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-[#0B0F19]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${depthUi
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white'
              }
            `}
          >
            <span role="img" aria-hidden="true" className="text-[14px] leading-none">✨</span>
            Depth UI
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-400/20 text-violet-300 font-semibold">NEW</span>
          </button>
        </div>

        {/* Hints */}
        {scopeMode === 'app' && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-fuchsia-400 flex-shrink-0 mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-xs text-fuchsia-300 leading-relaxed">
              <span className="font-semibold text-fuchsia-200">Full App Mode:</span> Generates a complete multi-screen application with navigation and mock data. Try: <span className="italic">&quot;Build an Instagram-like app&quot;</span>.
            </p>
          </div>
        )}
        {depthUi && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" aria-hidden="true">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <p className="text-xs text-indigo-300 leading-relaxed">
              <span className="font-semibold text-indigo-200">Depth UI Mode:</span> Generates visually rich, premium interfaces with functional floating elements, smooth parallax, and depth-layers. Try: <span className="italic">&quot;Build a startup hero layout with floating UI cards&quot;</span>.
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} aria-label="UI generation form" className="relative group">
        <div className={`
          relative flex flex-col w-full transition-all duration-300
          bg-[#111827]/80 backdrop-blur-md border border-white/[0.08]
          ${isFocused ? 'ring-1 ring-violet-500/30 shadow-2xl shadow-violet-500/10' : 'hover:border-white/[0.12] shadow-xl'}
          ${scopeMode === 'app' ? 'ring-1 ring-fuchsia-500/20' : ''}
          ${depthUi ? 'ring-1 ring-indigo-500/20' : ''}
          rounded-2xl overflow-hidden
        `}>
          
          {/* Active Recording State */}
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

          {/* Expanding Text Area */}
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
              onChange={(e) => { setPrompt(e.target.value); setValidationError(null); scheduleClassify(e.target.value); }}
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

            {/* Live intent hint */}
            {(liveIntent || isClassifying) && (
              <div className="flex items-center gap-2 px-1 py-1.5">
                {isClassifying ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <Sparkles className="w-3 h-3 animate-pulse text-blue-400" />
                    Analyzing intent…
                  </span>
                ) : liveIntent ? (
                  <>
                    <span className="text-[11px] text-gray-500">Detected:</span>
                    <IntentBadge intentType={liveIntent.intentType} confidence={liveIntent.confidence} size="sm" />
                    {confidenceHistory.length >= 2 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                        {confidenceDelta > 0 ? (
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                        ) : confidenceDelta < 0 ? (
                          <TrendingDown className="w-3 h-3 text-rose-400" />
                        ) : (
                          <Minus className="w-3 h-3 text-zinc-500" />
                        )}
                        {confidenceDelta > 0 ? '+' : ''}{confidenceDelta}% over {confidenceHistory.length} tries
                      </span>
                    )}
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
                title="Attach image file"
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
              <span className={`text-xs mr-2 transition-opacity duration-300 ${charCount > maxChars ? 'text-red-400 opacity-100' : 'text-zinc-500 opacity-0 group-hover:opacity-100'}`}>
                {charCount}/{maxChars}
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

        <p id="prompt-hint" className="sr-only">
          {scopeMode === 'app'
            ? 'Describe a full application to generate a complete multi-screen React app with navigation and mock data.'
            : 'Enter a description of the UI component you want to build, then click Generate.'}
        </p>
      </form>

      {/* Generation History */}
      <div className="mt-4" role="group" aria-label="Prompt history">
        <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-2 font-medium">
          <Clock className="w-3 h-3 block" />
          Your Generation History
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
          {history.length > 0 ? (
            history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPrompt(item.promptSnippet)}
                disabled={isLoading}
                aria-label={`Reuse history: ${item.componentName}`}
                className="
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                  border border-violet-800/40 text-violet-400 bg-violet-500/10
                  hover:border-violet-500/60 hover:text-violet-300 hover:bg-violet-500/20
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 focus:ring-offset-[#0B0F19]
                  flex-shrink-0 whitespace-nowrap
                "
              >
                <ChevronRight className="w-3 h-3 block flex-shrink-0" aria-hidden="true" />
                <span className="font-semibold">{item.componentName}:</span> 
                <span className="truncate max-w-[200px]">{item.promptSnippet}</span>
              </button>
            ))
          ) : (
            <div className="text-xs text-slate-600 italic flex items-center gap-2 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.06]">
              Nothing here yet. Build your first component or app!
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
