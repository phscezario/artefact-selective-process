import { describe, expect, it } from 'vitest';
import {
  createTaskInput,
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '@artefact/backend/schemas';
import { toFieldErrors } from './form-errors';

function errorsFor(payload: unknown) {
  const result = createTaskInput.safeParse(payload);

  if (result.success) {
    throw new Error('Expected the payload to be rejected.');
  }

  return toFieldErrors(result.error);
}

describe('toFieldErrors', () => {
  it('maps every rejected field to its own message', () => {
    const fieldErrors = errorsFor({
      titulo: '   ',
      descricao: 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1),
      status: 'archived',
    });

    expect(fieldErrors.titulo).toBe('Title is required.');
    expect(fieldErrors.descricao).toBe(
      `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters.`,
    );
    expect(fieldErrors.status).toBeDefined();
  });

  it('reports the title limit the form advertises', () => {
    const fieldErrors = errorsFor({ titulo: 'x'.repeat(TITLE_MAX_LENGTH + 1) });

    expect(fieldErrors.titulo).toBe(`Title must be at most ${TITLE_MAX_LENGTH} characters.`);
  });

  it('accepts the limits themselves', () => {
    const result = createTaskInput.safeParse({
      titulo: 'x'.repeat(TITLE_MAX_LENGTH),
      descricao: 'y'.repeat(DESCRIPTION_MAX_LENGTH),
    });

    expect(result.success).toBe(true);
  });
});
