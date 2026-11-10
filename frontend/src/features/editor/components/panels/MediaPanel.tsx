import { memo, useMemo } from 'react';
import { AlertTriangle, Film, FolderOpen } from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { playback } from '../../services/playback';
import { formatTimecode } from '../../utils/time';
import { countGraphemes, LANGUAGE_LABELS, tokenizeWords } from '../../utils/unicode';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ed-stat">
      <span className="ed-stat-label">{label}</span>
      <span className="ed-stat-value">{value}</span>
    </div>
  );
}

export const MediaPanel = memo(function MediaPanel() {
  const videoUrl = useVideoStore((s) => s.videoUrl);
  const sourceName = useVideoStore((s) => s.sourceName);
  const isLocal = useVideoStore((s) => s.isLocalPreview);
  const duration = useVideoStore((s) => s.duration);
  const width = useVideoStore((s) => s.videoWidth);
  const height = useVideoStore((s) => s.videoHeight);
  const mediaError = useVideoStore((s) => s.mediaError);
  const captions = useCaptionStore((s) => s.captions);

  const stats = useMemo(() => {
    const covered = captions.reduce((sum, c) => sum + (c.end - c.start), 0);
    const words = captions.reduce((sum, c) => sum + tokenizeWords(c.text).length, 0);
    const chars = captions.reduce((sum, c) => sum + countGraphemes(c.text), 0);
    const langs = captions.reduce<Record<string, number>>((m, c) => ({ ...m, [c.language]: (m[c.language] ?? 0) + 1 }), {});
    return {
      covered,
      words,
      avgCps: covered > 0 ? chars / covered : 0,
      langs: Object.entries(langs)
        .map(([l, n]) => `${LANGUAGE_LABELS[l as keyof typeof LANGUAGE_LABELS] ?? l} ${n}`)
        .join(' · '),
    };
  }, [captions]);

  return (
    <div className="ed-panel-scroll">
      <div className="ed-media-card">
        <div className="ed-media-thumb">
          <Film size={22} />
        </div>
        <div className="ed-media-info">
          <strong>{videoUrl ? sourceName || 'Project video' : 'No video'}</strong>
          <span>
            {videoUrl
              ? `${width && height ? `${width}×${height} · ` : ''}${formatTimecode(duration, 1)}`
              : 'This project has no uploaded video yet.'}
          </span>
          {isLocal && <span className="ed-badge is-accent">Local preview — not uploaded</span>}
        </div>
      </div>
      {mediaError && (
        <div className="ed-notice is-error">
          <AlertTriangle size={14} /> <span>{mediaError}</span>
        </div>
      )}

      <label className="ed-btn ed-file-btn">
        <FolderOpen size={14} />
        Preview a local video file
        <input
          type="file"
          accept="video/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            playback.setSource(URL.createObjectURL(file), file.name, true);
            e.target.value = '';
          }}
        />
      </label>
      <p className="ed-help">
        Plays a file from your computer against these captions — handy for checking timing. It is not uploaded and is
        forgotten when you leave the editor.
      </p>

      <h3 className="ed-subhead">Captions</h3>
      <div className="ed-stats">
        <Stat label="Captions" value={String(captions.length)} />
        <Stat label="Words" value={String(stats.words)} />
        <Stat label="Coverage" value={duration ? `${Math.round((stats.covered / duration) * 100)}%` : '—'} />
        <Stat label="Avg reading speed" value={`${stats.avgCps.toFixed(1)} cps`} />
      </div>
      {stats.langs && <p className="ed-help">{stats.langs}</p>}
    </div>
  );
});
