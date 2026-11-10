import { randomUUID } from 'node:crypto';
import { buildSeedTasks } from './task.seed';
import { TASK_STATUS_ORDER } from './task.constants';
import type { Task, TaskPage, TaskSort, TaskStatus } from './task.schema';

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
  list(input: { cursor?: string | undefined; limit: number; sort: TaskSort }): Promise<TaskPage>;
  findById(id: string): Promise<Task | null>;
  create(data: CreateTaskData): Promise<Task>;
  update(id: string, data: UpdateTaskData): Promise<Task | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * `localeCompare` depends on the runtime's ICU data, so the collator is created
 * once with an explicit locale instead of trusting the process default.
 */
const titleCollator = new Intl.Collator('en', { sensitivity: 'base' });

/**
 * Total order for every supported sort. The id is the tiebreaker: without it two
 * tasks with the same timestamp could swap places between two page requests.
 */
function compareTasks(sort: TaskSort) {
  switch (sort) {
    case 'created-asc':
      return (first: Task, second: Task) =>
        first.dataCriacao.getTime() - second.dataCriacao.getTime() ||
        first.id.localeCompare(second.id);
    case 'updated-desc':
      return (first: Task, second: Task) =>
        second.dataAtualizacao.getTime() - first.dataAtualizacao.getTime() ||
        first.id.localeCompare(second.id);
    case 'titulo-asc':
      return (first: Task, second: Task) =>
        titleCollator.compare(first.titulo, second.titulo) || first.id.localeCompare(second.id);
    case 'status-asc':
      return (first: Task, second: Task) =>
        TASK_STATUS_ORDER[first.status] - TASK_STATUS_ORDER[second.status] ||
        second.dataAtualizacao.getTime() - first.dataAtualizacao.getTime() ||
        first.id.localeCompare(second.id);
    case 'created-desc':
    default:
      return (first: Task, second: Task) =>
        second.dataCriacao.getTime() - first.dataCriacao.getTime() ||
        first.id.localeCompare(second.id);
  }
}

/**
 * In-memory adapter kept as a single instance per process.
 * Tasks are stored newest-first and paginated by keyset (`cursor` = previous page's
 * last id), which stays correct when items are deleted between requests - an
 * offset-based `take/skip` would skip a row in that scenario.
 */
export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks: Task[];

  constructor(initialTasks: Task[] = buildSeedTasks()) {
    this.tasks = [...initialTasks].sort(compareTasks('created-desc'));
  }

  async list({
    cursor,
    limit,
    sort,
  }: {
    cursor?: string | undefined;
    limit: number;
    sort: TaskSort;
  }): Promise<TaskPage> {
    // The store keeps its own order; the requested one is materialised per call so
    // an update does not have to move items around in the backing array.
    const ordered = [...this.tasks].sort(compareTasks(sort));
    const cursorIndex = cursor ? ordered.findIndex((task) => task.id === cursor) : -1;
    // An unknown cursor restarts from the first page instead of failing the request.
    const start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    // Copies on the way out: a caller mutating a returned task must not rewrite the store.
    const items = ordered.slice(start, start + limit).map((task) => ({ ...task }));
    const lastItem = items.at(-1);
    const hasMore = start + items.length < ordered.length;

    return {
      items,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      total: ordered.length,
    };
  }

  async findById(id: string): Promise<Task | null> {
    const task = this.tasks.find((candidate) => candidate.id === id);
    return task ? { ...task } : null;
  }

  async create(data: CreateTaskData): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: randomUUID(),
      titulo: data.titulo,
      descricao: data.descricao,
      status: data.status,
      dataCriacao: now,
      dataAtualizacao: now,
    };

    this.tasks.unshift(task);
    return { ...task };
  }

  async update(id: string, data: UpdateTaskData): Promise<Task | null> {
    const index = this.tasks.findIndex((task) => task.id === id);
    const current = index >= 0 ? this.tasks[index] : undefined;

    if (!current) {
      return null;
    }

    const updated: Task = {
      ...current,
      titulo: data.titulo ?? current.titulo,
      descricao: data.descricao !== undefined ? data.descricao : current.descricao,
      status: data.status ?? current.status,
      // `dataCriacao` is history and never changes; the edit timestamp does.
      dataAtualizacao: new Date(),
    };

    this.tasks[index] = updated;
    return { ...updated };
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
