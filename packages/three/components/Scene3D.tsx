'use client';

import React from 'react';

export function Scene3D({ children }: { children?: React.ReactNode }) {
  return (
    <div className="w-full h-64 bg-gray-900 border border-gray-800 rounded-xl relative overflow-hidden flex items-center justify-center">
      <span className="text-gray-500 absolute bottom-4 right-4 text-xs font-mono">WebGPU Ready</span>
      <div className="text-cyan-400 font-bold tracking-widest">[ 3D Scene Container ]</div>
      {children}
    </div>
  );
}

export function AnimatedModel({ url }: { url: string }) {
  return <div className="p-4 border border-dashed border-cyan-500/30 text-cyan-500/50">Model: {url}</div>;
}

export function ParticleSystem({ count: _count = 1000 }: { count?: number }) {
  return <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 to-transparent pointer-events-none opacity-50" />;
}
