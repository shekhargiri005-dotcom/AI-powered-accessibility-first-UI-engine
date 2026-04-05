'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Settings2, Layers } from 'lucide-react';

/**
 * The AIModel type is intentionally open (`string`) so that new models
 * can be added without requiring a TypeScript union update.
 * The AI_MODELS map provides the definitive list of known models.
 */
export type AIModel = string;

export interface ModelDef {
  id: AIModel;
  name: string;
  description: string;
  icon: string;
  maxLines: number;
}

export const AI_MODELS: Record<AIModel, ModelDef> = {
  'gpt-5.4-mini': { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', description: 'Daily UI generation', icon: '⚡', maxLines: 500 },
  'gpt-5.4-nano': { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', description: 'Ultra-fast', icon: '⚡', maxLines: 250 },
  'gpt-4.1': { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Massive context', icon: '📦', maxLines: 500 },
  'gpt-5.4': { id: 'gpt-5.4', name: 'GPT-5.4', description: 'Advanced reasoning', icon: '🧠', maxLines: 1000 },
  'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal', icon: '🖼️', maxLines: 500 },
  'gpt-4o-mini': { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast multimodal', icon: '🧠', maxLines: 400 },
  'deepseek-coder': { id: 'deepseek-coder', name: 'DeepSeek 6.7B (Local)', description: 'Ollama-powered local AI', icon: '🦙', maxLines: 800 },
};

export interface ModelSwitcherProps {
  onModelChange: (model: AIModel) => void;
  onFullAppModeChange: (enabled: boolean) => void;
  onMultiSlideModeChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export default function ModelSwitcher({ onModelChange, onFullAppModeChange, onMultiSlideModeChange, disabled }: ModelSwitcherProps) {
  const [selectedModel, setSelectedModel] = useState<AIModel>('gpt-5.4-mini');
  const [isFullAppMode, setIsFullAppMode] = useState(false);
  const [isMultiSlideMode, setIsMultiSlideMode] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedModel = localStorage.getItem('uiEngine_model') as AIModel | null;
      const savedAppMode = localStorage.getItem('uiEngine_fullAppMode');
      const savedSlideMode = localStorage.getItem('uiEngine_multiSlideMode');
      
      if (savedModel && AI_MODELS[savedModel]) {
        setTimeout(() => {
          setSelectedModel(savedModel);
          onModelChange(savedModel);
        }, 0);
      }
      if (savedAppMode) {
        const isEnabled = savedAppMode === 'true';
        setTimeout(() => {
          setIsFullAppMode(isEnabled);
          onFullAppModeChange(isEnabled);
        }, 0);
      }
      if (savedSlideMode) {
        const isEnabled = savedSlideMode === 'true';
        setTimeout(() => {
          setIsMultiSlideMode(isEnabled);
          onMultiSlideModeChange(isEnabled);
        }, 0);
      }
    } catch (e) {
      console.warn("LocalStorage access denied or unavailable", e);
    }
  }, [onFullAppModeChange, onModelChange, onMultiSlideModeChange]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelectModel = (modelId: AIModel) => {
    setSelectedModel(modelId);
    setIsOpen(false);
    localStorage.setItem('uiEngine_model', modelId);
    onModelChange(modelId);
    showToast(`Switched to ${AI_MODELS[modelId].name}`);
  };

  const handleToggleFullAppMode = () => {
    const newVal = !isFullAppMode;
    setIsFullAppMode(newVal);
    localStorage.setItem('uiEngine_fullAppMode', String(newVal));
    onFullAppModeChange(newVal);
    showToast(newVal ? 'Full App Mode Enabled (Chunking)' : 'Full App Mode Disabled');
  };

  const handleToggleMultiSlideMode = () => {
    const newVal = !isMultiSlideMode;
    setIsMultiSlideMode(newVal);
    localStorage.setItem('uiEngine_multiSlideMode', String(newVal));
    onMultiSlideModeChange(newVal);
    showToast(newVal ? 'Multi-Slide Mode Enabled' : 'Multi-Slide Mode Disabled');
  };

  const activeModel = AI_MODELS[selectedModel];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative" ref={dropdownRef}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-lg z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}

      {/* Model Dropdown Container */}
      <div className="relative flex-1 sm:min-w-[240px]">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Selected model: ${activeModel.name}. Click to change.`}
          className="w-full flex items-center justify-between gap-3 px-4 py-2 bg-gray-900 border border-gray-700/50 rounded-xl hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center gap-3 truncate">
            <span className="text-xl" aria-hidden="true">{activeModel.icon}</span>
            <div className="flex flex-col items-start truncate">
              <span className="text-sm font-semibold text-white truncate">{activeModel.name}</span>
              <span className="text-[10px] text-gray-400 truncate hidden sm:block">Up to {activeModel.maxLines} lines</span>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div
            role="listbox"
            className="absolute top-full left-0 w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-40 py-2"
          >
            {Object.values(AI_MODELS).map((model) => (
              <button
                key={model.id}
                role="option"
                aria-selected={selectedModel === model.id}
                onClick={() => handleSelectModel(model.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{model.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">{model.name}</span>
                    <span className="text-xs text-gray-400">{model.description} · Limit: {model.maxLines}</span>
                  </div>
                </div>
                {selectedModel === model.id && <Check className="w-4 h-4 text-blue-500" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Controls Container */}
      <div className="flex items-center gap-2 ml-auto">
        
        {/* Full App Mode Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/40 border border-gray-700/30 rounded-xl">
          <div className="flex flex-col items-end sm:items-start group relative">
            <label htmlFor="full-app-toggle" className="text-sm font-semibold text-white flex items-center gap-2 cursor-pointer">
              <Settings2 className="w-4 h-4 text-gray-400" />
              Full App
            </label>
            <span className="text-[10px] text-gray-500 hidden sm:block">Chunking mode</span>
            
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-gray-800 text-xs text-gray-300 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Bypasses API token limits by generating deep architectural file manifests and chunking generation.
            </div>
          </div>
          
          <button
            id="full-app-toggle"
            role="switch"
            aria-checked={isFullAppMode}
            disabled={disabled}
            onClick={handleToggleFullAppMode}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
              isFullAppMode ? 'bg-violet-600' : 'bg-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                isFullAppMode ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Multi-Slide Mode Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/40 border border-gray-700/30 rounded-xl">
          <div className="flex flex-col items-end sm:items-start group relative">
            <label htmlFor="multi-slide-toggle" className="text-sm font-semibold text-white flex items-center gap-2 cursor-pointer">
              <Layers className="w-4 h-4 text-gray-400" />
              Multi-slide
            </label>
            <span className="text-[10px] text-gray-500 hidden sm:block">Paginated view</span>
            
            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 w-56 p-2 bg-gray-800 text-[11px] leading-tight text-gray-300 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Instructs the AI to structuralize outputs as a multi-slide/multi-view architectural experience rather than a single static block. For WebGL, orchestrates camera physics with HTML navigation overlays.
            </div>
          </div>
          
          <button
            id="multi-slide-toggle"
            role="switch"
            aria-checked={isMultiSlideMode}
            disabled={disabled}
            onClick={handleToggleMultiSlideMode}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
              isMultiSlideMode ? 'bg-emerald-500' : 'bg-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                isMultiSlideMode ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

      </div>
    </div>
  );
}
