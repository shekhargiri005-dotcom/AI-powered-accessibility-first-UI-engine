'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  ThumbsUp, ThumbsDown, Pencil, Send, CheckCircle,
  X, Loader2, AlertCircle, History, BarChart3, TrendingUp, Clock,
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

type BarState = 'idle' | 'correcting' | 'submitting' | 'done' | 'error' | 'history' | 'analytics';

interface FeedbackHistoryItem {
  id: string;
  signal: 'thumbs_up' | 'thumbs_down' | 'corrected' | 'discarded';
  timestamp: string;
  model: string;
  provider: string;
  intentType: string;
}

interface FeedbackAnalytics {
  totalFeedback: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  correctionCount: number;
  satisfactionRate: number;
  avgLatencyMs: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FeedbackBar({
  generationId, model, provider, intentType, promptHash,
  a11yScore, critiqueScore, latencyMs, workspaceId,
  autoDetectedEdit, onFeedbackSubmitted,
}: FeedbackBarProps) {
  const [barState,      setBarState]      = useState<BarState>('idle');
  const [correctionNote, setCorrectionNote] = useState('');
  const [errorMsg,      setErrorMsg]      = useState('');
  const [history,       setHistory]       = useState<FeedbackHistoryItem[]>([]);
  const [analytics,     setAnalytics]     = useState<FeedbackAnalytics | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchFeedbackHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/feedback/history?workspaceId=${workspaceId || 'default'}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error('Failed to load feedback history', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [workspaceId]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/feedback/analytics?workspaceId=${workspaceId || 'default'}`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics || null);
      }
    } catch (e) {
      console.error('Failed to load analytics', e);
    }
  }, [workspaceId]);

  // Load feedback history when entering history state
  useEffect(() => {
    if (barState === 'history') {
      fetchFeedbackHistory();
    }
  }, [barState, fetchFeedbackHistory]);

  // Load analytics when entering analytics state
  useEffect(() => {
    if (barState === 'analytics') {
      fetchAnalytics();
    }
  }, [barState, fetchAnalytics]);

  // Auto-dismiss "done" toast after 3 seconds
  useEffect(() => {
    if (barState === 'done') {
      const timer = setTimeout(() => setBarState('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [barState]);

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

  // ── History state ──────────────────────────────────────────────────────────
  if (barState === 'history') {
    return (
      <div className="mx-4 mb-3 p-4 bg-gray-900/60 border border-gray-700/40 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Feedback History</span>
          </div>
          <button
            onClick={() => setBarState('idle')}
            className="p-1 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">No feedback history yet.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50">
                <div className="flex items-center gap-2">
                  {item.signal === 'thumbs_up' && <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />}
                  {item.signal === 'thumbs_down' && <ThumbsDown className="w-3.5 h-3.5 text-red-400" />}
                  {item.signal === 'corrected' && <Pencil className="w-3.5 h-3.5 text-blue-400" />}
                  <span className="text-xs text-gray-300">{item.provider}/{item.model}</span>
                </div>
                <span className="text-[10px] text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Analytics state ────────────────────────────────────────────────────────
  if (barState === 'analytics') {
    return (
      <div className="mx-4 mb-3 p-4 bg-gray-900/60 border border-gray-700/40 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Feedback Analytics</span>
          </div>
          <button
            onClick={() => setBarState('idle')}
            className="p-1 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {!analytics ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-800/50">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-gray-500 uppercase">Satisfaction</span>
              </div>
              <p className="text-lg font-bold text-white">{analytics.satisfactionRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] text-gray-500 uppercase">Avg Latency</span>
              </div>
              <p className="text-lg font-bold text-white">{(analytics.avgLatencyMs / 1000).toFixed(1)}s</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/50">
              <span className="text-[10px] text-gray-500 uppercase">Thumbs Up</span>
              <p className="text-lg font-bold text-emerald-400">{analytics.thumbsUpCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/50">
              <span className="text-[10px] text-gray-500 uppercase">Corrections</span>
              <p className="text-lg font-bold text-blue-400">{analytics.correctionCount}</p>
            </div>
          </div>
        )}
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

      {/* History button */}
      <button
        onClick={() => setBarState('history')}
        disabled={isSubmitting}
        title="View feedback history"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500
          hover:text-blue-400 hover:bg-blue-500/10 border border-transparent
          hover:border-blue-500/20 transition-all disabled:opacity-40 ml-2"
      >
        <History className="w-3.5 h-3.5" />
      </button>

      {/* Analytics button */}
      <button
        onClick={() => setBarState('analytics')}
        disabled={isSubmitting}
        title="View analytics"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500
          hover:text-violet-400 hover:bg-violet-500/10 border border-transparent
          hover:border-violet-500/20 transition-all disabled:opacity-40"
      >
        <BarChart3 className="w-3.5 h-3.5" />
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
