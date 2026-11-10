import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from '@artefact/backend';

/**
 * The only HTTP surface of the backend. It is a thin adapter: the router itself
 * knows nothing about Next.js, so the same code could be mounted on Fastify,
 * Express or a Lambda handler without changes.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function handler(request: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext: () => createContext({ headers: request.headers }),
    onError({ error, path }) {
      // The server log keeps the cause and the stack; the client only receives the
      // formatted shape (see `errorFormatter`).
      if (process.env.NODE_ENV !== 'test') {
        console.error(`[trpc] ${path ?? '<no-path>'} failed:`, error.cause ?? error);
      }
    },
  });
}

export { handler as GET, handler as POST };
