import * as React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated' | 'outline' | 'gradient';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  default: 'bg-gray-900/60 border border-gray-800/60',
  glass: 'bg-white/5 backdrop-blur-xl border border-white/10',
  elevated: 'bg-gray-900 shadow-xl shadow-black/30 border border-gray-800/40',
  outline: 'bg-transparent border border-gray-700',
  gradient: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700/50',
};

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
};

export function Card({
  className,
  variant = 'default',
  hover = false,
  padding = 'md',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl',
        variantStyles[variant],
        paddingStyles[padding],
        hover && 'transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 hover:border-gray-600/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return <div className={cn('flex flex-col space-y-1.5 pb-4', className)} {...props} />;
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return <h3 className={cn('text-xl font-semibold text-white leading-none tracking-tight', className)} {...props} />;
}

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return <p className={cn('text-sm text-gray-400', className)} {...props} />;
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, ...props }: CardContentProps) {
  return <div className={cn('', className)} {...props} />;
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className, ...props }: CardFooterProps) {
  return <div className={cn('flex items-center pt-4', className)} {...props} />;
}
