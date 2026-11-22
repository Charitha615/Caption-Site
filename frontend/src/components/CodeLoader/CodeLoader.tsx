import React, { useEffect, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Typewriter } from '../Typewriter/Typewriter';
import './CodeLoader.css';

const COLORS = ['gray', 'teal', 'blue', 'slate', 'pink'] as const;
const VISIBLE = 14;

type Line = { id: number; indent: boolean; gapAfter: boolean; segments: { width: number; color: string; dot: boolean }[] };

let nextId = 0;
const makeLine = (): Line => ({
  id: nextId++,
  indent: Math.random() > 0.7,
  gapAfter: Math.random() > 0.8,
  segments: Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => ({
    width: 40 + Math.floor(Math.random() * 70),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    dot: Math.random() > 0.93,
  })),
});

export interface CodeLoaderProps {
  /** Phrases typed in the window title bar. */
  words?: string[];
  label?: string;
  className?: string;
}

/** A tiny editor window that "writes code" forever while a title types status phrases. */
export const CodeLoader: React.FC<CodeLoaderProps> = ({
  words = ['Setting things up…', 'Initializing modules…', 'Almost ready…'],
  label = 'Loading',
  className,
}) => {
  const reduced = useReducedMotion();
  const [lines, setLines] = useState<Line[]>(() => Array.from({ length: reduced ? VISIBLE : 3 }, makeLine));

  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setLines((old) => [...old.slice(-(VISIBLE - 1)), makeLine()]), 220);
    return () => window.clearInterval(t);
  }, [reduced]);

  return (
    <div role="img" aria-label={label} className={['code-loader', className].filter(Boolean).join(' ')}>
      <div className="code-loader-bar">
        <span className="code-loader-lights" aria-hidden="true"><i /><i /><i /></span>
        <span className="code-loader-title"><Typewriter words={words} typingMs={70} deletingMs={35} pauseMs={2000} /></span>
      </div>
      <div className="code-loader-body">
        {lines.map((line) => (
          <div key={line.id} className={`code-line${line.indent ? ' code-line-indent' : ''}${line.gapAfter ? ' code-line-gap' : ''}`}>
            {line.segments.map((s, i) =>
              s.dot ? (
                <span key={i} className={`code-dot code-${s.color}`} />
              ) : (
                <span key={i} className={`code-seg code-${s.color}`} style={{ '--w': `${s.width}px` } as React.CSSProperties} />
              ),
            )}
          </div>
        ))}
        <div className="code-line"><span className="code-cursor" /></div>
      </div>
    </div>
  );
};
