import type { ZodError } from 'zod';
import { toFieldErrors as toSharedFieldErrors } from '@artefact/backend/schemas';
import { isTaskField, type TaskFieldErrors } from './form';

/**
 * Narrows the shared server mapping to the fields this form renders. The keys come
 * from the backend so client and server cannot diverge on how an issue is named.
 */
export function toFieldErrors(error: ZodError): TaskFieldErrors {
  const fieldErrors: TaskFieldErrors = {};

  for (const [field, message] of Object.entries(toSharedFieldErrors(error))) {
    if (isTaskField(field)) {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
}
