import React, { useEffect, useRef } from 'react';
import './Spotlight.css';

export interface SpotlightProps {
  className?: string;
  /** Diameter of the glow in px. */
  size?: number;
}

/**
 * A soft glow that follows the cursor inside its parent element.
 * The parent must be `position: relative; overflow: hidden`.
 * Position is written to CSS variables (no re-renders on mouse move).
 */
export const Spotlight: React.FC<SpotlightProps> = ({ className, size = 260 }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    let frame = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { left, top } = parent.getBoundingClientRect();
        el.style.setProperty('--spot-x', `${e.clientX - left - size / 2}px`);
        el.style.setProperty('--spot-y', `${e.clientY - top - size / 2}px`);
      });
    };
    const onEnter = () => el.classList.add('is-active');
    const onLeave = () => el.classList.remove('is-active');

    parent.addEventListener('mousemove', onMove);
    parent.addEventListener('mouseenter', onEnter);
    parent.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      parent.removeEventListener('mousemove', onMove);
      parent.removeEventListener('mouseenter', onEnter);
      parent.removeEventListener('mouseleave', onLeave);
    };
  }, [size]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={['spotlight', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    />
  );
};
