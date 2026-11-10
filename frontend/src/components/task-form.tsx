'use client';

import { useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  taskStatusSchema,
} from '@artefact/backend/schemas';
import { useTaskForm } from '@/lib/hooks/use-task-form';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import { STATUS_OPTIONS } from '@/lib/tasks';
import { useTRPC } from '@/lib/trpc/client';
import { useToast } from '@/components/toast';
import type { TaskFormValues } from '@/lib/form';

type TaskFormProps =
  | { mode: 'create'; initialValues?: Partial<TaskFormValues> }
  | { mode: 'edit'; taskId: string; initialValues: Partial<TaskFormValues> };

export function TaskForm(props: TaskFormProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toast = useToast();
  const fieldId = useId();

  const { values, fieldErrors, setField, setFieldErrors, validate } = useTaskForm(
    props.initialValues,
  );

  const createTask = useMutation(trpc.tasks.create.mutationOptions());
  const updateTask = useMutation(trpc.tasks.update.mutationOptions());

  // Derived, not stored: a second source of truth for "am I saving?" drifts.
  const isSubmitting = createTask.isPending || updateTask.isPending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const payload = validate();

    if (!payload) {
      toast.error('Please fix the highlighted fields before saving.');
      return;
    }

    try {
      if (props.mode === 'edit') {
        await updateTask.mutateAsync({ id: props.taskId, ...payload });
        toast.success('Task updated successfully.');
      } else {
        await createTask.mutateAsync(payload);
        toast.success('Task created successfully.');
      }

      // Drop the cached pages so the list reflects the change immediately. No input
      // means every cached order is invalidated, not only the one on screen.
      await queryClient.invalidateQueries({
        queryKey: trpc.tasks.list.infiniteQueryKey(),
      });

      // `/` is force-dynamic, so navigating re-renders the server component with
      // fresh data; a `router.refresh()` here would be the same request twice.
      router.push('/');
    } catch (submitError) {
      // The server is the source of truth: if it rejects a field, mirror it in the form.
      const serverFieldErrors = getFieldErrors(submitError);

      if (serverFieldErrors) {
        setFieldErrors(serverFieldErrors);
      }

      toast.error(getErrorMessage(submitError));
    }
  }

  const titleError = fieldErrors.titulo;
  const descriptionError = fieldErrors.descricao;

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label className="field-label" htmlFor={`${fieldId}-titulo`}>
          Title <span className="required">*</span>
        </label>
        <input
          id={`${fieldId}-titulo`}
          name="titulo"
          className={`input ${titleError ? 'input-invalid' : ''}`}
          value={values.titulo}
          onChange={(event) => setField('titulo', event.target.value)}
          placeholder="e.g. Review the Q3 revenue dashboard"
          maxLength={TITLE_MAX_LENGTH}
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? `${fieldId}-titulo-error` : `${fieldId}-titulo-hint`}
          autoComplete="off"
          required
        />
        {titleError ? (
          <p className="field-error" id={`${fieldId}-titulo-error`} role="alert">
            {titleError}
          </p>
        ) : (
          <p className="field-hint" id={`${fieldId}-titulo-hint`}>
            Required, up to {TITLE_MAX_LENGTH} characters.
          </p>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${fieldId}-descricao`}>
          Description
        </label>
        <textarea
          id={`${fieldId}-descricao`}
          name="descricao"
          className={`textarea ${descriptionError ? 'input-invalid' : ''}`}
          value={values.descricao}
          onChange={(event) => setField('descricao', event.target.value)}
          placeholder="Optional context, next steps, links…"
          maxLength={DESCRIPTION_MAX_LENGTH}
          rows={5}
          aria-invalid={Boolean(descriptionError)}
          aria-describedby={
            descriptionError ? `${fieldId}-descricao-error` : `${fieldId}-descricao-hint`
          }
        />
        {descriptionError ? (
          <p className="field-error" id={`${fieldId}-descricao-error`} role="alert">
            {descriptionError}
          </p>
        ) : (
          <p className="field-hint" id={`${fieldId}-descricao-hint`}>
            Optional · {values.descricao.length}/{DESCRIPTION_MAX_LENGTH} characters
          </p>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${fieldId}-status`}>
          Status
        </label>
        <select
          id={`${fieldId}-status`}
          name="status"
          className="select"
          value={values.status}
          onChange={(event) => {
            // A `<select>` gives back a string; parse it instead of casting so an
            // unexpected option can never enter the form model.
            const parsed = taskStatusSchema.safeParse(event.target.value);

            if (parsed.success) {
              setField('status', parsed.data);
            }
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-actions">
        <Link href="/" className="btn btn-ghost">
          Cancel
        </Link>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : props.mode === 'edit' ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </form>
  );
}
