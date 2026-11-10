import 'server-only';

import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { cache } from 'react';
import { appRouter, createContext } from '@artefact/backend';
import { makeQueryClient } from './query-client';

/**
 * `cache` guarantees the same QueryClient for the whole request, so a server
 * component and a nested one share the prefetched data.
 */
export const getQueryClient = cache(makeQueryClient);

/**
 * The procedures run in-process: the server component calls the router directly
 * instead of doing an HTTP round trip to its own API route.
 */
export const trpc = createTRPCOptionsProxy({
  ctx: () => createContext(),
  router: appRouter,
  queryClient: getQueryClient,
});

/** Direct caller, for server components that need the value itself. */
export const caller = appRouter.createCaller(() => createContext());

export function HydrateClient({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
