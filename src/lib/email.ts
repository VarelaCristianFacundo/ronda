const KNOWN_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'hotmail.com.ar',
  'outlook.com',
  'outlook.com.ar',
  'live.com',
  'live.com.ar',
  'yahoo.com',
  'yahoo.com.ar',
  'icloud.com',
  'protonmail.com',
  'fibertel.com.ar',
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$/;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/**
 * Suggests a correction for common typos: missing TLD ("gmail"), or a domain one or two
 * edits away from a well-known provider ("gmial.com"). Returns null when nothing fits.
 */
export function suggestEmail(input: string): string | null {
  const email = normalizeEmail(input);
  const at = email.lastIndexOf('@');
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain || KNOWN_DOMAINS.includes(domain)) return null;

  const bare = KNOWN_DOMAINS.find((d) => d.split('.')[0] === domain);
  if (bare) return `${local}@${bare}`;

  let best: { d: string; score: number } | null = null;
  for (const d of KNOWN_DOMAINS) {
    const score = distance(domain, d);
    if (score <= 2 && (!best || score < best.score)) best = { d, score };
  }
  return best ? `${local}@${best.d}` : null;
}

/** Webmail inbox for a few big providers, so "Abrir mi correo" can deep-link. */
export function inboxUrl(email: string): string | null {
  const domain = email.split('@')[1] ?? '';
  if (domain === 'gmail.com') return 'https://mail.google.com/mail/u/0/#inbox';
  if (/^(hotmail|outlook|live)\./.test(domain)) return 'https://outlook.live.com/mail/';
  if (/^yahoo\./.test(domain)) return 'https://mail.yahoo.com/';
  if (domain === 'icloud.com') return 'https://www.icloud.com/mail';
  return null;
}
