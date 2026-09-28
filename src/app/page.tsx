import Link from 'next/link';
import { signInWithGoogle } from './(auth)/actions';
import { GoogleButton } from './(auth)/google-button';

const HERO_RING =
  'conic-gradient(#E8B04A 0 70deg,#F7F2E8 70deg 72deg,#9FBFDA 72deg 142deg,#F7F2E8 142deg 144deg,#CBA6C1 144deg 214deg,#F7F2E8 214deg 216deg,#D5B28F 216deg 286deg,#F7F2E8 286deg 288deg,#A9B4C4 288deg 358deg,#F7F2E8 358deg 360deg)';

export default function Welcome() {
  const google = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
  return (
    <main className="screen screen-narrow auth-screen">
      <div style={{ padding: '20px 24px 0' }}>
        <span className="brand">
          <span className="brand-mark" />
          ronda
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
        <div
          aria-hidden="true"
          style={{
            width: 236,
            height: 236,
            borderRadius: '50%',
            background: HERO_RING,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 196,
              height: 196,
              borderRadius: '50%',
              background: 'var(--paper)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{ font: '600 14px/1 var(--font-ui)', color: 'var(--ink-2)' }}>Nico te paga</span>
            <span className="amount is-owed" style={{ fontSize: 36, letterSpacing: '-0.02em' }}>
              $ 38.200
            </span>
            <span style={{ font: '500 13px/1 var(--font-ui)', color: 'var(--ink-2)' }}>y quedan a mano</span>
          </div>
        </div>
      </div>
      <div className="stack gap-14" style={{ padding: '0 24px 34px' }}>
        <h1 className="t-display">Cuentas claras, amistades largas.</h1>
        <p className="t-body" style={{ marginBottom: 10 }}>
          Anotá los gastos compartidos y Ronda te dice quién le debe a quién, sin planillas.
        </p>
        <Link href="/entrar" className="btn btn-primary btn-block" style={{ fontSize: 17 }}>
          Continuar con email
        </Link>
        {google && (
          <form action={signInWithGoogle}>
            <GoogleButton />
          </form>
        )}
        <p style={{ margin: '4px 0 0', font: '400 13px/1.45 var(--font-ui)', color: 'var(--ink-2)', textAlign: 'center' }}>
          Al continuar aceptás los{' '}
          <Link href="/terminos" style={{ color: 'var(--ink)' }}>
            Términos
          </Link>{' '}
          y la{' '}
          <Link href="/privacidad" style={{ color: 'var(--ink)' }}>
            Política de privacidad
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
