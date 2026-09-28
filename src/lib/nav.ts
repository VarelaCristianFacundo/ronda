/** Post-login destination: same-origin relative paths only (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/grupos'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (next === '/' || next.startsWith('/entrar') || next.startsWith('/auth')) return fallback;
  return next;
}
