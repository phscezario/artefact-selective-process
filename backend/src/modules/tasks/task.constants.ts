/**
 * Limits and enumerations used by both the server schemas and the UI. Kept in a
 * module without Zod so client code can import a value without pulling the
 * validator into the bundle.
 */
export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 1000;
export const LIST_DEFAULT_LIMIT = 8;
export const LIST_MAX_LIMIT = 50;

/**
 * Orders offered by `tasks.list`. The value travels over the wire (and in the URL),
 * so it stays stable: the label lives in the frontend.
 */
export const TASK_SORT_VALUES = [
  'created-desc',
  'created-asc',
  'updated-desc',
  'titulo-asc',
  'status-asc',
] as const;

export const DEFAULT_TASK_SORT = 'created-desc';

/**
 * Workflow order, not alphabetical: "done" is the end of the pipeline, so sorting
 * by status should read like the board does.
 */
export const TASK_STATUS_ORDER = {
  todo: 0,
  in_progress: 1,
  done: 2,
} as const;
