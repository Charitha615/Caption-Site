import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { TetrisLoader } from '../../components/TetrisLoader/TetrisLoader';
import { LiquidLoader } from '../../components/LiquidLoader/LiquidLoader';
import { CodeLoader } from '../../components/CodeLoader/CodeLoader';
import { Typewriter } from '../../components/Typewriter/Typewriter';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { GameOffer } from './games/GameOffer';
import type { GameId } from './games/gameTypes';
import type { ProjectStatus } from '../../types/project';
import { STAGES, stageIndex, type StageKey } from './generatingStages';
import './GeneratingStage.css';

/** Window title phrases for the code loader, per stage. */
const CODE_WORDS: Record<StageKey, string[]> = {
  uploaded: ['queue.wait()', 'worker.claim(job)'],
  processing: ['ffprobe video.mp4', 'read metadata…'],
  extracting_audio: ['ffmpeg -vn audio.flac', 'normalise speech…'],
  transcribing: ['ai.transcribe(speech)', 'detect language: si + en'],
  generating_captions: ['captions.align(words)', 'captions.split(lines)'],
};

const LOADERS = ['tetris', 'liquid', 'code'] as const;
type LoaderKind = (typeof LOADERS)[number];

const pickOther = (current: LoaderKind | null): LoaderKind => {
  const options = LOADERS.filter((l) => l !== current);
  return options[Math.floor(Math.random() * options.length)];
};

export interface GeneratingStageProps {
  status: ProjectStatus | undefined;
  /** 0–100 overall progress, if the server reported it. */
  percent?: number | null;
  /** Server's own phase label, announced to screen readers. */
  phaseLabel?: string | null;
  /** When set, a long wait offers a mini-game; called with the chosen game. */
  onPlayGame?: (game: GameId) => void;
}

/**
 * The "Generating captions" stage: a dark panel that randomly mixes three
 * playful loaders, with the current pipeline step, a caption-style typewriter
 * message and a step track inside it.
 */
export const GeneratingStage: React.FC<GeneratingStageProps> = ({ status, percent, phaseLabel, onPlayGame }) => {
  const reduced = useReducedMotion();
  const [loader, setLoader] = useState<LoaderKind>(() => pickOther(null));
  const index = stageIndex(status);
  const stage = STAGES[index];
  const pct = Math.max(0, Math.min(100, Math.round(percent ?? 0)));

  // Shuffle to a different loader every 9–15 s, and whenever the stage moves on.
  const lastIndex = useRef(index);
  useEffect(() => {
    if (reduced) return;
    const stageMoved = lastIndex.current !== index;
    lastIndex.current = index;
    const delay = stageMoved ? 500 : 9000 + Math.random() * 6000;
    const t = window.setTimeout(() => setLoader((l) => pickOther(l)), delay);
    return () => window.clearTimeout(t);
  }, [loader, index, reduced]);

  return (
    <section className="gen-stage" aria-labelledby="gen-stage-title">
      <div className="gen-stage-glow" aria-hidden="true" />

      <header className="gen-stage-head">
        <span className="gen-stage-chip">Step {index + 1} of {STAGES.length}</span>
        <span className="gen-stage-pct" aria-hidden="true">{pct}<small>%</small></span>
      </header>

      <div className="gen-stage-title-row" key={stage.key}>
        <span className="gen-stage-icon" aria-hidden="true">{stage.icon}</span>
        <h3 id="gen-stage-title" className="gen-stage-title">{stage.title}</h3>
      </div>

      <div className="gen-stage-anim" aria-hidden="true">
        <div className="gen-stage-anim-item" key={loader}>
          {loader === 'tetris' && <TetrisLoader columns={10} rows={16} cellSize={9} gap={2} />}
          {loader === 'liquid' && <LiquidLoader />}
          {loader === 'code' && <CodeLoader words={CODE_WORDS[stage.key]} />}
        </div>
      </div>

      {/* Styled like an on-video caption, with the active word style of the default preset */}
      <p className="gen-stage-caption">
        <Typewriter words={stage.lines} />
      </p>

      <div
        className="gen-stage-track"
        role="progressbar"
        aria-label="Caption generation progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${phaseLabel ?? stage.title} · ${pct}%`}
      >
        {STAGES.map((s, i) => {
          const state = i < index ? 'done' : i === index ? 'active' : 'pending';
          return (
            <div key={s.key} className={`gen-track-step gen-track-${state}`}>
              <span className="gen-track-bar"><span className="gen-track-fill" /></span>
              <span className="gen-track-label">
                {state === 'done' && <Check size={12} aria-hidden="true" />} {s.short}
              </span>
            </div>
          );
        })}
      </div>

      {onPlayGame && <GameOffer onPlay={onPlayGame} />}

      <p className="sr-only" aria-live="polite">{phaseLabel ?? stage.title}</p>
    </section>
  );
};
