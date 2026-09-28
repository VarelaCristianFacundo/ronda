'use client';

import Link from 'next/link';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="screen screen-narrow" style={{ padding: '64px 24px' }}>
      <div className="stack gap-18">
        <span className="bang" aria-hidden="true" style={{ width: 40, height: 40, fontSize: 22, lineHeight: '40px' }}>
          !
        </span>
        <h1 className="t-h1">No pudimos cargar esto</h1>
        <p className="t-body">Puede ser la conexión o un problema nuestro. Tus datos están a salvo: no se perdió nada.</p>
        <button type="button" className="btn btn-primary btn-block" onClick={reset}>
          Reintentar
        </button>
        <Link href="/grupos" className="btn btn-text btn-block">
          Volver a tus grupos
        </Link>
      </div>
    </main>
  );
}
