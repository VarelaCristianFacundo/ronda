'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendMagicLink, type SignInState } from '../../actions';

const WAIT_SECONDS = 60;

function ResendButton({ remaining }: { remaining: number }) {
  const { pending } = useFormStatus();
  const waiting = remaining > 0;
  const label = pending
    ? 'Enviando…'
    : waiting
      ? `Reenviar en ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
      : 'Reenviar link';
  return (
    <button type="submit" className="btn btn-secondary btn-block" disabled={waiting || pending} aria-live="polite">
      {pending && <span className="spinner" aria-hidden="true" />}
      {label}
    </button>
  );
}

export function ResendForm({ email, next }: { email: string; next: string }) {
  const [state, action] = useActionState<SignInState, FormData>(sendMagicLink, {});
  const [remaining, setRemaining] = useState(WAIT_SECONDS);

  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <form action={action} className="stack gap-8">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="resend" value="1" />
      <ResendButton remaining={remaining} />
      {state.error && (
        <span className="field-error" role="alert">
          <span className="bang" aria-hidden="true">
            !
          </span>
          {state.error}
        </span>
      )}
    </form>
  );
}
