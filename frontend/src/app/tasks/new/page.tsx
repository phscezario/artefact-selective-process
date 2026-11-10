import Link from 'next/link';
import { TaskForm } from '@/components/task-form';

export default function NewTaskPage() {
  return (
    <div className="page page-narrow">
      <div className="page-heading">
        <Link href="/" className="back-link">
          ← Back to tasks
        </Link>
        <h1 className="page-title">New task</h1>
        <p className="page-subtitle">
          Title is required. The form validates with the same schema the API uses, then the server
          validates it again.
        </p>
      </div>

      <TaskForm mode="create" />
    </div>
  );
}
