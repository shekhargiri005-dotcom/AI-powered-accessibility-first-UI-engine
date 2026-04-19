/**
 * @file components/prompt-input/types.ts
 * Shared types for PromptInput components
 */

import type { IntentClassification } from '@/lib/validation/schemas';

export type GenerationMode = 'component' | 'app' | 'depth_ui';

export interface SubmitOptions {
  depthUi?: boolean;
}

export interface PromptInputProps {
  onSubmit: (prompt: string, mode: GenerationMode, options?: SubmitOptions) => void;
  isLoading: boolean;
  onIntentDetected?: (classification: IntentClassification) => void;
  hasActiveProject?: boolean;
  aiPayload?: Record<string, any>;
  /** Pre-fill the prompt textarea with this value (e.g. for refine) */
  initialPrompt?: string;
  /** Increment this counter to auto-focus the textarea (e.g. when refine is clicked) */
  focusTrigger?: number;
}

// Speech Recognition types
export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { isFinal: boolean; [key: number]: { transcript: string } }[];
  error?: string;
}

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

// History item type
export interface HistoryItem {
  id: string;
  componentName: string;
  promptSnippet: string;
}
