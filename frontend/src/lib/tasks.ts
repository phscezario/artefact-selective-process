import type { TaskStatus } from '@artefact/backend/schemas';

/** Page size used by both the server prefetch and the client infinite query. */
export const TASKS_PAGE_SIZE = 8;

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
 * The API contract says `dataCriacao` is a Date; superjson restores it on both the
 * HTTP and the RSC hydration path. This helper keeps the markup safe if a plain
 * ISO string ever reaches the component.
 */
export function toIsoString(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function formatTaskCount(count: number): string {
  return count === 1 ? '1 task' : `${count} tasks`;
}
