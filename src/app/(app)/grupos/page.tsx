import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon } from '@/components/icons';
import { TabBar } from '@/components/tabbar';
import { Avatar, RondaAvatar } from '@/components/ui';
import { getGroupSummaries, getProfile } from '@/lib/data';
import { personas, relativeDay, tsToDay } from '@/lib/labels';
import { formatMoney, spokenMoney, type CurrencyCode } from '@/lib/money';
import { overallByCurrency } from '@/lib/overall';

export const metadata: Metadata = { title: 'Tus grupos' };

export default async function GroupsPage() {
  const [profile, list] = await Promise.all([getProfile(), getGroupSummaries()]);
  const firstName = profile.name.split(' ')[0];

  if (list.length === 0) {
    return (
      <main className="screen has-tabbar">
        <Header firstName={firstName} name={profile.name} />
        <div className="content stack gap-18" style={{ flex: 1, justifyContent: 'center', padding: '40px 24px 120px' }}>
          <span
            aria-hidden="true"
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              border: '3px dashed var(--line-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--av-0)' }} />
          </span>
          <h1 className="t-h1">Todavía no tenés grupos</h1>
          <p className="t-body">Creá uno para el viaje, la casa o la pareja. Después sumás al resto con un link por WhatsApp.</p>
          <div className="stack gap-12" style={{ marginTop: 8 }}>
            <Link href="/grupos/nuevo" className="btn btn-primary btn-block" style={{ fontSize: 17 }}>
              Crear un grupo
            </Link>
            <Link href="/grupos/unirme" className="btn btn-secondary btn-block" style={{ fontSize: 17 }}>
              Tengo un link de invitación
            </Link>
          </div>
        </div>
        <TabBar current="grupos" />
      </main>
    );
  }

  const [first, ...others] = overallByCurrency(list);
  const toneClass = (t: string) => (t === 'owed' ? 'is-owed' : t === 'owe' ? 'is-owe' : '');

  return (
    <main className="screen has-tabbar">
      <Header firstName={firstName} name={profile.name} />
      <div className="content">
        <section aria-label="Saldo general" className="rule" style={{ padding: '6px 0 22px' }}>
          <h1 className={`overline ${toneClass(first.tone)}`}>{first.headline}</h1>
          <div
            className={`amount amount-xxl ${toneClass(first.tone)}`}
            style={{ margin: '8px 0 14px' }}
            aria-label={`${first.headline} ${spokenMoney(Math.abs(first.netMinor), first.currency)}`}
          >
            {formatMoney(Math.abs(first.netMinor), first.currency)}
          </div>
          {others.map((l) => (
            <div key={l.currency} className="hstack gap-8" style={{ font: '500 15px/1.3 var(--font-ui)', marginTop: 4 }}>
              <span className={`pill ${l.tone === 'owed' ? 'pill-owed' : l.tone === 'owe' ? 'pill-owe' : 'pill-settled'}`} style={{ height: 26, padding: '0 8px' }}>
                {l.tone === 'owed' ? '↓ Te deben' : l.tone === 'owe' ? '↑ Debés' : '= Al día'}
              </span>
              {l.tone !== 'settled' && (
                <span className={`amount ${toneClass(l.tone)}`} style={{ fontSize: 17 }}>
                  {formatMoney(Math.abs(l.netMinor), l.currency)}
                </span>
              )}
              <span className="muted">{l.headline.split(' ').slice(0, 2).join(' ').replace('En ', 'en ')}</span>
            </div>
          ))}
        </section>

        <div className="hstack between" style={{ padding: '18px 0 6px', alignItems: 'baseline' }}>
          <h2 className="t-section">Tus grupos</h2>
          <span style={{ font: '500 14px/1 var(--font-ui)', color: 'var(--ink-2)' }}>{list.length}</span>
        </div>
        <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {list.map((g) => (
            <li key={g.id}>
              <Link href={`/grupos/${g.id}`} className="row" style={{ minHeight: 72, gap: 14 }}>
                <RondaAvatar colors={g.colors} letter={g.name.trim()[0]?.toUpperCase()} />
                <span className="row-main">
                  <span className="row-title" style={{ fontSize: 16 }}>
                    {g.name}
                  </span>
                  <span className="row-sub">
                    {personas(g.activeMembers)} · {g.currency !== 'ARS' ? g.currency : g.lastActivityAt ? relativeDay(tsToDay(g.lastActivityAt)) : 'nuevo'}
                  </span>
                </span>
                <GroupBalance netMinor={g.netMinor} currency={g.currency} pair={g.activeMembers === 2} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Link href="/grupos/nuevo" className="btn btn-primary fab">
        <PlusIcon size={20} />
        Nuevo grupo
      </Link>
      <TabBar current="grupos" />
    </main>
  );
}

function Header({ firstName, name }: { firstName: string; name: string }) {
  return (
    <div className="content hstack between" style={{ paddingTop: 14 }}>
      <span style={{ font: '500 15px/1 var(--font-ui)', color: 'var(--ink-2)' }}>Hola, {firstName}</span>
      <Link href="/cuenta" className="icon-btn" aria-label="Tu cuenta">
        <Avatar name={name} color={0} size={36} />
      </Link>
    </div>
  );
}

function GroupBalance({ netMinor, currency, pair }: { netMinor: number; currency: CurrencyCode; pair: boolean }) {
  if (netMinor === 0) return <span className="pill pill-settled">= Al día</span>;
  const owed = netMinor > 0;
  const label = owed ? (pair ? 'te debe' : 'te deben') : pair ? 'le debés' : 'debés';
  return (
    <span className="row-end">
      <span className={`row-end-label ${owed ? 'is-owed' : 'is-owe'}`}>{label}</span>
      <span className={`amount ${owed ? 'is-owed' : 'is-owe'}`} style={{ fontSize: 18 }}>
        {formatMoney(Math.abs(netMinor), currency)}
      </span>
    </span>
  );
}
