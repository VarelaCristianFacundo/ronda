import { who, type GroupBundle } from '@/lib/data';
import type { FormMember } from './expense-form';

export function formMembers(b: GroupBundle): FormMember[] {
  return b.members
    .filter((m) => m.status === 'active' || b.expenses.some((e) => e.payerId === m.id || e.shares.some((s) => s.memberId === m.id)))
    .map((m) => ({ id: m.id, label: who(b, m.id), name: m.name, color: m.color, active: m.status === 'active' }));
}
