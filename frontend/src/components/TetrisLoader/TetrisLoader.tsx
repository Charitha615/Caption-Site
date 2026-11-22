import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { generateTetrisFrames, type TetrisFrames } from './tetrisFrames';
import './TetrisLoader.css';

export interface TetrisLoaderProps {
  /** Cells across (min 4). */
  columns?: number;
  /** Cells down (min 6). */
  rows?: number;
  /** Side of one cell in px. The whole loader scales with it. */
  cellSize?: number;
  /** Space between cells in px. */
  gap?: number;
  /** Milliseconds per frame. */
  speed?: number;
  label?: string;
  className?: string;
}

/**
 * A loading indicator that plays Tetris: a bot stacks pieces, clears lines,
 * tops out, and a new game starts. Reduced-motion users get one still board.
 * Frames are painted straight onto the DOM — no React render per frame.
 */
export const TetrisLoader: React.FC<TetrisLoaderProps> = ({
  columns = 8,
  rows = 16,
  cellSize = 10,
  gap = 2,
  speed = 45,
  label = 'Loading',
  className,
}) => {
  const width = Math.max(4, Math.round(columns));
  const height = Math.max(6, Math.round(rows));
  const gridRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  // A new game each round (round bumps when the previous one tops out).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const game = useMemo<TetrisFrames>(() => generateTetrisFrames(width, height), [width, height, round]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const dots = Array.from(grid.children) as HTMLElement[];
    const paint = (index: number) => {
      const board = game[index];
      if (!board) return;
      for (let i = 0; i < dots.length; i++) {
        const v = board[i] ?? 0;
        if (v) dots[i].dataset.v = String(v);
        else delete dots[i].dataset.v;
      }
    };

    if (reduced) {
      paint(Math.floor(game.length * 0.55));
      return;
    }

    let frame = 0;
    let request = 0;
    let last = performance.now();
    let owed = 0;
    paint(0);

    // A clock, not a timer: a background tab freezes the game instead of rushing on return.
    const tick = (now: number) => {
      owed += now - last;
      last = now;
      if (owed > speed * 4) owed = speed;
      while (owed >= speed) {
        owed -= speed;
        frame++;
      }
      if (frame >= game.length) {
        setRound((r) => r + 1);
        return;
      }
      paint(frame);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [game, speed, reduced]);

  return (
    <div
      ref={gridRef}
      role="img"
      aria-label={label}
      className={['tetris-loader', className].filter(Boolean).join(' ')}
      style={
        {
          '--tetris-cell': `${cellSize}px`,
          gridTemplateColumns: `repeat(${width}, var(--tetris-cell))`,
          gap,
        } as React.CSSProperties
      }
    >
      {Array.from({ length: width * height }, (_, i) => (
        <span key={i} className="tetris-cell" />
      ))}
    </div>
  );
};
