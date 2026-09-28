// Deterministic expense splitting. Every function returns shares that sum exactly to the total.
//
// Rounding rules (documented in docs/PLAN.md and the README):
// - Equal: each participant gets floor(total / n). The leftover cents (always < n) go to the payer
//   when the payer participates; otherwise one cent each to participants in the given order.
// - Percentages (basis points, 100 % = 10000, must sum to 10000): each share is
//   floor(total * bp / 10000); leftover cents go one each to the largest fractional remainders,
//   ties broken by the given order.
// - Exact: amounts are taken as entered and must sum to the total.
//
// "Given order" is the caller's participant order; the app always passes members sorted by
// join order then id, so results are reproducible.

import { MAX_AMOUNT_MINOR, sumMinor } from './money';

export type SplitMethod = 'equal' | 'exact' | 'percent';

export type Share = { memberId: string; shareMinor: number; input: number | null };

export type SplitInput =
  | { method: 'equal'; total: number; payerId: string; participants: string[] }
  | { method: 'exact'; total: number; payerId: string; entries: { memberId: string; minor: number }[] }
  | { method: 'percent'; total: number; payerId: string; entries: { memberId: string; bp: number }[] };

export type SplitError =
  | { code: 'no_participants' }
  | { code: 'duplicate_participant' }
  | { code: 'invalid_total' }
  | { code: 'invalid_value'; memberId: string }
  | { code: 'exact_mismatch'; assigned: number; diff: number } // diff = total - assigned
  | { code: 'percent_mismatch'; assignedBp: number; diffBp: number };

export type SplitResult =
  | { ok: true; shares: Share[]; payerAbsorbs: number }
  | { ok: false; error: SplitError };

function validTotal(total: number): boolean {
  return Number.isSafeInteger(total) && total > 0 && total <= MAX_AMOUNT_MINOR;
}

function hasDuplicates(ids: string[]): boolean {
  return new Set(ids).size !== ids.length;
}

export function splitEqual(total: number, participants: string[], payerId: string): SplitResult {
  if (!validTotal(total)) return { ok: false, error: { code: 'invalid_total' } };
  if (participants.length === 0) return { ok: false, error: { code: 'no_participants' } };
  if (hasDuplicates(participants)) return { ok: false, error: { code: 'duplicate_participant' } };

  const n = participants.length;
  const base = Math.floor(total / n);
  let rest = total - base * n;
  const payerParticipates = participants.includes(payerId);
  const payerAbsorbs = payerParticipates ? rest : 0;

  const shares = participants.map((memberId) => {
    let extra = 0;
    if (payerParticipates) {
      if (memberId === payerId) extra = rest;
    } else if (rest > 0) {
      extra = 1;
      rest -= 1;
    }
    return { memberId, shareMinor: base + extra, input: null };
  });
  return { ok: true, shares, payerAbsorbs };
}

export function splitExact(
  total: number,
  entries: { memberId: string; minor: number }[],
): SplitResult {
  if (!validTotal(total)) return { ok: false, error: { code: 'invalid_total' } };
  const active = entries.filter((e) => e.minor !== 0);
  if (active.length === 0) return { ok: false, error: { code: 'no_participants' } };
  if (hasDuplicates(entries.map((e) => e.memberId))) {
    return { ok: false, error: { code: 'duplicate_participant' } };
  }
  for (const e of entries) {
    if (!Number.isSafeInteger(e.minor) || e.minor < 0) {
      return { ok: false, error: { code: 'invalid_value', memberId: e.memberId } };
    }
  }
  const assigned = sumMinor(entries.map((e) => e.minor));
  if (assigned !== total) {
    return { ok: false, error: { code: 'exact_mismatch', assigned, diff: total - assigned } };
  }
  return {
    ok: true,
    shares: active.map((e) => ({ memberId: e.memberId, shareMinor: e.minor, input: e.minor })),
    payerAbsorbs: 0,
  };
}

export function splitPercent(total: number, entries: { memberId: string; bp: number }[]): SplitResult {
  if (!validTotal(total)) return { ok: false, error: { code: 'invalid_total' } };
  const active = entries.filter((e) => e.bp !== 0);
  if (active.length === 0) return { ok: false, error: { code: 'no_participants' } };
  if (hasDuplicates(entries.map((e) => e.memberId))) {
    return { ok: false, error: { code: 'duplicate_participant' } };
  }
  for (const e of entries) {
    if (!Number.isSafeInteger(e.bp) || e.bp < 0 || e.bp > 10000) {
      return { ok: false, error: { code: 'invalid_value', memberId: e.memberId } };
    }
  }
  const assignedBp = entries.reduce((acc, e) => acc + e.bp, 0);
  if (assignedBp !== 10000) {
    return { ok: false, error: { code: 'percent_mismatch', assignedBp, diffBp: 10000 - assignedBp } };
  }

  // BigInt keeps total * bp exact even for the largest allowed totals.
  const T = BigInt(total);
  const rows = active.map((e, index) => {
    const product = T * BigInt(e.bp);
    return {
      memberId: e.memberId,
      bp: e.bp,
      index,
      floor: Number(product / 10000n),
      remainder: Number(product % 10000n),
    };
  });
  let leftover = total - rows.reduce((acc, r) => acc + r.floor, 0);
  const order = [...rows].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const extra = new Map<string, number>();
  for (const r of order) {
    if (leftover === 0) break;
    extra.set(r.memberId, 1);
    leftover -= 1;
  }
  return {
    ok: true,
    shares: rows.map((r) => ({
      memberId: r.memberId,
      shareMinor: r.floor + (extra.get(r.memberId) ?? 0),
      input: r.bp,
    })),
    payerAbsorbs: 0,
  };
}

export function computeSplit(input: SplitInput): SplitResult {
  switch (input.method) {
    case 'equal':
      return splitEqual(input.total, input.participants, input.payerId);
    case 'exact':
      return splitExact(input.total, input.entries);
    case 'percent':
      return splitPercent(input.total, input.entries);
  }
}
