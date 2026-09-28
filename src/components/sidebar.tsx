'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { overallByCurrency, type OverallLine } from '@/lib/overall';
import type { GroupSummary } from '@/lib/data';
import { PlusIcon } from './icons';
import { Avatar, RondaAvatar } from './ui';

/** Desktop (≥ 1200 px) navigation: groups and their balances always visible (D01). */
export function Sidebar({ profile, groups }: { profile: { name: string }; groups: GroupSummary[] }) {
  const pathname = usePathname();
  const overall = overallByCurrency(groups);
  const [first, ...rest] = overall;

  return (
    <aside className="sidebar" aria-label="Navegación">
      <Link href="/grupos" className="brand" style={{ padding: '0 8px' }}>
        <span className="brand-mark" />
        ronda
      </Link>
      {first && (
        <div className="side-balance">
          <span className={`overline ${first.tone === 'owed' ? 'is-owed' : first.tone === 'owe' ? 'is-owe' : ''}`} style={{ fontSize: 11 }}>
            {first.headline}
          </span>
          <span
            className={`amount ${first.tone === 'owed' ? 'is-owed' : first.tone === 'owe' ? 'is-owe' : ''}`}
            style={{ fontSize: 30 }}
          >
            {formatMoney(Math.abs(first.netMinor), first.currency)}
          </span>
          {rest.map((l) => (
            <SideLine key={l.currency} line={l} />
          ))}
        </div>
      )}
      <nav className="side-nav" aria-label="Grupos">
        <span className="overline" style={{ fontSize: 11, padding: '0 12px 8px' }}>
          Grupos
        </span>
        {groups.map((g) => {
          const href = `/grupos/${g.id}`;
          const current = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={g.id} href={href} className="side-item" aria-current={current ? 'page' : undefined}>
              <RondaAvatar colors={g.colors} size={30} gapColor={current ? 'var(--surface)' : 'var(--paper-2)'} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
              <SideAmount netMinor={g.netMinor} currency={g.currency} />
            </Link>
          );
        })}
      </nav>
      <Link href="/grupos/nuevo" className="btn btn-secondary btn-md" style={{ margin: '0 4px' }}>
        <PlusIcon size={16} />
        Nuevo grupo
      </Link>
      <div className="stack gap-4" style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <Link href="/actividad" className="side-item" style={{ minHeight: 44 }} aria-current={pathname === '/actividad' ? 'page' : undefined}>
          Actividad
        </Link>
        <Link href="/cuenta" className="side-item" style={{ minHeight: 48 }} aria-current={pathname === '/cuenta' ? 'page' : undefined}>
          <Avatar name={profile.name} color={0} size={28} />
          {profile.name}
        </Link>
      </div>
    </aside>
  );
}

function SideLine({ line }: { line: OverallLine }) {
  return (
    <span style={{ font: '500 13px/1.3 var(--font-ui)' }} className={line.tone === 'owed' ? 'is-owed' : line.tone === 'owe' ? 'is-owe' : 'muted'}>
      {line.sentence}
    </span>
  );
}

function SideAmount({ netMinor, currency }: { netMinor: number; currency: CurrencyCode }) {
  if (netMinor === 0) return <span style={{ font: '600 13px/1 var(--font-ui)', color: 'var(--ink-2)' }}>al día</span>;
  const owed = netMinor > 0;
  const body = formatMoney(Math.abs(netMinor), currency, { symbol: currency !== 'ARS' });
  return (
    <span className={`amount ${owed ? 'is-owed' : 'is-owe'}`} style={{ fontSize: 14 }}>
      <span className="sr-only">{owed ? 'te deben ' : 'debés '}</span>
      {owed ? '+' : '−'}
      {body}
    </span>
  );
}
