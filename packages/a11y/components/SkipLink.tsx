import React from 'react';

export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a 
      href={`#${targetId}`} 
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-lg z-[9999]"
    >
      Skip to main content
    </a>
  );
}
