'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] unexpected error', error);
  }, [error]);

  return (
    <div className="page">
      <div className="error-state" role="alert">
        <h1>Something went wrong</h1>
        <p>{error.message || 'An unexpected error interrupted the page.'}</p>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
