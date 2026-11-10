import { HydrateClient, getQueryClient, trpc } from '@/lib/trpc/server';
import { TaskList } from '@/components/task-list';
import { getNextPageParam, taskListInput } from '@/lib/tasks';

/**
 * Server-Side Rendering:
 * the first page is prefetched in-process and hydrated into the client cache, so
 * the HTML that reaches the browser already contains the tasks.
 *
 * `force-dynamic` is required because the store lives in memory and changes on every
 * mutation - without it Next would serve HTML generated once at build time.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await getQueryClient().prefetchInfiniteQuery(
    trpc.tasks.list.infiniteQueryOptions(taskListInput, { getNextPageParam }),
  );

  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">Artefact · written case</p>
        <h1 className="page-title">Task manager</h1>
        <p className="page-subtitle">
          Next.js 15 App Router on the front, tRPC over an in-memory repository on the back. This
          list is rendered on the server and hydrated on the client.
        </p>
      </div>

      <HydrateClient>
        <TaskList />
      </HydrateClient>
    </div>
  );
}
