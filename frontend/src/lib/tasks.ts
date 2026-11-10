import {
  DEFAULT_TASK_SORT,
  LIST_DEFAULT_LIMIT,
  TASK_SORT_VALUES,
} from '@artefact/backend/constants';
import type { TaskSort, TaskStatus } from '@artefact/backend/schemas';

/** Page size used by both the server prefetch and the client infinite query. */
export const TASKS_PAGE_SIZE = LIST_DEFAULT_LIMIT;

export const SORT_LABELS: Record<TaskSort, string> = {
  'created-desc': 'Newest created',
  'created-asc': 'Oldest created',
  'updated-desc': 'Recently updated',
  'titulo-asc': 'Title (A–Z)',
  'status-asc': 'Status (to do → done)',
};

export const SORT_OPTIONS = TASK_SORT_VALUES.map((value) => ({
  value: value as TaskSort,
  label: SORT_LABELS[value],
}));

/**
 * The order lives in the URL (`/?sort=updated-desc`), so the server component can
 * prefetch the same page the browser is about to render. Anything unrecognised
 * falls back to the default instead of failing: the URL is user-editable.
 */
export function parseTaskSort(value: string | string[] | undefined): TaskSort {
  if (typeof value === 'string' && (TASK_SORT_VALUES as readonly string[]).includes(value)) {
    return value as TaskSort;
  }

  return DEFAULT_TASK_SORT;
}

/**
 * Single definition of the list query, shared by the SSR prefetch, the client hook
 * and every cache invalidation. A second copy would drift silently: the query key
 * includes the input, so a mismatched sort makes the hydrated cache miss.
 */
export function taskListInput(sort: TaskSort = DEFAULT_TASK_SORT) {
  return { limit: TASKS_PAGE_SIZE, sort };
}

export function getNextPageParam(lastPage: { nextCursor: string | null }): string | undefined {
  return lastPage.nextCursor ?? undefined;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as TaskStatus[]).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

/**
 * Formatting is pinned to UTC on purpose: the list is rendered on the server and
 * hydrated on the client, and a locale/timezone-dependent string would produce a
 * hydration mismatch for anyone outside UTC.
 */
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${dateTimeFormatter.format(date)} UTC`;
}

/**
 * The API contract says the dates are `Date` objects; superjson restores them on
 * both the HTTP and the RSC hydration path. This helper keeps the markup safe if a
 * plain ISO string ever reaches the component.
 */
export function toIsoString(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function formatTaskCount(count: number): string {
  return count === 1 ? '1 task' : `${count} tasks`;
}
