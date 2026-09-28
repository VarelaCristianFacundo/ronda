'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CloseIcon, PayArrow } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, FieldError } from '@/components/ui';
import { formatDay, PAYMENT_METHODS, todayIso, type PaymentMethod } from '@/lib/labels';
import { CURRENCIES, formatMoney, parseAmount, toInputValue, type CurrencyCode } from '@/lib/money';
import { recordPayment, voidPayment } from '../actions';

type Person = { id: string; label: string; name: string; color: number; alias: string | null };

export function PaymentForm({
  groupId,
  groupName,
  currency,
  meId,
  people,
  initialFrom,
  initialTo,
  suggested,
}: {
  groupId: string;
  groupName: string;
  currency: CurrencyCode;
  meId: string;
  people: Person[];
  initialFrom: string;
  initialTo: string;
  suggested: { fromId: string; toId: string; amountMinor: number }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const byId = new Map(people.map((p) => [p.id, p]));
  const [fromId, setFromId] = useState(initialFrom);
  const [toId, setToId] = useState(initialTo);
  const owed = (f: string, t: string) => suggested.find((s) => s.fromId === f && s.toId === t)?.amountMinor ?? 0;
  const [amountText, setAmountText] = useState(() => (owed(initialFrom, initialTo) ? toInputValue(owed(initialFrom, initialTo)) : ''));
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState<PaymentMethod | ''>('transferencia');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const c = currency;
  const amount = parseAmount(amountText);
  const due = owed(fromId, toId);
  const left = amount !== null ? due - amount : due;
  const from = byId.get(fromId);
  const to = byId.get(toId);
  const fromMe = fromId === meId;
  const toMe = toId === meId;

  const title = fromMe ? `Le pagaste a ${to?.label}` : toMe ? `${from?.label} te pagó` : `${from?.label} le pagó a ${to?.label}`;
  const dueLine = due
    ? toMe
      ? `Te debe ${formatMoney(due, c)}`
      : fromMe
        ? `Le debés ${formatMoney(due, c)}`
        : `Le debe ${formatMoney(due, c)}`
    : 'No hay una deuda sugerida entre estas personas';

  const remainder =
    amount === null || !due
      ? null
      : left > 0
        ? {
            text: toMe ? `Pago parcial · ${from?.label} va a seguir debiéndote` : fromMe ? `Pago parcial · vas a seguir debiéndole` : `Pago parcial · ${from?.label} va a seguir debiendo`,
            amount: left,
            tone: toMe ? 'is-owed' : fromMe ? 'is-owe' : '',
          }
        : left === 0
          ? { text: 'Con este pago quedan a mano', amount: null, tone: '' }
          : { text: `Paga ${formatMoney(-left, c)} de más: queda a favor de ${fromMe ? 'vos' : from?.label}`, amount: null, tone: '' };

  const reason = fromId === toId ? 'Elegí dos personas distintas.' : !amountText.trim() ? 'Escribí el monto.' : amount === null || amount === 0 ? 'El monto no es válido.' : null;
  const receiverAlias = to?.alias;

  function submit() {
    setTouched(true);
    if (reason || !amount) return;
    setError(null);
    start(async () => {
      const r = await recordPayment(groupId, { fromId, toId, amountMinor: amount, date, method: method || null, note: note.trim() || null });
      if (!r.ok) return setError(r.error);
      const paymentId = r.data.paymentId;
      router.push(`/grupos/${groupId}/pago/${paymentId}?nuevo=1`);
      toast({
        message: r.data.message,
        action: {
          label: 'Deshacer',
          onClick: async () => {
            const v = await voidPayment(groupId, paymentId, 'Deshecho al registrarlo');
            toast(v.ok ? { message: 'Listo, anulamos el pago. Queda en el historial como anulado.' } : { tone: 'error', message: v.error });
            router.refresh();
          },
        },
      });
    });
  }

  return (
    <div className="expense-sheet pay-sheet">
      <Link href={`/grupos/${groupId}/saldar`} className="sheet-backdrop" aria-label="Cerrar" tabIndex={-1} />
      <form
        className="sheet-panel"
        role="dialog"
        aria-label="Registrar pago"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="topbar sheet-top">
          <Link href={`/grupos/${groupId}/saldar`} className="icon-btn" aria-label="Cerrar">
            <CloseIcon />
          </Link>
          <span className="topbar-title">
            <strong>Registrar pago</strong>
            <span>{groupName}</span>
          </span>
        </div>
        <div className="sheet-body stack gap-18">
          <div className="hstack gap-14">
            {from && to && (
              <span className="hstack" aria-hidden="true">
                <Avatar name={from.name} color={from.color} size={44} />
                <PayArrow length={22} head={8} />
                <span style={{ marginLeft: 2, display: 'inline-flex' }}>
                  <Avatar name={to.name} color={to.color} size={44} />
                </span>
              </span>
            )}
            <span className="stack gap-4" style={{ minWidth: 0 }}>
              <h1 style={{ font: '500 24px/1.1 var(--font-display)' }}>{title}</h1>
              <span className="t-caption">{dueLine}</span>
            </span>
          </div>

          <div className="grid-2">
            <label className="field">
              <span className="field-label">Paga</span>
              <select className="select" value={fromId} onChange={(e) => {
                setFromId(e.target.value);
                const d = owed(e.target.value, toId);
                if (d) setAmountText(toInputValue(d));
              }}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Recibe</span>
              <select className="select" value={toId} onChange={(e) => {
                setToId(e.target.value);
                const d = owed(fromId, e.target.value);
                if (d) setAmountText(toInputValue(d));
              }}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="stack gap-10">
            <label className="amount-field">
              <span className="currency">{CURRENCIES[c].symbol}</span>
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                aria-label={`Monto del pago en ${CURRENCIES[c].name}`}
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onBlur={() => amount !== null && setAmountText(toInputValue(amount))}
              />
            </label>
            {due > 0 && (
              <div className="hstack gap-8">
                <button type="button" className="chip" onClick={() => setAmountText(toInputValue(due))} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  Todo · {formatMoney(due, c)}
                </button>
                {due >= 2 && (
                  <button type="button" className="chip" onClick={() => setAmountText(toInputValue(Math.floor(due / 2)))} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    Mitad · {formatMoney(Math.floor(due / 2), c)}
                  </button>
                )}
              </div>
            )}
          </div>

          {remainder && (
            <div className="note hstack gap-8" style={{ alignItems: 'baseline', color: 'var(--ink)', fontSize: 15 }} aria-live="polite">
              <span style={{ font: '500 15px/1.3 var(--font-ui)' }}>{remainder.text}</span>
              {remainder.amount !== null && (
                <>
                  <span className="leader leader-up" aria-hidden="true" />
                  <span className={`amount ${remainder.tone}`} style={{ fontSize: 18 }}>
                    {formatMoney(remainder.amount, c)}
                  </span>
                </>
              )}
            </div>
          )}

          <div className="grid-2">
            <label className="tile">
              <span className="tile-text">
                <span className="tile-label">Fecha</span>
                <span className="tile-value">{date === todayIso() ? `Hoy, ${formatDay(date)}` : formatDay(date, { year: 'always' })}</span>
              </span>
              <input type="date" aria-label="Fecha del pago" value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
            <label className="tile">
              <span className="tile-text">
                <span className="tile-label">Medio (opcional)</span>
                <span className="tile-value">{method ? PAYMENT_METHODS[method] : 'Sin indicar'}</span>
              </span>
              <select aria-label="Medio de pago" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}>
                <option value="">Sin indicar</option>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input className="input" aria-label="Nota (opcional)" placeholder="Nota (opcional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {receiverAlias && (
            <div className="stack gap-4" style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)' }}>
              <span style={{ font: '600 12px/1 var(--font-ui)', color: 'var(--ink-2)' }}>{toMe ? 'Tu alias para recibir' : `Alias de ${to?.label}`}</span>
              <span className="hstack between" style={{ font: '500 15px/1 ui-monospace, Menlo, monospace' }}>
                {receiverAlias}
                <button
                  type="button"
                  className="link-button"
                  style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-ui)', margin: 0 }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(receiverAlias).catch(() => {});
                    toast({ message: 'Alias copiado.' });
                  }}
                >
                  Copiar
                </button>
              </span>
            </div>
          )}
        </div>
        <div className="sheet-foot stack gap-10">
          {error && (
            <div className="alert" role="alert">
              <span className="bang" aria-hidden="true">
                !
              </span>
              {error}
            </div>
          )}
          {reason && touched && <FieldError>{reason}</FieldError>}
          <div className="sheet-actions">
            <Link href={`/grupos/${groupId}/saldar`} className="btn sheet-desktop-only">
              Cancelar
            </Link>
            <button type="submit" className="btn btn-primary" aria-disabled={Boolean(reason) || pending} disabled={pending} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {pending && <span className="spinner" aria-hidden="true" />}
              {pending ? 'Registrando…' : amount ? `Registrar ${formatMoney(amount, c)}` : 'Registrar pago'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
