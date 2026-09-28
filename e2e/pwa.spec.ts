import { expect, test } from '@playwright/test';

// Service worker is registered only in production builds: run against `next start`
// with PWA=1 E2E_BASE_URL=http://localhost:3100 npx playwright test e2e/pwa.spec.ts
test.skip(!process.env.PWA, 'Set PWA=1 and point E2E_BASE_URL at a production server');

test('installable manifest, service worker and offline fallback', async ({ page, context, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ short_name: 'Ronda', display: 'standalone', start_url: '/grupos', lang: 'es-AR' });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  }

  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
  expect(scope).toMatch(/\/$/);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.endsWith('-static'))!);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached).toContain('/offline');

  // Offline navigation shows the fallback instead of the browser error page, and pages
  // with balances are never served from cache.
  await page.reload(); // ensure the page is controlled by the SW
  await context.setOffline(true);
  await page.goto('/grupos').catch(() => {});
  await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
  await context.setOffline(false);
});
