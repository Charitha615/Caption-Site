import axios from 'axios';
import { apiClient } from './api';
import { VIDEO_UPLOAD } from '../config/constants';
import type { ApiResponse } from '../types/api';
import type { Project, UploadedMedia } from '../types/project';

export interface UploadSessionInfo {
  uuid: string;
  status: 'pending' | 'completed' | 'cancelled';
  file_name: string;
  file_size: number;
  chunk_size: number;
  total_chunks: number;
  received_chunks: number[];
  expires_at: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  /** bytes per second, smoothed */
  speed: number;
  /** seconds remaining, null while unknown */
  eta: number | null;
  /** true while waiting for the network to come back */
  waitingForNetwork: boolean;
  /** retry attempt currently in progress (0 = none) */
  retrying: number;
}

export interface UploadResult {
  project: Project;
  media_file: UploadedMedia;
}

export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled.');
    this.name = 'UploadCancelledError';
  }
}

const MAX_RETRIES = 6;
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new UploadCancelledError());
    }, { once: true });
  });

const waitForOnline = (signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (navigator.onLine) return resolve();
    const done = () => {
      window.removeEventListener('online', done);
      resolve();
    };
    window.addEventListener('online', done);
    signal.addEventListener('abort', () => {
      window.removeEventListener('online', done);
      reject(new UploadCancelledError());
    }, { once: true });
  });

function isRetryable(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
}

/**
 * Chunked, resumable video upload.
 *
 * - Reads the file with Blob.slice, so the video is never loaded into memory.
 * - Uploads a few chunks in parallel; each chunk retries with exponential backoff
 *   and pauses while the browser is offline.
 * - Starting the same file again (same name + size) resumes: the server reports
 *   which chunks it already has and only the rest are sent.
 * - cancel() aborts in-flight requests and discards the server-side session.
 */
export class ChunkedUpload {
  private controller = new AbortController();
  private session: UploadSessionInfo | null = null;
  private chunkLoaded = new Map<number, number>();
  private startedAt = 0;
  private bytesAtStart = 0;
  private speed = 0;
  private waiting = false;
  private retrying = 0;

  private readonly projectUuid: string;
  private readonly file: File;
  private readonly language: string;
  private readonly onProgress: (p: UploadProgress) => void;

  constructor(projectUuid: string, file: File, language: string, onProgress: (p: UploadProgress) => void = () => {}) {
    this.projectUuid = projectUuid;
    this.file = file;
    this.language = language;
    this.onProgress = onProgress;
  }

  get sessionId(): string | null {
    return this.session?.uuid ?? null;
  }

  async start(): Promise<UploadResult> {
    const signal = this.controller.signal;
    const res = await apiClient.post<ApiResponse<{ upload: UploadSessionInfo }>>(
      `/projects/${this.projectUuid}/uploads`,
      { file_name: this.file.name, file_size: this.file.size, language: this.language },
      { signal, silent: true },
    );
    const session = res.data.data.upload;
    this.session = session;

    for (const i of session.received_chunks) {
      this.chunkLoaded.set(i, this.chunkLength(i));
    }
    this.startedAt = performance.now();
    this.bytesAtStart = this.loadedBytes();
    this.emit();

    await this.sendMissing(session.received_chunks);

    try {
      return await this.complete();
    } catch (err) {
      // The server lost a chunk (e.g. disk cleanup) — send what's missing once more.
      const missing = axios.isAxiosError(err) ? (err.response?.data as { errors?: { missing_chunks?: number[] } })?.errors?.missing_chunks : undefined;
      if (!missing?.length) throw err;
      missing.forEach((i) => this.chunkLoaded.delete(i));
      await this.sendMissing(Array.from({ length: session.total_chunks }, (_, i) => i).filter((i) => !missing.includes(i)));
      return this.complete();
    }
  }

  /** Stop sending but keep the server session, so the same file can resume later. */
  abortLocally(): void {
    this.controller.abort();
  }

  /** Abort and discard the upload on the server. Safe to call at any time. */
  async cancel(): Promise<void> {
    this.controller.abort();
    if (this.session) {
      await apiClient.delete(`/uploads/${this.session.uuid}`, { silent: true }).catch(() => undefined);
    }
  }

  private async sendMissing(received: number[]): Promise<void> {
    const session = this.session!;
    const have = new Set(received);
    const queue = Array.from({ length: session.total_chunks }, (_, i) => i).filter((i) => !have.has(i));
    const workers = Array.from({ length: Math.min(VIDEO_UPLOAD.PARALLEL_CHUNKS, queue.length) }, async () => {
      while (queue.length) {
        const index = queue.shift()!;
        await this.sendChunk(index);
      }
    });
    await Promise.all(workers);
  }

  private async sendChunk(index: number): Promise<void> {
    const session = this.session!;
    const signal = this.controller.signal;
    const start = index * session.chunk_size;
    const blob = this.file.slice(start, Math.min(start + session.chunk_size, this.file.size));

    for (let attempt = 0; ; attempt++) {
      if (signal.aborted) throw new UploadCancelledError();
      try {
        await apiClient.put(`/uploads/${session.uuid}/chunks/${index}`, blob, {
          signal,
          silent: true,
          timeout: 120_000,
          headers: { 'Content-Type': 'application/octet-stream' },
          onUploadProgress: (e) => {
            this.chunkLoaded.set(index, e.loaded);
            this.emit();
          },
        });
        this.chunkLoaded.set(index, blob.size);
        if (this.retrying) this.retrying = 0;
        this.emit();
        return;
      } catch (err) {
        if (signal.aborted || axios.isCancel(err)) throw new UploadCancelledError();
        this.chunkLoaded.set(index, 0);
        if (!isRetryable(err) || attempt >= MAX_RETRIES) throw err;

        if (!navigator.onLine) {
          this.waiting = true;
          this.emit();
          await waitForOnline(signal);
          this.waiting = false;
        }
        this.retrying = attempt + 1;
        this.emit();
        await sleep(Math.min(1000 * 2 ** attempt, 20_000), signal);
      }
    }
  }

  private async complete(): Promise<UploadResult> {
    const res = await apiClient.post<ApiResponse<UploadResult>>(
      `/uploads/${this.session!.uuid}/complete`,
      {},
      { signal: this.controller.signal, silent: true, timeout: 300_000 },
    );
    return res.data.data;
  }

  private chunkLength(index: number): number {
    const s = this.session!;
    return index < s.total_chunks - 1 ? s.chunk_size : s.file_size - s.chunk_size * (s.total_chunks - 1);
  }

  private loadedBytes(): number {
    let sum = 0;
    this.chunkLoaded.forEach((v) => (sum += v));
    return sum;
  }

  private emit(): void {
    const total = this.file.size;
    const loaded = Math.min(total, this.loadedBytes());
    const elapsed = (performance.now() - this.startedAt) / 1000;
    if (elapsed > 0.5) {
      const instant = (loaded - this.bytesAtStart) / elapsed;
      this.speed = this.speed ? this.speed * 0.7 + instant * 0.3 : instant;
    }
    this.onProgress({
      loaded,
      total,
      percent: total ? Math.floor((loaded / total) * 100) : 0,
      speed: Math.max(0, this.speed),
      eta: this.speed > 0 ? Math.max(0, Math.round((total - loaded) / this.speed)) : null,
      waitingForNetwork: this.waiting,
      retrying: this.retrying,
    });
  }
}
