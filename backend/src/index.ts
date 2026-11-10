/**
 * Public surface of the backend package.
 *
 * `frontend/` imports the router (to mount it on /api/trpc and to prefetch in
 * server components) and the input schemas (to validate the form with the exact
 * same rules the server enforces). Nothing else is exported on purpose.
 */
export { appRouter } from './router';
export type { AppRouter } from './router';
export { createContext, type Context } from './context';
export { createCallerFactory } from './trpc';
export {
  createTaskInput,
  updateTaskInput,
  listTasksInput,
  taskIdInput,
  taskStatusSchema,
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
export {
  InMemoryTaskRepository,
  type TaskRepository,
  type CreateTaskData,
  type UpdateTaskData,
} from './modules/tasks/task.repository';
export { buildSeedTasks } from './modules/tasks/task.seed';
