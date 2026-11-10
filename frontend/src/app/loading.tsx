export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <div className="page-heading">
        <div className="skeleton skeleton-line skeleton-line-sm" />
        <div className="skeleton skeleton-line skeleton-line-lg" />
        <div className="skeleton skeleton-line" />
      </div>

      <ul className="task-list">
        {Array.from({ length: 4 }).map((_, index) => (
          <li className="task-row" key={index}>
            <div className="task-body">
              <div className="skeleton skeleton-line skeleton-line-md" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line skeleton-line-sm" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
