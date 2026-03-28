import React from 'react';

export function Grid({ children, cols = 1, className = '', gap = 4 }: { children: React.ReactNode; cols?: number; className?: string; gap?: number }) {
  const colClass = `grid-cols-${cols}`;
  const gapClass = `gap-${gap}`;
  return <div className={`grid ${colClass} ${gapClass} ${className}`}>{children}</div>;
}

export function Stack({ children, direction = 'col', className = '', gap = 4 }: { children: React.ReactNode; direction?: 'row' | 'col'; className?: string; gap?: number }) {
  return <div className={`flex flex-${direction} gap-${gap} ${className}`}>{children}</div>;
}

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`w-full max-w-7xl mx-auto px-4 ${className}`}>{children}</div>;
}
