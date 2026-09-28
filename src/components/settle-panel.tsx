import Link from 'next/link';
import { who, type GroupBundle } from '@/lib/data';
import { formatMoney } from '@/lib/money';
import type { Transfer } from '@/lib/settle';
import { PayArrow } from './icons';
import { Avatar } from './ui';

type B = Pick<GroupBundle, 'transfers' | 'byId' | 'me' | 'group'>;

export function transfersCopy(n: number): string {
  if (n === 0) return 'Nadie le debe nada a nadie. Están todos a mano.';
  const t = n === 1 ? 'Con esta transferencia quedan' : `Con estas ${n} transferencias quedan`;
  return `${t} todos a mano. Es una forma posible de saldar, pensada para usar pocas transferencias; también vale cualquier otra combinación que deje los saldos en cero.`;
}

function payHref(b: B, t: Transfer) {
  return `/grupos/${b.group.id}/pago/nuevo?de=${t.fromId}&a=${t.toId}`;
}

function Pair({ b, t, size = 32, muted = false }: { b: B; t: Transfer; size?: number; muted?: boolean }) {
  const from = b.byId.get(t.fromId)!;
  const to = b.byId.get(t.toId)!;
  return (
    <span className="hstack" aria-hidden="true">
      <Avatar name={from.name} color={from.color} size={size} inactive={from.status !== 'active'} />
      <PayArrow color={muted ? 'var(--ink-2)' : 'var(--ink)'} />
      <span style={{ marginLeft: 2, display: 'inline-flex' }}>
        <Avatar name={to.name} color={to.color} size={size} inactive={to.status !== 'active'} />
      </span>
    </span>
  );
}

/** Full "Cómo saldar" list (M16). `compact` is the desktop side-panel variant (D01). */
export function SettlePanel({ b, compact = false }: { b: B; compact?: boolean }) {
  const c = b.group.currency;
  const toMe = b.transfers.filter((t) => t.toId === b.me.id);
  const fromMe = b.transfers.filter((t) => t.fromId === b.me.id);
  const rest = b.transfers.filter((t) => t.toId !== b.me.id && t.fromId !== b.me.id);

  if (compact) {
    return (
      <div>
        <div className="hstack between rule" style={{ alignItems: 'baseline', paddingBottom: 10 }}>
          <h2 className="t-section">Cómo saldar</h2>
          <span className="t-caption">{b.transfers.length === 1 ? '1 pago' : `${b.transfers.length} pagos`}</span>
        </div>
        {b.transfers.length === 0 ? (
          <p className="t-body-sm muted" style={{ padding: '14px 0' }}>
            Están todos a mano.
          </p>
        ) : (
          <div className="list">
            {[...toMe, ...fromMe, ...rest].map((t) => {
              const mine = t.toId === b.me.id || t.fromId === b.me.id;
              return (
                <div key={`${t.fromId}-${t.toId}`} className="hstack gap-10" style={{ minHeight: mine ? 60 : 52 }}>
                  <span style={{ flex: 1, font: '500 15px/1.2 var(--font-ui)', color: mine ? 'var(--ink)' : 'var(--ink-body)' }}>
                    {who(b, t.fromId)} <span className="muted">→</span> {t.toId === b.me.id ? 'vos' : who(b, t.toId)}
                  </span>
                  <span className={`amount ${t.toId === b.me.id ? 'is-owed' : t.fromId === b.me.id ? 'is-owe' : ''}`} style={{ fontSize: 16 }}>
                    {formatMoney(t.amountMinor, c)}
                  </span>
                  {mine && (
                    <Link href={payHref(b, t)} className="btn btn-secondary" style={{ height: 40, padding: '0 12px', borderRadius: 10, fontSize: 13 }}>
                      Registrar
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const Row = ({ t, verb, primary }: { t: Transfer; verb: string; primary?: boolean }) => (
    <div className="hstack gap-12" style={{ minHeight: 76 }}>
      <Pair b={b} t={t} />
      <span className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
        <span style={{ font: '600 15px/1.2 var(--font-ui)' }}>{verb}</span>
        <span className={`amount ${t.toId === b.me.id ? 'is-owed' : 'is-owe'}`} style={{ fontSize: 18 }}>
          {formatMoney(t.amountMinor, c)}
        </span>
      </span>
      <Link href={payHref(b, t)} className={`btn btn-sm ${primary ? 'btn-primary' : 'btn-secondary'}`}>
        Registrar
      </Link>
    </div>
  );

  return (
    <div className="stack">
      {toMe.length > 0 && (
        <>
          <h2 className="overline is-owed rule" style={{ paddingBottom: 4 }}>
            Te pagan a vos
          </h2>
          <div className="list">
            {toMe.map((t, i) => (
              <Row key={t.fromId} t={t} verb={`${who(b, t.fromId)} te paga`} primary={i === toMe.length - 1} />
            ))}
          </div>
        </>
      )}
      {fromMe.length > 0 && (
        <>
          <h2 className="overline is-owe rule" style={{ paddingBottom: 4, paddingTop: toMe.length ? 20 : 0 }}>
            Vos pagás
          </h2>
          <div className="list">
            {fromMe.map((t) => (
              <Row key={t.toId} t={t} verb={`Le pagás a ${who(b, t.toId)}`} primary />
            ))}
          </div>
        </>
      )}
      {rest.length > 0 && (
        <>
          <h2 className="overline rule" style={{ paddingBottom: 4, paddingTop: toMe.length || fromMe.length ? 20 : 0 }}>
            Entre el resto
          </h2>
          <div className="list">
            {rest.map((t) => (
              <Link key={`${t.fromId}-${t.toId}`} href={payHref(b, t)} className="row" style={{ minHeight: 68 }}>
                <Pair b={b} t={t} muted />
                <span style={{ flex: 1, font: '500 15px/1.2 var(--font-ui)' }}>
                  {who(b, t.fromId)} le paga a {who(b, t.toId)}
                </span>
                <span className="amount" style={{ fontSize: 17 }}>
                  {formatMoney(t.amountMinor, c)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
