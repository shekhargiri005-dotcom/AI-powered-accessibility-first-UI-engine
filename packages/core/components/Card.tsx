import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}
