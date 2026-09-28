import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpenseRow, PaymentRow, movementsOf, type Movement } from '@/components/movements';
import { TabBar } from '@/components/tabbar';
import { getGroup, getGroupSummaries, type GroupBundle } from '@/lib/data';
import { formatDay, todayIso } from '@/lib/labels';
import { GroupFilter } from './group-filter';

export const metadata: Metadata = { title: 'Actividad' };

const LIMIT = 150;

function dayHeading(day: string) {
  const today = todayIso();
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (day === today) return `Hoy · ${formatDay(day)}`;
  if (day === y.toISOString().slice(0, 10)) return `Ayer · ${formatDay(day)}`;
  return formatDay(day);
}

export default async function ActivityPage(props: PageProps<'/actividad'>) {
  const sp = await props.searchParams;
  const kind = sp.tipo === 'gastos' || sp.tipo === 'pagos' ? sp.tipo : 'todo';
  const summaries = await getGroupSummaries();
  const groupFilter = typeof sp.grupo === 'string' && summaries.some((s) => s.id === sp.grupo) ? sp.grupo : null;
  const bundles = await Promise.all(summaries.filter((s) => !groupFilter || s.id === groupFilter).map((s) => getGroup(s.id)));

  const all: { m: Movement; b: GroupBundle }[] = bundles
    .flatMap((b) => movementsOf(b).map((m) => ({ m, b })))
    .filter(({ m }) => kind === 'todo' || (kind === 'gastos' ? m.kind === 'expense' : m.kind === 'payment'))
    .sort((x, y) => (x.m.at < y.m.at ? 1 : x.m.at > y.m.at ? -1 : 0));
  const shown = all.slice(0, LIMIT);
  const byDay = new Map<string, typeof shown>();
  for (const x of shown) byDay.set(x.m.item.date, [...(byDay.get(x.m.item.date) ?? []), x]);

  const href = (t: string, g: string | null) => {
    const q = new URLSearchParams();
    if (t !== 'todo') q.set('tipo', t);
    if (g) q.set('grupo', g);
    return `/actividad${q.size ? `?${q}` : ''}`;
  };

  return (
    <main className="screen has-tabbar">
      <div className="content" style={{ padding: '14px var(--pad) 12px' }}>
        <h1 className="t-h1-sm" style={{ paddingTop: 10 }}>
          Actividad
        </h1>
      </div>
      <div className="content">
        <nav className="chips" aria-label="Filtrar actividad" style={{ paddingBottom: 8 }}>
          {(
            [
              ['todo', 'Todo'],
              ['gastos', 'Gastos'],
              ['pagos', 'Pagos'],
            ] as const
          ).map(([k, label]) => (
            <Link key={k} href={href(k, groupFilter)} className={`chip${kind === k ? ' is-selected' : ''}`} aria-current={kind === k ? 'page' : undefined}>
              {label}
            </Link>
          ))}
          {summaries.length > 1 && <GroupFilter groups={summaries.map((s) => ({ id: s.id, name: s.name }))} value={groupFilter} kind={kind} />}
        </nav>
        {shown.length === 0 ? (
          <div className="stack gap-12" style={{ padding: '40px 0' }}>
            <h2 className="t-section">Todavía no hay movimientos</h2>
            <p className="t-body-sm">Cuando alguien cargue un gasto o registre un pago en tus grupos, aparece acá.</p>
          </div>
        ) : (
          [...byDay].map(([day, items]) => (
            <section key={day}>
              <h2 className="overline list-head">{dayHeading(day)}</h2>
              <div className="list">
                {items.map(({ m, b }) =>
                  m.kind === 'expense' ? (
                    <ExpenseRow key={m.item.id} ctx={b} e={m.item} showGroup={b.group.name} />
                  ) : (
                    <PaymentRow key={m.item.id} ctx={b} p={m.item} showGroup={b.group.name} />
                  ),
                )}
              </div>
            </section>
          ))
        )}
        {all.length > LIMIT && <p className="t-caption" style={{ padding: '16px 0' }}>Mostramos los {LIMIT} movimientos más recientes. Para ver todo, entrá al historial de cada grupo.</p>}
      </div>
      <TabBar current="actividad" />
    </main>
  );
}
