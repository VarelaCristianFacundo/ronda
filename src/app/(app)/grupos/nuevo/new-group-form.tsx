'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { FieldError } from '@/components/ui';
import { CURRENCIES, CURRENCY_CODES } from '@/lib/money';
import { createGroup, type FormState } from '../actions';

export function NewGroupForm() {
  const [state, action] = useActionState<FormState, FormData>(createGroup, {});
  const nameError = state.fieldErrors?.name;
  return (
    <form action={action} className="content stack gap-22 has-bottom-bar" style={{ paddingTop: 8 }}>
      <h1 className="t-h1">¿Para qué es el grupo?</h1>
      <div className="field">
        <label className="field-label" htmlFor="name">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          className="input"
          maxLength={60}
          required
          autoFocus
          placeholder="Ej: Bariloche ’26, Depto Palermo"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'name-error' : undefined}
        />
        {nameError && <FieldError id="name-error">{nameError}</FieldError>}
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label" style={{ marginBottom: 6 }}>
          Moneda del grupo
        </legend>
        <div className="segmented" role="radiogroup">
          {CURRENCY_CODES.map((c, i) => (
            <label key={c}>
              <input type="radio" name="currency" value={c} defaultChecked={i === 0} />
              {c} {CURRENCIES[c].symbol}
            </label>
          ))}
        </div>
        <span className="field-hint">
          Todos los gastos del grupo van en esta moneda. Se puede cambiar hasta que cargues el primer movimiento.
        </span>
      </fieldset>
      {state.error && !nameError && (
        <div className="alert" role="alert">
          <span className="bang" aria-hidden="true">
            !
          </span>
          {state.error}
        </div>
      )}
      <div className="actionbar on-surface">
        <SubmitButton pendingLabel="Creando…">Crear grupo</SubmitButton>
      </div>
    </form>
  );
}
