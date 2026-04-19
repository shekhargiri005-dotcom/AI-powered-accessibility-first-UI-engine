import * as React from 'react';
import { cn } from '../../utils/cn';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  smCols?: 1 | 2 | 3 | 4;
  mdCols?: 1 | 2 | 3 | 4 | 6;
  lgCols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8;
  children: React.ReactNode;
}

const colStyles: Record<number, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
  5: 'grid-cols-5', 6: 'grid-cols-6', 12: 'grid-cols-12',
};
const smColStyles: Record<number, string> = {
  1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4',
};
const mdColStyles: Record<number, string> = {
  1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 6: 'md:grid-cols-6',
};
const lgColStyles: Record<number, string> = {
  1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 12: 'lg:grid-cols-12',
};
const gapStyles: Record<number, string> = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 5: 'gap-5', 6: 'gap-6', 8: 'gap-8',
};

export function Grid({ cols = 1, smCols, mdCols, lgCols, gap = 4, className, children, ...props }: GridProps) {
  return (
    <div
      className={cn(
        'grid',
        colStyles[cols],
        smCols && smColStyles[smCols],
        mdCols && mdColStyles[mdCols],
        lgCols && lgColStyles[lgCols],
        gapStyles[gap],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'col';
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  children: React.ReactNode;
}

const alignStyles: Record<string, string> = {
  start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch', baseline: 'items-baseline',
};
const justifyStyles: Record<string, string> = {
  start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between', around: 'justify-around', evenly: 'justify-evenly',
};

export function Stack({ direction = 'col', gap = 4, align, justify, wrap, className, children, ...props }: StackProps) {
  return (
    <div
      className={cn(
        'flex',
        direction === 'row' ? 'flex-row' : 'flex-col',
        gapStyles[gap],
        align && alignStyles[align],
        justify && justifyStyles[justify],
        wrap && 'flex-wrap',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
}

const containerSizes: Record<string, string> = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  full: 'max-w-full',
};

export function Container({ size = 'xl', className, children, ...props }: ContainerProps) {
  return (
    <div className={cn('w-full mx-auto px-4 sm:px-6 lg:px-8', containerSizes[size], className)} {...props}>
      {children}
    </div>
  );
}

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
}

export function Divider({ orientation = 'horizontal', label, className, ...props }: DividerProps) {
  if (orientation === 'vertical') {
    return <div className={cn('w-px self-stretch bg-gray-700', className)} {...props} />;
  }
  if (label) {
    return (
      <div className={cn('relative flex items-center', className)} {...props}>
        <div className="flex-grow border-t border-gray-700" />
        <span className="mx-3 flex-shrink text-xs text-gray-500">{label}</span>
        <div className="flex-grow border-t border-gray-700" />
      </div>
    );
  }
  return <div className={cn('border-t border-gray-700', className)} {...props} />;
}

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export function Section({ title, description, children, className, ...props }: SectionProps) {
  return (
    <section className={cn('py-8', className)} {...props}>
      {(title || description) && (
        <div className="mb-6 space-y-1">
          {title && <h2 className="text-2xl font-bold text-white">{title}</h2>}
          {description && <p className="text-sm text-gray-400">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
