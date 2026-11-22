export type GameId = 'snake' | 'sniper';

export const GAMES: Array<{ id: GameId; name: string; emoji: string; blurb: string }> = [
  { id: 'snake', name: 'Snake', emoji: '🐍', blurb: 'Classic, quick rounds' },
  { id: 'sniper', name: 'Bottle range', emoji: '🎯', blurb: 'Shoot glass bottles through a scope' },
];

/** Seconds of waiting before we offer a game. */
export const OFFER_AFTER_SECONDS = 15;

const DISMISS_KEY = 'wait-game-offer-dismissed';
export const offerDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};
export const dismissOffer = () => {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
};
