import { expect, type Page } from '@playwright/test';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Polls Mailpit for the newest message to `email` and returns the sign-in link in it. */
export async function magicLinkFor(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const body = (await res.json()) as { messages?: { ID: string }[] };
    const id = body.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML: string };
      const href = msg.HTML.match(/href="([^"]*token_hash[^"]*)"/)?.[1];
      if (href) return href.replaceAll('&amp;', '&');
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No magic link for ${email}`);
}

/** Full magic-link sign-in through the UI. */
export async function signIn(page: Page, email: string, next?: string) {
  await page.goto(next ? `/entrar?next=${encodeURIComponent(next)}` : '/entrar');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Mandame el link' }).click();
  await expect(page.getByRole('heading', { name: 'Revisá tu correo' })).toBeVisible();
  await page.goto(await magicLinkFor(email));
}
