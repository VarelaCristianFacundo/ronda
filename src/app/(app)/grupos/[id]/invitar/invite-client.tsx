'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CheckIcon } from '@/components/icons';
import { InviteShare, inviteUrl } from '@/components/invite-share';
import { useToast } from '@/components/toast';
import { FieldError } from '@/components/ui';
import { addMember, createInvite, revokeInvites } from '../../actions';

export function InviteLinkBox({
  groupId,
  groupName,
  token,
  expires,
  isOwner,
}: {
  groupId: string;
  groupName: string;
  token: string | null;
  expires: string | null;
  isOwner: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const display = token ? `${typeof window === 'undefined' ? '' : window.location.host}/u/${token}` : null;

  return (
    <>
      <div className="field">
        <span className="field-label">Link del grupo</span>
        {token ? (
          <div
            className="hstack gap-8"
            style={{ height: 56, padding: '0 6px 0 14px', borderRadius: 12, background: 'var(--surface)', border: '1.5px solid var(--line-strong)' }}
          >
            <span
              style={{ flex: 1, minWidth: 0, font: '500 15px/1 ui-monospace, Menlo, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              suppressHydrationWarning
            >
              {display}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              style={copied ? { background: 'var(--owed-tint)', color: 'var(--owed)', fontWeight: 700 } : { border: '1.5px solid var(--ink)' }}
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl(token)).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
              }}
            >
              {copied && <CheckIcon size={14} color="var(--owed)" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : (
          <div className="note">
            {isOwner ? 'Todavía no hay un link activo.' : 'No hay un link activo. Pedile uno a quien administra el grupo.'}
          </div>
        )}
        <span className="field-hint">
          {token ? (
            <>
              Vence el {expires}. Cualquiera con el link puede entrar.{' '}
              {isOwner && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await revokeInvites(groupId);
                      if (!r.ok) toast({ tone: 'error', message: r.error });
                      else toast({ message: 'Link desactivado. Ya nadie puede entrar con él.' });
                      router.refresh();
                    })
                  }
                  style={{ border: 0, background: 'none', padding: 0, color: 'var(--focus)', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }}
                >
                  Desactivar
                </button>
              )}
            </>
          ) : isOwner ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await createInvite(groupId);
                  if (!r.ok) toast({ tone: 'error', message: r.error });
                  router.refresh();
                })
              }
            >
              Generar link
            </button>
          ) : null}
        </span>
      </div>
      {(token || isOwner) && (
        <InviteShare groupId={groupId} groupName={groupName} token={token} canCreate={isOwner} primaryLabel="Compartir por WhatsApp" showCopy={false} />
      )}
    </>
  );
}

export function AddPersonForm({ groupId }: { groupId: string }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <form
      className="field"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return setError('Escribí un nombre o un email.');
        const isEmail = v.includes('@');
        const name = isEmail ? v.split('@')[0] : v;
        start(async () => {
          const r = await addMember(groupId, { name, email: isEmail ? v : undefined });
          if (!r.ok) return setError(r.fieldErrors?.email ?? r.error);
          setError(null);
          // The list may already have refreshed and the user may be typing the next person.
          setValue((cur) => (cur.trim() === v ? '' : cur));
          toast({
            message: isEmail
              ? `Agregamos a ${v}. Cuando entre a Ronda con ese email, aparece en el grupo.`
              : `Agregamos a ${name}. Ya lo podés sumar a los gastos.`,
          });
          router.refresh();
        });
      }}
    >
      <label className="field-label" htmlFor="person">
        O agregá a alguien sin cuenta
      </label>
      <div className="hstack gap-8">
        <input
          id="person"
          className="input"
          style={{ flex: 1 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Nombre o email"
          maxLength={254}
          autoCapitalize="words"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'person-error' : 'person-hint'}
        />
        <button type="submit" className="btn btn-secondary" style={{ width: 96, height: 52, padding: 0 }} disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : 'Agregar'}
        </button>
      </div>
      {error ? (
        <FieldError id="person-error">{error}</FieldError>
      ) : (
        <span className="field-hint" id="person-hint">
          Con email, se une solo cuando entre a Ronda con esa dirección.
        </span>
      )}
    </form>
  );
}
