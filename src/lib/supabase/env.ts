export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  return v;
}

export function supabaseKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (v.startsWith('sb_secret_')) {
    throw new Error('Refusing to use a Supabase secret key in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  return v;
}
