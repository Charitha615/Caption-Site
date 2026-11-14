import axios from 'axios';
import type { ApiResponse } from '../types/api';

export interface AppError {
  status: number | null;
  code: string;
  message: string;
  fieldErrors: Record<string, string[]>;
  requestId?: string;
}

const FRIENDLY: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  413: 'That file is too large.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again.',
  502: 'The service is temporarily unavailable. Please try again.',
  503: 'The service is temporarily unavailable. Please try again.',
};

/** Normalises any thrown value into a user-safe error. Never surfaces stack traces or raw axios text. */
export function toAppError(err: unknown, fallback = 'Something went wrong. Please try again.'): AppError {
  if (axios.isCancel(err)) {
    return { status: null, code: 'cancelled', message: 'Cancelled.', fieldErrors: {} };
  }
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      const timedOut = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
      return {
        status: null,
        code: timedOut ? 'timeout' : 'network',
        message: timedOut ? 'The request timed out. Check your connection and try again.' : 'Cannot reach the server. Check your connection and try again.',
        fieldErrors: {},
      };
    }
    const status = err.response.status;
    const data = (err.response.data ?? {}) as ApiResponse & { code?: string; request_id?: string };
    const fieldErrors = data.errors ?? {};
    const firstField = Object.values(fieldErrors)[0]?.[0];
    // Server messages for 4xx are written for users; 5xx messages are replaced by friendly copy.
    const serverMessage = status < 500 ? (firstField || data.message) : undefined;
    return {
      status,
      code: data.code ?? `http_${status}`,
      message: serverMessage || FRIENDLY[status] || fallback,
      fieldErrors,
      requestId: data.request_id,
    };
  }
  return { status: null, code: 'unknown', message: err instanceof Error && err.message ? err.message : fallback, fieldErrors: {} };
}

/** First validation / API message from an error, for inline display. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  return toAppError(err, fallback).message;
}

export function fieldError(err: AppError | null, field: string): string | undefined {
  return err?.fieldErrors[field]?.[0];
}
