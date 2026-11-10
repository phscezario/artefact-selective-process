'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type ToastTone = 'success' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success(message: string): void;
  error(message: string): void;
}

const TOAST_DURATION_MS = 4500;

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }

  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current;
      nextId.current += 1;

      setToasts((current) => [...current, { id, tone, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      );
    },
    [dismiss],
  );

  // Pending timers would otherwise outlive the provider (route change, unmount)
  // and call `setToasts` on a component that no longer exists.
  useEffect(() => {
    const pendingTimers = timers.current;

    return () => {
      for (const timer of pendingTimers.values()) {
        clearTimeout(timer);
      }

      pendingTimers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.tone}`}
            // `alert` is assertive and `status` is polite; the container must not
            // declare a live region of its own or screen readers announce twice.
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <span className="toast-icon" aria-hidden="true">
              {toast.tone === 'success' ? '✓' : '!'}
            </span>
            <p className="toast-message">{toast.message}</p>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
