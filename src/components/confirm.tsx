'use client';

import { useId, useRef, useState, useTransition } from 'react';

/**
 * Button that opens a confirmation dialog (native <dialog>: focus trap, Esc to close).
 * The red fill only appears on the confirmation step, as the design system specifies.
 */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  onConfirm,
  className = 'btn btn-destructive btn-block',
  tone = 'destructive',
  children,
}: {
  label: React.ReactNode;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: (extra: { reason: string }) => Promise<string | null | void>; // returns an error message
  className?: string;
  tone?: 'destructive' | 'primary';
  children?: React.ReactNode; // optional extra fields, e.g. a reason
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={() => setError(null)}>
        <form
          method="dialog"
          className="stack gap-18"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get('reason') ?? '');
            start(async () => {
              const err = await onConfirm({ reason });
              if (err) setError(err);
              else ref.current?.close();
            });
          }}
        >
          <h2 id={titleId} style={{ font: '500 26px/1.1 var(--font-display)' }}>
            {title}
          </h2>
          <div className="t-body-sm">{body}</div>
          {children}
          {error && (
            <div className="alert" role="alert">
              <span className="bang" aria-hidden="true">
                !
              </span>
              {error}
            </div>
          )}
          <div className="hstack gap-10" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              Cancelar
            </button>
            <button type="submit" className={`btn ${tone === 'destructive' ? 'btn-destructive-solid' : 'btn-primary'}`} disabled={pending}>
              {pending && <span className="spinner" aria-hidden="true" />}
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
