'use client';

import React, { useEffect, useRef } from 'react';

/**
 * ParallaxBackground — pure visual component.
 * pointer-events: none, fixed behind all content.
 * Layer 1 moves at 0.2× scroll, Layer 2 at 0.5×.
 * No interaction with click/tap behavior.
 */
export default function ParallaxBackground() {
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    const onScroll = () => {
      rafId = requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        if (layer1Ref.current) {
          layer1Ref.current.style.transform = `translateY(${scrollY * 0.2}px)`;
        }
        if (layer2Ref.current) {
          layer2Ref.current.style.transform = `translateY(${scrollY * 0.5}px)`;
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none"
      style={{ isolation: 'isolate' }}
    >
      {/* Dot-grid pattern */}
      <div className="absolute inset-0 stitch-dot-grid opacity-100" />

      {/* Layer 1 — slow orb (0.2×), top-left */}
      <div
        ref={layer1Ref}
        className="stitch-parallax-layer absolute -top-40 -left-40 w-[700px] h-[700px]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.14) 0%, rgba(139,92,246,0.04) 45%, transparent 70%)',
        }}
      />

      {/* Layer 2 — faster orb (0.5×), bottom-right */}
      <div
        ref={layer2Ref}
        className="stitch-parallax-layer absolute -bottom-60 -right-40 w-[800px] h-[800px]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(109,40,217,0.12) 0%, rgba(139,92,246,0.03) 50%, transparent 70%)',
        }}
      />

      {/* Diagonal accent line — purely decorative */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            rgba(139,92,246,1) 0px,
            rgba(139,92,246,1) 1px,
            transparent 1px,
            transparent 60px
          )`,
        }}
      />
    </div>
  );
}
