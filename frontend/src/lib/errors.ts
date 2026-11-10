import { TRPCClientError } from '@trpc/client';
import { isTaskField, type TaskFieldErrors } from './form';

interface ErrorData {
  fieldErrors?: Record<string, string> | null;
}

/**
 * tRPC errors are transport-aware (`TRPCClientError`), but a network failure or a
 * bug can surface anything. Normalise both cases into one readable message.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) {
    const data = error.data as ErrorData | undefined;
    const fieldMessages = data?.fieldErrors;

    if (fieldMessages) {
      const firstMessage = Object.values(fieldMessages)[0];

      if (firstMessage) {
        return firstMessage;
      }
    }

    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

/**
 * Server-side field validation, used when the API rejects an input the form accepted.
 * Keys are filtered instead of cast: the payload crosses a network boundary, so the
 * shape is a claim, not a guarantee.
 */
export function getFieldErrors(error: unknown): TaskFieldErrors | null {
  if (!(error instanceof TRPCClientError)) {
    return null;
  }

  const data = error.data as ErrorData | undefined;
  const fieldErrors = data?.fieldErrors;

  if (!fieldErrors) {
    return null;
  }

  const knownFieldErrors: TaskFieldErrors = {};

  for (const [field, message] of Object.entries(fieldErrors)) {
    if (isTaskField(field)) {
      knownFieldErrors[field] = message;
    }
  }

  return Object.keys(knownFieldErrors).length > 0 ? knownFieldErrors : null;
}
