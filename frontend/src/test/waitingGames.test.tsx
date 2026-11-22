import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { newBoard, step, turn } from '../components/SnakeGame/snakeEngine';
import { GameOffer } from '../features/projects/games/GameOffer';
import GameArcade from '../features/projects/games/GameArcade';

describe('snake engine', () => {
  it('moves, refuses to reverse, and grows when it eats', () => {
    let b = newBoard(10, () => 0);
    const head = b.snake.segments[0];
    expect(turn(b, 'LEFT')).toBe(b); // straight back into itself is ignored
    b = { ...b, food: { x: head.x + 1, y: head.y } };
    const r = step(b, () => 0);
    expect(r.ate).toBe(true);
    expect(r.board.score).toBe(1);
    expect(r.board.snake.segments).toHaveLength(4);
  });

  it('crashes into the wall', () => {
    let b = newBoard(5);
    b = turn(b, 'UP');
    let crashed = false;
    for (let i = 0; i < 6 && !crashed; i++) {
      const r = step({ ...b, food: { x: 0, y: 4 } });
      crashed = r.crashed;
      b = r.board;
    }
    expect(crashed).toBe(true);
  });
});

describe('GameOffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('appears only after the wait threshold and starts the chosen game', () => {
    const onPlay = vi.fn();
    render(<GameOffer onPlay={onPlay} afterSeconds={30} />);
    expect(screen.queryByText(/taking a while/i)).toBeNull();
    act(() => vi.advanceTimersByTime(30_000));
    fireEvent.click(screen.getByRole('button', { name: /snake/i }));
    expect(onPlay).toHaveBeenCalledWith('snake');
  });

  it('“No thanks” hides it for the session', () => {
    const { unmount } = render(<GameOffer onPlay={() => {}} afterSeconds={1} />);
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(screen.queryByText(/taking a while/i)).toBeNull();
    unmount();
    render(<GameOffer onPlay={() => {}} afterSeconds={1} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText(/taking a while/i)).toBeNull();
  });
});

describe('GameArcade', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const base = { game: 'snake' as const, onSwitch: () => {}, stageTitle: 'AI is listening', percent: 40 };

  it('shows live progress, and a ready banner without closing the game', () => {
    const { rerender } = render(<MemoryRouter><GameArcade {...base} onClose={() => {}} outcome={null} /></MemoryRouter>);
    expect(screen.getByText('AI is listening')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    rerender(<MemoryRouter><GameArcade {...base} onClose={() => {}} outcome={{ kind: 'ready', editorHref: '/projects/abc/editor' }} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Open the editor' })).toHaveAttribute('href', '/projects/abc/editor');
    expect(screen.getByRole('button', { name: /play snake/i })).toBeInTheDocument();
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<MemoryRouter><GameArcade {...base} onClose={onClose} outcome={null} /></MemoryRouter>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
