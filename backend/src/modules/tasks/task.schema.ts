import { z, type ZodError } from 'zod';
import {
  DEFAULT_TASK_SORT,
  DESCRIPTION_MAX_LENGTH,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  TASK_SORT_VALUES,
  TITLE_MAX_LENGTH,
} from './task.constants';

export {
  DEFAULT_TASK_SORT,
  DESCRIPTION_MAX_LENGTH,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  TASK_SORT_VALUES,
  TITLE_MAX_LENGTH,
} from './task.constants';

/**
 * Field names follow the case specification (`titulo`, `descricao`, `dataCriacao`).
 * Everything else in the codebase - identifiers, comments, UI copy - is in English.
 */
export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required.')
  .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters.`);

/**
 * An empty or whitespace-only description is stored as `null` so the domain has a
 * single representation for "no description" instead of three (`''`, `'  '`, `null`).
 */
const descriptionSchema = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX_LENGTH, `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters.`)
  .transform((value) => (value.length > 0 ? value : null));

const idSchema = z.string().min(1, 'Task id is required.');

export const createTaskInput = z.object({
  titulo: titleSchema,
  descricao: descriptionSchema.optional(),
  status: taskStatusSchema.default('todo'),
});
export type CreateTaskInput = z.infer<typeof createTaskInput>;

export const updateTaskInput = z
  .object({
    id: idSchema,
    titulo: titleSchema.optional(),
    descricao: descriptionSchema.optional(),
    status: taskStatusSchema.optional(),
  })
  .refine(
    (input) =>
      input.titulo !== undefined || input.descricao !== undefined || input.status !== undefined,
    { message: 'Provide at least one field to update.' },
  );
export type UpdateTaskInput = z.infer<typeof updateTaskInput>;

export const listTasksInput = z.object({
  /** Id of the last task of the previous page (keyset pagination). */
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(LIST_MAX_LIMIT).default(LIST_DEFAULT_LIMIT),
  sort: z.enum(TASK_SORT_VALUES).default(DEFAULT_TASK_SORT),
});
export type ListTasksInput = z.infer<typeof listTasksInput>;
export type TaskSort = ListTasksInput['sort'];

export const taskIdInput = z.object({ id: idSchema });

/**
 * The entity itself. Inputs above guard the two doors writes come through; this
 * schema guards the shape the rest of the system reads, so the seed data and the
 * repository cannot drift from the contract the UI consumes.
 */
export const taskSchema = z.object({
  id: idSchema,
  titulo: z.string().min(1).max(TITLE_MAX_LENGTH),
  descricao: z.string().max(DESCRIPTION_MAX_LENGTH).nullable(),
  status: taskStatusSchema,
  dataCriacao: z.date(),
  /** Bumped on every update; equal to `dataCriacao` while the task is untouched. */
  dataAtualizacao: z.date(),
});
export type Task = z.infer<typeof taskSchema>;

export interface TaskPage {
  items: Task[];
  /** `null` when there are no more pages. */
  nextCursor: string | null;
  total: number;
}

/**
 * Single mapping from Zod issues to the per-field error shape that the tRPC error
 * formatter sends and the form renders. Both sides must agree on the keys, so it
 * lives next to the schemas instead of being reimplemented per layer.
 */
export function toFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === 'string' && fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}
