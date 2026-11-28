import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTourStore } from '../../stores/tourStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { BRAND } from '../../config/brand';
import './AppTour.css';

interface TourStep {
  /** `data-tour` value of the element to point at; none (or hidden, e.g. on phones) shows the step in the middle. */
  target?: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  { title: `Welcome to ${BRAND.titleName}! 👋`, body: 'A quick tour of where things are. It takes under a minute, and you can skip it any time.' },
  { target: 'new-project', title: 'Start a new project', body: 'Upload a video and we write සිංහල or English captions for it, with timing for every word.' },
  { target: 'projects', title: 'Your projects', body: 'Every video you upload lives here. Open one to edit the captions, style them and export.' },
  { target: 'search', title: 'Find anything fast', body: 'Search your projects by name. Press Ctrl+K (⌘K on Mac) from anywhere.' },
  { target: 'usage', title: 'Your plan and usage', body: 'See how many caption minutes you have left this cycle. They reset every 30 days.' },
  { target: 'upgrade', title: 'Go Pro when you need more', body: '600 minutes, 4K exports with no watermark, all caption styles and the AI tools.' },
  { target: 'notifications', title: 'Notifications', body: 'Finished videos, payments and news from us show up here.' },
  { target: 'help', title: 'Help and shortcuts', body: 'Keyboard shortcuts are here. You can replay this tour from the account menu (top right).' },
  { title: "You're ready! 🎬", body: 'Start with a short video to see how it works. Have fun creating!' },
];

const PAD = 8;
const GAP = 14;

interface Box { top: number; left: number; width: number; height: number }

/** The element a step points at, if it is on screen. */
function findTarget(step: TourStep): Box | null {
  if (!step.target) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const visible = r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
  return visible ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null;
}

/** Where the card goes: beside the highlighted element where there is room, else below or above it. */
function cardPosition(box: Box | null, card: { width: number; height: number }): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!box) return { top: Math.max(16, (vh - card.height) / 2), left: Math.max(12, (vw - card.width) / 2) };
  const clampX = (x: number) => Math.min(Math.max(12, x), vw - card.width - 12);
  const clampY = (y: number) => Math.min(Math.max(12, y), vh - card.height - 12);
  if (box.left + box.width + GAP + card.width < vw) return { top: clampY(box.top), left: box.left + box.width + GAP };
  if (box.top + box.height + GAP + card.height < vh) return { top: box.top + box.height + GAP, left: clampX(box.left + box.width / 2 - card.width / 2) };
  return { top: clampY(box.top - GAP - card.height), left: clampX(box.left + box.width / 2 - card.width / 2) };
}

/** Step-by-step tour that highlights parts of the app. */
export const AppTour: React.FC = () => {
  const open = useTourStore((s) => s.open);
  const close = useTourStore((s) => s.close);
  const saveSettings = useSettingsStore((s) => s.save);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<React.CSSProperties>({ opacity: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[index]!;
  const last = index === TOUR_STEPS.length - 1;

  const finish = useCallback(() => {
    close();
    setIndex(0);
    // Don't show it again on the next visit.
    void saveSettings({ tour_pending: false }).catch(() => undefined);
  }, [close, saveSettings]);

  const place = useCallback(() => {
    const target = findTarget(step);
    setBox(target);
    const card = cardRef.current;
    if (card) setPos(cardPosition(target, { width: card.offsetWidth, height: card.offsetHeight }));
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)?.scrollIntoView?.({ block: 'nearest' });
    place();
  }, [open, index, place, step.target]);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, finish, place]);

  if (!open) return null;

  return createPortal(
    <div className="tour-root">
      {box
        ? <div className="tour-spotlight" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} aria-hidden="true" />
        : <div className="tour-backdrop" aria-hidden="true" />}
      <div
        ref={cardRef}
        className="tour-card"
        style={pos}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
      >
        <button type="button" className="tour-close" onClick={finish} aria-label="Close the tour"><X size={16} aria-hidden="true" /></button>
        <p className="tour-step">Step {index + 1} of {TOUR_STEPS.length}</p>
        <h2 id="tour-title" className="tour-title">{step.title}</h2>
        <p id="tour-body" className="tour-body">{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {TOUR_STEPS.map((s, i) => <span key={s.title} className={i === index ? 'is-on' : ''} />)}
        </div>
        <div className="tour-actions">
          {index === 0
            ? <button type="button" className="tour-btn is-ghost" onClick={finish}>Skip tour</button>
            : <button type="button" className="tour-btn is-ghost" onClick={() => setIndex((i) => i - 1)}>Back</button>}
          <button type="button" className="tour-btn" onClick={() => (last ? finish() : setIndex((i) => i + 1))}>
            {last ? 'Get started' : index === 0 ? "Let's go" : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
