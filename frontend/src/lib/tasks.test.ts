import { describe, expect, it } from 'vitest';
import { DEFAULT_TASK_SORT } from '@artefact/backend/constants';
import { SORT_OPTIONS, parseTaskSort, taskListInput } from './tasks';

describe('parseTaskSort', () => {
  it('keeps every value the API accepts', () => {
    for (const option of SORT_OPTIONS) {
      expect(parseTaskSort(option.value)).toBe(option.value);
    }
  });

  it('falls back to the default for a missing or unknown value', () => {
    expect(parseTaskSort(undefined)).toBe(DEFAULT_TASK_SORT);
    expect(parseTaskSort('')).toBe(DEFAULT_TASK_SORT);
    expect(parseTaskSort('alphabetical')).toBe(DEFAULT_TASK_SORT);
    expect(parseTaskSort(['created-asc', 'titulo-asc'])).toBe(DEFAULT_TASK_SORT);
  });

  it('offers the default as the first option', () => {
    expect(SORT_OPTIONS[0]?.value).toBe(DEFAULT_TASK_SORT);
  });
});

describe('taskListInput', () => {
  it('pins the page size and forwards the order', () => {
    expect(taskListInput('updated-desc')).toEqual({
      limit: taskListInput().limit,
      sort: 'updated-desc',
    });
    expect(taskListInput().sort).toBe(DEFAULT_TASK_SORT);
  });
});
