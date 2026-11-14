import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';

const api = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('./api', () => ({ apiClient: api }));

import { ChunkedUpload, UploadCancelledError } from './uploadService';

const session = (received: number[] = []) => ({
  data: {
    data: {
      upload: { uuid: 'u1', status: 'pending', file_name: 'v.mp4', file_size: 10, chunk_size: 4, total_chunks: 3, received_chunks: received, expires_at: '' },
    },
  },
});
const completed = { data: { data: { project: { uuid: 'p1' }, media_file: { uuid: 'm1', original_name: 'v.mp4', file_size: 10 } } } };
const file = () => new File(['0123456789'], 'v.mp4', { type: 'video/mp4' });

describe('ChunkedUpload', () => {
  beforeEach(() => {
    api.post.mockReset();
    api.put.mockReset();
    api.delete.mockReset();
  });

  it('sends every chunk as a slice of the file and completes', async () => {
    api.post.mockResolvedValueOnce(session()).mockResolvedValueOnce(completed);
    api.put.mockResolvedValue({ data: {} });
    const progress = vi.fn();

    const result = await new ChunkedUpload('p1', file(), 'si', progress).start();

    expect(result.media_file.uuid).toBe('m1');
    const sizes = api.put.mock.calls.map(([url, blob]) => [url, (blob as Blob).size]).sort();
    expect(sizes).toEqual([['/uploads/u1/chunks/0', 4], ['/uploads/u1/chunks/1', 4], ['/uploads/u1/chunks/2', 2]]);
    expect(api.post).toHaveBeenLastCalledWith('/uploads/u1/complete', {}, expect.objectContaining({ silent: true }));
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ percent: 100, loaded: 10 }));
  });

  it('resumes by sending only the chunks the server is missing', async () => {
    api.post.mockResolvedValueOnce(session([0, 2])).mockResolvedValueOnce(completed);
    api.put.mockResolvedValue({ data: {} });

    await new ChunkedUpload('p1', file(), 'si').start();

    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put.mock.calls[0][0]).toBe('/uploads/u1/chunks/1');
  });

  it('retries a chunk after a transient server error', async () => {
    vi.useFakeTimers();
    api.post.mockResolvedValueOnce(session([0, 1])).mockResolvedValueOnce(completed);
    const busy = new AxiosError('busy', 'ERR_BAD_RESPONSE', undefined, undefined, { status: 503, data: {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } });
    api.put.mockRejectedValueOnce(busy).mockResolvedValue({ data: {} });

    const promise = new ChunkedUpload('p1', file(), 'si').start();
    await vi.runAllTimersAsync();
    await promise;

    expect(api.put).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not retry client errors such as an expired session', async () => {
    api.post.mockResolvedValueOnce(session([0, 1]));
    const gone = new AxiosError('gone', 'ERR_BAD_REQUEST', undefined, undefined, { status: 410, data: {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } });
    api.put.mockRejectedValue(gone);

    await expect(new ChunkedUpload('p1', file(), 'si').start()).rejects.toBe(gone);
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  it('cancel aborts in-flight requests and deletes the server session', async () => {
    api.post.mockResolvedValueOnce(session());
    api.delete.mockResolvedValue({});
    api.put.mockImplementation((_url, _blob, config: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => config.signal.addEventListener('abort', () => reject(new UploadCancelledError()))),
    );

    const upload = new ChunkedUpload('p1', file(), 'si');
    const promise = upload.start();
    await vi.waitFor(() => expect(api.put).toHaveBeenCalled());
    await upload.cancel();

    await expect(promise).rejects.toBeInstanceOf(UploadCancelledError);
    expect(api.delete).toHaveBeenCalledWith('/uploads/u1', expect.anything());
  });
});
