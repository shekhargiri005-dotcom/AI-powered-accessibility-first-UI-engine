'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, ChevronRight, Plus, Bot, Mic, AudioLines, Image as ImageIcon, X, File as FileIcon } from 'lucide-react';

type AttachedFile = {
  id: string;
  name: string;
  type: 'image' | 'document';
  url: string;
};

const EXAMPLE_PROMPTS = [
  'A login form with email and password fields',
  'A product card with image, title, price, and add to cart button',
  'A navigation bar with logo, links, and a CTA button',
  'A user profile settings form with name, bio, and avatar upload',
  'A modal dialog for confirming account deletion',
  'A search bar with filters and autocomplete',
  'A data table with pagination and sortable columns',
  'A pricing card with features list and subscribe button',
];

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export default function PromptInput({ onSubmit, isLoading }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const newAttachment: AttachedFile = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        url: URL.createObjectURL(file), // Free URL on unmount in a complete implementation
      };
      setAttachments([...attachments, newAttachment]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((prompt.trim() || attachments.length > 0) && !isLoading) {
      // In a full implementation, you'd pass attachments here too.
      // For now, we append a notice to the prompt so the user knows they attached something.
      let finalPrompt = prompt.trim();
      if (attachments.length > 0) {
        finalPrompt += `\\n[Attached Files: ${attachments.map(a => a.name).join(', ')}]`;
      }
      onSubmit(finalPrompt);
      setPrompt('');
      setAttachments([]);
      setIsRecording(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  const charCount = prompt.length;
  const maxChars = 10000;
  const isOverLimit = charCount > maxChars;

  return (
    <section aria-labelledby="prompt-heading">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
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
      </div>

      <form onSubmit={handleSubmit} aria-label="UI component generation form" className="relative group">
        <div className={`
          relative flex flex-col w-full min-h-[56px] transition-all duration-300
          bg-[#212121] backdrop-blur-md border border-[#303030] 
          ${isFocused ? 'ring-1 ring-white/10 shadow-2xl' : 'hover:border-[#404040] shadow-xl'}
          rounded-[28px] overflow-hidden
        `}>
          
          {/* Attachments Rail (if files attached or recording) */}
          {(attachments.length > 0 || isRecording) && (
            <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 border-b border-[#303030]/50" role="region" aria-label="Attached files">
              {isRecording && (
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
              )}
              {attachments.map((file) => (
                <div key={file.id} className="flex items-center gap-1.5 bg-[#303030]/50 border border-[#404040] rounded-xl py-1 px-1.5 pr-2.5 text-xs group">
                  {file.type === 'image' ? (
                    <img src={file.url} alt="Preview" className="w-6 h-6 rounded-md object-cover border border-[#404040]" />
                  ) : (
                    <FileIcon className="w-4 h-4 text-violet-400 ml-1" />
                  )}
                  <span className="truncate max-w-[100px] text-zinc-300 font-medium ml-1">{file.name}</span>
                  <button type="button" onClick={() => removeAttachment(file.id)} className="text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end px-2 py-2 w-full">
            {/* Left Actions */}
            <div className="flex items-center pr-2 pl-1 pb-1 gap-2">
               <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.doc,.docx"
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors focus:outline-none"
              >
                <Plus className="w-5 h-5 stroke-[1.5]" />
              </button>
            </div>

            {/* Expanding Text Area */}
            <div className="flex-1 relative pb-1">
               <textarea
                id="component-prompt"
                name="component-prompt"
                rows={prompt.split('\\n').length > 3 ? 3 : prompt.split('\\n').length}
                className="
                  w-full resize-none bg-transparent pt-3 pb-1 px-1 text-zinc-100
                  placeholder-zinc-500 text-sm sm:text-base leading-relaxed
                  outline-none focus:outline-none min-h-[40px] max-h-[200px] overflow-y-auto
                "
                placeholder="Ask anything..."
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

            {/* Right Actions & Submit */}
            <div className="flex items-center pl-2 gap-1.5 pb-1 pr-1">
              
              {/* Optional glowing dot (if active/processing) */}
              {isLoading && (
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
              )}

              <button type="button" className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors focus:outline-none hidden sm:block">
                <Sparkles className="w-4 h-4 stroke-[1.5]" />
              </button>

              <button type="button" onClick={toggleRecording} className={`p-2 rounded-full transition-colors focus:outline-none hidden sm:block ${isRecording ? 'bg-red-500/20 text-red-500' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}>
                <Mic className="w-5 h-5 stroke-[1.5]" />
              </button>

              <button
                type="submit"
                disabled={(!prompt.trim() && attachments.length === 0) || isLoading || isOverLimit}
                aria-label={isLoading ? 'Generating component, please wait' : 'Generate component'}
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full ml-1
                  transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#212121] focus:ring-white
                  ${isLoading || (!prompt.trim() && attachments.length === 0 && !isRecording) 
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed opacity-50' 
                    : 'bg-white text-black hover:scale-105 active:scale-95 shadow-md'
                  }
                `}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                ) : prompt.trim() || attachments.length > 0 || isRecording ? (
                  <Send className="w-4 h-4 block ml-[2px]" aria-hidden="true" />
                ) : (
                  <AudioLines className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          
          {/* Character limit warning underneath */}
          <div className={`overflow-hidden transition-all duration-300 ${isOverLimit ? 'h-6 opacity-100' : 'h-0 opacity-0'}`}>
            <div className="text-xs text-red-400 text-right px-6 pb-2">
              {charCount}/{maxChars}
            </div>
          </div>
        </div>

        <p id="prompt-hint" className="sr-only">
          Enter a description of the UI component you want to build, then click Generate to create a React component with accessibility features.
        </p>
      </form>

      {/* Example prompts */}
      <div className="mt-4" role="group" aria-label="Example component descriptions">
        <p className="text-xs text-gray-500 mb-2 font-medium">Quick examples:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => handleExampleClick(example)}
              disabled={isLoading}
              aria-label={`Use example: ${example}`}
              className="
                flex items-center gap-1 px-3 py-1.5 rounded-full text-xs
                border border-gray-700/50 text-gray-400
                hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/5
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-950
              "
            >
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
              {example}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
