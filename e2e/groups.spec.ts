import { expect, test, type Browser } from '@playwright/test';
import { signIn, uniqueEmail } from './helpers';

async function newUser(browser: Browser, prefix: string) {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const email = uniqueEmail(prefix);
  await signIn(page, email);
  return { context, page, email };
}

test('create a group, invite by link and by email, isolation between groups', async ({ browser }) => {
  const owner = await newUser(browser, 'owner');
  const page = owner.page;

  await page.getByRole('link', { name: 'Crear un grupo' }).click();
  await page.getByLabel('Nombre').fill('Casa en Almagro');
  await page.getByRole('button', { name: 'Crear grupo' }).click();
  await expect(page.getByRole('heading', { name: 'Casa en Almagro' })).toBeVisible();
  await expect(page.getByText('Por ahora sos la única persona del grupo')).toBeVisible();
  const groupUrl = page.url();

  // Add a person without account and one reserved by email.
  await page.getByRole('link', { name: 'Agregar a alguien sin cuenta' }).click();
  await page.getByLabel('O agregá a alguien sin cuenta').fill('Juli');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('Sin cuenta', { exact: true })).toBeVisible();

  const invitedEmail = uniqueEmail('fede');
  await page.getByLabel('O agregá a alguien sin cuenta').fill(invitedEmail);
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('Pendiente', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Generar link' }).click();
  await page.getByRole('button', { name: 'Copiar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copiado' })).toBeVisible();
  const inviteLink = await page.evaluate(() => navigator.clipboard.readText());
  expect(inviteLink).toMatch(/\/u\/[A-Za-z0-9_-]{16,}$/);

  // The person invited by email sees the group as soon as they sign in.
  const fedeCtx = await browser.newContext();
  const fedePage = await fedeCtx.newPage();
  await signIn(fedePage, invitedEmail);
  await expect(fedePage.getByRole('link', { name: /Casa en Almagro/ })).toBeVisible();

  // Someone else opens the link and claims Juli's slot.
  const juli = await newUser(browser, 'juli');
  await juli.page.goto(inviteLink);
  await expect(juli.page.getByRole('heading', { name: 'Sumate a Casa en Almagro' })).toBeVisible();
  await juli.page.getByText('Soy Juli').click();
  await juli.page.getByRole('button', { name: 'Unirme al grupo' }).click();
  await expect(juli.page).toHaveURL(groupUrl);

  await page.goto(groupUrl.replace(/\/?$/, '/invitar'));
  await expect(page.getByText('En el grupo · 3')).toBeVisible();
  await expect(page.getByText('Sin cuenta', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Pendiente', { exact: true })).toHaveCount(0);

  // A stranger cannot see the group, even with the URL.
  const stranger = await newUser(browser, 'stranger');
  await stranger.page.goto(groupUrl);
  await expect(stranger.page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
  await stranger.page.goto('/grupos');
  await expect(stranger.page.getByRole('heading', { name: 'Todavía no tenés grupos' })).toBeVisible();

  // Revoking the link stops new joins.
  await page.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByText('Todavía no hay un link activo.')).toBeVisible();
  await stranger.page.goto(inviteLink);
  await expect(stranger.page.getByRole('heading', { name: 'Esta invitación ya no sirve' })).toBeVisible();

  for (const c of [owner.context, fedeCtx, juli.context, stranger.context]) await c.close();
});
