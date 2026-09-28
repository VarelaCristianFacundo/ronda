'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckIcon } from './icons';

type Toast = {
  id: number;
  message: string;
  tone: 'ok' | 'error';
  action?: { label: string; onClick: () => void | Promise<void> };
};

type ToastInput = Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone']; durationMs?: number };

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Single toast at a time, announced politely, 6 s by default (the undo window). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const show = useCallback((t: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    seq.current += 1;
    setToast({ id: seq.current, message: t.message, tone: t.tone ?? 'ok', action: t.action });
    timer.current = setTimeout(() => setToast(null), t.durationMs ?? 6000);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            {toast.tone === 'ok' ? (
              <span className="toast-icon" aria-hidden="true">
                <CheckIcon size={14} color="var(--ink)" />
              </span>
            ) : (
              <span className="toast-icon is-error" aria-hidden="true">
                !
              </span>
            )}
            <span style={{ flex: 1 }}>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={async () => {
                  const action = toast.action;
                  setToast(null);
                  await action?.onClick();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
