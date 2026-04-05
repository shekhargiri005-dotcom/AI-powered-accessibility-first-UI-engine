'use client';

import React, { useState, useCallback } from 'react';
import {
  ThumbsUp, ThumbsDown, Pencil, Send, CheckCircle,
  X, Loader2, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedbackMeta {
  generationId:  string;
  model:         string;
  provider:      string;
  intentType:    string;
  promptHash:    string;
  a11yScore:     number;
  critiqueScore: number;
  latencyMs:     number;
  workspaceId?:  string;
}

interface FeedbackBarProps extends FeedbackMeta {
  /**
   * Automatically captured code from SandpackChangeObserver.
   * When set, the "I corrected it" button highlights and pre-fills correctedCode.
   */
  autoDetectedEdit?:    string;
  onFeedbackSubmitted?: (signal: string) => void;
}

type BarState = 'idle' | 'correcting' | 'submitting' | 'done' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export default function FeedbackBar({
  generationId, model, provider, intentType, promptHash,
  a11yScore, critiqueScore, latencyMs, workspaceId,
  autoDetectedEdit, onFeedbackSubmitted,
}: FeedbackBarProps) {
  const [barState,      setBarState]      = useState<BarState>('idle');
  const [correctionNote, setCorrectionNote] = useState('');
  const [errorMsg,      setErrorMsg]      = useState('');

  const submit = useCallback(async (
    signal:        'thumbs_up' | 'thumbs_down' | 'corrected' | 'discarded',
    note?:         string,
    correctedCode?: string,
  ) => {
    setBarState('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId,
          signal,
          model,
          provider,
          intentType,
          promptHash,
          a11yScore,
          critiqueScore,
          latencyMs,
          workspaceId,
          correctionNote:  note          || undefined,
          // Prefer explicit correctedCode, fall back to what Sandpack captured
          correctedCode:   correctedCode || autoDetectedEdit || undefined,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      setBarState('done');
      onFeedbackSubmitted?.(signal);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record');
      setBarState('error');
    }
  }, [
    generationId, model, provider, intentType, promptHash,
    a11yScore, critiqueScore, latencyMs, workspaceId,
    autoDetectedEdit, onFeedbackSubmitted,
  ]);

  // ── Done state ─────────────────────────────────────────────────────────────
  if (barState === 'done') {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mx-4 mb-3">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-xs text-emerald-300 font-medium">
          Thanks — your signal will improve future generations.
        </span>
      </div>
    );
  }

  // ── Correcting state ───────────────────────────────────────────────────────
  if (barState === 'correcting') {
    return (
      <div className="space-y-2 mx-4 mb-3 p-3 bg-gray-900/60 border border-gray-700/40 rounded-xl">
        {/* Auto-capture badge */}
        {autoDetectedEdit && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <CheckCircle className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="text-[10px] text-blue-300 font-medium">
              Sandpack edit auto-captured — {autoDetectedEdit.length.toLocaleString()} chars recorded
            </span>
          </div>
        )}

        <input
          id="feedback-correction-note"
          type="text"
          value={correctionNote}
          onChange={(e) => setCorrectionNote(e.target.value)}
          placeholder="What was wrong? (optional — e.g. 'hero section lacked spacing')"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700/60 rounded-lg
            text-xs text-white placeholder-gray-500 focus:outline-none
            focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit('corrected', correctionNote);
            if (e.key === 'Escape') { setBarState('idle'); setCorrectionNote(''); }
          }}
          autoFocus
        />

        <div className="flex gap-2">
          <button
            onClick={() => submit('corrected', correctionNote)}
            disabled={false}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white
              text-xs font-semibold hover:bg-blue-500 transition"
          >
            <Send className="w-3 h-3" />
            Submit Correction
          </button>
          <button
            onClick={() => { setBarState('idle'); setCorrectionNote(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800
              text-gray-400 text-xs hover:text-white hover:bg-gray-700 transition"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Idle / error state ─────────────────────────────────────────────────────
  const isSubmitting = barState === 'submitting';

  return (
    <div
      className="flex items-center gap-1 px-4 py-2 border-t border-gray-800/60"
      role="group"
      aria-label="Generation feedback"
    >
      <span className="text-[10px] text-gray-600 font-medium mr-1.5 shrink-0">
        Was this useful?
      </span>

      {/* Thumbs Up */}
      <button
        id="feedback-thumbs-up"
        onClick={() => submit('thumbs_up')}
        disabled={isSubmitting}
        title="Looks great"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500
          hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent
          hover:border-emerald-500/20 transition-all disabled:opacity-40"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Looks great</span>
      </button>

      {/* Thumbs Down */}
      <button
        id="feedback-thumbs-down"
        onClick={() => submit('thumbs_down')}
        disabled={isSubmitting}
        title="Needs work"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500
          hover:text-red-400 hover:bg-red-500/10 border border-transparent
          hover:border-red-500/20 transition-all disabled:opacity-40"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Needs work</span>
      </button>

      {/* Corrected — highlights when Sandpack edit auto-detected */}
      <button
        id="feedback-corrected"
        onClick={() => setBarState('correcting')}
        disabled={isSubmitting}
        title={autoDetectedEdit ? 'Edit captured — click to submit correction' : 'I corrected it'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all disabled:opacity-40
          ${autoDetectedEdit
            ? 'text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/20 animate-pulse'
            : 'text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 border-transparent hover:border-blue-500/20'
          }`}
      >
        {isSubmitting
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Pencil className="w-3.5 h-3.5" />
        }
        <span className="hidden sm:inline">
          {autoDetectedEdit ? 'Edit captured ✓' : 'I corrected it'}
        </span>
      </button>

      {/* Error toast */}
      {barState === 'error' && (
        <span className="text-[10px] text-red-400 flex items-center gap-1 ml-auto">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {errorMsg}
          <button
            onClick={() => setBarState('idle')}
            className="ml-1 underline hover:no-underline"
          >
            retry
          </button>
        </span>
      )}
    </div>
  );
}
