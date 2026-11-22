import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import './LiquidLoader.css';

const BARS = 7;
const MAX_HEIGHT = 80;

export interface LiquidLoaderProps {
  label?: string;
  className?: string;
}

/**
 * Seven liquid bars bouncing in a slow wave, with droplets popping off at the crest.
 * Animated with requestAnimationFrame writing styles directly (no re-render per frame).
 */
export const LiquidLoader: React.FC<LiquidLoaderProps> = ({ label = 'Loading', className }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cols = Array.from(root.querySelectorAll<HTMLElement>('.liquid-col'));

    const paint = (ms: number) => {
      const t = ms * 0.001;
      cols.forEach((col, i) => {
        const d = i * 0.8;
        const wave = Math.sin(t + d) + Math.sin(t * 4 + d) * 0.15 + Math.sin(t * 8 + d) * 0.05;
        const h = Math.max(6, Math.abs(wave) * MAX_HEIGHT);
        col.style.setProperty('--h', `${h}px`);
        col.style.setProperty('--wobble', `${Math.sin(ms * 0.003 + i * 0.5)}`);
        col.style.setProperty('--shimmer', `${Math.sin(ms * 0.0015 + i * 0.7) * 8}px`);
        col.style.setProperty('--bubble-y', `${20 + Math.sin(ms * 0.003 + i * 0.8) * 10}%`);
        col.style.setProperty('--bubble-x', `${30 + Math.sin(ms * 0.002 + i * 0.6) * 20}%`);
        col.style.setProperty('--base', `${0.6 + Math.sin(ms * 0.002 + i * 0.6) * 0.4}`);
        col.classList.toggle('is-peak', Math.sin(t + d) > 0.8);
      });
    };

    if (reduced) {
      paint(1800);
      return;
    }
    let request = 0;
    const tick = (ms: number) => {
      paint(ms);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [reduced]);

  return (
    <div ref={rootRef} role="img" aria-label={label} className={['liquid-loader', className].filter(Boolean).join(' ')}>
      {Array.from({ length: BARS }, (_, i) => (
        <div key={i} className={`liquid-col liquid-c${i}`}>
          <span className="liquid-drop" />
          <span className="liquid-bar">
            <span className="liquid-surface" />
            <span className="liquid-shimmer" />
            <span className="liquid-bubble" />
          </span>
          <span className="liquid-base" />
        </div>
      ))}
    </div>
  );
};
