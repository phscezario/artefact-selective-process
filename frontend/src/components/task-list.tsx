'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';
import { useToast } from '@/components/toast';
import { getErrorMessage } from '@/lib/errors';
import {
  STATUS_LABELS,
  TASKS_PAGE_SIZE,
  formatDateTime,
  formatTaskCount,
  toIsoString,
} from '@/lib/tasks';

export function TaskList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    status,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery(
    trpc.tasks.list.infiniteQueryOptions(
      { limit: TASKS_PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
    ),
  );

  const deleteTask = useMutation(
    trpc.tasks.delete.mutationOptions({
      onSuccess: async () => {
        toast.success('Task deleted.');
        // The list is paginated, so every cached page has to be refetched.
        await queryClient.invalidateQueries({
          queryKey: trpc.tasks.list.infiniteQueryKey({ limit: TASKS_PAGE_SIZE }),
        });
      },
      onError: (deleteError) => {
        toast.error(`Could not delete the task. ${getErrorMessage(deleteError)}`);
      },
      onSettled: () => {
        setConfirmingId(null);
      },
    }),
  );

  /**
   * Infinite scroll: the sentinel only exists while there is a next page, and the
   * observer is recreated whenever the fetching state changes to avoid stacking
   * duplicate requests.
   */
  useEffect(() => {
    const node = loadMoreRef.current;

    if (!node || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '240px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
        <p className="toolbar-meta">
          {formatTaskCount(total)}
          {isFetching && !isFetchingNextPage ? ' · refreshing…' : null}
        </p>
      </div>

      <ul className="task-list">
        {tasks.map((task) => {
          const isDeleting = deleteTask.isPending && deleteTask.variables?.id === task.id;
          const isConfirming = confirmingId === task.id;

          return (
            <li key={task.id} className="task-row">
              <div className="task-body">
                <div className="task-heading">
                  <h3 className="task-title">{task.titulo}</h3>
                  <span className={`badge badge-${task.status}`}>{STATUS_LABELS[task.status]}</span>
                </div>

                {task.descricao ? (
                  <p className="task-description">{task.descricao}</p>
                ) : (
                  <p className="task-description task-description-empty">No description</p>
                )}

                <p className="task-meta">
                  Created{' '}
                  <time dateTime={toIsoString(task.dataCriacao)}>
                    {formatDateTime(task.dataCriacao)}
                  </time>
                </p>
              </div>

              <div className="task-actions">
                {isConfirming ? (
                  <>
                    <span className="confirm-question">Delete?</span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteTask.mutate({ id: task.id })}
                      disabled={isDeleting}
                      aria-busy={isDeleting}
                    >
                      {isDeleting ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmingId(null)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <Link className="btn btn-ghost btn-sm" href={`/tasks/${task.id}/edit`}>
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm"
                      onClick={() => setConfirmingId(task.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
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
