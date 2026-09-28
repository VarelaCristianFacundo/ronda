import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sin conexión' };
export const dynamic = 'force-static';

// Precached by the service worker and shown when a page cannot load offline. Balances are
// never cached, so this page does not pretend to show them.
export default function Offline() {
  return (
    <main className="screen screen-narrow" style={{ padding: '64px 24px' }}>
      <div className="stack gap-18">
        <span className="brand">
          <span className="brand-mark" />
          ronda
        </span>
        <h1 className="t-h1">Sin conexión</h1>
        <p className="t-body">
          Ronda necesita internet para mostrarte saldos actualizados. Cuando vuelva la conexión, tocá reintentar.
        </p>
        {/* A plain link reloads the current URL through the network. */}
        <a href="" className="btn btn-primary btn-block">
          Reintentar
        </a>
      </div>
    </main>
  );
}
