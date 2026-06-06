import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
  type ReactNode,
} from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// Errors linger longer than successes so they can be read before auto-dismiss.
const DURATION_MS: Record<ToastType, number> = { success: 4000, info: 4000, error: 6000 };
const ICON: Record<ToastType, string> = { success: '✓', error: '✕', info: 'ℹ' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => dismiss(id), DURATION_MS[type]);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            role="alert"
            onClick={() => dismiss(t.id)}
          >
            <span className="toast-icon">{ICON[t.type]}</span>
            <span className="toast-msg">{t.message}</span>
            <span className="toast-close" aria-hidden="true">×</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
