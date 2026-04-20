'use client';

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Info, CheckCircle2, Wrench, FileJson, FileText, Check, X } from 'lucide-react';
import type { A11yReport, A11yViolation } from '@/lib/validation/schemas';

export interface A11yReportProps {
  report: A11yReport & { appliedFixes?: string[] };
  onFixApplied?: (fixId: string) => void;
  onFixDismissed?: (fixId: string) => void;
}

const SEVERITY_CONFIG = {
  error: {
    icon: <ShieldAlert className="w-4 h-4" aria-hidden="true" />,
    label: 'Error',
    classes: 'border-red-500/30 bg-red-950/20 text-red-400',
    badgeClasses: 'bg-red-500/20 text-red-400',
    dotClass: 'bg-red-500',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
    label: 'Warning',
    classes: 'border-yellow-500/30 bg-yellow-950/20 text-yellow-400',
    badgeClasses: 'bg-yellow-500/20 text-yellow-400',
    dotClass: 'bg-yellow-500',
  },
  info: {
    icon: <Info className="w-4 h-4" aria-hidden="true" />,
    label: 'Info',
    classes: 'border-blue-500/30 bg-blue-950/20 text-blue-400',
    badgeClasses: 'bg-blue-500/20 text-blue-400',
    dotClass: 'bg-blue-400',
  },
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 90 ? '#22c55e' : score >= 70 ? '#eab308' : '#ef4444';
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" aria-hidden="true">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={radius} stroke="#374151" strokeWidth="6" fill="none" />
        <circle
          cx="40" cy="40" r={radius}
          stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

interface ViolationCardProps {
  violation: A11yViolation;
  onFixApplied?: (fixId: string) => void;
  onFixDismissed?: (fixId: string) => void;
}

function ViolationCard({ violation, onFixApplied, onFixDismissed }: ViolationCardProps) {
  const config = SEVERITY_CONFIG[violation.severity];
  const [fixState, setFixState] = useState<'idle' | 'applied' | 'dismissed'>('idle');

  const handleApply = () => {
    setFixState('applied');
    onFixApplied?.(violation.ruleId);
  };

  const handleDismiss = () => {
    setFixState('dismissed');
    onFixDismissed?.(violation.ruleId);
  };

  if (fixState === 'dismissed') return null;

  return (
    <div
      className={`rounded-lg border p-3 ${config.classes} ${fixState === 'applied' ? 'opacity-60' : ''}`}
      role="listitem"
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badgeClasses}`}>
              {violation.ruleId}
            </span>
            <span className="text-xs text-gray-500">{violation.wcagCriteria}</span>
            {fixState === 'applied' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Fixed
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-200 mb-0.5">
            {violation.description}
          </p>
          <p className="text-xs text-gray-400 font-mono mb-1.5">
            {violation.element}
          </p>
          <div className="flex items-start gap-1.5">
            <Wrench className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-gray-400 flex-1">
              <span className="font-medium text-gray-300">Fix: </span>
              {violation.suggestion}
            </p>
          </div>
          
          {/* Fix action buttons */}
          {fixState === 'idle' && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleApply}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors"
              >
                <Check className="w-3 h-3" />
                Apply Fix
              </button>
              <button
                onClick={handleDismiss}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-700/50 text-gray-400 text-xs font-medium hover:bg-gray-700 transition-colors"
              >
                <X className="w-3 h-3" />
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function A11yReportComponent({ report, onFixApplied, onFixDismissed }: A11yReportProps) {
  const errorCount = report.violations.filter(v => v.severity === 'error').length;
  const warningCount = report.violations.filter(v => v.severity === 'warning').length;
  const infoCount = report.violations.filter(v => v.severity === 'info').length;

  const handleExportJSON = () => {
    const data = {
      ...report,
      exportedAt: new Date().toISOString(),
      standard: 'WCAG 2.1 AA',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `a11y-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    // Create a simple HTML representation for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Accessibility Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #2563eb; }
          .score { font-size: 48px; font-weight: bold; color: ${report.score >= 90 ? '#22c55e' : report.score >= 70 ? '#eab308' : '#ef4444'}; }
          .violation { margin: 20px 0; padding: 15px; border-left: 4px solid #ccc; }
          .error { border-left-color: #ef4444; background: #fef2f2; }
          .warning { border-left-color: #eab308; background: #fefce8; }
          .info { border-left-color: #3b82f6; background: #eff6ff; }
          .meta { color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <h1>Accessibility Report</h1>
        <p><strong>Score:</strong> <span class="score">${report.score}</span>/100</p>
        <p><strong>Status:</strong> ${report.passed ? '✓ Passed' : '✗ Violations Found'}</p>
        <p><strong>Standard:</strong> WCAG 2.1 AA</p>
        <hr>
        <h2>Violations (${report.violations.length})</h2>
        ${report.violations.map(v => `
          <div class="violation ${v.severity}">
            <strong>${v.ruleId}</strong> (${v.severity.toUpperCase()})<br>
            <em>${v.wcagCriteria}</em><br>
            <p>${v.description}</p>
            <p><strong>Element:</strong> ${v.element}</p>
            <p><strong>Suggestion:</strong> ${v.suggestion}</p>
          </div>
        `).join('')}
        ${report.appliedFixes?.length ? `
          <h2>Applied Fixes</h2>
          <ul>${report.appliedFixes.map(f => `<li>${f}</li>`).join('')}</ul>
        ` : ''}
        <div class="meta">
          <p>Exported: ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `a11y-report-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-labelledby="a11y-report-heading"
      className="rounded-xl border border-gray-700/50 bg-gray-900/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900/80 border-b border-gray-700/50">
        <ShieldCheck className="w-4 h-4 text-green-400" aria-hidden="true" />
        <h3 id="a11y-report-heading" className="text-sm font-semibold text-white">
          Accessibility Report
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Export report as PDF/HTML"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Export report as JSON"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">JSON</span>
          </button>
          <span className="text-xs text-gray-500">WCAG 2.1 AA</span>
        </div>
      </div>

      <div className="p-4">
        {/* Score summary */}
        <div className="flex items-center gap-6 mb-4 p-4 rounded-lg bg-gray-800/50">
          <ScoreRing score={report.score} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {report.passed ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-400" aria-hidden="true" />
                  <span className="font-semibold text-green-400">All checks passed</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-5 h-5 text-red-400" aria-hidden="true" />
                  <span className="font-semibold text-red-400">Violations found</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-2">Accessibility score: {report.score}/100</p>
            {/* Violation counts */}
            <div className="flex gap-3">
              {errorCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                  {warningCount} warning{warningCount !== 1 ? 's' : ''}
                </span>
              )}
              {infoCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                  {infoCount} info
                </span>
              )}
              {report.violations.length === 0 && (
                <span className="text-xs text-green-400">✓ No violations detected</span>
              )}
            </div>
          </div>
        </div>

        {/* Applied auto-fixes */}
        {report.appliedFixes && report.appliedFixes.length > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-green-500/20 bg-green-950/20">
            <div className="flex items-center gap-2 mb-1.5">
              <Wrench className="w-3.5 h-3.5 text-green-400" aria-hidden="true" />
              <span className="text-xs font-semibold text-green-400">Auto-repairs applied</span>
            </div>
            <ul className="space-y-0.5" aria-label="Applied auto-fixes">
              {report.appliedFixes.map((fix, i) => (
                <li key={i} className="text-xs text-green-300/80 flex items-start gap-1.5">
                  <span aria-hidden="true">✓</span> {fix}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Violations list */}
        {report.violations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Violations ({report.violations.length})
            </h4>
            <ul className="space-y-2" role="list" aria-label="Accessibility violations">
              {report.violations.map((violation) => (
                <ViolationCard 
                  key={violation.ruleId} 
                  violation={violation} 
                  onFixApplied={onFixApplied}
                  onFixDismissed={onFixDismissed}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
