'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useTransition } from 'react';
import { ConfirmButton } from '@/components/confirm';
import { SubmitButton } from '@/components/submit-button';
import { useToast } from '@/components/toast';
import { Avatar, FieldError } from '@/components/ui';
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from '@/lib/money';
import { leaveGroup, removeMember, setMemberRole, updateGroup, type FormState } from '../../actions';

export function GroupForm({
  groupId,
  name,
  currency,
  locked,
  isOwner,
}: {
  groupId: string;
  name: string;
  currency: CurrencyCode;
  locked: boolean;
  isOwner: boolean;
}) {
  const [state, action] = useActionState<FormState & { savedAt?: number }, FormData>(async (p, fd) => {
    const r = await updateGroup(p, fd);
    return r.error ? r : { savedAt: Date.now() };
  }, {});
  const toast = useToast();
  useEffect(() => {
    if (state.savedAt) toast({ message: 'Guardamos los cambios del grupo.' });
  }, [state.savedAt, toast]);

  return (
    <form action={action} className="stack gap-16">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="field">
        <label className="field-label" htmlFor="gname">
          Nombre
        </label>
        <input id="gname" name="name" className="input" defaultValue={name} maxLength={60} disabled={!isOwner} required />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="gcur" style={locked || !isOwner ? { color: 'var(--ink-3)' } : undefined}>
          Moneda del grupo
        </label>
        {locked || !isOwner ? (
          <>
            <input type="hidden" name="currency" value={currency} />
            <select id="gcur" className="select" disabled value={currency}>
              <option value={currency}>
                {currency} · {CURRENCIES[currency].name}
              </option>
            </select>
            <span className="field-hint">
              {locked ? 'Bloqueada: el grupo ya tiene movimientos.' : 'Sólo quien administra el grupo puede cambiarla.'}
            </span>
          </>
        ) : (
          <select id="gcur" name="currency" className="select" defaultValue={currency}>
            {CURRENCY_CODES.map((c) => (
              <option key={c} value={c}>
                {c} · {CURRENCIES[c].name}
              </option>
            ))}
          </select>
        )}
      </div>
      {state.error && <FieldError>{state.error}</FieldError>}
      {isOwner && (
        <SubmitButton pendingLabel="Guardando…" className="btn btn-secondary btn-block">
          Guardar cambios
        </SubmitButton>
      )}
    </form>
  );
}

type AdminMember = {
  id: string;
  name: string;
  color: number;
  role: 'owner' | 'member';
  isMe: boolean;
  hasAccount: boolean;
  invitedEmail: string | null;
  net: number;
  netLabel: string;
};

export function MemberAdmin({ groupId, members, isOwner }: { groupId: string; members: AdminMember[]; isOwner: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  return (
    <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {members.map((m) => (
        <li key={m.id} className="stack gap-8" style={{ padding: '10px 0' }}>
          <div className="hstack gap-12">
            <Avatar name={m.name} color={m.color} />
            <span className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ font: '500 15px/1.2 var(--font-ui)', overflowWrap: 'anywhere' }}>{m.name}</span>
              <span className="t-caption">
                {m.role === 'owner' ? 'Administra' : m.hasAccount ? 'Miembro' : m.invitedEmail ? `Pendiente · ${m.invitedEmail}` : 'Sin cuenta'}
                {m.net !== 0 && ` · ${m.net > 0 ? 'recibe' : 'debe'} ${m.netLabel}`}
              </span>
            </span>
          </div>
          {isOwner && !m.isMe && (
            <div className="hstack gap-8" style={{ paddingLeft: 44, flexWrap: 'wrap' }}>
              {m.hasAccount && (
                <button
                  type="button"
                  className="btn btn-text"
                  style={{ height: 40, padding: '0 8px', fontSize: 14 }}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await setMemberRole(groupId, m.id, m.role === 'owner' ? 'member' : 'owner');
                      toast(r.ok ? { message: m.role === 'owner' ? `${m.name} ya no administra.` : `${m.name} ahora administra el grupo.` } : { tone: 'error', message: r.error });
                      router.refresh();
                    })
                  }
                >
                  {m.role === 'owner' ? 'Quitar admin' : 'Hacer admin'}
                </button>
              )}
              <ConfirmButton
                label="Sacar del grupo"
                className="btn btn-text"
                title={`¿Sacar a ${m.name}?`}
                body={
                  m.net !== 0 ? (
                    <>
                      <p style={{ marginBottom: 8 }}>
                        <b>
                          {m.name} {m.net > 0 ? 'tiene para recibir' : 'todavía debe'} {m.netLabel}.
                        </b>{' '}
                        Ese saldo no se borra: sigue en el grupo y en “Cómo saldar” hasta que se registre el pago.
                      </p>
                      <p>Sus gastos y pagos quedan en el historial. Deja de ver el grupo.</p>
                    </>
                  ) : (
                    <p>Sus gastos y pagos quedan en el historial tal como están. Deja de ver el grupo y no se lo puede sumar a gastos nuevos.</p>
                  )
                }
                confirmLabel="Sí, sacar"
                onConfirm={async () => {
                  const r = await removeMember(groupId, m.id, true);
                  if (!r.ok) return r.error;
                  toast({ message: `${m.name} ya no está en el grupo.` });
                  router.refresh();
                }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function LeaveGroup({ groupId, groupName, blocked }: { groupId: string; groupName: string; blocked: string | null }) {
  const router = useRouter();
  if (blocked) {
    return (
      <>
        <button type="button" className="btn btn-destructive btn-block" disabled aria-describedby="leave-why" style={{ opacity: 0.6 }}>
          Salir del grupo
        </button>
        <span id="leave-why" className="field-hint">
          {blocked}
        </span>
      </>
    );
  }
  return (
    <ConfirmButton
      label="Salir del grupo"
      title={`¿Salir de ${groupName}?`}
      body={<p>Tus gastos y pagos quedan en el historial del grupo. Vas a dejar de verlo; para volver necesitás un link nuevo.</p>}
      confirmLabel="Sí, salir"
      onConfirm={async () => {
        const r = await leaveGroup(groupId);
        if (!r.ok) return r.error;
        router.replace('/grupos');
      }}
    />
  );
}
