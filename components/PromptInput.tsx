'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ChevronRight, Mic, X, Plus, Command, Clock } from 'lucide-react';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export default function PromptInput({ onSubmit, isLoading }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [history, setHistory] = useState<{ id: string, componentName: string, promptSnippet: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

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
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (finalTranscript) {
            setPrompt((prev) => (prev ? prev.trim() + ' ' : '') + finalTranscript.trim() + ' ');
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
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
      } catch (error: any) {
        alert(error.message || 'There was an error analyzing the image.');
      } finally {
        setIsProcessingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
      setPrompt('');
      setIsRecording(false);
    }
  };



  const charCount = prompt.length;
  const maxChars = 10000;
  const isOverLimit = charCount > maxChars;

  return (
    <section aria-labelledby="prompt-heading">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Command className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 id="prompt-heading" className="text-lg font-semibold text-white">
              Describe Your UI Component
            </h2>
            <p className="text-xs text-gray-400">
              Natural language → accessible React component
            </p>
          </div>
        </div>
      </div>      <form onSubmit={handleSubmit} aria-label="UI component generation form" className="relative group">
        <div className={`
          relative flex flex-col w-full transition-all duration-300
          bg-[#212121] backdrop-blur-md border border-[#303030] 
          ${isFocused ? 'ring-1 ring-white/10 shadow-2xl' : 'hover:border-[#404040] shadow-xl'}
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
                    Listening... Speak clearly.
                    <button type="button" onClick={toggleRecording} className="ml-1 text-red-500 hover:text-white transition-colors">
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
              rows={prompt.split('\n').length > 5 ? Math.min(prompt.split('\n').length, 15) : 5}
              className="
                w-full resize-y bg-transparent text-zinc-100
                placeholder-zinc-500 text-sm sm:text-base leading-relaxed
                outline-none focus:outline-none min-h-[120px] max-h-[600px] overflow-y-auto
              "
              placeholder="Ask anything or paste a huge prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={isLoading}
              maxLength={maxChars + 100}
              aria-label="Component description"
              aria-required="true"
            />
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
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors focus:outline-none disabled:opacity-50 flex items-center gap-1.5 text-xs font-medium"
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

              {/* Optional glowing dot (if active/processing) */}
              {isLoading && (
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
              )}

              <button type="button" onClick={toggleRecording} className={`p-2 rounded-lg transition-colors focus:outline-none ${isRecording ? 'bg-red-500/20 text-red-500' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}>
                <Mic className="w-4 h-4 stroke-[2]" />
              </button>

              <button
                type="submit"
                disabled={!prompt.trim() || isLoading || isOverLimit || isProcessingImage}
                aria-label={isLoading ? 'Generating component, please wait' : 'Generate component'}
                className={`
                  flex items-center justify-center px-4 py-1.5 rounded-lg
                  transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#212121] focus:ring-white
                  ${isLoading || !prompt.trim() 
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed opacity-50' 
                    : 'bg-white text-black hover:bg-gray-200 shadow-md font-medium text-sm'
                  }
                `}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <span className="mr-1.5">Generate</span>
                    <Send className={`w-3.5 h-3.5 block`} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <p id="prompt-hint" className="sr-only">
          Enter a description of the UI component you want to build, then click Generate to create a React component with accessibility features.
        </p>
      </form>

      {/* True User History */}
      <div className="mt-4" role="group" aria-label="Prompt history">
        <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-2 font-medium">
          <Clock className="w-3 h-3 block" />
          Your Generation History
        </p>
        <div className="flex flex-wrap gap-2">
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
                  border border-blue-900/40 text-blue-400 bg-blue-500/10
                  hover:border-blue-500/60 hover:text-blue-300 hover:bg-blue-500/20
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-950
                "
              >
                <ChevronRight className="w-3 h-3 block" aria-hidden="true" />
                <span className="font-semibold">{item.componentName}:</span> 
                <span className="truncate max-w-[200px] sm:max-w-[400px]">{item.promptSnippet}</span>
              </button>
            ))
          ) : (
            <div className="text-xs text-zinc-500 italic flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
              Nothing here yet. Build your first component!
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
