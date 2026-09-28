import { describe, expect, it } from 'vitest';
import { computeSplit, splitEqual, splitExact, splitPercent, type SplitResult } from './split';

function shares(result: SplitResult): Record<string, number> {
  if (!result.ok) throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`);
  return Object.fromEntries(result.shares.map((s) => [s.memberId, s.shareMinor]));
}

function sum(result: SplitResult): number {
  if (!result.ok) throw new Error('not ok');
  return result.shares.reduce((a, s) => a + s.shareMinor, 0);
}

describe('splitEqual', () => {
  it('splits evenly when divisible', () => {
    expect(shares(splitEqual(8_650_000, ['s', 'n', 'c', 'j', 'f'], 'n'))).toEqual({
      s: 1_730_000, n: 1_730_000, c: 1_730_000, j: 1_730_000, f: 1_730_000,
    });
  });

  it('gives leftover cents to the payer when the payer participates', () => {
    const r = splitEqual(1000, ['a', 'b', 'c'], 'b');
    expect(shares(r)).toEqual({ a: 333, b: 334, c: 333 });
    expect(r.ok && r.payerAbsorbs).toBe(1);
  });

  it('spreads leftover cents in participant order when the payer does not participate', () => {
    const r = splitEqual(1002, ['a', 'b', 'c', 'd'], 'x');
    expect(shares(r)).toEqual({ a: 251, b: 251, c: 250, d: 250 });
    expect(r.ok && r.payerAbsorbs).toBe(0);
  });

  it('is deterministic and always sums to the total', () => {
    const ids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];
    for (let total = 1; total < 500; total += 7) {
      const a = splitEqual(total, ids, 'm3');
      const b = splitEqual(total, ids, 'm3');
      expect(a).toEqual(b);
      expect(sum(a)).toBe(total);
    }
  });

  it('handles a single cent across many people', () => {
    expect(shares(splitEqual(1, ['a', 'b', 'c'], 'x'))).toEqual({ a: 1, b: 0, c: 0 });
  });

  it('rejects bad input', () => {
    expect(splitEqual(0, ['a'], 'a')).toEqual({ ok: false, error: { code: 'invalid_total' } });
    expect(splitEqual(100, [], 'a')).toEqual({ ok: false, error: { code: 'no_participants' } });
    expect(splitEqual(100, ['a', 'a'], 'a')).toEqual({ ok: false, error: { code: 'duplicate_participant' } });
    expect(splitEqual(10.5, ['a'], 'a').ok).toBe(false);
  });
});

describe('splitExact', () => {
  it('accepts amounts that sum to the total and drops zero rows', () => {
    const r = splitExact(8_650_000, [
      { memberId: 's', minor: 2_000_000 },
      { memberId: 'n', minor: 1_800_000 },
      { memberId: 'c', minor: 1_550_000 },
      { memberId: 'j', minor: 2_100_000 },
      { memberId: 'f', minor: 1_200_000 },
      { memberId: 'x', minor: 0 },
    ]);
    expect(sum(r)).toBe(8_650_000);
    expect(r.ok && r.shares.map((s) => s.memberId)).toEqual(['s', 'n', 'c', 'j', 'f']);
  });

  it('reports how much is missing', () => {
    const r = splitExact(8_650_000, [
      { memberId: 's', minor: 2_000_000 },
      { memberId: 'n', minor: 1_800_000 },
      { memberId: 'c', minor: 1_550_000 },
      { memberId: 'j', minor: 1_700_000 },
      { memberId: 'f', minor: 1_200_000 },
    ]);
    expect(r).toEqual({ ok: false, error: { code: 'exact_mismatch', assigned: 8_250_000, diff: 400_000 } });
  });

  it('reports excess as a negative diff', () => {
    const r = splitExact(100, [{ memberId: 'a', minor: 60 }, { memberId: 'b', minor: 50 }]);
    expect(r).toEqual({ ok: false, error: { code: 'exact_mismatch', assigned: 110, diff: -10 } });
  });

  it('rejects negative and fractional amounts', () => {
    expect(splitExact(100, [{ memberId: 'a', minor: 150 }, { memberId: 'b', minor: -50 }]).ok).toBe(false);
    expect(splitExact(100, [{ memberId: 'a', minor: 99.5 }, { memberId: 'b', minor: 0.5 }]).ok).toBe(false);
  });
});

describe('splitPercent', () => {
  it('matches the design example (30/20/20/20/10 of $ 86.500)', () => {
    const r = splitPercent(8_650_000, [
      { memberId: 's', bp: 3000 },
      { memberId: 'n', bp: 2000 },
      { memberId: 'c', bp: 2000 },
      { memberId: 'j', bp: 2000 },
      { memberId: 'f', bp: 1000 },
    ]);
    expect(shares(r)).toEqual({ s: 2_595_000, n: 1_730_000, c: 1_730_000, j: 1_730_000, f: 865_000 });
  });

  it('distributes leftover cents by largest remainder, ties by order', () => {
    // 100 cents at 33.33 / 33.33 / 33.34 → 33.33, 33.33, 33.34 → floors 33, 33, 33 (+1 leftover).
    const r = splitPercent(100, [
      { memberId: 'a', bp: 3333 },
      { memberId: 'b', bp: 3333 },
      { memberId: 'c', bp: 3334 },
    ]);
    expect(shares(r)).toEqual({ a: 33, b: 33, c: 34 });

    // Equal remainders: first in order wins.
    const t = splitPercent(1, [{ memberId: 'a', bp: 5000 }, { memberId: 'b', bp: 5000 }]);
    expect(shares(t)).toEqual({ a: 1, b: 0 });
  });

  it('always sums exactly across many totals', () => {
    const entries = [
      { memberId: 'a', bp: 1234 },
      { memberId: 'b', bp: 3333 },
      { memberId: 'c', bp: 2222 },
      { memberId: 'd', bp: 3211 },
    ];
    for (let total = 1; total < 3000; total += 13) {
      expect(sum(splitPercent(total, entries))).toBe(total);
    }
  });

  it('stays exact at the maximum amount (BigInt path)', () => {
    const total = 1_000_000_000_000;
    const r = splitPercent(total, [{ memberId: 'a', bp: 3333 }, { memberId: 'b', bp: 6667 }]);
    expect(shares(r)).toEqual({ a: 333_300_000_000, b: 666_700_000_000 });
  });

  it('reports the percentage mismatch', () => {
    const r = splitPercent(8_650_000, [
      { memberId: 's', bp: 3000 },
      { memberId: 'n', bp: 2500 },
      { memberId: 'c', bp: 2000 },
      { memberId: 'j', bp: 2000 },
      { memberId: 'f', bp: 1000 },
    ]);
    expect(r).toEqual({ ok: false, error: { code: 'percent_mismatch', assignedBp: 10500, diffBp: -500 } });
  });
});

describe('computeSplit', () => {
  it('dispatches by method', () => {
    expect(sum(computeSplit({ method: 'equal', total: 999, payerId: 'a', participants: ['a', 'b'] }))).toBe(999);
    expect(sum(computeSplit({ method: 'percent', total: 999, payerId: 'a', entries: [{ memberId: 'a', bp: 10000 }] }))).toBe(999);
    expect(sum(computeSplit({ method: 'exact', total: 999, payerId: 'a', entries: [{ memberId: 'b', minor: 999 }] }))).toBe(999);
  });
});
