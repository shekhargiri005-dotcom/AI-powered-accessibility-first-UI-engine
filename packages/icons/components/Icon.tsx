import React from 'react';

// Stub for SVG Icon component resolving via semantic search
export function Icon({ name: _name, className = '', size = 24 }: { name: string; className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
      {/* Fallback geometric icon representing the requested name: {name} */}
    </svg>
  );
}
