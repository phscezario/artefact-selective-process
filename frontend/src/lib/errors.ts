import { TRPCClientError } from '@trpc/client';
import type { TaskFieldErrors } from './form';

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

/** Server-side field validation, used when the API rejects an input the form accepted. */
export function getFieldErrors(error: unknown): TaskFieldErrors | null {
  if (!(error instanceof TRPCClientError)) {
    return null;
  }

  const data = error.data as ErrorData | undefined;
  const fieldErrors = data?.fieldErrors;

  return fieldErrors ? (fieldErrors as TaskFieldErrors) : null;
}
