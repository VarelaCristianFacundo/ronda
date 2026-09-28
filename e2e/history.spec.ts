import { expect, test } from '@playwright/test';
import { signIn, uniqueEmail } from './helpers';

test('group history shows edits and voids; CSV export and activity', async ({ page, browser }) => {
  await signIn(page, uniqueEmail('hist'));
  await page.goto('/grupos/nuevo');
  await page.getByLabel('Nombre').fill('Vos y Martín');
  await page.getByRole('button', { name: 'Crear grupo' }).click();
  await expect(page.getByRole('heading', { name: 'Vos y Martín' })).toBeVisible();
  const groupUrl = page.url();
  await page.goto(`${groupUrl}/invitar`);
  await page.getByLabel('O agregá a alguien sin cuenta').fill('Martín');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('Sin cuenta', { exact: true })).toBeVisible();

  for (const [amount, desc] of [
    ['200', 'Cine'],
    ['50', 'Pochoclos'],
  ]) {
    await page.goto(`${groupUrl}/gasto/nuevo`);
    await page.getByLabel(/Monto en/).fill(amount);
    await page.getByLabel('Descripción').fill(desc);
    await page.getByRole('button', { name: 'Guardar gasto' }).click();
    await expect(page).toHaveURL(/\?nuevo=/);
  }
  // Edit Cine, void Pochoclos, record a payment.
  await page.getByRole('link', { name: /Cine/ }).click();
  await page.getByRole('link', { name: 'Editar' }).click();
  await page.getByLabel('Descripción').fill('Cine y cena');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText(/Cambiaste la descripción de/)).toBeVisible();
  await page.goto(groupUrl);
  await page.getByRole('link', { name: /Pochoclos/ }).click();
  await page.getByRole('button', { name: 'Anular gasto' }).click();
  await page.getByRole('button', { name: 'Sí, anular' }).click();
  await expect(page.getByText(/Anulaste el gasto/)).toBeVisible();
  await page.goto(`${groupUrl}/pago/nuevo`);
  await page.getByLabel(/Monto del pago/).fill('40');
  await page.getByRole('button', { name: 'Registrar $ 40' }).click();
  await expect(page.getByRole('heading', { name: 'Pago registrado' })).toBeVisible();

  await page.goto(`${groupUrl}/historial`);
  await expect(page.getByRole('link', { name: /Cine y cena/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Pochoclos.*Anulado/ })).toBeVisible();
  await page.getByRole('link', { name: 'Pagos', exact: true }).click();
  await expect(page.getByRole('link', { name: /Martín te pagó/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Cine/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Cambios', exact: true }).click();
  for (const line of ['Creaste el grupo', 'Agregaste a Martín', 'Cargaste «Cine» por $ 200', 'Editaste «Cine y cena»', 'Anulaste «Pochoclos»', 'Registraste un pago: Martín te pagó $ 40']) {
    await expect(page.getByText(line)).toBeVisible();
  }

  // CSV: every revision, voids and payments.
  const res = await page.request.get(`${groupUrl}/export`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  const csv = await res.text();
  expect(csv.split('\r\n')[0]).toContain('tipo,id,version,estado,fecha,descripcion');
  expect(csv).toMatch(/gasto,[^,]+,1,reemplazado,[^,]+,Cine,/);
  expect(csv).toMatch(/gasto,[^,]+,2,vigente,[^,]+,Cine y cena,/);
  expect(csv).toMatch(/gasto,[^,]+,1,anulado,[^,]+,Pochoclos,/);
  expect(csv).toMatch(/pago,PAG-\d{5},1,vigente,[^,]+,Pago,,40\.00,ARS,Martín,/);

  // Export is not available to non-members.
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await signIn(other, uniqueEmail('ajeno'));
  const denied = await other.request.get(`${groupUrl}/export`);
  expect(denied.status()).toBe(404);
  await ctx.close();

  // Activity lists movements across groups with the group name.
  await page.goto('/actividad');
  await expect(page.getByRole('link', { name: /Cine y cena.*Vos y Martín/ })).toBeVisible();
});
