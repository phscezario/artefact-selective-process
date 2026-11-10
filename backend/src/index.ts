/**
 * Public surface of the backend package.
 *
 * `frontend/` imports the router (to mount it on /api/trpc and to prefetch in
 * server components) and the schemas (to validate the form with the exact same
 * rules the server enforces). Client components must import from
 * `@artefact/backend/schemas`, never from here: this entry is server-only.
 */
import 'server-only';

export { appRouter } from './router';
export type { AppRouter } from './router';
export { createContext, type Context } from './context';
export {
  createTaskInput,
  updateTaskInput,
  listTasksInput,
  taskIdInput,
  taskSchema,
  taskStatusSchema,
  toFieldErrors,
  DESCRIPTION_MAX_LENGTH,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  TITLE_MAX_LENGTH,
  type ListTasksInput,
  type Task,
  type TaskPage,
  type TaskStatus,
  type CreateTaskInput,
  type UpdateTaskInput,
} from './modules/tasks/task.schema';
