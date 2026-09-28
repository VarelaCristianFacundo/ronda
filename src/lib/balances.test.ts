import { describe, expect, it } from 'vitest';
import { computeBalances, expenseEffectFor, memberTotals, type BalanceExpense } from './balances';
import { suggestTransfers } from './settle';
import { splitEqual } from './split';

const members = ['s', 'n', 'c', 'j', 'f'];

function equalExpense(payerId: string, amountMinor: number, participants = members, voided = false): BalanceExpense {
  const r = splitEqual(amountMinor, participants, payerId);
  if (!r.ok) throw new Error('bad split');
  return { payerId, amountMinor, shares: r.shares, voided };
}

function sumValues(m: Map<string, number>) {
  return [...m.values()].reduce((a, b) => a + b, 0);
}

function applyTransfers(balances: Map<string, number>, transfers: ReturnType<typeof suggestTransfers>) {
  const next = new Map(balances);
  for (const t of transfers) {
    next.set(t.fromId, (next.get(t.fromId) ?? 0) + t.amountMinor);
    next.set(t.toId, (next.get(t.toId) ?? 0) - t.amountMinor);
  }
  return next;
}

describe('computeBalances', () => {
  it('computes nets from shares', () => {
    const b = computeBalances(members, [equalExpense('s', 24_000_000)], []);
    expect(b.get('s')).toBe(19_200_000);
    expect(b.get('n')).toBe(-4_800_000);
    expect(sumValues(b)).toBe(0);
  });

  it('ignores voided expenses', () => {
    const b = computeBalances(members, [equalExpense('s', 24_000_000, members, true)], []);
    expect([...b.values()].every((v) => v === 0)).toBe(true);
  });

  it('uses the edited revision instead of the original', () => {
    const original = equalExpense('s', 22_000_000);
    const edited = equalExpense('s', 24_000_000);
    // The app feeds only the current revision of each expense into the calculation.
    expect(computeBalances(members, [original], []).get('s')).toBe(17_600_000);
    expect(computeBalances(members, [edited], []).get('s')).toBe(19_200_000);
  });

  it('applies full and partial repayments', () => {
    const exp = [equalExpense('s', 1_000_000, ['s', 'j'])]; // j owes s 5.000
    const partial = computeBalances(members, exp, [{ fromId: 'j', toId: 's', amountMinor: 300_000, voided: false }]);
    expect(partial.get('j')).toBe(-200_000);
    expect(partial.get('s')).toBe(200_000);

    const full = computeBalances(members, exp, [
      { fromId: 'j', toId: 's', amountMinor: 300_000, voided: false },
      { fromId: 'j', toId: 's', amountMinor: 200_000, voided: false },
    ]);
    expect(full.get('j')).toBe(0);
    expect(full.get('s')).toBe(0);
  });

  it('ignores voided payments', () => {
    const exp = [equalExpense('s', 1_000_000, ['s', 'j'])];
    const b = computeBalances(members, exp, [{ fromId: 'j', toId: 's', amountMinor: 500_000, voided: true }]);
    expect(b.get('j')).toBe(-500_000);
  });

  it('overpayment flips the direction instead of disappearing', () => {
    const exp = [equalExpense('s', 1_000_000, ['s', 'j'])];
    const b = computeBalances(members, exp, [{ fromId: 'j', toId: 's', amountMinor: 700_000, voided: false }]);
    expect(b.get('j')).toBe(200_000);
    expect(b.get('s')).toBe(-200_000);
  });

  it('keeps departed members in the balance map', () => {
    const b = computeBalances(['s'], [equalExpense('s', 1_000, ['s', 'old'])], []);
    expect(b.get('old')).toBe(-500);
    expect(sumValues(b)).toBe(0);
  });

  it('rejects inconsistent share data', () => {
    expect(() =>
      computeBalances(members, [{ payerId: 's', amountMinor: 100, shares: [{ memberId: 's', shareMinor: 99 }], voided: false }], []),
    ).toThrow();
  });
});

describe('memberTotals and expenseEffectFor', () => {
  it('reports paid and share for a member', () => {
    const exp = [equalExpense('s', 1_000_000), equalExpense('n', 500_000)];
    expect(memberTotals('s', exp)).toEqual({ paid: 1_000_000, share: 300_000 });
  });

  it('computes per-expense effect', () => {
    const e = equalExpense('n', 8_650_000);
    expect(expenseEffectFor('s', e)).toBe(-1_730_000);
    expect(expenseEffectFor('n', e)).toBe(6_920_000);
    expect(expenseEffectFor('zz', e)).toBe(0);
  });
});

describe('suggestTransfers', () => {
  it('settles the design example', () => {
    const balances = new Map([
      ['s', 6_240_000],
      ['c', 1_480_000],
      ['n', -3_820_000],
      ['j', -2_750_000],
      ['f', -1_150_000],
    ]);
    const t = suggestTransfers(balances, members);
    expect(t[0]).toEqual({ fromId: 'n', toId: 's', amountMinor: 3_820_000 });
    expect(t.length).toBeLessThanOrEqual(4);
    const after = applyTransfers(balances, t);
    expect([...after.values()].every((v) => v === 0)).toBe(true);
  });

  it('returns nothing when everyone is settled', () => {
    expect(suggestTransfers(new Map([['a', 0], ['b', 0]]), ['a', 'b'])).toEqual([]);
  });

  it('is deterministic with ties', () => {
    const balances = new Map([['a', 100], ['b', 100], ['c', -100], ['d', -100]]);
    const order = ['a', 'b', 'c', 'd'];
    expect(suggestTransfers(balances, order)).toEqual([
      { fromId: 'c', toId: 'a', amountMinor: 100 },
      { fromId: 'd', toId: 'b', amountMinor: 100 },
    ]);
  });

  it('settles randomized groups to zero with at most n-1 transfers', () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let round = 0; round < 200; round++) {
      const ids = Array.from({ length: 2 + Math.floor(rand() * 8) }, (_, i) => `m${i}`);
      const exps = Array.from({ length: 1 + Math.floor(rand() * 10) }, () => {
        const payer = ids[Math.floor(rand() * ids.length)];
        const parts = ids.filter(() => rand() > 0.3);
        return equalExpense(payer, 1 + Math.floor(rand() * 1_000_000), parts.length ? parts : [payer]);
      });
      const balances = computeBalances(ids, exps, []);
      expect(sumValues(balances)).toBe(0);
      const t = suggestTransfers(balances, ids);
      expect(t.length).toBeLessThanOrEqual(ids.length - 1);
      expect(t.every((x) => x.amountMinor > 0)).toBe(true);
      expect([...applyTransfers(balances, t).values()].every((v) => v === 0)).toBe(true);
    }
  });

  it('rejects balances that do not sum to zero', () => {
    expect(() => suggestTransfers(new Map([['a', 1]]), ['a'])).toThrow();
  });
});
