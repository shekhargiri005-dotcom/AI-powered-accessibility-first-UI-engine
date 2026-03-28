import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  voiceActivation?: boolean;
}

export function Input({ voiceActivation, className, ...props }: InputProps) {
  return (
    <div className="relative">
      <input 
        className={`w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${voiceActivation ? 'pr-10' : ''} ${className || ''}`} 
        {...props} 
      />
      {voiceActivation && (
        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-400 transition-colors">
          🎤
        </button>
      )}
    </div>
  );
}
