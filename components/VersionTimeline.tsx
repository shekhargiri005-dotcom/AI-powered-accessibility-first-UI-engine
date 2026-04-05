'use client';

import React from 'react';
import {
  GitCommit, RotateCcw, Clock, CheckCircle2, Plus,
} from 'lucide-react';
import type { ProjectVersion } from '@/lib/projects/projectStore';

export interface VersionTimelineProps {
  versions: ProjectVersion[];
  currentVersion: number;
  onSelectVersion: (version: ProjectVersion) => void;
  onRollback: (version: number) => void;
  isRollingBack?: boolean;
}

export default function VersionTimeline({
  versions,
  currentVersion,
  onSelectVersion,
  onRollback,
  isRollingBack = false,
}: VersionTimelineProps) {
  return (
    <aside
      aria-label="Version history timeline"
      className="w-64 border-r border-gray-700/30 bg-gray-900/20 flex-col hidden md:flex"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700/20 flex-shrink-0">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <GitCommit className="w-3.5 h-3.5 text-blue-400" />
          Version History
        </h3>
        <p className="text-[10px] text-gray-600 mt-1">{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {[...versions].reverse().map((ver) => {
          const isActive = ver.version === currentVersion;
          const isLatest = ver.version === Math.max(...versions.map(v => v.version));

          return (
            <div key={ver.version} className="relative">
              {/* Connector line */}
              {ver.version !== Math.min(...versions.map(v => v.version)) && (
                <div className="absolute left-[18px] top-0 w-px h-2 bg-gray-700/50 -translate-y-2" />
              )}

              {/* Version card — uses div+tabIndex to avoid button-in-button invalid HTML */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectVersion(ver)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectVersion(ver); } }}
                aria-label={`Select version ${ver.version}: ${ver.changeDescription}`}
                aria-current={isActive ? 'true' : undefined}
                className={`
                  w-full text-left p-3 rounded-xl transition-all border group cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50
                  ${isActive
                    ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20'
                    : 'border-transparent hover:bg-gray-800/50 hover:border-gray-700/50'
                  }
                `}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  {/* Version badge */}
                  <span className={`
                    w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 border
                    ${isActive
                      ? 'bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-500/30'
                      : 'bg-gray-800 text-gray-400 border-gray-700'
                    }
                  `}>
                    v{ver.version}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isLatest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          LATEST
                        </span>
                      )}
                      {isActive && !isLatest && (
                        <CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="truncate">{new Date(ver.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                  </div>
                </div>

                {/* Change description */}
                <p className="text-[11px] text-gray-300 line-clamp-2 leading-relaxed">
                  {ver.changeDescription}
                </p>

                {/* Lines changed */}
                {ver.linesChanged !== undefined && ver.linesChanged > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {ver.version === 1 ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <Plus className="w-2.5 h-2.5" />
                        {ver.linesChanged} lines
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-blue-400">
                        <span>~{ver.linesChanged} lines changed</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Rollback button — shown on hover, hidden for current version + initial version */}
                {!isActive && ver.version > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRollback(ver.version);
                    }}
                    disabled={isRollingBack}
                    className="
                      mt-2 w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg
                      border border-gray-700/50 text-[10px] text-gray-400
                      hover:border-orange-500/40 hover:text-orange-300 hover:bg-orange-500/8
                      opacity-0 group-hover:opacity-100 transition-all duration-200
                      disabled:opacity-30 disabled:cursor-not-allowed
                    "
                    aria-label={`Roll back to version ${ver.version}`}
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Roll back to v{ver.version}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
