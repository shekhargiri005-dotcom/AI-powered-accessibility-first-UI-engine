import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  askAI?: boolean;
}

export function Button({ variant = 'primary', askAI, children, className, ...props }: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2';
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-white',
    ghost: 'hover:bg-gray-800/50 text-gray-300'
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className || ''}`} {...props}>
      {askAI && <span className="text-pink-400">✨</span>}
      {children}
    </button>
  );
}
