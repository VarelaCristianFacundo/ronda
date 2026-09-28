import { expect, test } from '@playwright/test';
import { magicLinkFor, uniqueEmail } from './helpers';

test('sign in with a magic link and sign out', async ({ page }) => {
  const email = uniqueEmail('sofi');

  await page.goto('/grupos');
  await expect(page).toHaveURL(/\/entrar\?next=%2Fgrupos/);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cuentas claras, amistades largas.' })).toBeVisible();
  await page.getByRole('link', { name: 'Continuar con email' }).click();

  // Validation with a suggestion (M02).
  const local = email.split('@')[0];
  await page.getByLabel('Email').fill(`${local}@gmail`);
  await page.getByRole('button', { name: 'Mandame el link' }).click();
  await expect(page.getByText('Parece que falta el final del email.')).toBeVisible();
  await expect(page.getByRole('button', { name: `${local}@gmail.com` })).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Mandame el link' }).click();
  await expect(page.getByRole('heading', { name: 'Revisá tu correo' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole('button', { name: /Reenviar en 0:\d\d/ })).toBeDisabled();

  await page.goto(await magicLinkFor(email));
  await expect(page).toHaveURL(/\/grupos$/);
  await expect(page.getByRole('heading', { name: 'Todavía no tenés grupos' })).toBeVisible();

  // A used link cannot be replayed.
  const link = await magicLinkFor(email);
  await page.getByRole('link', { name: 'Cuenta', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(link);
  await expect(page).toHaveURL(/\/entrar\?error=link/);
  await expect(page.getByText('Ese link ya se usó o venció.')).toBeVisible();

  await page.goto('/cuenta');
  await expect(page).toHaveURL(/\/entrar/);
});
