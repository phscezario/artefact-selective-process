import type { ZodError } from 'zod';

export interface TaskFormValues {
  titulo: string;
  descricao: string;
  status: 'todo' | 'in_progress' | 'done';
}

export type TaskField = keyof TaskFormValues;
export type TaskFieldErrors = Partial<Record<TaskField, string>>;

const FORM_FIELDS: readonly TaskField[] = ['titulo', 'descricao', 'status'];

function isFormField(value: unknown): value is TaskField {
  return typeof value === 'string' && (FORM_FIELDS as readonly string[]).includes(value);
}

/** Turns Zod issues into the per-field map the form renders. First issue per field wins. */
export function toFieldErrors(error: ZodError): TaskFieldErrors {
  const fieldErrors: TaskFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (isFormField(field) && fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}
