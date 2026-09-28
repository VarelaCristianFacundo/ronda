// Settlement suggestion: one way to bring every balance to zero with few transfers.
//
// Greedy: repeatedly match the member who owes the most with the member who is owed the
// most, transferring the smaller of the two amounts. Ties are broken by the member order
// passed in, so the result is deterministic. It produces at most n − 1 transfers; it is not
// guaranteed to be the minimum possible, and it is never the only valid way to settle,
// which is why the UI presents it as a suggestion.

export type Transfer = { fromId: string; toId: string; amountMinor: number };

export function suggestTransfers(balances: Map<string, number>, order: string[]): Transfer[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const pos = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;

  const total = [...balances.values()].reduce((a, b) => a + b, 0);
  if (total !== 0) throw new Error('Balances must sum to zero');

  const creditors = [...balances].filter(([, v]) => v > 0).map(([id, v]) => ({ id, left: v }));
  const debtors = [...balances].filter(([, v]) => v < 0).map(([id, v]) => ({ id, left: -v }));
  const byLargest = (a: { id: string; left: number }, b: { id: string; left: number }) =>
    b.left - a.left || pos(a.id) - pos(b.id);

  const transfers: Transfer[] = [];
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(byLargest);
    debtors.sort(byLargest);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.left, d.left);
    transfers.push({ fromId: d.id, toId: c.id, amountMinor: amount });
    c.left -= amount;
    d.left -= amount;
    if (c.left === 0) creditors.shift();
    if (d.left === 0) debtors.shift();
  }
  return transfers;
}
