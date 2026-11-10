import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query';
import superjson from 'superjson';

/**
 * One factory, two consumers:
 * - the browser keeps a single instance for the whole session;
 * - the server creates a new instance per request (see `lib/trpc/server.ts`).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR we already have fresh data in the HTML, so avoid an immediate refetch.
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        // Dates are part of the payload; superjson keeps them intact across the RSC boundary.
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
