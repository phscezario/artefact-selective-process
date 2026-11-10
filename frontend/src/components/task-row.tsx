'use client';

import Link from 'next/link';
import type { Task } from '@artefact/backend/schemas';
import { STATUS_LABELS, formatDateTime, toIsoString } from '@/lib/tasks';

interface TaskRowProps {
  task: Task;
  isConfirming: boolean;
  isDeleting: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

export function TaskRow({
  task,
  isConfirming,
  isDeleting,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: TaskRowProps) {
  // A task that was never edited has the same timestamp in both fields; showing
  // "updated" for it would only add noise.
  const wasEdited = task.dataAtualizacao.getTime() !== task.dataCriacao.getTime();

  return (
    <li className="task-row">
      <div className="task-body">
        <div className="task-heading">
          <h3 className="task-title">{task.titulo}</h3>
          <span className={`badge badge-${task.status}`}>{STATUS_LABELS[task.status]}</span>
        </div>

        {task.descricao ? (
          <p className="task-description">{task.descricao}</p>
        ) : (
          <p className="task-description task-description-empty">No description</p>
        )}

        <p className="task-meta">
          Created{' '}
          <time dateTime={toIsoString(task.dataCriacao)}>{formatDateTime(task.dataCriacao)}</time>
          {wasEdited ? (
            <>
              {' · updated '}
              <time dateTime={toIsoString(task.dataAtualizacao)}>
                {formatDateTime(task.dataAtualizacao)}
              </time>
            </>
          ) : null}
        </p>
      </div>

      <div className="task-actions">
        {isConfirming ? (
          <>
            <span className="confirm-question">Delete?</span>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={onConfirmDelete}
              disabled={isDeleting}
              aria-busy={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Confirm'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onCancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <Link className="btn btn-ghost btn-sm" href={`/tasks/${task.id}/edit`}>
              Edit
            </Link>
            <button
              type="button"
              className="btn btn-danger-outline btn-sm"
              onClick={onRequestDelete}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
