import React, { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { GAMES, OFFER_AFTER_SECONDS, dismissOffer, offerDismissed, type GameId } from './gameTypes';
import './GameOffer.css';

export interface GameOfferProps {
  onPlay: (game: GameId) => void;
  afterSeconds?: number;
}

/**
 * "Taking a while — want to play a game?" Appears once the wait passes `afterSeconds`.
 * "No thanks" hides it for the rest of the browser session.
 */
export const GameOffer: React.FC<GameOfferProps> = ({ onPlay, afterSeconds = OFFER_AFTER_SECONDS }) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(offerDismissed);

  useEffect(() => {
    if (dismissed) return;
    const t = window.setTimeout(() => setVisible(true), afterSeconds * 1000);
    return () => window.clearTimeout(t);
  }, [afterSeconds, dismissed]);

  if (!visible || dismissed) return null;

  return (
    <div className="game-offer" role="region" aria-label="Play a game while you wait">
      <div className="game-offer-text">
        <span className="game-offer-icon" aria-hidden="true"><Gamepad2 size={18} /></span>
        <div>
          <p className="game-offer-title">This one’s taking a while…</p>
          <p className="game-offer-sub">Want to play a game while you wait? We’ll tell you the moment your captions are ready.</p>
        </div>
      </div>
      <div className="game-offer-actions">
        {GAMES.map((g) => (
          <button key={g.id} type="button" className="game-offer-btn" onClick={() => onPlay(g.id)} title={g.blurb}>
            <span aria-hidden="true">{g.emoji}</span> {g.name}
          </button>
        ))}
        <button
          type="button"
          className="game-offer-dismiss"
          onClick={() => {
            dismissOffer();
            setDismissed(true);
          }}
        >
          No thanks
        </button>
      </div>
    </div>
  );
};
