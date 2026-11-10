import { tasksRouter } from './modules/tasks/task.router';
import { createTRPCRouter, publicProcedure } from './trpc';

export const appRouter = createTRPCRouter({
  /** Cheap endpoint for uptime checks and for the Docker healthcheck. */
  health: publicProcedure.query(() => ({ status: 'ok' as const, checkedAt: new Date() })),
  tasks: tasksRouter,
});

export type AppRouter = typeof appRouter;
