import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/nav';

/**
 * Completes sign-in for both magic links (token_hash, verified server-side) and OAuth/PKCE
 * (code exchange), then links any group slots reserved for this user's email.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  const tokenHash = url.searchParams.get('token_hash');
  const type = (url.searchParams.get('type') ?? 'email') as EmailOtpType;
  const code = url.searchParams.get('code');

  const supabase = await createClient();
  let ok = false;
  if (tokenHash) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  if (!ok) {
    const back = new URL('/entrar', url.origin);
    back.searchParams.set('error', 'link');
    back.searchParams.set('next', next);
    return NextResponse.redirect(back);
  }

  await supabase.rpc('claim_email_memberships');
  return NextResponse.redirect(new URL(next, url.origin));
}
