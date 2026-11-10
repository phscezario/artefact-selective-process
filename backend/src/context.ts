import { InMemoryTaskRepository, type TaskRepository } from './modules/tasks/task.repository';

export interface Context {
  taskRepository: TaskRepository;
}

export interface CreateContextOptions {
  /** Request headers, available for an auth layer to resolve the session from. */
  headers?: Headers;
  /** Allows tests (or a different composition root) to inject another adapter. */
  taskRepository?: TaskRepository;
}

interface GlobalWithTaskRepository {
  __artefactTaskRepository?: TaskRepository;
}

const globalScope = globalThis as unknown as GlobalWithTaskRepository;

function getTaskRepository(): TaskRepository {
  // Next.js discards the module cache on hot reload. Keeping the store on `globalThis`
  // means the in-memory data survives a dev reload instead of resetting on every edit.
  globalScope.__artefactTaskRepository ??= new InMemoryTaskRepository();
  return globalScope.__artefactTaskRepository;
}

/**
 * Builds the context for a request. Nothing here is Next-specific: the same function
 * can be used by a server component, a test or a standalone HTTP adapter.
 */
export async function createContext(options: CreateContextOptions = {}): Promise<Context> {
  return {
    taskRepository: options.taskRepository ?? getTaskRepository(),
  };
}
