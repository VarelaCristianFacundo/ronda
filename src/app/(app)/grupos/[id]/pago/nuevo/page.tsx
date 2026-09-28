import type { Metadata } from 'next';
import { getAliases, getGroup, isUuid, who } from '@/lib/data';
import { PaymentForm } from './payment-form';

export const metadata: Metadata = { title: 'Registrar pago' };

export default async function NewPaymentPage(props: PageProps<'/grupos/[id]/pago/nuevo'>) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const b = await getGroup(id);
  const pick = (v: unknown) => (typeof v === 'string' && isUuid(v) && b.byId.has(v) ? v : null);

  // Default pair: from the query (a suggested transfer), else the first suggestion involving me.
  const mine = b.transfers.find((t) => t.fromId === b.me.id || t.toId === b.me.id) ?? b.transfers[0];
  const fromId = pick(sp.de) ?? mine?.fromId ?? b.members.find((m) => m.status === 'active' && !m.isMe)?.id ?? b.me.id;
  const toId = pick(sp.a) ?? mine?.toId ?? b.me.id;

  // People you can record between: active members plus former members who still have a balance.
  const people = b.members
    .filter((m) => m.status === 'active' || (b.balances.get(m.id) ?? 0) !== 0)
    .map((m) => ({ id: m.id, label: who(b, m.id), name: m.name, color: m.color, userId: m.userId }));
  const aliases = await getAliases(people.map((p) => p.userId ?? ''));

  return (
    <PaymentForm
      groupId={id}
      groupName={b.group.name}
      currency={b.group.currency}
      meId={b.me.id}
      people={people.map((p) => ({ ...p, alias: p.userId ? (aliases.get(p.userId) ?? null) : null }))}
      initialFrom={fromId}
      initialTo={toId === fromId ? (people.find((p) => p.id !== fromId)?.id ?? toId) : toId}
      suggested={b.transfers.map((t) => ({ fromId: t.fromId, toId: t.toId, amountMinor: t.amountMinor }))}
    />
  );
}
