import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TopBar } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';

export const metadata: Metadata = { title: 'Unirme a un grupo' };

async function openInvite(formData: FormData) {
  'use server';
  const raw = String(formData.get('link') ?? '').trim();
  // Accept a full link (…/u/TOKEN) or just the token.
  const token = raw.match(/\/u\/([A-Za-z0-9_-]{16,64})/)?.[1] ?? raw.match(/^[A-Za-z0-9_-]{16,64}$/)?.[0];
  redirect(token ? `/u/${token}` : '/grupos/unirme?error=1');
}

export default async function JoinPage(props: PageProps<'/grupos/unirme'>) {
  const sp = await props.searchParams;
  return (
    <main className="screen">
      <TopBar back="/grupos" />
      <form action={openInvite} className="content stack gap-18" style={{ paddingTop: 8 }}>
        <h1 className="t-h1">Pegá el link de invitación</h1>
        <p className="t-body">Es el link que te pasaron por WhatsApp. También funciona si lo abrís directo desde el mensaje.</p>
        <div className="field">
          <label className="field-label" htmlFor="link">
            Link
          </label>
          <input
            id="link"
            name="link"
            className="input"
            required
            autoFocus
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://…/u/…"
            aria-invalid={sp.error ? true : undefined}
          />
          {sp.error && (
            <span className="field-error" role="alert">
              <span className="bang" aria-hidden="true">
                !
              </span>
              Ese link no parece una invitación de Ronda.
            </span>
          )}
        </div>
        <SubmitButton pendingLabel="Abriendo…">Continuar</SubmitButton>
      </form>
    </main>
  );
}
