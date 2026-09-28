'use client';

import { useActionState, useRef, useState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { sendMagicLink, type SignInState } from '../actions';

export function EmailForm({ next, defaultEmail, initialError }: { next: string; defaultEmail: string; initialError?: string }) {
  const [state, action] = useActionState<SignInState, FormData>(sendMagicLink, { error: initialError, email: defaultEmail });
  const [value, setValue] = useState(defaultEmail);
  const inputRef = useRef<HTMLInputElement>(null);
  // Hide the error once the user edits the address it was about.
  const error = state.error && (state.email === undefined || state.email === value) ? state.error : undefined;

  return (
    <form action={action} className="stack gap-22" noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="field" role={error ? 'alert' : undefined}>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          ref={inputRef}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="input"
          style={{ height: 54, fontSize: 17 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'email-error' : undefined}
          placeholder="nombre@email.com"
        />
        {error && (
          <span className="field-error" id="email-error">
            <span className="bang" aria-hidden="true">
              !
            </span>
            <span>
              {error}
              {state.suggestion && state.email === value && (
                <>
                  {' '}
                  ¿Quisiste decir{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setValue(state.suggestion!);
                      inputRef.current?.focus();
                    }}
                    style={{
                      border: 0,
                      background: 'none',
                      padding: 0,
                      font: 'inherit',
                      fontWeight: 700,
                      color: 'inherit',
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                    }}
                  >
                    {state.suggestion}
                  </button>
                  ?
                </>
              )}
            </span>
          </span>
        )}
      </div>
      <SubmitButton pendingLabel="Mandando…" style={{ fontSize: 17 }}>
        Mandame el link
      </SubmitButton>
    </form>
  );
}
