import * as React from 'react';
import { cn } from '../../utils/cn';

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

export function Form({ children, className, ...props }: FormProps) {
  return (
    <form className={cn('space-y-4', className)} {...props}>
      {children}
    </form>
  );
}

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, error, hint, required, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-300">
        {label}
        {required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  error?: string;
}

export function Select({ options, placeholder, error, className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full h-10 bg-gray-900 border border-gray-700 rounded-lg px-3 text-sm text-white',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error && 'border-red-500',
        className
      )}
      {...props}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(opt => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
      ))}
    </select>
  );
}

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const checkId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={checkId}
        className={cn(
          'mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-500',
          'focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-0 transition-colors',
          className
        )}
        {...props}
      />
      <div className="space-y-0.5">
        <label htmlFor={checkId} className="text-sm font-medium text-gray-300 cursor-pointer">{label}</label>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    </div>
  );
}

export interface ToggleProps {
  label: string;
  description?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function Toggle({ label, description, checked, onChange, className, id, disabled }: ToggleProps) {
  const toggleId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <label htmlFor={toggleId} className="text-sm font-medium text-gray-300 cursor-pointer">{label}</label>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        id={toggleId}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-2 focus:ring-offset-gray-900',
          checked ? 'bg-blue-500' : 'bg-gray-700',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <span className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0'
        )} />
      </button>
    </div>
  );
}

export interface RadioGroupProps {
  name: string;
  options: { value: string; label: string; description?: string }[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function RadioGroup({ name, options, value, onChange, className }: RadioGroupProps) {
  return (
    <div className={cn('space-y-2', className)} role="radiogroup">
      {options.map(opt => (
        <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange?.(opt.value)}
            className="mt-0.5 h-4 w-4 border-gray-600 bg-gray-900 text-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-0 transition-colors"
          />
          <div className="space-y-0.5">
            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{opt.label}</span>
            {opt.description && <p className="text-xs text-gray-500">{opt.description}</p>}
          </div>
        </label>
      ))}
    </div>
  );
}
