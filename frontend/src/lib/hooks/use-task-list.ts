'use client';

import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskSort } from '@artefact/backend/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useToast } from '@/components/toast';
import { getErrorMessage } from '@/lib/errors';
import { getNextPageParam, taskListInput } from '@/lib/tasks';

/**
 * Everything the list needs that is not markup: the paginated query for the
 * requested order, the infinite-scroll sentinel and the delete flow with its
 * confirmation state.
 */
export function useTaskList(sort: TaskSort) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const input = taskListInput(sort);

  const listQuery = useInfiniteQuery(
    trpc.tasks.list.infiniteQueryOptions(input, { getNextPageParam }),
  );
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listQuery;

  const deleteTask = useMutation(
    trpc.tasks.delete.mutationOptions({
      onSuccess: async () => {
        toast.success('Task deleted.');
        // The list is paginated, so every cached page has to be refetched.
        await queryClient.invalidateQueries({
          queryKey: trpc.tasks.list.infiniteQueryKey(input),
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

  return { listQuery, deleteTask, confirmingId, setConfirmingId, loadMoreRef };
}
