import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <span className="empty-icon" aria-hidden="true">
          ?
        </span>
        <h1>Task not found</h1>
        <p>It may have been deleted by someone else. The list below is always up to date.</p>
        <Link href="/" className="btn btn-primary">
          Back to tasks
        </Link>
      </div>
    </div>
  );
}
