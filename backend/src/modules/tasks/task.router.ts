import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure } from '../../trpc';
import { createTaskInput, listTasksInput, taskIdInput, updateTaskInput } from './task.schema';

function taskNotFound(id: string): TRPCError {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: `Task "${id}" was not found. It may have been deleted by someone else.`,
  });
}

export const tasksRouter = createTRPCRouter({
  list: publicProcedure
    .input(listTasksInput)
    .query(({ ctx, input }) => ctx.taskRepository.list(input)),

  getById: publicProcedure.input(taskIdInput).query(async ({ ctx, input }) => {
    const task = await ctx.taskRepository.findById(input.id);

    if (!task) {
      throw taskNotFound(input.id);
    }

    return task;
  }),

  create: publicProcedure.input(createTaskInput).mutation(({ ctx, input }) =>
    ctx.taskRepository.create({
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      status: input.status,
    }),
  ),

  update: publicProcedure.input(updateTaskInput).mutation(async ({ ctx, input }) => {
    const { id, ...changes } = input;
    const task = await ctx.taskRepository.update(id, changes);

    if (!task) {
      throw taskNotFound(id);
    }

    return task;
  }),

  delete: publicProcedure.input(taskIdInput).mutation(async ({ ctx, input }) => {
    const deleted = await ctx.taskRepository.delete(input.id);

    if (!deleted) {
      throw taskNotFound(input.id);
    }

    return { id: input.id };
  }),
});
