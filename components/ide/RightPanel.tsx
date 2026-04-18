'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Eye, Code, GitCommit, ScrollText, Sparkles, AlertCircle, Maximize2, X,
  TrendingUp, TrendingDown, Minus, Activity, Wand2, ChevronRight, Loader2,
} from 'lucide-react';
import type { UIIntent, A11yReport } from '@/lib/validation/schemas';
import type { ProjectVersion } from '@/lib/projects/projectStore';
import type { FeedbackMeta } from '@/components/FeedbackBar';
import type { FeedbackStats } from '@/lib/ai/feedbackStore';
import type { FinalRoundStatus, FinalRoundResult } from '@/lib/ai/finalRoundCritic';
import VersionTimeline from '@/components/VersionTimeline';
import GeneratedCode from '@/components/GeneratedCode';
import A11yReportComponent from '@/components/A11yReport';
import TestOutput from '@/components/TestOutput';
import IntentBadge from '@/components/IntentBadge';
import FeedbackBar from '@/components/FeedbackBar';
import FinalRoundPanel from '@/components/FinalRoundPanel';
import dynamic from 'next/dynamic';

const SandpackPreview = dynamic(() => import('@/components/SandpackPreview'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0B0F19]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
        <span className="text-slate-500 text-xs font-medium animate-pulse">Initializing Dev Environment...</span>
      </div>
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface RightPanelProps {
  initialProject: {
    id:             string;
    timestamp:      string;
    code:           string | Record<string, string>;
    intent:         UIIntent;
    a11yReport:     A11yReport;
    componentName:  string;
    tests?:         { rtl: string; playwright: string };
  };
  onRefine:    (prompt: string) => Promise<void>;
  isRefining:  boolean;
  projectId?:  string | null;
  /** Feedback metadata from the last generation — enables the FeedbackBar */
  feedbackMeta?: FeedbackMeta | null;
  /** Intent classifier confidence (0..1) used in unified engine confidence score */
  intentConfidence?: number;
  /** AI config passed through so Final Round can call the same model */
  aiConfig?: {
    model: string;
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
  } | null;
}

type TabId = 'preview' | 'code' | 'versions' | 'metrics';

// ─── Success Rate Badge ───────────────────────────────────────────────────────

function SuccessRateBadge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  if (pct >= 70) return (
    <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
      <TrendingUp className="w-3 h-3" /> {pct}%
    </span>
  );
  if (pct >= 40) return (
    <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
      <Minus className="w-3 h-3" /> {pct}%
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
      <TrendingDown className="w-3 h-3" /> {pct}%
    </span>
  );
}

function ConfidenceGauge({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (v / 100) * circumference;
  const color = v >= 85 ? '#10b981' : v >= 70 ? '#f59e0b' : '#fb7185';

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border bg-gray-900/40 border-gray-700/50"
      aria-label={`Engine confidence ${v} percent. ${label}.`}
      title={`Engine confidence: ${v}% · ${label}`}
    >
      <div className="relative w-6 h-6 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
          <circle cx="12" cy="12" r={radius} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2.5" />
          <circle
            cx="12"
            cy="12"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <span className="absolute text-[9px] font-bold tabular-nums" style={{ color }}>
          {v}
        </span>
      </div>
      <span
        className={`text-[10px] font-semibold ${
          v >= 85 ? 'text-emerald-300' : v >= 70 ? 'text-amber-300' : 'text-rose-300'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ─── html2canvas capture helper ─────────────────────────────────────────────
// CaptureWrapper proactively broadcasts SNAPSHOT_RESULT out of the sandboxed iframe
let globalSandpackSnapshot: string | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'SNAPSHOT_RESULT') {
      globalSandpackSnapshot = e.data.payload;
    }
  });
}

// Returns null on timeout / error.
async function captureViaPostMessage(timeoutMs = 12000): Promise<string | null> {
  // 1. If it was already auto-captured and cached, consume it immediately
  if (globalSandpackSnapshot) {
    const snap = globalSandpackSnapshot;
    globalSandpackSnapshot = null;
    return snap;
  }

  // 2. Otherwise safely wait for it to arrive
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, timeoutMs);

    function handler(e: MessageEvent) {
      if (e.data?.type === 'SNAPSHOT_RESULT') {
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        globalSandpackSnapshot = null;
        resolve(e.data.payload as string);
      } else if (e.data?.type === 'SNAPSHOT_ERROR') {
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve(null);
      }
    }

    window.addEventListener('message', handler);
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RightPanel({
  initialProject,
  onRefine,
  isRefining,
  projectId,
  feedbackMeta,
  intentConfidence = 0.8,
  aiConfig,
}: RightPanelProps) {
  const [activeTab,       setActiveTab]       = useState<TabId>('preview');
  const [versions,        setVersions]        = useState<ProjectVersion[]>([{
    version:           1,
    timestamp:         initialProject.timestamp,
    code:              initialProject.code,
    intent:            initialProject.intent,
    a11yReport:        initialProject.a11yReport,
    changeDescription: 'Initial generation',
  }]);
  const [currentVersion,  setCurrentVersion]  = useState(1);
  const [isRollingBack,   setIsRollingBack]   = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');

  /** Auto-captured code edit from Sandpack — bubbles up to FeedbackBar */
  const [editedCode, setEditedCode] = useState<string | undefined>(undefined);

  /** Aggregated feedback stats fetched lazily when user opens Metrics tab */
  const [feedbackStats,    setFeedbackStats]    = useState<FeedbackStats | null>(null);
  const [statsLoading,     setStatsLoading]     = useState(false);

  // ─── Final Round state ─────────────────────────────────────────────────
  const [finalRoundStatus, setFinalRoundStatus] = useState<FinalRoundStatus>('idle');
  const [finalRoundResult, setFinalRoundResult] = useState<FinalRoundResult | undefined>(undefined);
  const [finalRoundError,  setFinalRoundError]  = useState<string | undefined>(undefined);
  const [finalRoundCodeReplaced, setFinalRoundCodeReplaced] = useState(false);
  /** Tracks which generation has had Final Round run (prevents double-firing) */
  const finalRoundFiredForRef = useRef<string>('');

  // ─── AI Suggestions state ───────────────────────────────────────────────
  const [suggestions,     setSuggestions]     = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsKeyRef = useRef<string>('');

  const activeV = versions.find((v) => v.version === currentVersion) ?? versions[versions.length - 1];
  const intentScore = Math.round(Math.max(0, Math.min(1, intentConfidence)) * 100);
  const a11yScore = activeV.a11yReport?.score ?? feedbackMeta?.a11yScore ?? 0;
  const critiqueScore = feedbackMeta?.critiqueScore ?? 0;
  const feedbackSuccessRate = feedbackStats ? Math.round((feedbackStats.successRate ?? 0) * 100) : undefined;

  const engineConfidence = (() => {
    // Base weights
    let wi = 0.25; // intent quality
    let wa = 0.40;   // accessibility (deterministic — always available)
    let wc = 0.25;   // critique (may be 0 if quota-limited)
    let wf = 0.10;   // feedback learning signal

    const hasCritique = critiqueScore > 0;
    const hasFeedback = typeof feedbackSuccessRate === 'number' && (feedbackStats?.total ?? 0) >= 3;

    // If critique unavailable, redistribute to deterministic signals
    if (!hasCritique) {
      wa += wc * 0.70; // most of critique weight goes to a11y
      wi += wc * 0.30; // rest to intent
      wc = 0;
    }

    // If feedback too sparse, redistribute to a11y + critique
    if (!hasFeedback) {
      wa += wf * 0.60;
      if (hasCritique) wc += wf * 0.40; else wi += wf * 0.40;
      wf = 0;
    }

    let score =
      (wi * intentScore) +
      (wa * a11yScore) +
      (wc * critiqueScore) +
      (wf * (feedbackSuccessRate ?? 0));

    // Small penalty only for hard errors — skipped is expected in most envs
    if (finalRoundStatus === 'error') score -= 5;

    // Generation-success floor: if we have any intentScore the pipeline ran —
    // don't let sparse signals make a successful generation look like a failure.
    if (intentScore > 0) score = Math.max(score, 30);

    return Math.max(0, Math.min(100, Math.round(score)));
  })();
  const confidenceLabel =
    engineConfidence >= 85 ? 'Ready to ship' :
    engineConfidence >= 70 ? 'Needs minor refinement' :
    'Regenerate or repair first';
  // color/label handled by ConfidenceGauge

  // Reset Final Round when a new project/generation comes in
  useEffect(() => {
    setFinalRoundStatus('idle');
    setFinalRoundResult(undefined);
    setFinalRoundError(undefined);
    setFinalRoundCodeReplaced(false);
    finalRoundFiredForRef.current = '';
  }, [initialProject.id, initialProject.timestamp]);

  // ─── AI Suggestions lazy-fetch (user-triggered to save tokens) ──────────
  const fetchSuggestions = useCallback(() => {
    if (suggestionsLoading || !initialProject.intent?.componentName) return;
    setSuggestions([]);
    const codeSnippet = typeof initialProject.code === 'string'
      ? initialProject.code.slice(0, 2000)
      : Object.values(initialProject.code)[0]?.slice(0, 2000) ?? '';

    setSuggestionsLoading(true);
    fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        componentName: initialProject.intent.componentName,
        intentDescription: initialProject.intent.description,
        codeSnippet,
        ...(aiConfig?.model ? {
          model: aiConfig.model,
          provider: aiConfig.provider,
          // SECURITY: Never send apiKey from client - server resolves it
          baseUrl: aiConfig.baseUrl,
        } : {}),
      }),
    })
      .then((r) => r.json())
      .then((data: { success: boolean; suggestions?: string[] }) => {
        if (data.success && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions.filter((s) => typeof s === 'string' && s.length > 5));
        }
      })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject.id, initialProject.timestamp, suggestionsLoading, aiConfig]);

  // Reset on new project
  useEffect(() => {
    if (initialProject.id !== (versions[0]?.intent?.componentName ?? '')) {
      setVersions([{
        version: 1, timestamp: initialProject.timestamp, code: initialProject.code,
        intent: initialProject.intent, a11yReport: initialProject.a11yReport,
        changeDescription: 'Initial generation',
      }]);
      setCurrentVersion(1);
      setActiveTab('preview');
      setEditedCode(undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject.id]);

  // Sync refinement updates as new versions
  useEffect(() => {
    if (!isRefining) {
      const exists = versions.some(
        (v) => v.timestamp === initialProject.timestamp && v.code === initialProject.code,
      );
      if (!exists && versions.length > 0) {
        const newVer: ProjectVersion = {
          version:           versions.length + 1,
          timestamp:         initialProject.timestamp,
          code:              initialProject.code,
          intent:            initialProject.intent,
          a11yReport:        initialProject.a11yReport,
          changeDescription: initialProject.intent.description || 'Refined version',
        };
        setVersions((prev) => [...prev, newVer]);
        setCurrentVersion(newVer.version);
        setEditedCode(undefined);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject.timestamp, isRefining]);

  // Fetch feedback stats when Metrics tab is opened and meta is available
  useEffect(() => {
    if (activeTab !== 'metrics' || !feedbackMeta || feedbackStats) return;
    setStatsLoading(true);
    fetch(
      `/api/feedback?model=${encodeURIComponent(feedbackMeta.model)}&intentType=${encodeURIComponent(feedbackMeta.intentType)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setFeedbackStats(data.stats ?? null);
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => setStatsLoading(false));
  }, [activeTab, feedbackMeta, feedbackStats]);

  // ─── Final Round handler ─────────────────────────────────────────────────
  const handleScreenshotReady = useCallback(async (iframeSrc: string) => {
    // Guard: only run once per generation, requires model config
    const generationKey = activeV.timestamp + activeV.version;
    if (finalRoundFiredForRef.current === generationKey) return;
    if (!aiConfig?.model) return;
    if (isRefining) return;

    finalRoundFiredForRef.current = generationKey;
    setFinalRoundStatus('running');
    setFinalRoundResult(undefined);
    setFinalRoundError(undefined);
    setFinalRoundCodeReplaced(false);

    try {
      // ── Step 1: Capture screenshot ──────────────────────────────────────
      // Sandpack nodebox preview always runs in a local iframe (blob/about:blank).
      // SandpackScreenshotObserver passes the sentinel '.../_sandpack_preview'.
      // We cannot Playwright-screenshot the Vercel host itself (allowlist blocks it).
      // Solution: use html2canvas via the CaptureWrapper postMessage protocol.
      const isSandpackPreview =
        iframeSrc.endsWith('/_sandpack_preview') ||
        iframeSrc.includes('localhost') ||
        !iframeSrc.startsWith('http');

      let imageDataUrl: string;

      if (isSandpackPreview) {
        const snapshot = await captureViaPostMessage();
        if (!snapshot) {
          setFinalRoundStatus('skipped');
          setFinalRoundError('html2canvas capture timed out — Final Round skipped.');
          return;
        }
        imageDataUrl = snapshot;
      } else {
        // Genuine external URL — use Playwright server-side capture
        const ssRes = await fetch('/api/screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: iframeSrc, delayMs: 2000, viewportWidth: 1280, viewportHeight: 800 }),
        });
        const ssData = await ssRes.json() as { success: boolean; dataUrl?: string; error?: string };
        if (!ssData.success || !ssData.dataUrl) {
          setFinalRoundStatus('skipped');
          setFinalRoundError(ssData.error ?? 'Screenshot failed — Final Round skipped.');
          return;
        }
        imageDataUrl = ssData.dataUrl;
      }

      // Step 2: Call Final Round critic with screenshot + code + same model
      const currentCode = activeV.code;
      const sanitizedApiKey = aiConfig.apiKey && aiConfig.apiKey !== '\u2022\u2022\u2022\u2022' ? aiConfig.apiKey : undefined;

      const frRes = await fetch('/api/final-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          code: currentCode,
          model: aiConfig.model,
          provider: aiConfig.provider,
          apiKey: sanitizedApiKey,
          baseUrl: aiConfig.baseUrl,
        }),
      });
      const frData = await frRes.json() as {
        success: boolean;
        status: FinalRoundStatus;
        result?: FinalRoundResult;
        error?: string;
      };

      if (!frData.success) {
        setFinalRoundStatus('error');
        setFinalRoundError(frData.error);
        return;
      }

      setFinalRoundStatus(frData.status);
      setFinalRoundResult(frData.result);

      // Step 3: If the AI designer sent back repaired code, apply it
      if (
        frData.status === 'fixed' &&
        frData.result?.suggestedCode &&
        frData.result.suggestedCode.length > 150
      ) {
        const repairedCode = frData.result.suggestedCode;
        // Append a new version with the AI Designer's improvements
        setVersions((prev) => [
          ...prev,
          {
            version: prev.length + 1,
            timestamp: new Date().toISOString(),
            code: repairedCode,
            intent: activeV.intent,
            a11yReport: activeV.a11yReport,
            changeDescription: '\u2728 Final Round: AI Designer elevation',
          },
        ]);
        setCurrentVersion((prev) => prev + 1);
        setFinalRoundCodeReplaced(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setFinalRoundStatus('error');
      setFinalRoundError(`Final Round error: ${msg}`);
    }
  }, [aiConfig, activeV, isRefining]);

  const handleRollback = useCallback(async (version: number) => {
    if (!projectId) { setCurrentVersion(version); return; }
    setIsRollingBack(true);
    try {
      const res  = await fetch(`/api/projects/${projectId}/rollback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      const data = await res.json();
      if (data.success && data.project) {
        setVersions(data.project.versions);
        setCurrentVersion(data.project.currentVersion);
      }
    } catch { /* ignore */ } finally {
      setIsRollingBack(false);
    }
  }, [projectId]);

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'preview',  label: 'Preview',  icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'code',     label: 'Code',     icon: <Code className="w-3.5 h-3.5" /> },
    { id: 'versions', label: 'History',  icon: <GitCommit className="w-3.5 h-3.5" /> },
    { id: 'metrics',  label: 'Metrics',  icon: <ScrollText className="w-3.5 h-3.5" /> },
  ];

  const handleRefineSubmit = () => {
    if (!refinementPrompt.trim() || isRefining) return;
    onRefine(refinementPrompt.trim());
    setRefinementPrompt('');
  };

  return (
    <div className={`
      flex flex-col flex-1 min-h-0 bg-[#0B0F19] border-t lg:border-t-0 lg:border-l border-white/[0.08] z-20
      ${isFullscreen ? 'fixed inset-0 lg:left-72 z-50' : 'relative w-full'}
    `}>
      {/* ── Top Header ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            </span>
            <h2 className="text-sm font-bold text-white tracking-tight">{activeV.intent.componentName}</h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white/[0.05] text-[10px] text-slate-400 font-mono border border-white/[0.08]">
            v{currentVersion}
          </span>
          <IntentBadge intentType={currentVersion > 1 ? 'ui_refinement' : 'ui_generation'} size="sm" showLabel={false} />
          <ConfidenceGauge value={engineConfidence} label={confidenceLabel} />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] rounded-xl border border-white/[0.08]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                ${activeTab === t.id
                  ? 'bg-violet-600/20 text-violet-300 shadow-sm border border-violet-500/30'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] border border-transparent'
                }
              `}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
          <div className="w-px h-4 bg-white/[0.10] mx-1" />
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/[0.07] transition"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <X className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden relative min-h-0 bg-black/30 flex flex-col">

        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 relative min-h-0">
              <SandpackPreview
                key={`preview-${activeV.timestamp}-${currentVersion}`}
                code={activeV.code as string | Record<string, string>}
                componentName={activeV.intent.componentName}
                onCodeChange={setEditedCode}
                onReadyForScreenshot={aiConfig ? handleScreenshotReady : undefined}
              />

              {/* ✨ Holy Grail: Final Round Panel — floats in bottom-right of preview */}
              <FinalRoundPanel
                status={finalRoundStatus}
                result={finalRoundResult}
                codeWasReplaced={finalRoundCodeReplaced}
                errorMessage={finalRoundError}
                onDismiss={() => setFinalRoundStatus('idle')}
              />
            </div>

            {/* FeedbackBar — below preview, above refinement bar */}
            {feedbackMeta && (
              <FeedbackBar
                {...feedbackMeta}
                autoDetectedEdit={editedCode}
                onFeedbackSubmitted={() => setEditedCode(undefined)}
              />
            )}
          </div>
        )}

        {/* Code Tab */}
        {activeTab === 'code' && (
          <div className="absolute inset-0 overflow-y-auto z-10 bg-gray-950 pb-24">
            <GeneratedCode
              code={typeof activeV.code === 'string' ? activeV.code : JSON.stringify(activeV.code, null, 2)}
              componentName={activeV.intent.componentName}
            />
          </div>
        )}

        {/* Versions Tab */}
        {activeTab === 'versions' && (
          <div className="absolute inset-0 overflow-hidden flex bg-gray-950/50">
            <div className="w-full max-w-sm border-r border-gray-800/60 bg-gray-900/30 overflow-y-auto custom-scrollbar">
              <VersionTimeline
                versions={versions}
                currentVersion={currentVersion}
                onSelectVersion={(v) => setCurrentVersion(v.version)}
                onRollback={handleRollback}
                isRollingBack={isRollingBack}
              />
            </div>
            <div className="flex-1 flex items-center justify-center p-8 bg-gray-950/80 text-center">
              <div className="max-w-md">
                <GitCommit className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-200 mb-2">Version History</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Select a version from the timeline on the left to preview it. You can rollback to any previous state non-destructively.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="absolute inset-0 overflow-y-auto bg-gray-950 p-6 space-y-8 pb-24 custom-scrollbar">

            {/* A11y Report */}
            {activeV.a11yReport && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" /> Accessibility Report
                </h3>
                <A11yReportComponent report={activeV.a11yReport} />
              </div>
            )}

            {/* Test Output */}
            {initialProject.tests && (
              <div>
                <TestOutput tests={initialProject.tests} componentName={initialProject.componentName} />
              </div>
            )}

            {/* ── Generation Intelligence (Feedback Stats) ───────────────── */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> Generation Intelligence
              </h3>

              {!feedbackMeta ? (
                <p className="text-xs text-gray-600 italic">
                  Complete a generation to see model performance stats.
                </p>
              ) : statsLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 border border-gray-600 border-t-white rounded-full animate-spin" />
                  Loading stats…
                </div>
              ) : !feedbackStats ? (
                <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-5 text-center space-y-1">
                  <p className="text-xs text-gray-400 font-medium">No feedback data yet</p>
                  <p className="text-[10px] text-gray-600">
                    Rate this generation using the feedback bar in the Preview tab.
                    After a few samples the engine will start learning.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-200 mb-0.5">
                        {feedbackMeta.model}
                      </p>
                      <p className="text-[10px] text-gray-500 capitalize">
                        {feedbackMeta.intentType} components · {feedbackStats.total} sample{feedbackStats.total !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <SuccessRateBadge rate={feedbackStats.successRate} />
                  </div>

                  {/* Signal breakdown */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '👍 Approved',  value: feedbackStats.thumbsUp,   color: 'text-emerald-400' },
                      { label: '👎 Rejected',  value: feedbackStats.thumbsDown,  color: 'text-red-400'     },
                      { label: '✏️ Corrected', value: feedbackStats.corrected,   color: 'text-blue-400'    },
                      { label: '🗑️ Discarded', value: feedbackStats.discarded,   color: 'text-gray-500'    },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-lg border border-gray-800 bg-gray-900/30 px-3 py-2.5">
                        <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
                        <p className={`text-lg font-bold ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Quality scores */}
                  <div className="rounded-xl border border-gray-800 bg-gray-900/30 px-4 py-3 space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Avg quality scores</p>
                    {[
                      { label: 'A11y score',     value: feedbackStats.avgA11yScore,     suffix: '/100' },
                      { label: 'Critique score', value: feedbackStats.avgCritiqueScore, suffix: '/100' },
                      { label: 'Latency',        value: Math.round(feedbackStats.avgLatencyMs / 1000), suffix: 's' },
                    ].map(({ label, value, suffix }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{label}</span>
                        <span className="text-xs font-semibold text-gray-300 font-mono">
                          {value}{suffix}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-gray-700 text-right">
                    Updated {new Date(feedbackStats.lastUpdated).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Refining overlay */}
        {isRefining && (
          <div className="absolute inset-0 z-50 bg-[#0B0F19]/85 backdrop-blur-md flex items-center justify-center">
            <div className="flex flex-col items-center gap-5 text-center p-8 rounded-3xl bg-white/[0.04] border border-white/[0.08] shadow-2xl shadow-violet-500/10 backdrop-blur-xl">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-violet-500/10 border-t-violet-500 rounded-full animate-spin" />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-violet-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight mb-1">Evolving UI</h3>
                <p className="text-sm text-slate-400">Applying intelligent targeted patches...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Persistent Bottom Editing Bar ─────────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#0B0F19]/95 border-t border-white/[0.08] shadow-[0_-10px_40px_rgba(139,92,246,0.08)] z-20 backdrop-blur-xl">

        {/* ✨ AI Suggestion Chips — lazy loaded on user request */}
        <div className="px-4 pt-3 pb-1">
          {suggestions.length === 0 && !suggestionsLoading ? (
            <button
              type="button"
              onClick={fetchSuggestions}
              disabled={isRefining}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium
                bg-violet-500/10 border border-violet-500/20 text-violet-400/70
                hover:bg-violet-500/15 hover:text-violet-300 hover:border-violet-500/40
                disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
            >
              <Wand2 className="w-3 h-3" />
              Get AI Ideas
            </button>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="w-3 h-3 text-violet-400" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/80">
                  AI Suggestions
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {suggestionsLoading && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800/60 border border-gray-700/40 text-[11px] text-gray-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generating ideas…
                  </div>
                )}
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRefinementPrompt(s)}
                    disabled={isRefining}
                    title={s}
                    className="
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium
                      bg-violet-500/10 border border-violet-500/30 text-violet-300
                      hover:bg-violet-500/20 hover:border-violet-400/50 hover:text-violet-200
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500
                      max-w-[220px] truncate
                    "
                  >
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Refine Input */}
        <div className="flex items-center gap-3 w-full p-4">
          <div className="flex items-center gap-3 w-full bg-white/[0.04] p-2 rounded-2xl border border-white/[0.08] focus-within:ring-2 focus-within:ring-violet-500/40 focus-within:border-violet-500/40 transition-all backdrop-blur-sm">
            <input
              type="text"
              value={refinementPrompt}
              onChange={(e) => setRefinementPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRefineSubmit()}
              placeholder="Targeted edit... (e.g. 'Make the hero title larger and add a violet glow')"
              disabled={isRefining}
              className="flex-1 bg-transparent px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none"
            />
            <button
              onClick={handleRefineSubmit}
              disabled={!refinementPrompt.trim() || isRefining}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all disabled:opacity-30 shadow-lg shadow-violet-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isRefining ? 'Applying' : 'Refine'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
