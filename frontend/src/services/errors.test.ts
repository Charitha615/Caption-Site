import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { toAppError } from './errors';

const httpError = (status: number, data: unknown) =>
  new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe('toAppError', () => {
  it('surfaces the first field error for validation failures', () => {
    const err = toAppError(httpError(422, { message: 'Invalid', errors: { email: ['The email has already been taken.'] } }));
    expect(err.status).toBe(422);
    expect(err.message).toBe('The email has already been taken.');
    expect(err.fieldErrors.email).toEqual(['The email has already been taken.']);
  });

  it('never shows server internals for 5xx and keeps the request id', () => {
    const err = toAppError(httpError(500, { message: 'SQLSTATE[42S02] at /var/www/app', request_id: 'abc-123', code: 'server_error' }));
    expect(err.message).not.toContain('SQLSTATE');
    expect(err.message).toMatch(/something went wrong/i);
    expect(err.requestId).toBe('abc-123');
  });

  it('passes through plan-limit messages and codes', () => {
    const err = toAppError(httpError(402, { message: 'You have used all video renders for this month.', code: 'usage_limit_exceeded' }));
    expect(err.code).toBe('usage_limit_exceeded');
    expect(err.message).toBe('You have used all video renders for this month.');
  });

  it('describes network failures and timeouts', () => {
    expect(toAppError(new AxiosError('Network Error', 'ERR_NETWORK')).code).toBe('network');
    expect(toAppError(new AxiosError('timeout', 'ECONNABORTED')).message).toMatch(/timed out/);
  });
});
