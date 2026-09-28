'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isValidEmail, normalizeEmail, suggestEmail } from '@/lib/email';
import { safeNext } from '@/lib/nav';

export type SignInState = { error?: string; suggestion?: string; email?: string };

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') || host?.startsWith('127.') ? 'http' : 'https');
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000');
}

function callbackUrl(base: string, next: string) {
  // The email template appends "&token_hash=…", so the URL must already carry a query string.
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function sendMagicLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const next = safeNext(String(formData.get('next') ?? ''));
  const resend = formData.get('resend') === '1';

  if (!email) return { error: 'Escribí tu email.', email };
  if (!isValidEmail(email)) {
    const suggestion = suggestEmail(email) ?? undefined;
    return {
      email,
      suggestion,
      error: suggestion ? 'Parece que falta el final del email.' : 'Revisá el email: le falta algo.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(await origin(), next), shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429 || /rate limit|security purposes/i.test(error.message)) {
      return { email, error: 'Pediste varios links seguidos. Esperá un minuto y probá de nuevo.' };
    }
    return { email, error: 'No pudimos mandar el link. Revisá tu conexión y probá de nuevo.' };
  }

  const params = new URLSearchParams({ email, next });
  if (resend) {
    params.set('reenviado', '1');
    params.set('t', String(Date.now())); // remounts the countdown
  }
  redirect(`/entrar/revisa?${params.toString()}`);
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(String(formData.get('next') ?? ''));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl(await origin(), next) },
  });
  if (error || !data.url) redirect('/entrar?error=google');
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
