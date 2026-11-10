import React, { memo, useCallback, useMemo } from 'react';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { getWordTimings } from '../../model/captionOps';
import type { CaptionAnimation, CaptionSegment, CaptionStyle } from '../../model/types';
import { captionBoxStyle } from '../../utils/captionStyle';
import { splitGraphemes } from '../../utils/unicode';

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
  const lang = caption.language === 'en' ? 'en' : 'si';

  const content = timed ? (
    <TimedText caption={caption} animation={style.animation} />
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
function TimedText({ caption, animation }: { caption: CaptionLike; animation: CaptionAnimation }) {
  if (animation === 'typewriter') return <Typewriter caption={caption} />;
  return <WordHighlight caption={caption} mode={animation === 'karaoke' ? 'karaoke' : 'box'} />;
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

function WordHighlight({ caption, mode }: { caption: CaptionLike; mode: 'karaoke' | 'box' }) {
  const words = useMemo(() => getWordTimings(caption as CaptionSegment), [caption]);
  const active = useVideoStore(
    useCallback(
      (s: { currentTime: number }) => {
        const t = s.currentTime;
        for (let i = 0; i < words.length; i++) if (t >= words[i].start && t < words[i].end) return i;
        return t >= (words[words.length - 1]?.end ?? 0) ? words.length : -1;
      },
      [words]
    )
  );
  if (words.length === 0) return <>{' '}</>;
  return (
    <>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <span className={`cap-word ${i === active ? `is-active is-${mode}` : ''} ${mode === 'karaoke' && i < active ? 'is-spoken' : ''}`}>
            {w.text}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
    </>
  );
}
