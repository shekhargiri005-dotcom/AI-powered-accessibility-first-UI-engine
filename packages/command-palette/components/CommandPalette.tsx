import React, { useState, useEffect } from 'react';

export function CommandPalette({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
        // Toggle logic should be handled by parent state, this is just a stub
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-sm bg-black/60">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 p-4 border-b border-gray-800">
          <span className="text-gray-400">🔍</span>
          <input 
            autoFocus 
            placeholder="Search commands or trigger AI..." 
            className="flex-1 bg-transparent text-white focus:outline-none text-lg"
          />
          <button className="text-gray-400 hover:text-white px-2 cursor-pointer transition-colors">🎤</button>
        </div>
        <div className="p-2 max-h-96 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
