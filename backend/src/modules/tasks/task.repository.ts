import { randomUUID } from 'node:crypto';
import { buildSeedTasks } from './task.seed';
import type { Task, TaskPage, TaskStatus } from './task.schema';

export interface CreateTaskData {
  titulo: string;
  descricao: string | null;
  status: TaskStatus;
}

export interface UpdateTaskData {
  titulo?: string;
  descricao?: string | null;
  status?: TaskStatus;
}

/**
 * Port of the domain. The in-memory implementation is a detail: swapping it for
 * Postgres/Redis only requires another class with the same contract, which is
 * why every method is async even though the current one resolves immediately.
 */
export interface TaskRepository {
  list(input: { cursor?: string | undefined; limit: number }): Promise<TaskPage>;
  findById(id: string): Promise<Task | null>;
  create(data: CreateTaskData): Promise<Task>;
  update(id: string, data: UpdateTaskData): Promise<Task | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * In-memory adapter kept as a single instance per process.
 * Tasks are ordered newest-first and paginated by keyset (`cursor` = previous page's
 * last id), which stays correct when items are deleted between requests - an
 * offset-based `take/skip` would skip a row in that scenario.
 */
export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks: Task[];

  constructor(initialTasks: Task[] = buildSeedTasks()) {
    this.tasks = [...initialTasks].sort(
      (first, second) => second.dataCriacao.getTime() - first.dataCriacao.getTime(),
    );
  }

  async list({ cursor, limit }: { cursor?: string | undefined; limit: number }): Promise<TaskPage> {
    const cursorIndex = cursor ? this.tasks.findIndex((task) => task.id === cursor) : -1;
    // An unknown cursor restarts from the first page instead of failing the request.
    const start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    const items = this.tasks.slice(start, start + limit);
    const lastItem = items.at(-1);
    const hasMore = start + items.length < this.tasks.length;

    return {
      items,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      total: this.tasks.length,
    };
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.find((task) => task.id === id) ?? null;
  }

  async create(data: CreateTaskData): Promise<Task> {
    const task: Task = {
      id: randomUUID(),
      titulo: data.titulo,
      descricao: data.descricao,
      status: data.status,
      dataCriacao: new Date(),
    };

    this.tasks.unshift(task);
    return task;
  }

  async update(id: string, data: UpdateTaskData): Promise<Task | null> {
    const index = this.tasks.findIndex((task) => task.id === id);
    const current = this.tasks[index];

    if (!current) {
      return null;
    }

    const updated: Task = {
      ...current,
      titulo: data.titulo ?? current.titulo,
      descricao: data.descricao !== undefined ? data.descricao : current.descricao,
      status: data.status ?? current.status,
    };

    this.tasks[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.tasks.findIndex((task) => task.id === id);

    if (index === -1) {
      return false;
    }

    this.tasks.splice(index, 1);
    return true;
  }
}
