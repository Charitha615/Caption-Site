/** Pure Snake rules — no DOM, so they are easy to test. */

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type Point = { x: number; y: number };
export type GameState = 'idle' | 'playing' | 'paused' | 'gameOver';

export interface Snake {
  /** Head first. */
  segments: Point[];
  direction: Direction;
  /** Turns queued from fast key presses, applied one per tick. */
  queue: Direction[];
}

export interface Board {
  snake: Snake;
  food: Point;
  score: number;
  size: number;
}

const VECTORS: Record<Direction, Point> = { UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 }, LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 } };
const OPPOSITE: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

export function placeFood(size: number, segments: Point[], random: () => number = Math.random): Point {
  const free: Point[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!segments.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    }
  }
  return free[Math.floor(random() * free.length)] ?? { x: 0, y: 0 };
}

export function newBoard(size: number, random: () => number = Math.random): Board {
  const mid = Math.floor(size / 2);
  const segments = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
  return { size, score: 0, snake: { segments, direction: 'RIGHT', queue: [] }, food: placeFood(size, segments, random) };
}

/** Queue a turn; reversing into yourself and duplicate turns are ignored. */
export function turn(board: Board, dir: Direction): Board {
  const { snake } = board;
  const last = snake.queue[snake.queue.length - 1] ?? snake.direction;
  if (dir === last || dir === OPPOSITE[last] || snake.queue.length >= 3) return board;
  return { ...board, snake: { ...snake, queue: [...snake.queue, dir] } };
}

/** Advance one tick. Returns the new board and whether the snake crashed. */
export function step(board: Board, random: () => number = Math.random): { board: Board; crashed: boolean; ate: boolean } {
  const [next, ...rest] = board.snake.queue;
  const direction = next ?? board.snake.direction;
  const head = board.snake.segments[0];
  const v = VECTORS[direction];
  const nh = { x: head.x + v.x, y: head.y + v.y };
  const ate = nh.x === board.food.x && nh.y === board.food.y;
  // The tail moves away this tick unless we grow, so it isn't an obstacle.
  const body = ate ? board.snake.segments : board.snake.segments.slice(0, -1);

  if (nh.x < 0 || nh.y < 0 || nh.x >= board.size || nh.y >= board.size || body.some((s) => s.x === nh.x && s.y === nh.y)) {
    return { board, crashed: true, ate: false };
  }

  const segments = [nh, ...body];
  return {
    crashed: false,
    ate,
    board: {
      ...board,
      snake: { segments, direction, queue: rest },
      score: board.score + (ate ? 1 : 0),
      food: ate ? placeFood(board.size, segments, random) : board.food,
    },
  };
}

/** Starts at 140 ms per tick and speeds up as you eat, down to 70 ms. */
export const tickMs = (score: number) => Math.max(70, 140 - score * 4);
