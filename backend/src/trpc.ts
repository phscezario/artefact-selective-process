import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { toFieldErrors } from './modules/tasks/task.schema';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  // Dates survive the wire without being stringified by hand.
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const isProduction = process.env.NODE_ENV === 'production';
    // tRPC wraps unexpected errors as INTERNAL_SERVER_ERROR while keeping their
    // message, so a raw `throw new Error('db password...')` would reach the
    // browser. Production gets a generic message; the server log keeps the rest.
    const hideInternalMessage = isProduction && error.code === 'INTERNAL_SERVER_ERROR';

    return {
      ...shape,
      message: hideInternalMessage ? 'Internal server error' : shape.message,
      data: {
        ...shape.data,
        // Never ship server stacks to the browser, and keep them out of test output.
        stack: isProduction ? undefined : shape.data.stack,
        // Zod issues are exposed per field so the form can highlight the offending input.
        fieldErrors: error.cause instanceof ZodError ? toFieldErrors(error.cause) : null,
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
export const publicProcedure = t.procedure.use(timingLogger);
