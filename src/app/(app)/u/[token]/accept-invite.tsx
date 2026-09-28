'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert } from '@/components/ui';
import { acceptInvite } from '../../grupos/actions';

/**
 * Join as a new member, or claim a slot someone already created for you (so the expenses
 * already assigned to that name become yours).
 */
export function AcceptInvite({ token, claimable }: { token: string; claimable: { id: string; display_name: string }[] }) {
  const [choice, setChoice] = useState<string>('new');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="stack gap-16"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await acceptInvite(token, choice === 'new' ? null : choice);
          if (!r.ok) return setError(r.error);
          router.replace(`/grupos/${r.data.groupId}`);
        });
      }}
    >
      {claimable.length > 0 && (
        <fieldset className="stack gap-8" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label" style={{ marginBottom: 6 }}>
            ¿Ya te anotaron en el grupo?
          </legend>
          <p className="t-caption" style={{ marginBottom: 4 }}>
            Si alguno de estos nombres sos vos, elegilo y te quedás con sus gastos.
          </p>
          {claimable.map((c) => (
            <label key={c.id} className="chip" style={{ justifyContent: 'flex-start', height: 48 }}>
              <input type="radio" name="claim" value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} />
              Soy {c.display_name}
            </label>
          ))}
          <label className="chip" style={{ justifyContent: 'flex-start', height: 48 }}>
            <input type="radio" name="claim" value="new" checked={choice === 'new'} onChange={() => setChoice('new')} />
            No, entro como alguien nuevo
          </label>
        </fieldset>
      )}
      {error && <Alert>{error}</Alert>}
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? 'Entrando…' : 'Unirme al grupo'}
      </button>
    </form>
  );
}
