import React from 'react';

export function Motion({ children, animation = 'fade', className = '' }: { children: React.ReactNode; animation?: string; className?: string }) {
  // A stub for Framer Motion or similar spring physics component
  const animationClass = animation === 'fade' ? 'animate-in fade-in duration-500' : 
                         animation === 'slide' ? 'animate-in slide-in-from-bottom-4 duration-500' :
                         animation === 'scale' ? 'animate-in zoom-in-95 duration-500' : '';

  return <div className={`${animationClass} ${className}`}>{children}</div>;
}
