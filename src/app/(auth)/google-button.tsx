'use client';

import { useFormStatus } from 'react-dom';

export function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary btn-block" style={{ fontSize: 17, gap: 10 }} disabled={pending}>
      {pending ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '1.5px solid var(--ink)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: '700 12px/1 var(--font-ui)',
          }}
        >
          G
        </span>
      )}
      Continuar con Google
    </button>
  );
}
