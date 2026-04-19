import * as React from 'react';
import { cn } from '../../utils/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full space-y-1.5">
        {label && <label htmlFor={textareaId} className="block text-sm font-medium text-gray-300">{label}</label>}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full min-h-[80px] bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed resize-y',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/30',
            className
          )}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        />
        {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
