import React, { memo, useCallback, useMemo } from 'react';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { getWordTimings } from '../../model/captionOps';
import type { CaptionAnimation, CaptionSegment, CaptionStyle } from '../../model/types';
import { captionBoxStyle } from '../../utils/captionStyle';
import { splitGraphemes } from '../../utils/unicode';
import { cascadeOpacity, cascadeWindows } from '../../utils/cascade';

type CaptionLike = Pick<CaptionSegment, 'text' | 'start' | 'end' | 'words' | 'language'>;

const TIMED: CaptionAnimation[] = ['typewriter', 'karaoke', 'highlight'];

/**
 * Renders one caption exactly as it will look on video.
 *
 * Text is drawn twice: an outline layer (stroke + shadow) underneath and a fill
 * layer on top. `-webkit-text-stroke` alone strokes *inwards* and eats thin
 * Sinhala glyph strokes; layering gives a clean outside outline in every browser.
 * Both layers contain identical markup so they wrap identically.
 */
export const CaptionBox = memo(function CaptionBox({
  caption,
  style,
  scale,
  animate = true,
}: {
  caption: CaptionLike;
  style: CaptionStyle;
  scale: number;
  /** When false, render the final state (thumbnails, paused ghost previews). */
  animate?: boolean;
}) {
  const box = useMemo(() => captionBoxStyle(style, scale), [style, scale]);
  const timed = animate && TIMED.includes(style.animation);
  // The cascade works per word; typewriter already reveals text its own way.
  const cascade = animate && style.lineTransition === 'cascade' && style.animation !== 'typewriter';
  const lang = caption.language === 'en' ? 'en' : 'si';

  const content = timed || cascade ? (
    <TimedText caption={caption} animation={timed ? style.animation : 'none'} cascade={cascade} />
  ) : (
    <StaticText text={caption.text} />
  );

  return (
    <div className="cap-box" style={box} lang={lang} data-anim={animate ? style.animation : 'none'}>
      <span className={`cap-text ${style.outlineWidth > 0 ? 'has-stroke' : ''}`}>
        <span className="cap-layer-stroke" aria-hidden>{content}</span>
        <span className="cap-layer-fill">{content}</span>
      </span>
    </div>
  );
});

function StaticText({ text }: { text: string }) {
  return <>{text || ' '}</>;
}

/** Subscribes to the clock, but re-renders only when the active word / revealed length changes. */
function TimedText({ caption, animation, cascade }: { caption: CaptionLike; animation: CaptionAnimation; cascade: boolean }) {
  if (animation === 'typewriter') return <Typewriter caption={caption} />;
  const mode = animation === 'karaoke' ? 'karaoke' : animation === 'highlight' ? 'box' : 'none';
  return <WordHighlight caption={caption} mode={mode} cascade={cascade} />;
}

function Typewriter({ caption }: { caption: CaptionLike }) {
  const graphemes = useMemo(() => splitGraphemes(caption.text), [caption.text]);
  const revealTime = Math.max(0.3, Math.min(caption.end - caption.start, graphemes.length * 0.06));
  const visible = useVideoStore(
    useCallback(
      (s: { currentTime: number }) => {
        const p = (s.currentTime - caption.start) / revealTime;
        return Math.max(0, Math.min(graphemes.length, Math.ceil(p * graphemes.length)));
      },
      [caption.start, revealTime, graphemes.length]
    )
  );
  return (
    <>
      {graphemes.slice(0, visible).join('')}
      {/* Hidden remainder keeps the box size stable while revealing. */}
      <span className="cap-hidden">{graphemes.slice(visible).join('')}</span>
    </>
  );
}

const OPACITY_STEPS = 12;

function WordHighlight({ caption, mode, cascade }: { caption: CaptionLike; mode: 'karaoke' | 'box' | 'none'; cascade: boolean }) {
  const words = useMemo(() => getWordTimings(caption as CaptionSegment), [caption]);
  const windows = useMemo(
    () => (cascade ? cascadeWindows(words.length, caption.start, caption.end) : null),
    [cascade, words.length, caption.start, caption.end]
  );
  // A string key (active word + quantised opacities) so React re-renders only when something visible changes.
  const frame = useVideoStore(
    useCallback(
      (s: { currentTime: number }) => {
        const t = s.currentTime;
        let active = -1;
        if (mode !== 'none') {
          active = t >= (words[words.length - 1]?.end ?? 0) ? words.length : -1;
          for (let i = 0; i < words.length; i++) if (t >= words[i].start && t < words[i].end) { active = i; break; }
        }
        const fades = windows ? windows.map((w) => Math.round(cascadeOpacity(w, t) * OPACITY_STEPS)).join(',') : '';
        return `${active}|${fades}`;
      },
      [words, windows, mode]
    )
  );
  if (words.length === 0) return <>{' '}</>;
  const [activeKey, fadeKey] = frame.split('|');
  const active = Number(activeKey);
  const opacities = fadeKey ? fadeKey.split(',').map((v) => Number(v) / OPACITY_STEPS) : null;
  return (
    <>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <span
            className={`cap-word ${mode !== 'none' && i === active ? `is-active is-${mode}` : ''} ${mode === 'karaoke' && i < active ? 'is-spoken' : ''}`}
            style={opacities ? { opacity: opacities[i] } : undefined}
          >
            {w.text}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
    </>
  );
}
