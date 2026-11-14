import { memo } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import type { CaptionSegment } from '../../model/types';

/**
 * AI transcripts are never assumed correct: captions that came from the AI are labelled for
 * review, and when the text differs from what the transcription model originally heard
 * (AI clean-up or the user's own edits), the original is shown with a one-click restore.
 */
export const AiOriginal = memo(function AiOriginal({ caption }: { caption: CaptionSegment }) {
  const meta = caption.meta ?? {};
  const original = typeof meta.original_text === 'string' ? meta.original_text : null;
  const source = (meta.source ?? null) as { transcriber?: string; cleanup?: string } | null;
  if (!source && original === null) return null;

  const differs = original !== null && original.normalize('NFC') !== caption.text.normalize('NFC');
  const cleanedByAi = meta.cleaned === true;

  return (
    <div className="ed-ai-origin" role="note">
      <p className="ed-help">
        <Sparkles size={12} aria-hidden="true" /> AI transcription
        {cleanedByAi ? ' · punctuation tidied by AI' : ''} — please check the words and timing.
      </p>
      {differs && (
        <div className="ed-ai-original">
          <span className="ed-field-label">Originally transcribed</span>
          <p lang={caption.language === 'en' ? 'en' : 'si'} dir="auto">{original}</p>
          <button
            type="button"
            className="ed-btn is-ghost is-sm"
            onClick={() => useCaptionStore.getState().updateText(caption.id, original!)}
          >
            <RotateCcw size={13} aria-hidden="true" /> Restore original
          </button>
        </div>
      )}
    </div>
  );
});
