import { describe, expect, it } from 'vitest';
import { diffRevisions, type Revision } from './history';

const names: Record<string, string> = { s: 'Vos', n: 'Nico', c: 'Cami', j: 'Juli' };
const nameOf = (id: string) => names[id] ?? '?';

const base: Revision = {
  revision: 1,
  description: 'Cabaña',
  amountMinor: 22_000_000,
  payerId: 's',
  date: '2026-07-12',
  method: 'equal',
  category: 'ALO',
  note: null,
  shares: [
    { memberId: 's', shareMinor: 11_000_000, input: null },
    { memberId: 'n', shareMinor: 11_000_000, input: null },
  ],
  createdBy: 'u1',
  createdAt: '2026-07-12T18:40:00Z',
};

describe('diffRevisions', () => {
  it('reports the design example (total changed)', () => {
    const next = {
      ...base,
      revision: 2,
      amountMinor: 24_000_000,
      shares: [
        { memberId: 's', shareMinor: 12_000_000, input: null },
        { memberId: 'n', shareMinor: 12_000_000, input: null },
      ],
    };
    expect(diffRevisions(base, next, 'ARS', nameOf)).toEqual([
      { verb: 'cambió', what: 'el total', from: '$ 220.000', to: '$ 240.000' },
    ]);
  });

  it('reports people added and removed, payer and method changes', () => {
    const next: Revision = {
      ...base,
      revision: 2,
      payerId: 'n',
      method: 'exact',
      shares: [
        { memberId: 's', shareMinor: 12_000_000, input: 12_000_000 },
        { memberId: 'c', shareMinor: 10_000_000, input: 10_000_000 },
      ],
    };
    expect(diffRevisions(base, next, 'ARS', nameOf)).toEqual([
      { verb: 'cambió', what: 'quién pagó', from: 'Vos', to: 'Nico' },
      { verb: 'sumó', what: 'a Cami al gasto' },
      { verb: 'sacó', what: 'a Nico del gasto' },
      { verb: 'cambió', what: 'cómo se divide', from: 'Iguales', to: 'Montos exactos' },
    ]);
  });

  it('reports percentage and note edits', () => {
    const a: Revision = { ...base, method: 'percent', note: 'x', shares: [
      { memberId: 's', shareMinor: 11_000_000, input: 5000 },
      { memberId: 'n', shareMinor: 11_000_000, input: 5000 },
    ] };
    const b: Revision = { ...a, revision: 2, note: null, shares: [
      { memberId: 's', shareMinor: 13_200_000, input: 6000 },
      { memberId: 'n', shareMinor: 8_800_000, input: 4000 },
    ] };
    expect(diffRevisions(a, b, 'ARS', nameOf)).toEqual([
      { verb: 'borró', what: 'la nota' },
      { verb: 'cambió', what: 'el porcentaje de Vos', from: '50 %', to: '60 %' },
      { verb: 'cambió', what: 'el porcentaje de Nico', from: '50 %', to: '40 %' },
    ]);
  });

  it('is empty for identical revisions', () => {
    expect(diffRevisions(base, { ...base, revision: 2 }, 'ARS', nameOf)).toEqual([]);
  });
});
