import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  // Dates survive the wire without being stringified by hand.
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Zod issues are exposed per field so the form can highlight the offending input.
    const fieldErrors =
      error.cause instanceof ZodError
        ? Object.fromEntries(
            error.cause.issues.map((issue) => [issue.path.join('.'), issue.message] as const),
          )
        : null;

    const isProduction = process.env.NODE_ENV === 'production';

    return {
      ...shape,
      data: {
        ...shape.data,
        // Never ship server stacks to the browser, and keep them out of test output.
        stack: isProduction ? undefined : shape.data.stack,
        fieldErrors,
      },
    };
  },
});

/**
 * Timing log for local development. A real deployment would emit a span to the
 * observability stack instead of writing to stdout.
 */
const timingLogger = t.middleware(async ({ path, type, next }) => {
  const startedAt = performance.now();
  const result = await next();
  const elapsed = Math.round(performance.now() - startedAt);

  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    console.info(`[trpc] ${type} ${path} ${elapsed}ms ${result.ok ? 'ok' : 'error'}`);
  }

  return result;
});

export { t };
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure.use(timingLogger);
