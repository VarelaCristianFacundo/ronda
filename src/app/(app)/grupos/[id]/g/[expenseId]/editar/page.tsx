import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getGroup } from '@/lib/data';
import { ExpenseForm } from '../../../gasto/expense-form';
import { formMembers } from '../../../gasto/form-members';

export const metadata: Metadata = { title: 'Editar gasto' };

export default async function EditExpensePage(props: PageProps<'/grupos/[id]/g/[expenseId]/editar'>) {
  const { id, expenseId } = await props.params;
  const b = await getGroup(id);
  const e = b.expenses.find((x) => x.id === expenseId);
  if (!e) notFound();
  if (e.voided) redirect(`/grupos/${id}/g/${expenseId}`);
  const involved = new Set([e.payerId, ...e.shares.map((s) => s.memberId)]);
  return (
    <ExpenseForm
      groupId={id}
      groupName={b.group.name}
      currency={b.group.currency}
      members={formMembers(b).filter((m) => m.active || involved.has(m.id))}
      meId={b.me.id}
      initial={{
        description: e.description,
        amountMinor: e.amountMinor,
        payerId: e.payerId,
        date: e.date,
        category: e.category,
        note: e.note,
        method: e.method,
        shares: e.shares,
      }}
      edit={{ expenseId: e.id, revision: e.revision }}
    />
  );
}
