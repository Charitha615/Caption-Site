import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const exports = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), get: vi.fn(), remove: vi.fn(), download: vi.fn() }));
vi.mock('../services/exportService', async (orig) => ({
  ...(await orig<typeof import('../services/exportService')>()),
  exportService: exports,
}));
vi.mock('../features/editor/services/autosave', () => ({ flush: vi.fn().mockResolvedValue(undefined) }));

import { ExportDialog } from '../features/editor/components/export/ExportDialog';
import { useUIStore } from '../stores/editor/uiStore';
import { useEditorProjectStore } from '../stores/editor/editorProjectStore';
import { EMPTY_DOCUMENT, useCaptionStore } from '../stores/editor/captionStore';
import type { ExportItem } from '../types/export';

const item = (over: Partial<ExportItem>): ExportItem => ({
  uuid: 'e1', type: 'srt', status: 'completed', progress: 100, file_size: 120, error_message: null, options: {},
  download_url: 'https://api.test/x', download_name: 'video.srt', created_at: new Date().toISOString(), started_at: null, completed_at: null, ...over,
});

function setup(width = 720, height = 1280) {
  useCaptionStore.getState().load({ ...EMPTY_DOCUMENT, captions: [{ id: 'c', start: 0, end: 1, text: 'ආයුබෝවන්', language: 'si' }] });
  useEditorProjectStore.getState().setLoaded({ uuid: 'p1', name: 'P', duration: 10, settings: {}, isDemo: false, sourceWidth: width, sourceHeight: height, hasServerVideo: true });
  useUIStore.getState().setExportOpen(true);
  return render(<ExportDialog />);
}

describe('Export dialog', () => {
  beforeEach(() => {
    Object.values(exports).forEach((m) => m.mockReset());
    exports.list.mockResolvedValue([]);
  });

  it('shows the original aspect ratio and only the resolutions the source supports', async () => {
    setup(720, 1280);

    expect(screen.getByText('9:16 (original)')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '720p, 720 by 1280' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: '1080p, 1080 by 1920' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /2K, needs a larger source/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /4K, needs a larger source/ })).toBeDisabled();
  });

  it('downloads SRT, VTT and TXT straight away', async () => {
    setup();
    for (const type of ['srt', 'vtt', 'txt'] as const) {
      exports.create.mockResolvedValueOnce(item({ uuid: `e-${type}`, type }));
      await userEvent.click(screen.getByRole('button', { name: `Download ${type.toUpperCase()}` }));
      await waitFor(() => expect(exports.download).toHaveBeenCalledWith(`e-${type}`));
      expect(exports.create).toHaveBeenLastCalledWith('p1', { type });
    }
  });

  it('exports the video at the chosen resolution and shows render progress, then the download', async () => {
    exports.create.mockResolvedValue(item({ uuid: 'v1', type: 'mp4', status: 'queued', progress: 0, download_url: null, options: { resolution: '720', width: 720, height: 1280 } }));
    exports.get
      .mockResolvedValueOnce(item({ uuid: 'v1', type: 'mp4', status: 'processing', progress: 40, download_url: null, started_at: new Date(Date.now() - 20000).toISOString(), options: { resolution: '720', width: 720, height: 1280 } }))
      .mockResolvedValue(item({ uuid: 'v1', type: 'mp4', status: 'completed', progress: 100, file_size: 5_000_000, download_name: 'video.mp4', options: { resolution: '720', width: 720, height: 1280 } }));
    setup();

    await userEvent.click(screen.getByRole('radio', { name: '720p, 720 by 1280' }));
    await userEvent.click(screen.getByRole('button', { name: /export video/i }));

    await waitFor(() => expect(exports.create).toHaveBeenCalledWith('p1', { type: 'mp4', resolution: '720', quality: 'standard', template: null }));
    expect(await screen.findByText('Getting ready to render…')).toBeInTheDocument();
    expect(await screen.findByText('Rendering your video', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Render progress' })).toHaveAttribute('aria-valuenow', '40');

    await userEvent.click(await screen.findByRole('button', { name: /download mp4/i }, { timeout: 3000 }));
    expect(exports.download).toHaveBeenCalledWith('v1');
  });

  it('reopening during a render goes straight to its progress', async () => {
    exports.list.mockResolvedValue([item({ uuid: 'v2', type: 'mp4', status: 'processing', progress: 65, download_url: null, started_at: new Date().toISOString(), options: { resolution: '1080' } })]);
    exports.get.mockResolvedValue(item({ uuid: 'v2', type: 'mp4', status: 'processing', progress: 66, download_url: null, options: { resolution: '1080' } }));
    setup();

    expect(await screen.findByText('Rendering your video')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('shows a readable error when the plan limit is reached', async () => {
    const { AxiosError, AxiosHeaders } = await import('axios');
    exports.create.mockRejectedValue(new AxiosError('limit', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 402, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
      data: { message: 'You have used all video renders for this month.', code: 'usage_limit_exceeded' },
    }));
    setup();

    await userEvent.click(screen.getByRole('button', { name: /export video/i }));

    expect(await screen.findByText('You have used all video renders for this month.')).toBeInTheDocument();
  });
});
