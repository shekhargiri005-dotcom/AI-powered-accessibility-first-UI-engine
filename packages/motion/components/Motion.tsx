'use client';

/**
 * @file packages/motion/components/Motion.tsx
 *
 * Phase 8 upgrade — framer-motion wrapper spec for the @ui/motion package.
 *
 * DESIGN CONTRACT:
 *  This package serves two audiences:
 *  1. TypeScript host build — needs to compile without framer-motion installed.
 *     Achieved by using a fallback CSS-based implementation as the default export.
 *  2. Sandpack preview runtime — has framer-motion available via the virtual
 *     dependency list. AI-generated code importing from 'framer-motion' directly
 *     WILL have the real library available.
 *
 * PRACTICAL IMPLICATION FOR AI-GENERATED CODE:
 *  The system prompt instructs models to import framer-motion directly:
 *    import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
 *  This is the CORRECT pattern for depth_ui mode. Do NOT tell models to import
 *  from '@ui/motion' for physics/scroll — that route is for component mode only.
 *
 * WHAT THIS FILE PROVIDES:
 *  - Motion       — viewport-reveal wrapper (fade/slide/scale/reveal/pop)
 *  - MotionGroup  — staggered children wrapper
 *  - AnimatePresence re-export stub
 *
 * GPU compositing, parallax coefficients, and useReducedMotion patterns are
 * injected into depth_ui system prompts directly (prompts.ts Phase 8).
 *
 * WCAG 2.1 SC 2.3.3 (AAA) compliance:
 *  - All animations check prefers-reduced-motion via the CSS @media query.
 *  - Framer-motion's useReducedMotion() is the recommended pattern in generated code.
 */

import React, { useEffect, useRef, useState } from 'react';

// ─── AnimatePresence stub (real in Sandpack, no-op shim in host) ──────────────

export function AnimatePresence({
  children,
}: {
  children: React.ReactNode;
  mode?: string;
  initial?: boolean;
}) {
  return <>{children}</>;
}

// ─── Reduced motion detection ─────────────────────────────────────────────────

function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ─── Animation presets (CSS-based for host; framer-motion used in Sandpack) ──

type AnimationPreset = 'fade' | 'slide' | 'slide-left' | 'slide-right' | 'scale' | 'reveal' | 'pop' | 'parallax' | string;

const ANIMATION_CLASSES: Record<string, string> = {
  fade:        'opacity-0 motion-safe:animate-[fadeIn_0.5s_ease-out_forwards]',
  slide:       'opacity-0 translate-y-6 motion-safe:animate-[slideUp_0.5s_cubic-bezier(0.25,0.46,0.45,0.94)_forwards]',
  'slide-left' : 'opacity-0 -translate-x-8 motion-safe:animate-[slideRight_0.5s_ease-out_forwards]',
  'slide-right': 'opacity-0 translate-x-8  motion-safe:animate-[slideLeft_0.5s_ease-out_forwards]',
  scale:       'opacity-0 scale-95 motion-safe:animate-[scaleIn_0.45s_cubic-bezier(0.34,1.56,0.64,1)_forwards]',
  reveal:      'opacity-0 translate-y-4 blur-sm motion-safe:animate-[reveal_0.6s_ease-out_forwards]',
  pop:         'opacity-0 scale-80 motion-safe:animate-[popIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards]',
  parallax:    '', // pass-through — no CSS parallax; note in docs that framer-motion is needed
};

// ─── Motion component props ───────────────────────────────────────────────────

export interface MotionProps_Custom {
  children:    React.ReactNode;
  /**
   * Named animation preset.
   * 'fade' | 'slide' | 'slide-left' | 'slide-right' | 'scale' | 'reveal' | 'pop' | 'parallax'
   * Default: 'fade'
   *
   * NOTE on 'parallax': In depth_ui mode, prefer importing useScroll/useTransform
   * directly from 'framer-motion' rather than using this wrapper. See prompts.ts.
   */
  animation?:  AnimationPreset;
  /** Delay before animation starts (seconds → converted to ms). Default: 0 */
  delay?:      number;
  /** Animation duration (seconds → converted to ms). Default: variant duration. */
  duration?:   number;
  /**
   * Viewport threshold for the IntersectionObserver [0–1].
   * Default: 0.15 — triggers when 15% of the element is visible.
   */
  threshold?:  number;
  /**
   * For 'parallax' animation: fraction of scroll speed (0–1). Default: 0.30.
   * In host build this is a no-op; use framer-motion directly in Sandpack.
   */
  speedFactor?: number;
  /** Additional class names applied to the wrapper element. */
  className?:  string;
  /** Whether to animate only once when first entering viewport. Default: true */
  once?:       boolean;
}

// ─── Main Motion component ────────────────────────────────────────────────────

/**
 * Universal viewport-reveal animation wrapper.
 *
 * Respects prefers-reduced-motion — reduced-motion users see elements
 * immediately without transitions.
 *
 * For GPU-compositable parallax (depth_ui mode), use framer-motion directly:
 *   const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
 *   const y = useTransform(scrollYProgress, [0, 1], ['0px', '-90px']);
 */
export function Motion({
  children,
  animation  = 'fade',
  delay      = 0,
  duration,
  threshold  = 0.15,
  className  = '',
  once       = true,
}: MotionProps_Custom) {
  const shouldReduceMotion = useSystemReducedMotion();
  const ref     = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) obs.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);

  // Reduced-motion: show immediately with no class-based transition
  if (shouldReduceMotion) {
    return <div ref={ref} className={className}>{children}</div>;
  }

  const animClass = ANIMATION_CLASSES[animation] ?? ANIMATION_CLASSES.fade;

  const style: React.CSSProperties = {
    ...(delay    > 0  ? { animationDelay:    `${delay * 1000}ms`    } : {}),
    ...(duration != null ? { animationDuration: `${duration * 1000}ms` } : {}),
    // GPU compositing hint for all animated elements (TAF Dimension 14)
    willChange: visible ? 'auto' : 'opacity, transform',
  };

  return (
    <div
      ref={ref}
      style={style}
      className={`${visible ? animClass : 'opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

// Playwright / UI Engine Fallback: AI sometimes hallucinates <Motion.div> 
// instead of importing framer-motion directly. This prevents a catastrophic white-screen crash.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Motion as unknown as Record<string, (props: Record<string, unknown>) => React.ReactElement>).div = function MotionDivFallback(props) {
  // We strip framer-motion specific props to prevent DOM warnings, but pass the rest
  const { initial, animate, transition, variants, whileHover, whileTap, ...rest } = props;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <div {...(rest as any)} />;
};

// ─── MotionGroup — staggered children ────────────────────────────────────────

export interface MotionGroupProps {
  children:   React.ReactNode;
  className?: string;
  /** Stagger delay between children (seconds). Default: 0.1 */
  stagger?:   number;
  /** Animation preset applied to each child. Default: 'slide' */
  animation?: AnimationPreset;
  /** IntersectionObserver threshold. Default: 0.10 */
  threshold?: number;
}

/**
 * Wraps children in a staggered reveal container.
 * Each direct child is automatically delayed by `stagger` seconds.
 *
 * Reduced-motion users see all children immediately (no stagger).
 */
export function MotionGroup({
  children,
  className = '',
  stagger   = 0.10,
  animation = 'slide',
  threshold = 0.10,
}: MotionGroupProps) {
  const shouldReduceMotion = useSystemReducedMotion();
  const items = React.Children.toArray(children);

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      {items.map((child, i) => (
        <Motion
          key={i}
          animation={animation}
          delay={i * stagger}
          threshold={threshold}
        >
          {child}
        </Motion>
      ))}
    </div>
  );
}
