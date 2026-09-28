import type { Metadata } from 'next';
import Link from 'next/link';
import { SettlePanel, transfersCopy } from '@/components/settle-panel';
import { TopBar } from '@/components/ui';
import { getGroup } from '@/lib/data';
import { formatMoney } from '@/lib/money';
import { ReminderButton } from './reminder-button';

export const metadata: Metadata = { title: 'Cómo saldar' };

export default async function SettlePage(props: PageProps<'/grupos/[id]/saldar'>) {
  const { id } = await props.params;
  const b = await getGroup(id);
  const c = b.group.currency;
  const reminder = [
    `Cuentas de “${b.group.name}” en Ronda:`,
    ...b.transfers.map((t) => `• ${b.byId.get(t.fromId)?.name} → ${b.byId.get(t.toId)?.name}: ${formatMoney(t.amountMinor, c)}`),
    'Cuando transfieras, registralo en Ronda así queda para todos.',
  ].join('\n');
  const owesMe = b.transfers.some((t) => t.toId === b.me.id);

  return (
    <main className="screen has-bottom-bar">
      <TopBar back={`/grupos/${id}`} subtitle={b.group.name} />
      <div className="content stack gap-8">
        <h1 className="t-h1-sm">Cómo saldar</h1>
        <p className="t-body-sm">{transfersCopy(b.transfers.length)}</p>
      </div>
      <div className="content" style={{ paddingTop: 14 }}>
        <SettlePanel b={b} />
        <div className="note" style={{ marginTop: 18 }}>
          Ronda no mueve plata. Transferí con tu banco o billetera y registralo acá para que todos lo vean. Los pagos
          parciales también cuentan.
        </div>
        <Link href={`/grupos/${id}/pago/nuevo`} className="btn btn-text btn-block" style={{ marginTop: 8 }}>
          Registrar otro pago
        </Link>
        {b.transfers.length === 0 && (
          <p className="t-caption" style={{ textAlign: 'center' }}>
            Si alguien igual te transfiere, podés registrarlo: el saldo queda a su favor.
          </p>
        )}
      </div>
      {b.transfers.length > 0 && (
        <div className="actionbar">
          <ReminderButton text={reminder} label={owesMe ? 'Recordarles por WhatsApp' : 'Compartir por WhatsApp'} />
        </div>
      )}
    </main>
  );
}
