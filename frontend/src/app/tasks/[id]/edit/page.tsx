import { TRPCError } from '@trpc/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TaskForm } from '@/components/task-form';
import { caller } from '@/lib/trpc/server';

interface EditTaskPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTaskPage({ params }: EditTaskPageProps) {
  const { id } = await params;

  try {
    const task = await caller.tasks.getById({ id });

    return (
      <div className="page page-narrow">
        <div className="page-heading">
          <Link href="/" className="back-link">
            ← Back to tasks
          </Link>
          <h1 className="page-title">Edit task</h1>
          <p className="page-subtitle">
            Changes are saved through the tRPC mutation and the list is revalidated on the way back.
          </p>
        </div>

        <TaskForm
          mode="edit"
          taskId={task.id}
          initialValues={{
            titulo: task.titulo,
            descricao: task.descricao ?? '',
            status: task.status,
          }}
        />
      </div>
    );
  } catch (error) {
    // A task can disappear between the navigation and this render (another tab deleted it).
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') {
      notFound();
    }

    throw error;
  }
}
