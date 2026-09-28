'use client';

import { useFormStatus } from 'react-dom';

/** Submit button with the design's loading state ("Guardando…" + spinner). */
export function SubmitButton({
  children,
  pendingLabel,
  className = 'btn btn-primary btn-block',
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={disabled || pending} aria-busy={pending} {...rest}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
