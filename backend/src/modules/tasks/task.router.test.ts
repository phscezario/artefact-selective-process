import { describe, expect, it } from 'vitest';
import { appRouter } from '../../router';
import { InMemoryTaskRepository } from './task.repository';
import { TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH, LIST_DEFAULT_LIMIT } from './task.schema';

function createTestCaller(options: { seed?: boolean } = {}) {
  const repository = new InMemoryTaskRepository(options.seed ? undefined : []);
  return { caller: appRouter.createCaller({ taskRepository: repository }), repository };
}

describe('tasks router', () => {
  it('creates a task with a generated id, trimmed title and normalised description', async () => {
    const { caller } = createTestCaller();

    const first = await caller.tasks.create({
      titulo: '  Write the written case  ',
      descricao: '   ',
      status: 'todo',
    });
    const second = await caller.tasks.create({ titulo: 'Another task' });

    expect(first.id).toEqual(expect.any(String));
    expect(first.id).not.toBe(second.id);
    expect(first.titulo).toBe('Write the written case');
    expect(first.descricao).toBeNull();
    expect(first.status).toBe('todo');
    expect(first.dataCriacao).toBeInstanceOf(Date);
    // A task that was never edited carries the same timestamp in both fields.
    expect(first.dataAtualizacao).toEqual(first.dataCriacao);
  });

  it('keeps dataCriacao and bumps dataAtualizacao on update', async () => {
    const { caller } = createTestCaller();
    const created = await caller.tasks.create({ titulo: 'Started' });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await caller.tasks.update({ id: created.id, status: 'done' });

    expect(updated.dataCriacao.getTime()).toBe(created.dataCriacao.getTime());
    expect(updated.dataAtualizacao.getTime()).toBeGreaterThan(created.dataAtualizacao.getTime());
  });

  it('defaults the status to "todo" when it is omitted', async () => {
    const { caller } = createTestCaller();

    const task = await caller.tasks.create({ titulo: 'No status sent' });

    expect(task.status).toBe('todo');
  });

  it('rejects a title that is empty after trimming', async () => {
    const { caller } = createTestCaller();

    await expect(caller.tasks.create({ titulo: '   ' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('accepts the title limit and rejects one character more', async () => {
    const { caller } = createTestCaller();

    const atLimit = await caller.tasks.create({ titulo: 'x'.repeat(TITLE_MAX_LENGTH) });
    expect(atLimit.titulo).toHaveLength(TITLE_MAX_LENGTH);

    await expect(
      caller.tasks.create({ titulo: 'x'.repeat(TITLE_MAX_LENGTH + 1) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('accepts the description limit and rejects one character more', async () => {
    const { caller } = createTestCaller();

    const atLimit = await caller.tasks.create({
      titulo: 'Description boundary',
      descricao: 'y'.repeat(DESCRIPTION_MAX_LENGTH),
    });
    expect(atLimit.descricao).toHaveLength(DESCRIPTION_MAX_LENGTH);

    await expect(
      caller.tasks.create({
        titulo: 'Description boundary',
        descricao: 'y'.repeat(DESCRIPTION_MAX_LENGTH + 1),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects an unknown status', async () => {
    const { caller } = createTestCaller();

    await expect(
      // @ts-expect-error - the payload is intentionally outside the contract.
      caller.tasks.create({ titulo: 'Invalid status', status: 'archived' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('lists the newest task first', async () => {
    const { caller } = createTestCaller();

    await caller.tasks.create({ titulo: 'Oldest' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await caller.tasks.create({ titulo: 'Newest' });

    const page = await caller.tasks.list({});

    expect(page.items[0]?.titulo).toBe('Newest');
    expect(page.items.at(-1)?.titulo).toBe('Oldest');
  });

  it('paginates with a keyset cursor and reports the total', async () => {
    const { caller } = createTestCaller();

    for (let index = 0; index < 5; index += 1) {
      await caller.tasks.create({ titulo: `Task ${index}` });
    }

    const firstPage = await caller.tasks.list({ limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(5);
    expect(firstPage.nextCursor).not.toBeNull();
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

  it('falls back to the first page when the cursor is unknown', async () => {
    const { caller } = createTestCaller();

    for (let index = 0; index < 3; index += 1) {
      await caller.tasks.create({ titulo: `Task ${index}` });
    }

    const firstPage = await caller.tasks.list({ limit: 2 });
    const withUnknownCursor = await caller.tasks.list({ limit: 2, cursor: 'deleted-task-id' });

    expect(withUnknownCursor.items.map((task) => task.id)).toEqual(
      firstPage.items.map((task) => task.id),
    );
  });

  it('uses the default page size when the limit is omitted', async () => {
    const { caller } = createTestCaller({ seed: true });

    const page = await caller.tasks.list({});

    expect(page.items).toHaveLength(LIST_DEFAULT_LIMIT);
    expect(page.total).toBe(24);
  });

  it('rejects a page size outside the allowed range', async () => {
    const { caller } = createTestCaller();

    await expect(caller.tasks.list({ limit: 0 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller.tasks.list({ limit: 51 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
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

  it('trims the title on update', async () => {
    const { caller } = createTestCaller();
    const created = await caller.tasks.create({ titulo: 'Original' });

    const updated = await caller.tasks.update({ id: created.id, titulo: '  Updated  ' });

    expect(updated.titulo).toBe('Updated');
  });

  it('rejects an update without any field to change', async () => {
    const { caller } = createTestCaller();
    const created = await caller.tasks.create({ titulo: 'Untouched' });

    await expect(caller.tasks.update({ id: created.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects an empty task id', async () => {
    const { caller } = createTestCaller();

    await expect(caller.tasks.getById({ id: '' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('clears the description when an empty string is sent', async () => {
    const { caller } = createTestCaller();
    const created = await caller.tasks.create({
      titulo: 'Draft the ADR',
      descricao: 'Something',
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
    const created = await caller.tasks.create({ titulo: 'Temporary task' });

    await expect(caller.tasks.delete({ id: created.id })).resolves.toEqual({ id: created.id });
    await expect(caller.tasks.delete({ id: created.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(caller.tasks.getById({ id: created.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('does not let callers mutate the store through a returned task', async () => {
    const { caller } = createTestCaller();
    const created = await caller.tasks.create({ titulo: 'Immutable outside' });

    created.titulo = 'Hacked from the outside';

    const reloaded = await caller.tasks.getById({ id: created.id });

    expect(reloaded.titulo).toBe('Immutable outside');
  });

  it('ships the seeded tasks so the UI is never empty on first load', async () => {
    const { caller } = createTestCaller({ seed: true });

    const page = await caller.tasks.list({ limit: 50 });

    expect(page.total).toBe(24);
    expect(page.items).toHaveLength(24);
    expect(page.items.every((task) => task.dataCriacao instanceof Date)).toBe(true);
    expect(page.items.every((task) => task.dataAtualizacao instanceof Date)).toBe(true);
    expect(new Set(page.items.map((task) => task.id)).size).toBe(24);
  });
});

describe('task sorting', () => {
  async function createTask(
    caller: ReturnType<typeof createTestCaller>['caller'],
    titulo: string,
    overrides: { status?: 'todo' | 'in_progress' | 'done' } = {},
  ) {
    const task = await caller.tasks.create({ titulo, ...overrides });
    // Keep creation order distinct from title/status order in the assertions.
    await new Promise((resolve) => setTimeout(resolve, 2));
    return task;
  }

  it('sorts by creation in both directions', async () => {
    const { caller } = createTestCaller();
    await createTask(caller, 'Middle');
    await createTask(caller, 'Newest');
    await createTask(caller, 'Oldest');

    const newest = await caller.tasks.list({ sort: 'created-desc' });
    const oldest = await caller.tasks.list({ sort: 'created-asc' });

    expect(newest.items.map((task) => task.titulo)).toEqual(['Oldest', 'Newest', 'Middle']);
    expect(oldest.items.map((task) => task.titulo)).toEqual(['Middle', 'Newest', 'Oldest']);
  });

  it('throws when the sort is not one of the known values', async () => {
    const { caller } = createTestCaller();

    await expect(
      // @ts-expect-error - the payload is intentionally outside the contract.
      caller.tasks.list({ sort: 'alphabetical' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('defaults to the most recently created task first', async () => {
    const { caller } = createTestCaller();
    await createTask(caller, 'First');
    await createTask(caller, 'Second');

    const page = await caller.tasks.list({});

    expect(page.items.map((task) => task.titulo)).toEqual(['Second', 'First']);
  });

  it('sorts by edit time, putting the task edited last on top', async () => {
    const { caller } = createTestCaller();
    const untouched = await createTask(caller, 'Untouched');
    const edited = await createTask(caller, 'Edited');

    await new Promise((resolve) => setTimeout(resolve, 5));
    await caller.tasks.update({ id: untouched.id, status: 'done' });

    const page = await caller.tasks.list({ sort: 'updated-desc' });

    expect(page.items.map((task) => task.titulo)).toEqual(['Untouched', 'Edited']);
    // The edit moved the item without touching its creation timestamp.
    expect(page.items[0]?.dataCriacao.getTime()).toBeLessThan(edited.dataCriacao.getTime());
  });

  it('sorts by title ignoring case', async () => {
    const { caller } = createTestCaller();
    await createTask(caller, 'zebra');
    await createTask(caller, 'Apple');
    await createTask(caller, 'mango');

    const page = await caller.tasks.list({ sort: 'titulo-asc' });

    expect(page.items.map((task) => task.titulo)).toEqual(['Apple', 'mango', 'zebra']);
  });

  it('sorts by the workflow order of the status, not alphabetically', async () => {
    const { caller } = createTestCaller();
    await createTask(caller, 'Done task', { status: 'done' });
    await createTask(caller, 'In progress task', { status: 'in_progress' });
    await createTask(caller, 'To do task', { status: 'todo' });

    const page = await caller.tasks.list({ sort: 'status-asc' });

    expect(page.items.map((task) => task.status)).toEqual(['todo', 'in_progress', 'done']);
  });

  it('paginates in the requested order without repeating an item', async () => {
    const { caller } = createTestCaller();
    for (const title of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) {
      await createTask(caller, title);
    }

    const firstPage = await caller.tasks.list({ limit: 2, sort: 'created-asc' });
    const secondPage = await caller.tasks.list({
      limit: 2,
      sort: 'created-asc',
      cursor: firstPage.nextCursor ?? '',
    });
    const thirdPage = await caller.tasks.list({
      limit: 2,
      sort: 'created-asc',
      cursor: secondPage.nextCursor ?? '',
    });

    const titles = [...firstPage.items, ...secondPage.items, ...thirdPage.items].map(
      (task) => task.titulo,
    );

    expect(titles).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    expect(thirdPage.nextCursor).toBeNull();
  });

  it('orders seeded tasks differently by creation and by edit', async () => {
    const { caller } = createTestCaller({ seed: true });

    const byCreation = await caller.tasks.list({ limit: 50, sort: 'created-desc' });
    const byEdition = await caller.tasks.list({ limit: 50, sort: 'updated-desc' });

    expect(byCreation.items.map((task) => task.id)).not.toEqual(
      byEdition.items.map((task) => task.id),
    );
  });
});
