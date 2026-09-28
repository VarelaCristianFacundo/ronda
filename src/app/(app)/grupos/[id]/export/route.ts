import { NextResponse } from 'next/server';
import { actorName, fullName, getGroup, getGroupAudit } from '@/lib/data';
import { minorToDecimal, toCsv } from '@/lib/csv';
import { CATEGORIES, formatDateTime, PAYMENT_METHODS, SPLIT_LABELS, type CategoryCode, type PaymentMethod } from '@/lib/labels';
import { formatPercent } from '@/lib/money';

/**
 * CSV of a group's full history: one row per expense revision (so edits are visible with
 * their previous values) and one per payment, voided records included.
 * Access goes through the user's session and RLS; non-members get a 404 from getGroup.
 */
export async function GET(_req: Request, ctx: RouteContext<'/grupos/[id]/export'>) {
  const { id } = await ctx.params;
  const b = await getGroup(id);
  const audit = await getGroupAudit(id);
  const current = new Map(b.expenses.map((e) => [e.id, e]));
  const name = (memberId: string) => fullName(b, memberId).replace(/^Vos$/, b.me.name);
  const user = (userId: string | null) => {
    const a = actorName(b, userId);
    return a.isMe ? b.me.name : a.name;
  };
  const when = (ts: string | null) => (ts ? formatDateTime(ts) : '');

  const header = [
    'tipo', 'id', 'version', 'estado', 'fecha', 'descripcion', 'categoria', 'monto', 'moneda',
    'pago_o_de', 'para', 'reparto', 'detalle_reparto', 'medio', 'nota',
    'cargado_por', 'cargado_el', 'anulado_por', 'anulado_el', 'motivo_anulacion',
  ];

  const rows = audit.revisions.map((r) => {
    const e = current.get(r.expenseId);
    const isCurrent = e?.revision === r.revision;
    const state = e?.voided ? (isCurrent ? 'anulado' : 'reemplazado (luego anulado)') : isCurrent ? 'vigente' : 'reemplazado';
    const detail = r.shares
      .map((s) => `${name(s.memberId)}: ${minorToDecimal(s.shareMinor)}${r.method === 'percent' ? ` (${formatPercent(s.input ?? 0)}%)` : ''}`)
      .join('; ');
    return [
      'gasto', r.expenseId, r.revision, state, r.date, r.description,
      r.category ? CATEGORIES[r.category as CategoryCode] : '', { number: minorToDecimal(r.amountMinor) }, r.currency,
      name(r.payerId), '', SPLIT_LABELS[r.method], detail, '', r.note ?? '',
      user(r.createdBy), when(r.createdAt),
      isCurrent && e?.voided ? user(e.voidedBy) : '', isCurrent && e?.voided ? when(e.voidedAt) : '', isCurrent && e?.voided ? (e.voidReason ?? '') : '',
    ];
  });

  for (const p of [...b.payments].reverse()) {
    rows.push([
      'pago', `PAG-${String(p.receiptNumber).padStart(5, '0')}`, 1, p.voided ? 'anulado' : 'vigente', p.date, 'Pago', '',
      { number: minorToDecimal(p.amountMinor) }, p.currency, name(p.fromId), name(p.toId), '', '',
      p.method ? PAYMENT_METHODS[p.method as PaymentMethod] : '', p.note ?? '',
      user(p.createdBy), when(p.createdAt), p.voided ? user(p.voidedBy) : '', when(p.voidedAt), p.voidReason ?? '',
    ]);
  }

  const slug = b.group.name.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'grupo';
  return new NextResponse(toCsv(header, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ronda-${slug}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
