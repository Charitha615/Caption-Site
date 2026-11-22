import React from 'react';
import { AudioLines, Captions, Ear, Film, Inbox } from 'lucide-react';
import type { ProjectStatus } from '../../types/project';

/** The caption pipeline steps as shown on the "Generating captions" screen. */
export type StageKey = 'uploaded' | 'processing' | 'extracting_audio' | 'transcribing' | 'generating_captions';

export const STAGES: Array<{ key: StageKey; short: string; title: string; icon: React.ReactNode; lines: string[] }> = [
  {
    key: 'uploaded',
    short: 'Queued',
    title: 'Waiting in line',
    icon: <Inbox size={18} />,
    lines: ['Your video is safely uploaded…', 'Waking up a worker for you…', 'Grabbing a good seat in the queue…'],
  },
  {
    key: 'processing',
    short: 'Analyse',
    title: 'Analysing the video',
    icon: <Film size={18} />,
    lines: ['Measuring duration and frame rate…', 'Checking the resolution…', 'Getting to know your video…'],
  },
  {
    key: 'extracting_audio',
    short: 'Audio',
    title: 'Extracting the speech',
    icon: <AudioLines size={18} />,
    lines: ['Pulling out the speech track…', 'Turning the voices up, the noise down…', 'Making it crystal clear for the AI…'],
  },
  {
    key: 'transcribing',
    short: 'Transcribe',
    title: 'AI is listening',
    icon: <Ear size={18} />,
    lines: [
      'Listening carefully to every word…',
      'සිංහල වචන එකින් එක අහගෙන යනවා…',
      'Catching the Sinhala + English mix…',
      'Spelling names exactly the way you wrote them…',
    ],
  },
  {
    key: 'generating_captions',
    short: 'Captions',
    title: 'Building your captions',
    icon: <Captions size={18} />,
    lines: ['Timing every word to the speech…', 'Breaking lines where they read best…', 'Polishing the final captions…'],
  },
];

/** Status → index in STAGES (unknown / draft statuses count as queued). */
export const stageIndex = (status: ProjectStatus | undefined) => {
  const i = STAGES.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
};


/** Friendly title for a pipeline status, e.g. "AI is listening". */
export const stageTitleFor = (status: ProjectStatus | undefined) => STAGES[stageIndex(status)].title;
