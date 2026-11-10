import { describe, expect, it } from 'vitest';
import { appRouter } from '../../router';
import { InMemoryTaskRepository } from './task.repository';

function createTestCaller(options: { seed?: boolean } = {}) {
  const repository = new InMemoryTaskRepository(options.seed ? undefined : []);
  return { caller: appRouter.createCaller({ taskRepository: repository }), repository };
}

describe('tasks router', () => {
  it('creates a task with a generated id, trimmed title and normalised description', async () => {
    const { caller } = createTestCaller();

    const task = await caller.tasks.create({
      titulo: '  Write the written case  ',
      descricao: '   ',
      status: 'todo',
    });

    expect(task.id).toEqual(expect.any(String));
    expect(task.titulo).toBe('Write the written case');
    expect(task.descricao).toBeNull();
    expect(task.status).toBe('todo');
    expect(task.dataCriacao).toBeInstanceOf(Date);
  });

  it('rejects a task without a title', async () => {
    const { caller } = createTestCaller();

    await expect(caller.tasks.create({ titulo: '   ', status: 'todo' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects a title longer than the limit', async () => {
    const { caller } = createTestCaller();

    await expect(
      caller.tasks.create({ titulo: 'x'.repeat(121), status: 'todo' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('paginates with a keyset cursor and reports the total', async () => {
    const { caller } = createTestCaller();

    for (let index = 0; index < 5; index += 1) {
      await caller.tasks.create({ titulo: `Task ${index}`, status: 'todo' });
    }

    const firstPage = await caller.tasks.list({ limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(5);
    expect(firstPage.nextCursor).toBe(firstPage.items[1]?.id);

    const secondPage = await caller.tasks.list({ limit: 2, cursor: firstPage.nextCursor ?? '' });
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.nextCursor).toBe(secondPage.items[1]?.id);

    const thirdPage = await caller.tasks.list({ limit: 2, cursor: secondPage.nextCursor ?? '' });
    expect(thirdPage.items).toHaveLength(1);
    expect(thirdPage.nextCursor).toBeNull();

    const ids = [...firstPage.items, ...secondPage.items, ...thirdPage.items].map(
      (task) => task.id,
    );
    expect(new Set(ids).size).toBe(5);
  });

  it('rejects an invalid page size', async () => {
    const { caller } = createTestCaller();

    await expect(caller.tasks.list({ limit: 0 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('updates only the fields that were sent', async () => {
    const { caller } = createTestCaller();
    const created = await caller.tasks.create({
      titulo: 'Draft the ADR',
      descricao: 'Explain the cache decision',
      status: 'todo',
    });

    const updated = await caller.tasks.update({ id: created.id, status: 'done' });

    expect(updated.status).toBe('done');
    expect(updated.titulo).toBe('Draft the ADR');
    expect(updated.descricao).toBe('Explain the cache decision');
  });

  it('clears the description when an empty string is sent', async () => {
    const { caller } = createTestCaller();
    const created = await caller.tasks.create({
      titulo: 'Draft the ADR',
      descricao: 'Something',
      status: 'todo',
    });

    const updated = await caller.tasks.update({ id: created.id, descricao: '' });

    expect(updated.descricao).toBeNull();
  });

  it('returns NOT_FOUND when updating a task that does not exist', async () => {
    const { caller } = createTestCaller();

    await expect(
      caller.tasks.update({ id: 'missing-id', titulo: 'Anything' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deletes a task and returns an error the second time', async () => {
    const { caller } = createTestCaller();
    const created = await caller.tasks.create({ titulo: 'Temporary task', status: 'todo' });

    await expect(caller.tasks.delete({ id: created.id })).resolves.toEqual({ id: created.id });
    await expect(caller.tasks.delete({ id: created.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(caller.tasks.getById({ id: created.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('ships the seeded tasks so the UI is never empty on first load', async () => {
    const { caller } = createTestCaller({ seed: true });

    const page = await caller.tasks.list({ limit: 50 });

    expect(page.total).toBeGreaterThan(10);
    expect(page.items.every((task) => task.dataCriacao instanceof Date)).toBe(true);
  });
});
