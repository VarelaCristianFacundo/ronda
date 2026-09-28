import Link from 'next/link';

/** Mobile bottom navigation: three destinations (design system §08). */
export function TabBar({ current }: { current: 'grupos' | 'actividad' | 'cuenta' }) {
  const on = (k: typeof current) => (current === k ? ('page' as const) : undefined);
  const ink = (k: typeof current) => (current === k ? 'var(--ink)' : 'var(--ink-2)');
  return (
    <nav className="tabbar" aria-label="Principal">
      <Link href="/grupos" className="tab" aria-current={on('grupos')}>
        <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', border: `3px solid ${ink('grupos')}` }} />
        Grupos
        <span className="tab-bar" aria-hidden="true" />
      </Link>
      <Link href="/actividad" className="tab" aria-current={on('actividad')}>
        <span
          aria-hidden="true"
          style={{ width: 18, height: 18, borderTop: `2.5px solid ${ink('actividad')}`, borderBottom: `2.5px solid ${ink('actividad')}` }}
        />
        Actividad
        <span className="tab-bar" aria-hidden="true" />
      </Link>
      <Link href="/cuenta" className="tab" aria-current={on('cuenta')}>
        <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--av-0)' }} />
        Cuenta
        <span className="tab-bar" aria-hidden="true" />
      </Link>
    </nav>
  );
}
