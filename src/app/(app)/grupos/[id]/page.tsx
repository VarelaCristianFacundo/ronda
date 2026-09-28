import type { Metadata } from 'next';
import Link from 'next/link';
import { BalanceList, heroSentence } from '@/components/balances';
import { PlusIcon } from '@/components/icons';
import { InviteShare } from '@/components/invite-share';
import { ExpenseRow, PaymentRow, movementsOf } from '@/components/movements';
import { SettlePanel } from '@/components/settle-panel';
import { Avatar, RondaAvatar, TopBar } from '@/components/ui';
import { getActiveInvite, getGroup } from '@/lib/data';
import { CURRENCIES, formatMoney, spokenMoney } from '@/lib/money';
import { personas } from '@/lib/labels';

export async function generateMetadata(props: PageProps<'/grupos/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const b = await getGroup(id);
  return { title: b.group.name };
}

export default async function GroupPage(props: PageProps<'/grupos/[id]'>) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const b = await getGroup(id);
  const c = b.group.currency;
  const active = b.members.filter((m) => m.status === 'active');
  const colors = active.map((m) => m.color);
  const letter = b.group.name.trim()[0]?.toUpperCase();
  const isOwner = b.me.role === 'owner';
  const alone = active.length === 1;
  const newId = typeof sp.nuevo === 'string' ? sp.nuevo : null;

  const header = (
    <div className="hstack gap-12">
      <RondaAvatar colors={colors} letter={letter} />
      <span className="stack gap-4" style={{ minWidth: 0 }}>
        <h1 className="t-title">{b.group.name}</h1>
        <span className="t-caption">
          {alone ? `Sólo vos · ${c}` : `${personas(active.length)} · ${formatMoney(b.totalSpent, c)} en gastos`}
        </span>
      </span>
    </div>
  );

  // M08 — just created, nobody else yet.
  if (alone && !b.hasMovements) {
    const invite = await getActiveInvite(b.group.id);
    return (
      <main className="screen has-bottom-bar">
        <TopBar back="/grupos">
          <Link href={`/grupos/${id}/ajustes`} className="btn btn-text">
            Ajustes
          </Link>
        </TopBar>
        <div className="content">
          {header}
          <div className="dashed-card" style={{ marginTop: 22 }}>
            <div className="hstack" aria-hidden="true">
              <span style={{ border: '3px solid var(--paper)', borderRadius: '50%', display: 'inline-flex' }}>
                <Avatar name={b.me.name} color={b.me.color} size={44} />
              </span>
              <span className="avatar avatar-placeholder" style={{ ['--size' as string]: '44px', marginLeft: -8 }} />
              <span className="avatar avatar-placeholder" style={{ ['--size' as string]: '44px', marginLeft: -8 }} />
            </div>
            <h2 style={{ font: '500 24px/1.15 var(--font-display)' }}>Por ahora sos la única persona del grupo</h2>
            <p className="t-body" style={{ fontSize: 16 }}>
              Sumá a quienes comparten los gastos. Podés anotar gastos antes de que entren: agregalos sin cuenta y se les
              asignan cuando acepten.
            </p>
            <InviteShare groupId={b.group.id} groupName={b.group.name} token={invite?.token ?? null} canCreate={isOwner} />
            <Link href={`/grupos/${id}/invitar`} className="btn btn-text">
              Agregar a alguien sin cuenta
            </Link>
          </div>
          <div className="stack gap-6" style={{ paddingTop: 22 }}>
            <span className="overline">Movimientos</span>
            <span className="t-body-sm muted">Todavía no hay gastos. El primero suele ser el alquiler o el súper.</span>
          </div>
        </div>
        <div className="actionbar">
          <Link href={`/grupos/${id}/gasto/nuevo`} className="btn btn-secondary btn-block">
            <PlusIcon />
            Agregar el primer gasto
          </Link>
        </div>
      </main>
    );
  }

  const net = b.balances.get(b.me.id) ?? 0;
  const tone = net > 0 ? 'is-owed' : net < 0 ? 'is-owe' : '';
  const headline = net > 0 ? 'Te deben' : net < 0 ? 'Debés' : 'Estás al día';
  const movements = movementsOf(b);
  const recent = movements.slice(0, 4);

  return (
    <main className="screen has-bottom-bar group-page">
      <TopBar back="/grupos">
        <Link href={`/grupos/${id}/ajustes`} className="btn btn-text">
          Ajustes
        </Link>
        <Link href={`/grupos/${id}/invitar`} className="btn btn-text">
          Invitar
        </Link>
      </TopBar>
      {/* Desktop header bar (D01): title and all group actions in one row. */}
      <div className="group-desk-head">
        <div style={{ flex: 1, minWidth: 0 }}>{header}</div>
        <Link href={`/grupos/${id}/ajustes`} className="btn btn-text btn-md">
          Ajustes
        </Link>
        <Link href={`/grupos/${id}/invitar`} className="btn btn-text btn-md">
          Invitar
        </Link>
        <Link href={`/grupos/${id}/saldar`} className="btn btn-secondary btn-md">
          Saldar
        </Link>
        <Link href={`/grupos/${id}/gasto/nuevo`} className="btn btn-primary btn-md">
          <PlusIcon size={16} />
          Agregar gasto
        </Link>
      </div>
      <div className="group-layout">
        <div className="content group-main">
          <div className="group-mobile-head">{header}</div>
          <section aria-label="Tu saldo" className="rule" style={{ marginTop: 20, paddingBottom: 18 }}>
            <h2 className={`overline ${tone}`}>{headline}</h2>
            <div
              className={`amount amount-xl ${tone}`}
              style={{ margin: '8px 0 10px' }}
              aria-label={`${headline} ${spokenMoney(Math.abs(net), c)}`}
            >
              {formatMoney(Math.abs(net), c)}
            </div>
            <p className="t-body-sm">
              {b.myTotals.paid > 0 && (
                <>
                  Pagaste {formatMoney(b.myTotals.paid, c)} y tu parte es {formatMoney(b.myTotals.share, c)}.{' '}
                </>
              )}
              {heroSentence(b)}{' '}
              {net !== 0 && (
                <Link href={`/grupos/${id}/saldar`} className="text-link">
                  Ver cómo saldar
                </Link>
              )}
            </p>
          </section>

          <section aria-labelledby="saldos" className="group-balances-mobile" style={{ paddingTop: 16 }}>
            <h2 id="saldos" className="overline" style={{ marginBottom: 4 }}>
              Saldos del grupo
            </h2>
            <BalanceList b={b} />
          </section>

          <section aria-labelledby="movs" style={{ paddingTop: 14 }}>
            <div className="hstack between" style={{ alignItems: 'baseline', marginBottom: 4 }}>
              <h2 id="movs" className="overline">
                Últimos movimientos
              </h2>
              <Link href={`/grupos/${id}/historial`} style={{ font: '600 14px/1 var(--font-ui)' }}>
                Ver todo
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="t-body-sm muted" style={{ padding: '12px 0' }}>
                Todavía no hay gastos. El primero suele ser el alquiler o el súper.
              </p>
            ) : (
              <div className="list">
                {recent.map((m) =>
                  m.kind === 'expense' ? (
                    <ExpenseRow key={m.item.id} ctx={b} e={m.item} highlight={m.item.id === newId} />
                  ) : (
                    <PaymentRow key={m.item.id} ctx={b} p={m.item} />
                  ),
                )}
              </div>
            )}
          </section>
        </div>
        <aside className="group-side" aria-label="Saldos y cómo saldar">
          <div>
            <h2 className="t-section rule" style={{ paddingBottom: 10 }}>
              Saldos
            </h2>
            <BalanceList b={b} rowHeight={48} />
          </div>
          <SettlePanel b={b} compact />
        </aside>
      </div>
      <div className="actionbar">
        <div className="actionbar-split">
          <Link href={`/grupos/${id}/saldar`} className="btn btn-secondary">
            Saldar
          </Link>
          <Link href={`/grupos/${id}/gasto/nuevo`} className="btn btn-primary">
            <PlusIcon />
            Agregar gasto
          </Link>
        </div>
      </div>
      <span className="sr-only">Moneda del grupo: {CURRENCIES[c].name}</span>
    </main>
  );
}
