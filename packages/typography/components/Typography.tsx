import React from 'react';

export function Heading({ children, level = 1, className = '' }: { children: React.ReactNode; level?: 1|2|3|4|5|6; className?: string }) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  const sizes = {
    1: 'text-4xl md:text-5xl font-extrabold',
    2: 'text-3xl md:text-4xl font-bold',
    3: 'text-2xl md:text-3xl font-semibold',
    4: 'text-xl font-semibold',
    5: 'text-lg font-medium',
    6: 'text-base font-medium',
  };
  return <Tag className={`tracking-tight text-white ${sizes[level]} ${className}`}>{children}</Tag>;
}

export function Text({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-base text-gray-300 leading-relaxed ${className}`}>{children}</p>;
}

export function Caption({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-xs text-gray-500 ${className}`}>{children}</span>;
}
