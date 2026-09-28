// Group balances from expense shares and repayments. Pure functions; the server loads
// records through RLS and passes them here.
//
// net(member) = Σ amounts paid for expenses − Σ own shares + Σ payments sent − Σ payments received
// Positive net: the group owes this member ("recibe"). Negative: the member owes ("debe").
// Voided records are ignored. The nets of a group always sum to zero.

import { assertMinor } from './money';

export type BalanceExpense = {
  payerId: string;
  amountMinor: number;
  shares: { memberId: string; shareMinor: number }[];
  voided: boolean;
};

export type BalancePayment = {
  fromId: string;
  toId: string;
  amountMinor: number;
  voided: boolean;
};

export function computeBalances(
  memberIds: string[],
  expenses: BalanceExpense[],
  payments: BalancePayment[],
): Map<string, number> {
  const net = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const add = (id: string, delta: number) => {
    const next = (net.get(id) ?? 0) + delta;
    assertMinor(next);
    net.set(id, next);
  };

  for (const e of expenses) {
    if (e.voided) continue;
    const shareSum = e.shares.reduce((acc, s) => acc + s.shareMinor, 0);
    if (shareSum !== e.amountMinor) {
      throw new Error('Expense shares do not sum to the expense amount');
    }
    add(e.payerId, e.amountMinor);
    for (const s of e.shares) add(s.memberId, -s.shareMinor);
  }

  for (const p of payments) {
    if (p.voided) continue;
    add(p.fromId, p.amountMinor);
    add(p.toId, -p.amountMinor);
  }

  return net;
}

/** What one member paid and consumed, for "Pagaste $ X y tu parte es $ Y". */
export function memberTotals(memberId: string, expenses: BalanceExpense[]) {
  let paid = 0;
  let share = 0;
  for (const e of expenses) {
    if (e.voided) continue;
    if (e.payerId === memberId) paid += e.amountMinor;
    for (const s of e.shares) if (s.memberId === memberId) share += s.shareMinor;
  }
  return { paid, share };
}

/**
 * Effect of a single expense on one member: positive = others owe them for it,
 * negative = their share of someone else's expense, 0 = not involved or exactly even.
 */
export function expenseEffectFor(memberId: string, e: Omit<BalanceExpense, 'voided'>): number {
  const own = e.shares.find((s) => s.memberId === memberId)?.shareMinor ?? 0;
  return (e.payerId === memberId ? e.amountMinor : 0) - own;
}
