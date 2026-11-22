import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play } from 'lucide-react';
import { Button } from '../Button/Button';
import { newBoard, step, tickMs, turn, type Board, type Direction, type GameState } from './snakeEngine';
import './SnakeGame.css';

const HIGHSCORE_KEY = 'snake-highscores';
const MIN_SWIPE = 24;

type Highscore = { score: number; date: string };

const readScores = (): Highscore[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(HIGHSCORE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.slice(0, 5) : [];
  } catch {
    return [];
  }
};

const saveScore = (score: number): Highscore[] => {
  const list = [...readScores(), { score, date: new Date().toLocaleDateString() }].sort((a, b) => b.score - a.score).slice(0, 5);
  try {
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(list));
  } catch {
    /* private mode — scores just aren't remembered */
  }
  return list;
};

const KEYS: Record<string, Direction> = {
  ArrowUp: 'UP', KeyW: 'UP', ArrowDown: 'DOWN', KeyS: 'DOWN', ArrowLeft: 'LEFT', KeyA: 'LEFT', ArrowRight: 'RIGHT', KeyD: 'RIGHT',
};

export interface SnakeGameProps {
  /** Cells per side. */
  gridSize?: number;
  className?: string;
}

/** A minimal Snake on a canvas: arrows/WASD or swipe to steer, Space to start or pause. */
export const SnakeGame: React.FC<SnakeGameProps> = ({ gridSize = 15, className }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [board, setBoard] = useState<Board>(() => newBoard(gridSize));
  const [state, setState] = useState<GameState>('idle');
  const [scores, setScores] = useState<Highscore[]>(readScores);
  const [px, setPx] = useState(300);

  const start = useCallback(() => {
    setBoard(newBoard(gridSize));
    setState('playing');
  }, [gridSize]);

  const steer = useCallback((d: Direction) => setBoard((b) => turn(b, d)), []);

  // Game clock: one step per tick while playing.
  useEffect(() => {
    if (state !== 'playing') return;
    const t = window.setTimeout(() => {
      const res = step(board);
      if (res.crashed) {
        setState('gameOver');
        if (board.score > 0) setScores(saveScore(board.score));
      } else {
        setBoard(res.board);
      }
    }, tickMs(board.score));
    return () => window.clearTimeout(t);
  }, [board, state]);

  // Canvas size follows the container width, snapped to whole cells.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => setPx(Math.max(gridSize * 8, Math.floor(wrap.clientWidth / gridSize) * gridSize));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [gridSize]);

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = px * dpr;
    canvas.height = px * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cell = px / gridSize;
    const css = getComputedStyle(canvas);
    ctx.clearRect(0, 0, px, px);

    // Subtle checkerboard
    ctx.fillStyle = css.getPropertyValue('--snake-grid') || 'rgba(255,255,255,0.03)';
    for (let y = 0; y < gridSize; y++) for (let x = (y % 2); x < gridSize; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell);

    const r = cell * 0.28;
    const box = (x: number, y: number, inset: number) => {
      ctx.beginPath();
      ctx.roundRect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2, r);
      ctx.fill();
    };

    ctx.fillStyle = css.getPropertyValue('--snake-food') || '#FBBF24';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = cell * 0.6;
    box(board.food.x, board.food.y, cell * 0.18);
    ctx.shadowBlur = 0;

    const n = board.snake.segments.length;
    board.snake.segments.forEach((s, i) => {
      ctx.globalAlpha = 1 - (i / n) * 0.45;
      ctx.fillStyle = i === 0 ? css.getPropertyValue('--snake-head') || '#C4B5FD' : css.getPropertyValue('--snake-body') || '#8B5CF6';
      box(s.x, s.y, cell * 0.06);
    });
    ctx.globalAlpha = 1;
  }, [board, px, gridSize]);

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const dir = KEYS[e.code] ?? KEYS[e.key];
      if (dir && state === 'playing') {
        steer(dir);
        e.preventDefault();
      } else if (e.code === 'Space' || e.key === 'Enter' || e.code === 'KeyP') {
        // Let Enter/Space activate focused buttons normally.
        if (target?.closest('button') && e.code !== 'KeyP') return;
        e.preventDefault();
        if (state === 'playing') setState('paused');
        else if (state === 'paused') setState('playing');
        else start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, steer, start]);

  // Swipe.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = touch.current;
    touch.current = null;
    if (!from || state !== 'playing') return;
    const dx = e.changedTouches[0].clientX - from.x;
    const dy = e.changedTouches[0].clientY - from.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_SWIPE) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP');
  };

  return (
    <div className={['snake', className].filter(Boolean).join(' ')} data-state={state}>
      <div className="snake-score-row">
        <span>Score <strong>{board.score}</strong></span>
        <span>Best <strong>{scores[0]?.score ?? 0}</strong></span>
      </div>

      <div ref={wrapRef} className="snake-board" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <canvas
          ref={canvasRef}
          className="snake-canvas"
          style={{ width: px, height: px }}
          role="img"
          aria-label={`Snake game, ${state === 'playing' ? `score ${board.score}` : state === 'gameOver' ? 'game over' : state}`}
        />
        {state !== 'playing' && (
          <div className="snake-overlay">
            {state === 'gameOver' && <p className="snake-over-title">Game over · {board.score} pts</p>}
            {state === 'paused' && <p className="snake-over-title">Paused</p>}
            <Button
              variant="accent"
              startIcon={<Play size={16} aria-hidden="true" />}
              onClick={state === 'paused' ? () => setState('playing') : start}
            >
              {state === 'paused' ? 'Resume' : state === 'gameOver' ? 'Play again' : 'Play Snake'}
            </Button>
            <p className="snake-hint">Arrows / WASD or swipe · Space to pause</p>
          </div>
        )}
      </div>

      <div className="snake-controls">
        <div className="snake-pad" aria-label="Direction controls">
          <button type="button" className="snake-pad-up" aria-label="Up" onClick={() => steer('UP')}><ArrowUp size={18} /></button>
          <button type="button" className="snake-pad-left" aria-label="Left" onClick={() => steer('LEFT')}><ArrowLeft size={18} /></button>
          <button type="button" className="snake-pad-down" aria-label="Down" onClick={() => steer('DOWN')}><ArrowDown size={18} /></button>
          <button type="button" className="snake-pad-right" aria-label="Right" onClick={() => steer('RIGHT')}><ArrowRight size={18} /></button>
        </div>
        {state === 'playing' && (
          <Button variant="secondary" size="sm" startIcon={<Pause size={14} aria-hidden="true" />} onClick={() => setState('paused')}>
            Pause
          </Button>
        )}
      </div>

      {scores.length > 0 && (
        <div className="snake-highscores">
          <span className="snake-highscores-title">High scores</span>
          <ol>
            {scores.map((s, i) => (
              <li key={`${s.score}-${s.date}-${i}`}><strong>{s.score}</strong> pts <span>{s.date}</span></li>
            ))}
          </ol>
        </div>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {state === 'gameOver' && `Game over. Final score: ${board.score}`}
      </div>
    </div>
  );
};
