'use client';

import React, { useState } from 'react';
import { Sparkles, Send, Loader2, ChevronRight } from 'lucide-react';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
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

      <form onSubmit={handleSubmit} aria-label="UI component generation form">
        <div className={`
          relative rounded-xl border transition-all duration-200
          ${isFocused
            ? 'border-blue-500/50 shadow-lg shadow-blue-500/10'
            : 'border-gray-700/50'
          }
          bg-gray-900/60 backdrop-blur-sm
        `}>
          <label htmlFor="component-prompt" className="sr-only">
            Describe the UI component you want to generate
          </label>
          <textarea
            id="component-prompt"
            name="component-prompt"
            rows={4}
            className="
              w-full resize-none bg-transparent px-4 pt-4 pb-2 text-white
              placeholder-gray-500 text-sm leading-relaxed
              outline-none focus:outline-none rounded-xl
            "
            placeholder="e.g., 'A login form with email and password fields, a remember me checkbox, and a submit button that shows a loading spinner'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isLoading}
            maxLength={maxChars + 100}
            aria-label="Component description"
            aria-required="true"
            aria-describedby="char-count prompt-hint"
          />

          <div className="flex items-center justify-between px-4 pb-3">
            <span
              id="char-count"
              className={`text-xs ${isOverLimit ? 'text-red-400' : 'text-gray-500'}`}
              aria-live="polite"
              aria-label="Character count"
            >
              {charCount}/{maxChars}
            </span>

            <button
              type="submit"
              disabled={!prompt.trim() || isLoading || isOverLimit}
              aria-label={isLoading ? 'Generating component, please wait' : 'Generate component'}
              className="
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                bg-gradient-to-r from-blue-600 to-violet-600
                hover:from-blue-500 hover:to-violet-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
              "
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>Generate</span>
                </>
              )}
            </button>
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
