import type { Metadata } from 'next';
import { getGroup } from '@/lib/data';
import { ExpenseForm } from '../expense-form';
import { formMembers } from '../form-members';

export const metadata: Metadata = { title: 'Nuevo gasto' };

export default async function NewExpensePage(props: PageProps<'/grupos/[id]/gasto/nuevo'>) {
  const { id } = await props.params;
  const b = await getGroup(id);
  return (
    <ExpenseForm
      groupId={id}
      groupName={b.group.name}
      currency={b.group.currency}
      members={formMembers(b).filter((m) => m.active)}
      meId={b.me.id}
    />
  );
}
