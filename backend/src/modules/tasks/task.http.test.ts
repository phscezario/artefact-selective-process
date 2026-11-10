import { afterEach, describe, expect, it, vi } from 'vitest';
import superjson from 'superjson';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../router';
import { createTRPCRouter, publicProcedure } from '../../trpc';
import { InMemoryTaskRepository } from './task.repository';

/**
 * The router tests call the caller directly, which bypasses the transformer and the
 * error formatter. These tests go through the same adapter the app mounts, so the
 * two promises the README makes - `Date` on the wire and `fieldErrors` in the
 * payload - are actually covered.
 */
function createHandler(repository = new InMemoryTaskRepository([])) {
  return (request: Request) =>
    fetchRequestHandler({
      endpoint: '/api/trpc',
      req: request,
      router: appRouter,
      createContext: () => ({ taskRepository: repository }),
    });
}

function post(handler: ReturnType<typeof createHandler>, path: string, input: unknown) {
  return handler(
    new Request(`http://localhost/api/trpc/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(superjson.serialize(input)),
    }),
  );
}

interface WireSuccess {
  result: { data: unknown };
}

interface WireError {
  error: {
    json: {
      message: string;
      data: { code: string; stack?: string | null; fieldErrors?: unknown };
    };
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('tasks HTTP adapter', () => {
  it('keeps dataCriacao and dataAtualizacao as real Dates across the wire', async () => {
    const handler = createHandler();

    const response = await post(handler, 'tasks.create', { titulo: '  Wire me  ' });
    const body = (await response.json()) as WireSuccess;

    expect(response.status).toBe(200);

    const payload = superjson.deserialize(body.result.data as never) as {
      titulo: string;
      dataCriacao: unknown;
      dataAtualizacao: unknown;
    };

    expect(payload.titulo).toBe('Wire me');
    expect(payload.dataCriacao).toBeInstanceOf(Date);
    expect(payload.dataAtualizacao).toBeInstanceOf(Date);
  });

  it('returns BAD_REQUEST with per-field errors for invalid input', async () => {
    const handler = createHandler();

    const response = await post(handler, 'tasks.create', { titulo: '   ' });
    const body = (await response.json()) as WireError;

    expect(response.status).toBe(400);
    expect(body.error.json.data.code).toBe('BAD_REQUEST');
    expect(body.error.json.data.fieldErrors).toEqual({ titulo: 'Title is required.' });
  });

  it('maps a missing task to NOT_FOUND', async () => {
    const handler = createHandler();

    const response = await post(handler, 'tasks.delete', { id: 'missing-id' });
    const body = (await response.json()) as WireError;

    expect(response.status).toBe(404);
    expect(body.error.json.data.code).toBe('NOT_FOUND');
  });

  it('hides the message and the stack of an unexpected error in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const explodingRouter = createTRPCRouter({
      boom: publicProcedure.query(() => {
        throw new Error('connection string postgres://admin:hunter2@db');
      }),
    });

    const response = await fetchRequestHandler({
      endpoint: '/api/trpc',
      req: new Request('http://localhost/api/trpc/boom'),
      router: explodingRouter,
      createContext: () => ({ taskRepository: new InMemoryTaskRepository([]) }),
    });
    const body = (await response.json()) as WireError;

    expect(response.status).toBe(500);
    expect(body.error.json.message).toBe('Internal server error');
    // superjson turns the omitted stack into `null`, so either way it is not shipped.
    expect(body.error.json.data.stack ?? null).toBeNull();
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});
