'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { TaskSort } from '@artefact/backend/schemas';
import { DEFAULT_TASK_SORT } from '@artefact/backend/constants';
import { TaskRow } from '@/components/task-row';
import { useTaskList } from '@/lib/hooks/use-task-list';
import { getErrorMessage } from '@/lib/errors';
import { SORT_OPTIONS, formatTaskCount, parseTaskSort } from '@/lib/tasks';

interface TaskListProps {
  sort: TaskSort;
}

export function TaskList({ sort }: TaskListProps) {
  const { listQuery, deleteTask, confirmingId, setConfirmingId, loadMoreRef } = useTaskList(sort);
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startTransition] = useTransition();

  const { data, status, error, refetch, hasNextPage, isFetchingNextPage, isFetching } = listQuery;

  /**
   * The order is part of the URL, so the server component prefetches exactly this
   * view and the link can be shared. `startTransition` keeps the current list on
   * screen while the next order is being rendered.
   */
  function handleSortChange(value: string): void {
    const nextSort = parseTaskSort(value);
    const target = nextSort === DEFAULT_TASK_SORT ? pathname : `${pathname}?sort=${nextSort}`;

    startTransition(() => {
      router.replace(target, { scroll: false });
    });
  }

  if (status === 'error') {
    return (
      <div className="error-state" role="alert">
        <h2>We could not load your tasks</h2>
        <p>{getErrorMessage(error)}</p>
        <button type="button" className="btn btn-primary" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const tasks = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  if (status === 'success' && tasks.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon" aria-hidden="true">
          ✓
        </span>
        <h2>No tasks yet</h2>
        <p>Create the first one and it will show up here.</p>
        <Link href="/tasks/new" className="btn btn-primary">
          Create a task
        </Link>
      </div>
    );
  }

  return (
    <section aria-labelledby="task-list-heading">
      <div className="toolbar">
        <h2 id="task-list-heading" className="section-title">
          Your tasks
        </h2>

        <div className="toolbar-actions">
          <p className="toolbar-meta">
            {formatTaskCount(total)}
            {isFetching && !isFetchingNextPage ? ' · refreshing…' : null}
          </p>

          <label className="sort-control">
            <span className="sort-label">Sort by</span>
            <select
              className="select select-sm"
              value={sort}
              disabled={isNavigating}
              aria-busy={isNavigating}
              onChange={(event) => handleSortChange(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ul className="task-list" aria-busy={isNavigating}>
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            isConfirming={confirmingId === task.id}
            isDeleting={deleteTask.isPending && deleteTask.variables?.id === task.id}
            onRequestDelete={() => setConfirmingId(task.id)}
            onCancelDelete={() => setConfirmingId(null)}
            onConfirmDelete={() => deleteTask.mutate({ id: task.id })}
          />
        ))}
      </ul>

      <div className="load-more" ref={loadMoreRef}>
        {isFetchingNextPage ? (
          <span className="loading-more">
            <span className="spinner" aria-hidden="true" />
            Loading more tasks…
          </span>
        ) : hasNextPage ? (
          <span className="load-more-hint">Scroll to load more</span>
        ) : (
          <span className="load-more-hint">You have reached the end of the list.</span>
        )}
      </div>
    </section>
  );
}
