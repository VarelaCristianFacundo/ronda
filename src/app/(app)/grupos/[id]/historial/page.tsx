import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpenseRow, PaymentRow, movementsOf, paymentPhrase } from '@/components/movements';
import { TopBar } from '@/components/ui';
import { actorName, getGroup, getGroupAudit, who, type GroupBundle } from '@/lib/data';
import { formatDateTime, formatDay, todayIso, tsToDay } from '@/lib/labels';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = { title: 'Historial' };

const FILTERS = [
  ['todo', 'Todo'],
  ['gastos', 'Gastos'],
  ['pagos', 'Pagos'],
  ['cambios', 'Cambios'],
] as const;

type Event = Awaited<ReturnType<typeof getGroupAudit>>['events'][number];

function dayHeading(day: string) {
  const today = todayIso();
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (day === today) return `Hoy · ${formatDay(day)}`;
  if (day === y.toISOString().slice(0, 10)) return `Ayer · ${formatDay(day)}`;
  return formatDay(day, { year: 'auto' });
}

/** One audit line, e.g. "Cami editó «Cabaña»" / "Anulaste «Helado»". */
function describe(b: GroupBundle, ev: Event): { text: string; href?: string } {
  const actor = actorName(b, ev.actorUserId);
  const say = (third: string, second: string) => (actor.isMe ? second : `${actor.name} ${third}`);
  const exp = ev.expenseId ? b.expenses.find((e) => e.id === ev.expenseId) : undefined;
  const pay = ev.paymentId ? b.payments.find((p) => p.id === ev.paymentId) : undefined;
  const member = ev.memberId ? who(b, ev.memberId) : 'alguien';
  const c = b.group.currency;
  const d = ev.data;
  const expHref = exp ? `/grupos/${b.group.id}/g/${exp.id}` : undefined;
  const payHref = pay ? `/grupos/${b.group.id}/pago/${pay.id}` : undefined;

  switch (ev.kind) {
    case 'group_created':
      return { text: say('creó el grupo', 'Creaste el grupo') };
    case 'group_renamed':
      return { text: say(`cambió el nombre de «${d.from}» a «${d.to}»`, `Cambiaste el nombre de «${d.from}» a «${d.to}»`) };
    case 'group_currency_changed':
      return { text: say(`cambió la moneda de ${d.from} a ${d.to}`, `Cambiaste la moneda de ${d.from} a ${d.to}`) };
    case 'member_added':
      return { text: say(`agregó a ${member}`, `Agregaste a ${member}`) };
    case 'member_joined':
      return { text: actor.isMe ? 'Te sumaste al grupo' : `${member} se sumó al grupo` };
    case 'member_claimed':
      return { text: actor.isMe ? 'Entraste y tomaste tu lugar en el grupo' : `${member} entró a Ronda y tomó su lugar` };
    case 'member_rejoined':
      return { text: actor.isMe ? 'Volviste al grupo' : `${member} volvió al grupo` };
    case 'member_left':
      return { text: actor.isMe ? 'Saliste del grupo' : `${member} salió del grupo` };
    case 'member_removed': {
      const net = Number(d.net_minor ?? 0);
      const extra = net ? ` con saldo pendiente (${net > 0 ? 'a favor' : 'debía'} ${formatMoney(Math.abs(net), c)})` : '';
      return { text: say(`sacó a ${member} del grupo${extra}`, `Sacaste a ${member} del grupo${extra}`) };
    }
    case 'member_role_changed':
      return {
        text:
          d.to === 'owner'
            ? say(`hizo admin a ${member}`, `Hiciste admin a ${member}`)
            : say(`le sacó la administración a ${member}`, `Le sacaste la administración a ${member}`),
      };
    case 'invite_created':
      return { text: say('generó un link de invitación', 'Generaste un link de invitación') };
    case 'invite_revoked':
      return { text: say('desactivó el link de invitación', 'Desactivaste el link de invitación') };
    case 'expense_created':
      return {
        text: say(`cargó «${d.description}» por ${formatMoney(Number(d.amount_minor), c)}`, `Cargaste «${d.description}» por ${formatMoney(Number(d.amount_minor), c)}`),
        href: expHref,
      };
    case 'expense_edited':
      return { text: say(`editó «${exp?.description ?? 'un gasto'}»`, `Editaste «${exp?.description ?? 'un gasto'}»`), href: expHref };
    case 'expense_voided': {
      const why = d.reason ? `: “${d.reason}”` : '';
      return { text: say(`anuló «${exp?.description ?? 'un gasto'}»${why}`, `Anulaste «${exp?.description ?? 'un gasto'}»${why}`), href: expHref };
    }
    case 'payment_recorded':
      return {
        text: pay ? say(`registró un pago: ${paymentPhrase(b, pay)}`, `Registraste un pago: ${paymentPhrase(b, pay)}`) : say('registró un pago', 'Registraste un pago'),
        href: payHref,
      };
    case 'payment_voided':
      return {
        text: pay ? say(`anuló un pago (${paymentPhrase(b, pay)})`, `Anulaste un pago (${paymentPhrase(b, pay)})`) : say('anuló un pago', 'Anulaste un pago'),
        href: payHref,
      };
    default:
      return { text: say('hizo un cambio', 'Hiciste un cambio') };
  }
}

export default async function HistoryPage(props: PageProps<'/grupos/[id]/historial'>) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const view = FILTERS.some(([k]) => k === sp.ver) ? (sp.ver as (typeof FILTERS)[number][0]) : 'todo';
  const b = await getGroup(id);

  let body: React.ReactNode;
  if (view === 'cambios') {
    const { events } = await getGroupAudit(id);
    const byDay = new Map<string, Event[]>();
    for (const ev of events) {
      const day = tsToDay(ev.createdAt);
      byDay.set(day, [...(byDay.get(day) ?? []), ev]);
    }
    body = [...byDay].map(([day, evs]) => (
      <section key={day}>
        <h2 className="overline list-head">{dayHeading(day)}</h2>
        <ol className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {evs.map((ev) => {
            const { text, href } = describe(b, ev);
            const inner = (
              <span className="stack gap-4" style={{ padding: '12px 0' }}>
                <span style={{ font: '500 15px/1.4 var(--font-ui)' }}>{text}</span>
                <span className="t-caption">{formatDateTime(ev.createdAt)}</span>
              </span>
            );
            return (
              <li key={ev.id}>
                {href ? (
                  <Link href={href} className="row" style={{ minHeight: 0 }}>
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ol>
      </section>
    ));
  } else {
    const list = movementsOf(b).filter((m) => view === 'todo' || (view === 'gastos' ? m.kind === 'expense' : m.kind === 'payment'));
    const byDay = new Map<string, typeof list>();
    for (const m of list) byDay.set(m.item.date, [...(byDay.get(m.item.date) ?? []), m]);
    body =
      list.length === 0 ? (
        <p className="t-body-sm muted" style={{ padding: '24px 0' }}>
          {view === 'pagos' ? 'Todavía no se registraron pagos.' : 'Todavía no hay gastos.'}
        </p>
      ) : (
        [...byDay].map(([day, items]) => (
          <section key={day}>
            <h2 className="overline list-head">{dayHeading(day)}</h2>
            <div className="list">
              {items.map((m) => (m.kind === 'expense' ? <ExpenseRow key={m.item.id} ctx={b} e={m.item} /> : <PaymentRow key={m.item.id} ctx={b} p={m.item} />))}
            </div>
          </section>
        ))
      );
  }

  return (
    <main className="screen">
      <TopBar back={`/grupos/${id}`} title="Historial" subtitle={b.group.name}>
        <a href={`/grupos/${id}/export`} className="btn btn-text" download>
          CSV
        </a>
      </TopBar>
      <div className="content" style={{ paddingBottom: 40 }}>
        <nav className="chips" aria-label="Filtrar historial" style={{ paddingBottom: 8 }}>
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={`/grupos/${id}/historial${k === 'todo' ? '' : `?ver=${k}`}`} className={`chip${view === k ? ' is-selected' : ''}`} aria-current={view === k ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        {view === 'cambios' && (
          <p className="t-caption" style={{ padding: '6px 0' }}>
            Todo lo que pasó en el grupo, con quién lo hizo. Nada se borra: las ediciones guardan la versión anterior y lo
            anulado queda registrado.
          </p>
        )}
        {body}
      </div>
    </main>
  );
}
