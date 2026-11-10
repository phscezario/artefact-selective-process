import { z } from 'zod';

export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 1000;
export const LIST_DEFAULT_LIMIT = 8;
export const LIST_MAX_LIMIT = 50;

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
  limit: z.number().int().min(1).max(LIST_MAX_LIMIT),
});
export type ListTasksInput = z.infer<typeof listTasksInput>;

export const taskIdInput = z.object({ id: idSchema });

export interface Task {
  id: string;
  titulo: string;
  descricao: string | null;
  status: TaskStatus;
  dataCriacao: Date;
}

export interface TaskPage {
  items: Task[];
  /** `null` when there are no more pages. */
  nextCursor: string | null;
  total: number;
}
