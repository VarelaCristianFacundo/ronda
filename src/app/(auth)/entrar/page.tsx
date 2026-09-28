import type { Metadata } from 'next';
import { TopBar } from '@/components/ui';
import { safeNext } from '@/lib/nav';
import { signInWithGoogle } from '../actions';
import { GoogleButton } from '../google-button';
import { EmailForm } from './email-form';

export const metadata: Metadata = { title: 'Entrar' };

const ERRORS: Record<string, string> = {
  link: 'Ese link ya se usó o venció. Pedí uno nuevo.',
  google: 'No pudimos conectar con Google. Probá de nuevo o entrá con tu email.',
};

export default async function SignIn(props: PageProps<'/entrar'>) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === 'string' ? sp.next : null);
  const errorKey = typeof sp.error === 'string' ? sp.error : null;
  const email = typeof sp.email === 'string' ? sp.email : '';
  const google = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
  const invited = next.startsWith('/u/');

  return (
    <main className="screen screen-narrow">
      <TopBar back="/" />
      <div className="stack gap-22" style={{ padding: '16px 24px', flex: 1 }}>
        <div className="stack gap-10">
          <h1 className="t-h1">Entrá con tu email</h1>
          <p className="t-body" style={{ fontSize: 16 }}>
            Te mandamos un link para entrar. Sin contraseñas.
          </p>
        </div>
        <EmailForm next={next} defaultEmail={email} initialError={errorKey ? ERRORS[errorKey] : undefined} />
        {google && (
          <>
            <div className="hstack gap-12" style={{ font: '500 13px/1 var(--font-ui)', color: 'var(--ink-2)' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />o
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>
            <form action={signInWithGoogle}>
              <input type="hidden" name="next" value={next} />
              <GoogleButton />
            </form>
          </>
        )}
      </div>
      <div className="note" style={{ margin: '0 24px 34px', fontSize: 14 }}>
        {invited
          ? 'Entrá para sumarte al grupo al que te invitaron.'
          : '¿Te invitaron a un grupo? Entrá con el mismo email de la invitación y aparece solo.'}
      </div>
    </main>
  );
}
