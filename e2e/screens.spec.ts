import { expect, test, type Page } from '@playwright/test';
import { signIn, uniqueEmail } from './helpers';

// Design-review captures (not an assertion suite). Run with: SCREENS=1 npx playwright test e2e/screens.spec.ts
test.skip(!process.env.SCREENS, 'Set SCREENS=1 to capture design-review screenshots');

const OUT = 'test-results/screens';

async function expense(page: Page, groupUrl: string, amount: string, desc: string, cat: string, payer?: string) {
  await page.goto(`${groupUrl}/gasto/nuevo`);
  await page.getByLabel(/Monto en/).fill(amount);
  await page.getByLabel('Descripción').fill(desc);
  if (payer) await page.getByLabel('Quién pagó').selectOption({ label: payer });
  await page.getByRole('radio', { name: cat }).click();
  await page.getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(page).toHaveURL(/\?nuevo=/);
}

test('capture key screens', async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR' });
  const page = await context.newPage();
  await page.goto('/');
  await page.screenshot({ path: `${OUT}/m01-bienvenida.png` });
  await signIn(page, uniqueEmail('sofi'));
  await page.goto('/cuenta');
  await page.getByLabel('Tu nombre').fill('Sofía Benítez');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Guardamos tus datos.')).toBeVisible();
  await page.goto('/grupos');
  await page.screenshot({ path: `${OUT}/m06-sin-grupos.png` });

  await page.goto('/grupos/nuevo');
  await page.getByLabel('Nombre').fill('Bariloche ’26');
  await page.getByRole('button', { name: 'Crear grupo' }).click();
  await expect(page.getByRole('heading', { name: 'Bariloche ’26' })).toBeVisible();
  const groupUrl = page.url();
  await page.screenshot({ path: `${OUT}/m08-grupo-vacio.png` });
  await page.goto(`${groupUrl}/invitar`);
  for (const n of ['Nico Ferreyra', 'Cami Sosa', 'Juli Paz', 'Fede R']) {
    await page.getByLabel('O agregá a alguien sin cuenta').fill(n);
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.getByText(n, { exact: true })).toBeVisible();
  }
  await page.screenshot({ path: `${OUT}/m09-invitar.png` });

  await expense(page, groupUrl, '240000', 'Cabaña en Villa Los Coihues', 'Alojamiento');
  await expense(page, groupUrl, '72000', 'Nafta ida', 'Transporte', 'Fede');
  await expense(page, groupUrl, '54300', 'Súper en Anónima', 'Supermercado');
  await expense(page, groupUrl, '86500', 'Cena en El Boliche', 'Comida', 'Nico');
  await page.screenshot({ path: `${OUT}/m13-gasto-guardado.png` });
  await page.goto(groupUrl);
  await page.screenshot({ path: `${OUT}/m07-grupo.png`, fullPage: true });

  await page.goto(`${groupUrl}/gasto/nuevo`);
  await page.getByLabel(/Monto en/).fill('86500');
  await page.getByLabel('Descripción').fill('Cena en El Boliche');
  await page.screenshot({ path: `${OUT}/m10-iguales.png` });
  await page.getByText('%', { exact: true }).click();
  await page.screenshot({ path: `${OUT}/m12-porcentajes.png` });

  await page.goto(`${groupUrl}/saldar`);
  await page.screenshot({ path: `${OUT}/m16-saldar.png`, fullPage: true });
  await page.getByRole('link', { name: 'Registrar', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: /te pagó|Le pagaste|le pagó/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/m17-pago.png` });
  await page.goto('/grupos');
  await page.screenshot({ path: `${OUT}/m04-grupos.png` });
  await page.goto('/actividad');
  await page.screenshot({ path: `${OUT}/m15-actividad.png` });
  await page.goto(groupUrl);
  await page.getByRole('link', { name: /Cabaña/ }).click();
  await page.waitForURL(/\/g\//);
  await page.screenshot({ path: `${OUT}/m14-detalle.png`, fullPage: true });

  // Desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: await context.storageState(), locale: 'es-AR' });
  const d = await desk.newPage();
  await d.goto(groupUrl);
  await d.screenshot({ path: `${OUT}/d01-grupo.png` });
  await d.goto(`${groupUrl}/gasto/nuevo`);
  await d.getByLabel(/Monto en/).fill('86500');
  await d.getByLabel('Descripción').fill('Cena en El Boliche de Alberto');
  await d.getByText('Porcentajes', { exact: true }).click();
  await d.screenshot({ path: `${OUT}/d02-gasto.png` });
  await d.goto(`${groupUrl}/saldar`);
  await d.getByRole('link', { name: 'Registrar', exact: true }).first().click();
  await d.waitForURL(/pago\/nuevo/);
  await expect(d.getByRole('heading', { name: /te pagó|Le pagaste|le pagó/ })).toBeVisible();
  await d.screenshot({ path: `${OUT}/d03-pago.png` });
  await desk.close();
  await context.close();
});
