'use client';

import { useActionState, useEffect } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { FieldError } from '@/components/ui';
import { useToast } from '@/components/toast';
import { updateProfile, type ProfileState } from './actions';

export function ProfileForm({ name, alias }: { name: string; alias: string }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfile, {});
  const toast = useToast();
  useEffect(() => {
    if (state.saved) toast({ message: 'Guardamos tus datos.' });
  }, [state.saved, toast]);

  return (
    <form action={action} className="stack gap-16">
      <div className="field">
        <label className="field-label" htmlFor="name">
          Tu nombre
        </label>
        <input id="name" name="name" className="input" defaultValue={name} maxLength={60} required aria-invalid={state.fieldErrors?.name ? true : undefined} />
        {state.fieldErrors?.name && <FieldError>{state.fieldErrors.name}</FieldError>}
        <span className="field-hint">Así te ven en todos tus grupos.</span>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="alias">
          Alias para recibir (opcional)
        </label>
        <input
          id="alias"
          name="alias"
          className="input"
          defaultValue={alias}
          maxLength={60}
          autoCapitalize="none"
          spellCheck={false}
          placeholder="tu.alias.banco"
          style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}
          aria-invalid={state.fieldErrors?.alias ? true : undefined}
        />
        {state.fieldErrors?.alias && <FieldError>{state.fieldErrors.alias}</FieldError>}
        <span className="field-hint">Lo ven quienes comparten un grupo con vos, para transferirte.</span>
      </div>
      {state.error && !state.fieldErrors && <FieldError>{state.error}</FieldError>}
      <SubmitButton pendingLabel="Guardando…" className="btn btn-primary btn-block">
        Guardar
      </SubmitButton>
    </form>
  );
}
