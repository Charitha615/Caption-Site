import { describe, expect, it } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../services/api';

describe('API client uploads', () => {
  it('sends FormData as multipart, keeping the file (not converted to JSON)', async () => {
    let sent: InternalAxiosRequestConfig | null = null;
    const form = new FormData();
    form.append('slip', new File(['x'], 'slip.png', { type: 'image/png' }));

    await apiClient.post('/billing/payments/p1/slip', form, {
      adapter: async (config) => {
        sent = config;
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
      },
    });

    expect(sent!.data).toBeInstanceOf(FormData);
    expect((sent!.data as FormData).get('slip')).toBeInstanceOf(File);
    expect(String(sent!.headers.get('Content-Type') ?? '')).not.toContain('application/json');
  });

  it('still sends plain objects as JSON', async () => {
    let sent: InternalAxiosRequestConfig | null = null;
    await apiClient.post('/x', { a: 1 }, {
      adapter: async (config) => {
        sent = config;
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
      },
    });
    expect(sent!.data).toBe('{"a":1}');
    expect(String(sent!.headers.get('Content-Type'))).toContain('application/json');
  });
});
