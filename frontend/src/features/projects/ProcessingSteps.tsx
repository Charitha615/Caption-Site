import React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import type { ProjectStatus } from '../../types/project';
import './ProcessingSteps.css';

const STEPS: Array<{ key: ProjectStatus[]; title: string; desc: string }> = [
  { key: ['uploaded'], title: 'Video uploaded', desc: 'Stored privately and queued' },
  { key: ['processing'], title: 'Analyse video', desc: 'Duration, resolution and frame rate' },
  { key: ['extracting_audio'], title: 'Extract speech audio', desc: 'Speech-optimised audio track' },
  { key: ['transcribing'], title: 'AI transcription', desc: 'Speech to timed text' },
  { key: ['generating_captions'], title: 'Build captions', desc: 'Caption lines and word timings' },
];

const ORDER: ProjectStatus[] = ['uploaded', 'processing', 'extracting_audio', 'transcribing', 'generating_captions', 'ready'];

export interface ProcessingStepsProps {
  status: ProjectStatus | undefined;
  /** Status at which processing failed (the step shows a cross). */
  failed?: boolean;
}

/** Ordered list of pipeline phases. State is conveyed by icon and text, not colour alone. */
/** Shown when a job has waited for a worker longer than this. */
export const STALLED_QUEUE_SECONDS = 45;

export const QueueStalledNotice: React.FC<{ queuedSeconds?: number | null; notice?: string | null }> = ({ queuedSeconds, notice }) =>
  notice ? (
    <p className="proc-stalled" role="status">{notice}</p>
  ) : queuedSeconds && queuedSeconds >= STALLED_QUEUE_SECONDS ? (
    <p className="proc-stalled" role="status">
      Processing hasn’t started yet. The server may be busy — if this persists, the background worker may not be running.
    </p>
  ) : null;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** "Transcribing · 2:14 elapsed — about 1–3 min for this video". Keeps long AI steps from looking frozen. */
export const PhaseTimer: React.FC<{ status?: ProjectStatus; phaseSeconds?: number | null; durationSeconds?: number | null }> = ({ status, phaseSeconds, durationSeconds }) => {
  if (phaseSeconds == null || status === 'uploaded') return null;
  const minutes = Math.max(1, Math.round((durationSeconds ?? 60) / 60));
  const hint = status === 'transcribing' ? ` · usually ${Math.max(1, Math.round(minutes * 0.5))}–${Math.max(2, minutes * 2)} min for a ${minutes}-minute video` : '';
  return (
    <p className="proc-timer">
      {clock(phaseSeconds)} elapsed in this step{hint}
    </p>
  );
};

export const ProcessingSteps: React.FC<ProcessingStepsProps> = ({ status, failed = false }) => {
  const current = status ? ORDER.indexOf(status === 'completed' ? 'ready' : status) : 0;

  return (
    <ol className="proc-steps" aria-label="Processing progress">
      {STEPS.map((step, i) => {
        const done = current > i || status === 'ready' || status === 'completed';
        const active = !done && current === i;
        const state = done ? 'done' : active ? (failed ? 'failed' : 'active') : 'pending';
        return (
          <li key={step.title} className={`proc-step proc-step-${state}`} aria-current={active ? 'step' : undefined}>
            <span className="proc-step-icon" aria-hidden="true">
              {state === 'done' ? <Check size={16} /> : state === 'active' ? <Loader2 size={16} className="proc-spin" /> : state === 'failed' ? <X size={16} /> : i + 1}
            </span>
            <span className="proc-step-text">
              <span className="proc-step-title">{step.title}</span>
              <span className="proc-step-desc">{step.desc}</span>
            </span>
            <span className="sr-only">
              {state === 'done' ? '— done' : state === 'active' ? '— in progress' : state === 'failed' ? '— failed' : '— waiting'}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
