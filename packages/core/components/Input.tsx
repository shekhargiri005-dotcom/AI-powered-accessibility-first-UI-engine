import * as React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'ghost';
  inputSize?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  default: 'bg-gray-900 border border-gray-700 focus:border-blue-500 focus:ring-blue-500/30',
  filled: 'bg-gray-800 border border-transparent focus:bg-gray-750 focus:border-blue-500 focus:ring-blue-500/30',
  ghost: 'bg-transparent border-b border-gray-700 rounded-none focus:border-blue-500 focus:ring-0',
};

const sizeStyles: Record<string, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, variant = 'default', inputSize = 'md', className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg text-white placeholder-gray-500',
              'focus:outline-none focus:ring-2 transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              variantStyles[variant],
              sizeStyles[inputSize],
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/30',
              className
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-400 flex items-center gap-1" role="alert">
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-gray-500">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
