import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="screen screen-narrow" style={{ padding: '64px 24px' }}>
      <div className="stack gap-18">
        <span className="brand">
          <span className="brand-mark" />
          ronda
        </span>
        <h1 className="t-h1">No encontramos esta página</h1>
        <p className="t-body">Puede que el enlace esté mal, que ya no exista o que no formes parte de este grupo.</p>
        <Link href="/grupos" className="btn btn-primary btn-block">
          Ir a tus grupos
        </Link>
      </div>
    </main>
  );
}
