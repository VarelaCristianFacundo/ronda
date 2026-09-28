import Link from 'next/link';
import { expenseEffectFor } from '@/lib/balances';
import { who, type Expense, type GroupBundle, type Payment } from '@/lib/data';
import { PAYMENT_METHODS, relativeDay, type PaymentMethod } from '@/lib/labels';
import { formatMoney } from '@/lib/money';
import { CategoryTile } from './ui';

type Ctx = Pick<GroupBundle, 'byId' | 'me' | 'group'>;

export type Movement = { kind: 'expense'; at: string; item: Expense } | { kind: 'payment'; at: string; item: Payment };

/** Expenses and payments merged, newest first (by date, then by creation time). */
export function movementsOf(b: Pick<GroupBundle, 'expenses' | 'payments'>): Movement[] {
  const list: Movement[] = [
    ...b.expenses.map((e) => ({ kind: 'expense' as const, at: e.date + e.createdAt, item: e })),
    ...b.payments.map((p) => ({ kind: 'payment' as const, at: p.date + p.createdAt, item: p })),
  ];
  return list.sort((a, b2) => (a.at < b2.at ? 1 : a.at > b2.at ? -1 : 0));
}

export function paymentTitle(ctx: Ctx, p: Payment): string {
  const from = who(ctx, p.fromId);
  const to = who(ctx, p.toId);
  if (p.fromId === ctx.me.id) return `Le pagaste a ${to}`;
  if (p.toId === ctx.me.id) return `${from} te pagó`;
  return `${from} le pagó a ${to}`;
}

/** Lowercase phrase for audit lines: "Martín te pagó $ 40", "le pagaste $ 40 a Nico". */
export function paymentPhrase(ctx: Ctx, p: Payment): string {
  const amount = formatMoney(p.amountMinor, ctx.group.currency);
  if (p.fromId === ctx.me.id) return `le pagaste ${amount} a ${who(ctx, p.toId)}`;
  if (p.toId === ctx.me.id) return `${who(ctx, p.fromId)} te pagó ${amount}`;
  return `${who(ctx, p.fromId)} le pagó ${amount} a ${who(ctx, p.toId)}`;
}

export function ExpenseRow({ ctx, e, highlight = false, showGroup }: { ctx: Ctx; e: Expense; highlight?: boolean; showGroup?: string }) {
  const c = ctx.group.currency;
  const effect = expenseEffectFor(ctx.me.id, e);
  const involved = e.payerId === ctx.me.id || e.shares.some((s) => s.memberId === ctx.me.id);
  const payer = e.payerId === ctx.me.id ? 'Pagaste vos' : `Pagó ${who(ctx, e.payerId)}`;
  const sub = showGroup
    ? `${showGroup} · ${payer.toLowerCase()}`
    : `${payer} · ${formatMoney(e.amountMinor, c)}${highlight ? ' · recién' : ` · ${relativeDay(e.date)}`}`;
  return (
    <Link
      href={`/grupos/${ctx.group.id}/g/${e.id}`}
      className={`row${e.voided ? ' is-void' : ''}${highlight ? ' is-new' : ''}`}
      style={{ minHeight: 66 }}
    >
      <CategoryTile code={e.category ?? 'OTR'} kind={e.voided ? 'void' : 'expense'} />
      <span className="row-main">
        <span className="row-title">{e.description}</span>
        <span className="row-sub">{e.voided ? `Anulado · ${formatMoney(e.amountMinor, c)}` : sub}</span>
      </span>
      {e.voided ? (
        <span className="row-end">
          <span className="row-end-label muted">anulado</span>
        </span>
      ) : showGroup ? (
        <span className="row-end">
          <span className="amount" style={{ fontSize: 16 }}>
            {formatMoney(e.amountMinor, c)}
          </span>
          <EffectLabel effect={effect} involved={involved} currency={c} inline />
        </span>
      ) : (
        <span className="row-end">
          <EffectLabel effect={effect} involved={involved} currency={c} />
        </span>
      )}
    </Link>
  );
}

function EffectLabel({
  effect,
  involved,
  currency,
  inline = false,
}: {
  effect: number;
  involved: boolean;
  currency: Expense['currency'];
  inline?: boolean;
}) {
  if (!involved) return <span className="row-end-label muted">no participás</span>;
  if (effect === 0) return <span className="row-end-label muted">quedás a mano</span>;
  const owed = effect > 0;
  const amount = formatMoney(Math.abs(effect), currency);
  if (inline) {
    return <span className={`row-end-label ${owed ? 'is-owed' : 'is-owe'}`}>{owed ? `te deben ${amount}` : `debés ${amount}`}</span>;
  }
  return (
    <>
      <span className={`row-end-label ${owed ? 'is-owed' : 'is-owe'}`}>{owed ? 'te deben' : 'tu parte'}</span>
      <span className={`amount ${owed ? 'is-owed' : 'is-owe'}`} style={{ fontSize: 16 }}>
        {amount}
      </span>
    </>
  );
}

export function PaymentRow({ ctx, p, showGroup }: { ctx: Ctx; p: Payment; showGroup?: string }) {
  const c = ctx.group.currency;
  const method = p.method ? PAYMENT_METHODS[p.method as PaymentMethod] : null;
  const mine = p.fromId === ctx.me.id || p.toId === ctx.me.id;
  const sub = [showGroup, method?.toLowerCase(), showGroup ? null : relativeDay(p.date)].filter(Boolean).join(' · ');
  return (
    <Link href={`/grupos/${ctx.group.id}/pago/${p.id}`} className={`row${p.voided ? ' is-void' : ''}`} style={{ minHeight: 66 }}>
      <CategoryTile code="PAG" kind={p.voided ? 'void' : 'payment'} />
      <span className="row-main">
        <span className="row-title">{paymentTitle(ctx, p)}</span>
        <span className="row-sub">{p.voided ? 'Pago anulado' : sub || 'pago'}</span>
      </span>
      <span className="row-end">
        <span className="amount" style={{ fontSize: 16 }}>
          {formatMoney(p.amountMinor, c)}
        </span>
        <span className="row-end-label muted">{p.voided ? 'anulado' : mine ? 'pago' : 'no participás'}</span>
      </span>
    </Link>
  );
}
