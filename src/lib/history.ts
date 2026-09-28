// Human-readable differences between two expense revisions (for "Historial de cambios").

import { CATEGORIES, formatDay, SPLIT_LABELS, type CategoryCode } from './labels';
import { formatMoney, formatPercent, type CurrencyCode } from './money';
import type { SplitMethod } from './split';

export type Revision = {
  revision: number;
  description: string;
  amountMinor: number;
  payerId: string;
  date: string;
  method: SplitMethod;
  category: string | null;
  note: string | null;
  shares: { memberId: string; shareMinor: number; input: number | null }[];
  createdBy: string | null;
  createdAt: string;
};

/** One change. `verb` is third person ("cambió"); the UI conjugates it for "vos". */
export type Change = { verb: 'cambió' | 'sumó' | 'sacó' | 'editó' | 'agregó' | 'borró'; what: string; from?: string; to?: string };

export const SECOND_PERSON: Record<Change['verb'], string> = {
  cambió: 'cambiaste',
  sumó: 'sumaste',
  sacó: 'sacaste',
  editó: 'editaste',
  agregó: 'agregaste',
  borró: 'borraste',
};

export function diffRevisions(
  prev: Revision,
  next: Revision,
  currency: CurrencyCode,
  nameOf: (memberId: string) => string,
): Change[] {
  const out: Change[] = [];
  const money = (m: number) => formatMoney(m, currency);

  if (prev.amountMinor !== next.amountMinor) out.push({ verb: 'cambió', what: 'el total', from: money(prev.amountMinor), to: money(next.amountMinor) });
  if (prev.description !== next.description) out.push({ verb: 'cambió', what: 'la descripción', from: `“${prev.description}”`, to: `“${next.description}”` });
  if (prev.payerId !== next.payerId) out.push({ verb: 'cambió', what: 'quién pagó', from: nameOf(prev.payerId), to: nameOf(next.payerId) });
  if (prev.date !== next.date) out.push({ verb: 'cambió', what: 'la fecha', from: formatDay(prev.date), to: formatDay(next.date) });
  if (prev.category !== next.category) {
    const cat = (c: string | null) => (c ? CATEGORIES[c as CategoryCode] : 'sin categoría');
    out.push({ verb: 'cambió', what: 'la categoría', from: cat(prev.category), to: cat(next.category) });
  }
  if ((prev.note ?? '') !== (next.note ?? '')) {
    if (!prev.note) out.push({ verb: 'agregó', what: 'una nota' });
    else if (!next.note) out.push({ verb: 'borró', what: 'la nota' });
    else out.push({ verb: 'editó', what: 'la nota' });
  }

  const before = new Map(prev.shares.map((s) => [s.memberId, s]));
  const after = new Map(next.shares.map((s) => [s.memberId, s]));
  const added = next.shares.filter((s) => !before.has(s.memberId)).map((s) => nameOf(s.memberId));
  const removed = prev.shares.filter((s) => !after.has(s.memberId)).map((s) => nameOf(s.memberId));
  if (added.length) out.push({ verb: 'sumó', what: `a ${added.join(', ')} al gasto` });
  if (removed.length) out.push({ verb: 'sacó', what: `a ${removed.join(', ')} del gasto` });

  if (prev.method !== next.method) {
    out.push({ verb: 'cambió', what: 'cómo se divide', from: SPLIT_LABELS[prev.method], to: SPLIT_LABELS[next.method] });
  } else if (!added.length && !removed.length) {
    // Same people and method: report individual share changes (inputs for exact/percent).
    for (const s of next.shares) {
      const p = before.get(s.memberId)!;
      if (next.method === 'percent' && p.input !== s.input) {
        out.push({ verb: 'cambió', what: `el porcentaje de ${nameOf(s.memberId)}`, from: `${formatPercent(p.input ?? 0)} %`, to: `${formatPercent(s.input ?? 0)} %` });
      } else if (next.method === 'exact' && p.shareMinor !== s.shareMinor) {
        out.push({ verb: 'cambió', what: `la parte de ${nameOf(s.memberId)}`, from: money(p.shareMinor), to: money(s.shareMinor) });
      }
    }
  }
  return out;
}
