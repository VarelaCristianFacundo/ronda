import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckIcon } from '@/components/icons';
import { actorName, fullName, getGroup, isUuid } from '@/lib/data';
import { formatDateTime, formatDay, PAYMENT_METHODS, type PaymentMethod } from '@/lib/labels';
import { formatMoney } from '@/lib/money';
import { ReceiptActions } from './receipt-actions';

export const metadata: Metadata = { title: 'Comprobante de pago' };

export default async function PaymentReceipt(props: PageProps<'/grupos/[id]/pago/[paymentId]'>) {
  const { id, paymentId } = await props.params;
  if (!isUuid(paymentId)) notFound();
  const sp = await props.searchParams;
  const b = await getGroup(id);
  const p = b.payments.find((x) => x.id === paymentId);
  if (!p) notFound();
  const c = b.group.currency;
  const fresh = sp.nuevo === '1';
  const code = `PAG-${String(p.receiptNumber).padStart(5, '0')}`;
  const stillOwes = b.transfers.find((t) => t.fromId === p.fromId && t.toId === p.toId)?.amountMinor ?? 0;
  const from = fullName(b, p.fromId);
  const to = fullName(b, p.toId);
  const recorder = actorName(b, p.createdBy);
  const voider = p.voided ? actorName(b, p.voidedBy) : null;

  const owesLabel =
    p.toId === b.me.id ? `${from.split(' ')[0]} todavía te debe` : p.fromId === b.me.id ? `Todavía le debés a ${to.split(' ')[0]}` : `${from.split(' ')[0]} todavía le debe a ${to.split(' ')[0]}`;
  const shareText = [
    `Comprobante Ronda · ${b.group.name} · ${code}`,
    `${from} → ${to}: ${formatMoney(p.amountMinor, c)}`,
    `Fecha: ${formatDay(p.date, { year: 'always' })}`,
    p.voided ? 'ANULADO' : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <main className="screen receipt-screen screen-narrow" style={{ maxWidth: 560 }}>
      <div className="stack" style={{ flex: 1, padding: '36px 24px 0' }}>
        <div className="receipt">
          <span
            aria-hidden="true"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: p.voided ? 'var(--sunk)' : 'var(--marigold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {p.voided ? <span style={{ font: '800 24px/1 var(--font-ui)' }}>×</span> : <CheckIcon size={26} color="var(--ink)" />}
          </span>
          <div className="stack gap-6">
            <h1 className="t-h1-sm">{p.voided ? 'Pago anulado' : fresh ? 'Pago registrado' : 'Comprobante de pago'}</h1>
            <span className="t-body-sm" style={{ fontSize: 15 }}>
              {p.voided
                ? `${voider?.isMe ? 'Lo anulaste' : `Lo anuló ${voider?.name ?? 'alguien'}`} el ${formatDateTime(p.voidedAt!)}${p.voidReason ? ` · “${p.voidReason}”` : ''}. Ya no cuenta para los saldos.`
                : `Quedó en el historial del grupo. Lo registró ${recorder.isMe ? 'vos' : recorder.name}.`}
            </span>
          </div>
          <div style={{ borderTop: '1.5px solid var(--ink)' }}>
            <Kv k="De" v={from} />
            <Kv k="Para" v={to} />
            <Kv k="Fecha" v={formatDay(p.date, { year: 'always' })} />
            {p.method && <Kv k="Medio" v={PAYMENT_METHODS[p.method as PaymentMethod]} />}
            {p.note && <Kv k="Nota" v={p.note} />}
            <div className="kv" style={{ padding: '14px 0' }}>
              <span style={{ font: '600 15px/1 var(--font-ui)' }}>Monto</span>
              <span className="leader" aria-hidden="true" style={{ transform: 'none' }} />
              <span className="amount" style={{ fontSize: 26, textDecoration: p.voided ? 'line-through' : undefined }}>
                {formatMoney(p.amountMinor, c)}
              </span>
            </div>
            {!p.voided && stillOwes > 0 && (
              <div className="kv">
                <span className="kv-k">{owesLabel}</span>
                <span className="leader" aria-hidden="true" style={{ transform: 'none' }} />
                <span className={`amount ${p.toId === b.me.id ? 'is-owed' : p.fromId === b.me.id ? 'is-owe' : ''}`} style={{ fontSize: 17 }}>
                  {formatMoney(stillOwes, c)}
                </span>
              </div>
            )}
          </div>
          <span style={{ font: '400 12px/1 ui-monospace, Menlo, monospace', color: 'var(--ink-2)' }}>
            {b.group.name} · {code}
          </span>
        </div>
        <div className="receipt-edge" aria-hidden="true" />
      </div>
      <div className="stack gap-12" style={{ padding: '24px 24px 34px' }}>
        <Link href={`/grupos/${id}`} className="btn btn-primary btn-block">
          Listo
        </Link>
        <ReceiptActions groupId={id} paymentId={paymentId} shareText={shareText} voided={p.voided} />
      </div>
    </main>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <span className="kv-k">{k}</span>
      <span className="leader" aria-hidden="true" style={{ transform: 'none' }} />
      <span className="kv-v">{v}</span>
    </div>
  );
}
