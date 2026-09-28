import type { Metadata } from 'next';
import { TopBar } from '@/components/ui';
import { getGroup } from '@/lib/data';
import { formatMoney } from '@/lib/money';
import { GroupForm, LeaveGroup, MemberAdmin } from './settings-client';

export const metadata: Metadata = { title: 'Ajustes del grupo' };

export default async function SettingsPage(props: PageProps<'/grupos/[id]/ajustes'>) {
  const { id } = await props.params;
  const b = await getGroup(id);
  const c = b.group.currency;
  const isOwner = b.me.role === 'owner';
  const myNet = b.balances.get(b.me.id) ?? 0;
  const members = b.members
    .filter((m) => m.status === 'active')
    .map((m) => ({
      id: m.id,
      name: m.isMe ? `${m.name} (vos)` : m.name,
      color: m.color,
      role: m.role,
      isMe: m.isMe,
      hasAccount: m.userId !== null,
      invitedEmail: m.invitedEmail,
      net: b.balances.get(m.id) ?? 0,
      netLabel: formatMoney(Math.abs(b.balances.get(m.id) ?? 0), c),
    }));
  const former = b.members.filter((m) => m.status !== 'active');
  const otherOwners = b.members.some((m) => m.status === 'active' && m.role === 'owner' && !m.isMe);
  const othersWithAccount = b.members.some((m) => m.status === 'active' && m.userId && !m.isMe);

  return (
    <main className="screen">
      <TopBar back={`/grupos/${id}`} title="Ajustes del grupo" subtitle={b.group.name} />
      <div className="content stack gap-22" style={{ paddingBottom: 48 }}>
        <GroupForm groupId={id} name={b.group.name} currency={c} locked={b.hasMovements} isOwner={isOwner} />

        <section className="stack gap-8" aria-labelledby="miembros">
          <h2 id="miembros" className="overline rule" style={{ paddingBottom: 6 }}>
            Personas
          </h2>
          <MemberAdmin groupId={id} members={members} isOwner={isOwner} />
          <p className="t-caption">
            Si alguien sale del grupo, sus gastos y pagos quedan en el historial tal como estaban. Para salir por su cuenta
            tiene que tener saldo cero; si lo sacás con saldo pendiente, esa deuda sigue en el grupo y en “Cómo saldar”.
          </p>
        </section>

        {former.length > 0 && (
          <section className="stack gap-8" aria-labelledby="ex">
            <h2 id="ex" className="overline rule" style={{ paddingBottom: 6 }}>
              Ya no están
            </h2>
            <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {former.map((m) => {
                const net = b.balances.get(m.id) ?? 0;
                return (
                  <li key={m.id} className="hstack gap-12" style={{ minHeight: 48 }}>
                    <span style={{ flex: 1, font: '500 15px/1.2 var(--font-ui)', color: 'var(--ink-2)' }}>
                      {m.name} · {m.status === 'left' ? 'salió' : 'lo sacaron'}
                    </span>
                    <span className={`amount ${net > 0 ? 'is-owed' : net < 0 ? 'is-owe' : 'muted'}`} style={{ fontSize: 15 }}>
                      {net === 0 ? 'al día' : `${net > 0 ? 'recibe' : 'debe'} ${formatMoney(Math.abs(net), c)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="stack gap-10" aria-labelledby="export">
          <h2 id="export" className="overline rule" style={{ paddingBottom: 6 }}>
            Historial
          </h2>
          <a href={`/grupos/${id}/export`} className="btn btn-secondary btn-block" download>
            Exportar historial (CSV)
          </a>
          <span className="field-hint">Incluye cada versión de los gastos, los anulados y los pagos.</span>
        </section>

        <section className="stack gap-10">
          <LeaveGroup
            groupId={id}
            groupName={b.group.name}
            blocked={
              myNet !== 0
                ? `Tu saldo es ${myNet > 0 ? 'a favor' : 'en contra'}: ${formatMoney(Math.abs(myNet), c)}. Saldalo antes de salir.`
                : isOwner && !otherOwners && othersWithAccount
                  ? 'Sos la única persona que administra el grupo. Hacé admin a alguien antes de salir.'
                  : null
            }
          />
        </section>
      </div>
    </main>
  );
}
