import React, { useEffect, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import './Typewriter.css';

export interface TypewriterProps {
  /** Phrases to type, delete and cycle through. */
  words: string[];
  typingMs?: number;
  deletingMs?: number;
  pauseMs?: number;
  className?: string;
}

type Timing = Required<Pick<TypewriterProps, 'typingMs' | 'deletingMs' | 'pauseMs'>>;

const Typing: React.FC<{ words: string[] } & Timing> = ({ words, typingMs, deletingMs, pauseMs }) => {
  const [state, setState] = useState({ index: 0, text: '', deleting: false });

  useEffect(() => {
    const word = words[state.index % words.length];
    let delay = state.deleting ? deletingMs : typingMs;
    let next = state;
    if (!state.deleting && state.text === word) {
      if (words.length === 1) return; // a single phrase just stays
      delay = pauseMs;
      next = { ...state, deleting: true };
    } else if (state.deleting && state.text === '') {
      next = { index: (state.index + 1) % words.length, text: '', deleting: false };
      delay = 250;
    } else {
      next = { ...state, text: word.slice(0, state.text.length + (state.deleting ? -1 : 1)) };
    }
    const t = window.setTimeout(() => setState(next), delay);
    return () => window.clearTimeout(t);
  }, [state, words, typingMs, deletingMs, pauseMs]);

  return <>{state.text}</>;
};

/** Types each phrase, holds it, deletes it, moves to the next. Starts over when the phrases change. */
export const Typewriter: React.FC<TypewriterProps> = ({ words, typingMs = 55, deletingMs = 28, pauseMs = 1800, className }) => {
  const reduced = useReducedMotion();
  // Keyed by content (not array identity), so parent re-renders don't restart the typing.
  const key = words.join('\u0000');
  return (
    <span className={['typewriter', className].filter(Boolean).join(' ')}>
      {reduced || !words.length ? (words[0] ?? '') : <Typing key={key} words={words} typingMs={typingMs} deletingMs={deletingMs} pauseMs={pauseMs} />}
      <span className="typewriter-caret" aria-hidden="true" />
    </span>
  );
};
