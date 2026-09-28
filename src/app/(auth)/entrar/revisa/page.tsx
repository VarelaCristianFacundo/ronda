import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckIcon } from '@/components/icons';
import { TopBar } from '@/components/ui';
import { inboxUrl, isValidEmail } from '@/lib/email';
import { safeNext } from '@/lib/nav';
import { ResendForm } from './resend-form';

export const metadata: Metadata = { title: 'Revisá tu correo' };

export default async function CheckEmail(props: PageProps<'/entrar/revisa'>) {
  const sp = await props.searchParams;
  const email = typeof sp.email === 'string' ? sp.email : '';
  const next = safeNext(typeof sp.next === 'string' ? sp.next : null);
  if (!isValidEmail(email)) redirect('/entrar');
  const inbox = inboxUrl(email);

  return (
    <main className="screen screen-narrow">
      <TopBar back={`/entrar?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`} />
      <div className="stack gap-18" style={{ flex: 1, padding: '40px 24px 24px' }}>
        <span
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: '5px solid var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckIcon size={30} color="var(--ink)" />
        </span>
        <h1 className="t-h1">Revisá tu correo</h1>
        <p className="t-body" role="status">
          {sp.reenviado ? 'Te mandamos otro link a ' : 'Mandamos un link a '}
          <b style={{ color: 'var(--ink)' }}>{email}</b>. Tocalo para entrar. Vence en 15 minutos.
        </p>
        <p className="t-caption">¿No llega? Fijate en spam o promociones.</p>
      </div>
      <div className="stack gap-12" style={{ padding: '0 24px 34px' }}>
        {inbox && (
          <a href={inbox} target="_blank" rel="noreferrer" className="btn btn-primary btn-block">
            Abrir mi correo
          </a>
        )}
        {/* Remount after each resend so the countdown starts over. */}
        <ResendForm key={typeof sp.t === 'string' ? sp.t : 'first'} email={email} next={next} />
        <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="btn btn-text btn-block">
          Usar otro email
        </Link>
      </div>
    </main>
  );
}
