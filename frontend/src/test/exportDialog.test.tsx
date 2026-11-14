import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const exports = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), get: vi.fn(), remove: vi.fn(), download: vi.fn() }));
vi.mock('../services/exportService', async (orig) => ({
  ...(await orig<typeof import('../services/exportService')>()),
  exportService: exports,
  templateService: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), remove: vi.fn() },
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

describe('Export dialog', () => {
  beforeEach(() => {
    Object.values(exports).forEach((m) => m.mockReset());
    exports.list.mockResolvedValue([]);
    useCaptionStore.getState().load({ ...EMPTY_DOCUMENT, captions: [{ id: 'c', start: 0, end: 1, text: 'ආයුබෝවන්', language: 'si' }] });
    useEditorProjectStore.getState().setLoaded({ uuid: 'p1', name: 'P', duration: 10, settings: {}, isDemo: false, sourceWidth: 1920, sourceHeight: 1080, hasServerVideo: true });
    useUIStore.getState().setExportOpen(true);
  });

  it('exports SRT and downloads it immediately', async () => {
    exports.create.mockResolvedValue(item({ type: 'srt' }));
    render(<ExportDialog />);

    await userEvent.click(screen.getByRole('radio', { name: /SRT/i }));
    await userEvent.click(screen.getByRole('button', { name: /export srt/i }));

    await waitFor(() => expect(exports.download).toHaveBeenCalledWith('e1'));
    expect(exports.create).toHaveBeenCalledWith('p1', { type: 'srt' });
  });

  it('queues an MP4 render with the chosen options and shows it in the list', async () => {
    exports.create.mockResolvedValue(item({ uuid: 'e2', type: 'mp4', status: 'queued', progress: 0, download_url: null, options: { resolution: '720', quality: 'standard' } }));
    exports.get.mockResolvedValue(item({ uuid: 'e2', type: 'mp4', status: 'processing', progress: 40, download_url: null }));
    render(<ExportDialog />);

    await userEvent.click(screen.getByRole('radio', { name: '720p' }));
    await userEvent.click(screen.getByRole('button', { name: /render mp4/i }));

    await waitFor(() => expect(exports.create).toHaveBeenCalledWith('p1', { type: 'mp4', resolution: '720', quality: 'standard', template: null }));
    expect(exports.download).not.toHaveBeenCalled();
    expect(await screen.findByRole('list')).toBeInTheDocument();
  });

  it('shows a readable error when the plan limit is reached', async () => {
    const { AxiosError, AxiosHeaders } = await import('axios');
    exports.create.mockRejectedValue(new AxiosError('limit', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 402, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
      data: { message: 'You have used all video renders for this month.', code: 'usage_limit_exceeded' },
    }));
    render(<ExportDialog />);

    await userEvent.click(screen.getByRole('button', { name: /render mp4/i }));

    expect(await screen.findByText('You have used all video renders for this month.')).toBeInTheDocument();
  });
});
