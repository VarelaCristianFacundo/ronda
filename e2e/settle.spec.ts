import { expect, test, type Browser } from '@playwright/test';
import { signIn, uniqueEmail } from './helpers';

async function user(browser: Browser, name: string) {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await signIn(page, uniqueEmail(name.toLowerCase()));
  await page.goto('/cuenta');
  await page.getByLabel('Tu nombre').fill(name);
  if (name === 'Ana') await page.getByLabel('Alias para recibir (opcional)').fill('ana.ronda');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Guardamos tus datos.')).toBeVisible();
  return { context, page };
}

test('settle up with a partial payment, void it, and membership rules', async ({ browser }) => {
  const ana = await user(browser, 'Ana');
  const beto = await user(browser, 'Beto');

  await ana.page.goto('/grupos/nuevo');
  await ana.page.getByLabel('Nombre').fill('Depto Palermo');
  await ana.page.getByRole('button', { name: 'Crear grupo' }).click();
  await expect(ana.page.getByRole('heading', { name: 'Depto Palermo' })).toBeVisible();
  const groupUrl = ana.page.url();
  await ana.page.goto(`${groupUrl}/invitar`);
  await ana.page.getByRole('button', { name: 'Generar link' }).click();
  await ana.page.getByRole('button', { name: 'Copiar', exact: true }).click();
  const link = await ana.page.evaluate(() => navigator.clipboard.readText());

  await beto.page.goto(link);
  await beto.page.getByRole('button', { name: 'Unirme al grupo' }).click();
  await expect(beto.page).toHaveURL(groupUrl);

  // Ana pays 300 split equally → Beto owes 150.
  await ana.page.goto(`${groupUrl}/gasto/nuevo`);
  await ana.page.getByLabel(/Monto en/).fill('300');
  await ana.page.getByLabel('Descripción').fill('Internet');
  await ana.page.getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(ana.page.getByLabel('Te deben 150 pesos')).toBeVisible();

  // Beto sees the suggestion, framed as one possible way to settle.
  await beto.page.goto(`${groupUrl}/saldar`);
  await expect(beto.page.getByText(/Es una forma posible de saldar/)).toBeVisible();
  await expect(beto.page.getByText('Le pagás a Ana')).toBeVisible();
  await beto.page.getByRole('link', { name: 'Registrar', exact: true }).click();

  // Partial payment with the receiver's alias shown.
  await expect(beto.page.getByRole('heading', { name: 'Le pagaste a Ana' })).toBeVisible();
  await expect(beto.page.getByText('Le debés $ 150')).toBeVisible();
  await expect(beto.page.getByText('ana.ronda')).toBeVisible();
  await expect(beto.page.getByLabel(/Monto del pago/)).toHaveValue('150');
  await beto.page.getByLabel(/Monto del pago/).fill('100');
  await expect(beto.page.getByText('Pago parcial · vas a seguir debiéndole')).toBeVisible();
  await beto.page.getByRole('button', { name: 'Registrar $ 100' }).click();
  await expect(beto.page.getByRole('heading', { name: 'Pago registrado' })).toBeVisible();
  await expect(beto.page.getByText('Todavía le debés a Ana')).toBeVisible();
  await expect(beto.page.getByRole('status').getByText('Tu pago registrado. Todavía le debés $ 50 a Ana.')).toBeVisible();

  await ana.page.goto(groupUrl);
  await expect(ana.page.getByLabel('Te deben 50 pesos')).toBeVisible();
  await expect(ana.page.getByRole('link', { name: /Beto te pagó/ })).toBeVisible();

  // Leaving with a balance is blocked with a reason.
  await beto.page.goto(`${groupUrl}/ajustes`);
  await expect(beto.page.getByRole('button', { name: 'Salir del grupo' })).toBeDisabled();
  await expect(beto.page.getByText(/Saldalo antes de salir/)).toBeVisible();

  // Voiding the payment restores the previous balance, and the record stays.
  await ana.page.getByRole('link', { name: /Beto te pagó/ }).click();
  await ana.page.getByRole('button', { name: 'Anular pago' }).click();
  await ana.page.getByRole('button', { name: 'Sí, anular' }).click();
  await expect(ana.page.getByRole('heading', { name: 'Pago anulado' })).toBeVisible();
  await ana.page.goto(groupUrl);
  await expect(ana.page.getByLabel('Te deben 150 pesos')).toBeVisible();

  // The owner removes Beto after confirming; his debt stays visible.
  await ana.page.goto(`${groupUrl}/ajustes`);
  await ana.page.getByRole('button', { name: 'Sacar del grupo' }).click();
  await expect(ana.page.getByText('Beto todavía debe $ 150.')).toBeVisible();
  await ana.page.getByRole('button', { name: 'Sí, sacar' }).click();
  await expect(ana.page.getByText(/Beto · lo sacaron/)).toBeVisible();
  await ana.page.goto(`${groupUrl}/saldar`);
  await expect(ana.page.getByText('Beto te paga')).toBeVisible();

  await beto.page.goto(groupUrl);
  await expect(beto.page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();

  await ana.context.close();
  await beto.context.close();
});
