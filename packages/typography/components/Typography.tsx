'use client';

import React from 'react';

/**
 * Typography primitives for the @ui/typography package.
 * Use these in generated components for consistent heading hierarchy.
 */

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const HEADING_SIZES: Record<HeadingLevel, string> = {
  1: 'text-4xl md:text-5xl font-extrabold',
  2: 'text-3xl md:text-4xl font-bold',
  3: 'text-2xl md:text-3xl font-semibold',
  4: 'text-xl font-semibold',
  5: 'text-lg font-medium',
  6: 'text-base font-medium',
};

export interface HeadingProps {
  children: React.ReactNode;
  level?: HeadingLevel;
  className?: string;
}

/** Renders the appropriate h1–h6 element. Defaults to h1. */
export function Heading({ children, level = 1, className = '' }: HeadingProps) {
  // JSX requires the tag to be a concrete string, not a template literal
  const tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
  const Tag = tags[level - 1] as React.ElementType;
  return (
    <Tag className={`tracking-tight text-white ${HEADING_SIZES[level]} ${className}`}>
      {children}
    </Tag>
  );
}

export interface TextProps {
  children: React.ReactNode;
  className?: string;
}

export function Text({ children, className = '' }: TextProps) {
  return <p className={`text-base text-gray-300 leading-relaxed ${className}`}>{children}</p>;
}

export interface CaptionProps {
  children: React.ReactNode;
  className?: string;
}

export function Caption({ children, className = '' }: CaptionProps) {
  return <span className={`text-xs text-gray-500 ${className}`}>{children}</span>;
}
