import { describe, expect, it } from 'vitest';
import { TRPCClientError } from '@trpc/client';
import { getErrorMessage, getFieldErrors } from './errors';

/** Builds the error shape a tRPC client receives over the wire. */
function clientError(data: Record<string, unknown>, message = 'Fallback message') {
  return TRPCClientError.from({
    error: {
      message,
      code: -32600,
      data: { code: 'BAD_REQUEST', httpStatus: 400, path: 'tasks.create', ...data },
    },
  } as never);
}

describe('getErrorMessage', () => {
  it('prefers the first server-side field message', () => {
    const error = clientError({ fieldErrors: { titulo: 'Title is required.' } }, 'Invalid input');

    expect(getErrorMessage(error)).toBe('Title is required.');
  });

  it('falls back to the transport message when there are no field errors', () => {
    expect(getErrorMessage(clientError({ fieldErrors: null }, 'Task not found.'))).toBe(
      'Task not found.',
    );
  });

  it('returns a generic message for values that are not errors', () => {
    expect(getErrorMessage('boom')).toBe('Something went wrong. Please try again.');
  });
});

describe('getFieldErrors', () => {
  it('returns only the keys the form knows about', () => {
    const error = clientError({
      fieldErrors: { titulo: 'Title is required.', unknownField: 'Should be dropped.' },
    });

    expect(getFieldErrors(error)).toEqual({ titulo: 'Title is required.' });
  });

  it('returns null when no known field is rejected', () => {
    expect(getFieldErrors(clientError({ fieldErrors: { unknownField: 'nope' } }))).toBeNull();
    expect(getFieldErrors(clientError({ fieldErrors: null }))).toBeNull();
  });

  it('returns null for errors that did not come from tRPC', () => {
    expect(getFieldErrors(new Error('offline'))).toBeNull();
  });
});
