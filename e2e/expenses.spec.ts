import { expect, test, type Page } from '@playwright/test';
import { signIn, uniqueEmail } from './helpers';

async function setupGroup(page: Page) {
  await signIn(page, uniqueEmail('gastos'));
  await page.goto('/grupos/nuevo');
  await page.getByLabel('Nombre').fill('Bariloche ’26');
  await page.getByRole('button', { name: 'Crear grupo' }).click();
  await expect(page.getByRole('heading', { name: 'Bariloche ’26' })).toBeVisible();
  const groupUrl = page.url();
  await page.goto(`${groupUrl}/invitar`);
  for (const name of ['Juli', 'Fede']) {
    await page.getByLabel('O agregá a alguien sin cuenta').fill(name);
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  return groupUrl;
}

async function openNewExpense(page: Page, groupUrl: string, amount: string, description: string) {
  await page.goto(`${groupUrl}/gasto/nuevo`);
  await expect(page.getByLabel(/Monto en/)).toBeFocused();
  await page.getByLabel(/Monto en/).fill(amount);
  await page.getByLabel('Descripción').fill(description);
}

test('expenses: equal, exact and percent splits, edit history, void and undo', async ({ page }) => {
  const groupUrl = await setupGroup(page);

  // Equal split with a leftover cent: the payer absorbs it and is told so.
  await openNewExpense(page, groupUrl, '100', 'Cena');
  await expect(page.getByText('Entre 3 personas')).toBeVisible();
  await expect(page.getByText('vos absorbés $ 0,01')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(page).toHaveURL(/\?nuevo=/);
  await expect(page.getByRole('status').getByText('Gasto guardado. Te deben $ 66,66 por cena.')).toBeVisible();
  await expect(page.getByLabel('Te deben 66,66 pesos')).toBeVisible();

  // Exact amounts: seeded from the equal split, mismatch shown, one-tap fix.
  await openNewExpense(page, groupUrl, '900', 'Nafta');
  await page.getByText('Montos', { exact: true }).click();
  await expect(page.getByLabel('Monto de Juli')).toHaveValue('300');
  await page.getByLabel('Monto de Juli').fill('200');
  await expect(page.getByRole('alert').getByText('Faltan asignar $ 100')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar gasto' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Sumártelos a vos (pagaste)' }).click();
  await expect(page.getByText('Todo asignado')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(page).toHaveURL(/\?nuevo=/);

  // Percentages: over/under 100 % is explained and fixable.
  await openNewExpense(page, groupUrl, '1000', 'Súper');
  await page.getByText('%', { exact: true }).click();
  await page.getByLabel('Porcentaje de Vos').fill('50');
  await page.getByLabel('Porcentaje de Juli').fill('30');
  await page.getByLabel('Porcentaje de Fede').fill('10');
  await expect(page.getByRole('alert').getByText('Falta un 10 %: la suma da 90 %')).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar a Fede (20 %)' }).click();
  await expect(page.getByText('100 % asignado')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(page).toHaveURL(/\?nuevo=/);

  // Balance: cena +66,66, nafta (900 paid, 400 share) +500, súper (1000 paid, 500 share) +500.
  await expect(page.getByLabel('Te deben 1.066,66 pesos')).toBeVisible();

  // Edit creates a revision and the change is visible in the history.
  await page.getByRole('link', { name: /Cena/ }).click();
  await page.getByRole('link', { name: 'Editar' }).click();
  await page.getByLabel(/Monto en/).fill('130');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText(/Cambiaste el total de/)).toBeVisible();
  await expect(page.locator('s', { hasText: '$ 100' })).toBeVisible();
  await expect(page.locator('b', { hasText: '$ 130' })).toBeVisible();
  await expect(page.getByText('Creaste el gasto')).toBeVisible();

  // Void keeps the record, removes it from balances.
  await page.getByRole('button', { name: 'Anular gasto' }).click();
  await page.getByLabel('Motivo (opcional)').fill('estaba repetido');
  await page.getByRole('button', { name: 'Sí, anular' }).click();
  await expect(page.getByText(/Anulaste el gasto: “estaba repetido”/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Editar' })).toHaveCount(0);
  await page.goto(groupUrl);
  await expect(page.getByLabel('Te deben 1.000 pesos')).toBeVisible();

  // Undo right after saving voids the new expense.
  await openNewExpense(page, groupUrl, '50', 'Helado');
  await page.getByRole('button', { name: 'Guardar gasto' }).click();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Listo, lo anulamos.')).toBeVisible();
  await expect(page.getByLabel('Te deben 1.000 pesos')).toBeVisible();
});
