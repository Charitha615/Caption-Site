import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertCircle, PartyPopper, X } from 'lucide-react';
import { SnakeGame } from '../../../components/SnakeGame/SnakeGame';
import { SniperScope } from '../../../components/SniperScope/SniperScope';
import { GAMES, type GameId } from './gameTypes';
import './GameArcade.css';

export type ArcadeOutcome = { kind: 'ready'; editorHref: string } | { kind: 'failed' } | null;

export interface GameArcadeProps {
  game: GameId;
  onSwitch: (game: GameId) => void;
  onClose: () => void;
  /** Live caption progress shown in the top bar, e.g. "AI is listening". */
  stageTitle: string;
  percent?: number | null;
  /** Set once processing settles so the player is told without being yanked out of the game. */
  outcome: ArcadeOutcome;
}

/**
 * Full-screen game room shown while captions generate. Loaded lazily (the
 * sniper scene is large), closed with the X, Esc, or the sniper's EXIT plate.
 */
const GameArcade: React.FC<GameArcadeProps> = ({ game, onSwitch, onClose, stageTitle, percent, outcome }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  // Lock page scroll, focus the dialog, Esc closes, focus returns afterwards.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    rootRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const pct = Math.max(0, Math.min(100, Math.round(percent ?? 0)));

  return createPortal(
    <div ref={rootRef} className="arcade" role="dialog" aria-modal="true" aria-label="Games while you wait" tabIndex={-1}>
      <header className="arcade-bar">
        <div className="arcade-tabs" role="tablist" aria-label="Choose a game">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={g.id === game}
              className={`arcade-tab${g.id === game ? ' is-active' : ''}`}
              onClick={() => onSwitch(g.id)}
            >
              <span aria-hidden="true">{g.emoji}</span> {g.name}
            </button>
          ))}
        </div>

        {!outcome && (
          <div className="arcade-status" aria-live="polite">
            <span className="arcade-status-dot" aria-hidden="true" />
            <span className="arcade-status-text">{stageTitle}</span>
            <span className="arcade-status-pct">{pct}%</span>
            <span className="arcade-status-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
          </div>
        )}

        <button type="button" className="arcade-close" onClick={onClose} aria-label="Close game">
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      {outcome?.kind === 'ready' && (
        <div className="arcade-banner arcade-banner-ready" role="alert">
          <PartyPopper size={18} aria-hidden="true" />
          <span><strong>Your captions are ready!</strong> Finish your round or jump in now.</span>
          <Link to={outcome.editorHref} className="arcade-banner-cta" onClick={onClose}>Open the editor</Link>
        </div>
      )}
      {outcome?.kind === 'failed' && (
        <div className="arcade-banner arcade-banner-failed" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span><strong>Caption generation failed.</strong> Close the game to see why and retry.</span>
          <button type="button" className="arcade-banner-cta" onClick={onClose}>Close game</button>
        </div>
      )}

      <div className={`arcade-stage arcade-stage-${game}`}>
        {game === 'snake' ? <SnakeGame /> : <SniperScope onExit={onClose} />}
      </div>
    </div>,
    document.body,
  );
};

export default GameArcade;
