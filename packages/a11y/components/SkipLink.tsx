import * as React from 'react';

export interface SkipLinkProps {
  targetId?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SkipLink({ targetId = 'main-content', children = 'Skip to main content', className }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={className || 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-lg z-[9999] focus:outline-none focus:ring-2 focus:ring-blue-400'}
    >
      {children}
    </a>
  );
}
