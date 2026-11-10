'use client';

import { useState } from 'react';
import { createTaskInput } from '@artefact/backend/schemas';
import { toFieldErrors } from '@/lib/form-errors';
import type { TaskFieldErrors, TaskFormValues } from '@/lib/form';

/**
 * Small form state machine: values and per-field errors.
 * Validation reuses the exact schema the tRPC procedure uses, so the client can
 * only accept what the server would accept. The submitting state is not stored
 * here: it already lives on the mutations, and a second copy drifts.
 */
export function useTaskForm(initialValues?: Partial<TaskFormValues>) {
  const [values, setValues] = useState<TaskFormValues>({
    titulo: '',
    descricao: '',
    status: 'todo',
    ...initialValues,
  });
  const [fieldErrors, setFieldErrors] = useState<TaskFieldErrors>({});

  function setField<Field extends keyof TaskFormValues>(
    field: Field,
    value: TaskFormValues[Field],
  ): void {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  /** Returns the normalised payload, or `null` when the form is invalid. */
  function validate(): TaskFormValues | null {
    const result = createTaskInput.safeParse(values);

    if (!result.success) {
      setFieldErrors(toFieldErrors(result.error));
      return null;
    }

    setFieldErrors({});

    return {
      titulo: result.data.titulo,
      descricao: result.data.descricao ?? '',
      status: result.data.status,
    };
  }

  return {
    values,
    fieldErrors,
    setField,
    setFieldErrors,
    validate,
  };
}
