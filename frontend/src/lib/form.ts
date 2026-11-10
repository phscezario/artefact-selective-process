import type { TaskStatus } from '@artefact/backend/schemas';

/**
 * Form model and field guards. Deliberately free of runtime dependencies: the list
 * page imports `isTaskField` through `errors.ts`, and pulling the Zod schemas here
 * would add the validator to every page that can show an error.
 */
export interface TaskFormValues {
  titulo: string;
  descricao: string;
  status: TaskStatus;
}

export type TaskField = keyof TaskFormValues;
export type TaskFieldErrors = Partial<Record<TaskField, string>>;

const FORM_FIELDS: readonly TaskField[] = ['titulo', 'descricao', 'status'];

export function isTaskField(value: unknown): value is TaskField {
  return typeof value === 'string' && (FORM_FIELDS as readonly string[]).includes(value);
}
