import * as React from 'react';
import { cn } from '../../utils/cn';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  ring?: boolean;
  status?: 'online' | 'offline' | 'busy' | 'away';
}

const sizeStyles: Record<string, string> = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const statusColors: Record<string, string> = {
  online: 'bg-emerald-500',
  offline: 'bg-gray-500',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
};

export function Avatar({ src, alt = '', fallback, size = 'md', shape = 'circle', ring = false, status, className, ...props }: AvatarProps) {
  const initials = fallback || alt?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className={cn('relative inline-flex shrink-0', className)} {...props}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn(
            sizeStyles[size],
            shape === 'circle' ? 'rounded-full' : 'rounded-lg',
            'object-cover',
            ring && 'ring-2 ring-offset-2 ring-offset-gray-900 ring-blue-500',
          )}
        />
      ) : (
        <div
          className={cn(
            sizeStyles[size],
            shape === 'circle' ? 'rounded-full' : 'rounded-lg',
            'flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold',
            ring && 'ring-2 ring-offset-2 ring-offset-gray-900 ring-blue-500',
          )}
          aria-label={alt}
          role="img"
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-gray-900',
            statusColors[status],
            size === 'xs' ? 'h-1.5 w-1.5' : size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}
