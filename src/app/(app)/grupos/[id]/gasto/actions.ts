'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, invalid, uuid, type ActionResult } from '@/lib/actions';
import { expenseEffectFor } from '@/lib/balances';
import { getGroup, requireUser, who } from '@/lib/data';
import { CATEGORY_CODES } from '@/lib/labels';
import { formatMoney, MAX_AMOUNT_MINOR } from '@/lib/money';
import { computeSplit, type SplitError } from '@/lib/split';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Revisá la fecha.')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s), 'Revisá la fecha.');

const minor = z.number().int().min(0).max(MAX_AMOUNT_MINOR);

const expenseInput = z.object({
  description: z.string().trim().min(1, 'Poné una descripción.').max(80, 'Hasta 80 caracteres.'),
  amountMinor: z.number().int('El monto no es válido.').positive('El monto tiene que ser mayor a cero.').max(MAX_AMOUNT_MINOR, 'El monto es demasiado grande.'),
  payerId: uuid,
  date: isoDate,
  category: z.enum(CATEGORY_CODES as [string, ...string[]]).nullable(),
  note: z.string().trim().max(500, 'La nota puede tener hasta 500 caracteres.').nullable(),
  split: z.discriminatedUnion('method', [
    z.object({ method: z.literal('equal'), participants: z.array(uuid).min(1, 'Elegí al menos una persona.').max(50) }),
    z.object({ method: z.literal('exact'), entries: z.array(z.object({ memberId: uuid, value: minor })).min(1).max(50) }),
    z.object({ method: z.literal('percent'), entries: z.array(z.object({ memberId: uuid, value: z.number().int().min(0).max(10000) })).min(1).max(50) }),
  ]),
});

export type ExpenseInput = z.infer<typeof expenseInput>;

function splitErrorMessage(e: SplitError): string {
  switch (e.code) {
    case 'no_participants':
      return 'Elegí al menos una persona.';
    case 'exact_mismatch':
      return 'Los montos no suman el total.';
    case 'percent_mismatch':
      return 'Los porcentajes tienen que sumar 100 %.';
    case 'duplicate_participant':
      return 'Hay una persona repetida.';
    default:
      return 'Revisá el reparto.';
  }
}

export async function saveExpense(
  groupId: string,
  raw: ExpenseInput,
  edit?: { expenseId: string; expectedRevision: number },
): Promise<ActionResult<{ expenseId: string; message: string }>> {
  const parsed = expenseInput.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  if (!uuid.safeParse(groupId).success) return { ok: false, error: 'Grupo inválido.' };
  const input = parsed.data;

  // Loads through RLS: throws notFound for non-members. Also gives us member order and currency.
  const b = await getGroup(groupId);
  const order = new Map(b.members.map((m, i) => [m.id, i]));
  const bySeq = <T,>(xs: T[], id: (x: T) => string) => [...xs].sort((a, c) => (order.get(id(a)) ?? 1e9) - (order.get(id(c)) ?? 1e9));

  // Recompute shares on the server from the raw input; never trust client-side amounts.
  const result =
    input.split.method === 'equal'
      ? computeSplit({ method: 'equal', total: input.amountMinor, payerId: input.payerId, participants: bySeq(input.split.participants, (x) => x) })
      : input.split.method === 'exact'
        ? computeSplit({
            method: 'exact',
            total: input.amountMinor,
            payerId: input.payerId,
            entries: bySeq(input.split.entries, (x) => x.memberId).map((e) => ({ memberId: e.memberId, minor: e.value })),
          })
        : computeSplit({
            method: 'percent',
            total: input.amountMinor,
            payerId: input.payerId,
            entries: bySeq(input.split.entries, (x) => x.memberId).map((e) => ({ memberId: e.memberId, bp: e.value })),
          });
  if (!result.ok) return { ok: false, error: splitErrorMessage(result.error) };

  const shares = result.shares.map((s) => ({ member_id: s.memberId, share_minor: s.shareMinor, input_value: s.input }));
  const common = {
    p_description: input.description,
    p_amount: input.amountMinor,
    p_currency: b.group.currency, // one currency per group; the database re-checks it
    p_payer: input.payerId,
    p_date: input.date,
    p_method: input.split.method,
    // Explicit nulls: omitting the keys would make PostgREST look for a different signature.
    // (Generated types don't model nullable function arguments.)
    p_category: (input.category ?? null) as unknown as string,
    p_note: (input.note ?? null) as unknown as string,
    p_shares: shares,
  };

  const { supabase } = await requireUser();
  let expenseId: string;
  if (edit) {
    if (!uuid.safeParse(edit.expenseId).success) return { ok: false, error: 'Gasto inválido.' };
    const { error } = await supabase.rpc('edit_expense', {
      p_expense: edit.expenseId,
      p_expected_revision: edit.expectedRevision,
      ...common,
    });
    if (error) return fail(error);
    expenseId = edit.expenseId;
  } else {
    const { data, error } = await supabase.rpc('create_expense', { p_group: groupId, ...common });
    if (error || !data) return fail(error);
    expenseId = data;
  }

  revalidatePath(`/grupos/${groupId}`, 'layout');
  revalidatePath('/grupos');
  revalidatePath('/actividad');

  const effect = expenseEffectFor(b.me.id, { payerId: input.payerId, amountMinor: input.amountMinor, shares: result.shares });
  const payer = who(b, input.payerId);
  const what = input.description.toLocaleLowerCase('es-AR');
  const c = b.group.currency;
  const verb = edit ? 'Gasto actualizado.' : 'Gasto guardado.';
  const message =
    effect < 0
      ? `${verb} Le debés ${formatMoney(-effect, c)} a ${payer} por ${what}.`
      : effect > 0
        ? `${verb} Te deben ${formatMoney(effect, c)} por ${what}.`
        : `${verb} No cambia tu saldo.`;
  return { ok: true, data: { expenseId, message } };
}

export async function voidExpense(groupId: string, expenseId: string, reason: string | null): Promise<ActionResult> {
  const parsed = z
    .object({ groupId: uuid, expenseId: uuid, reason: z.string().trim().max(200).nullable() })
    .safeParse({ groupId, expenseId, reason: reason || null });
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('void_expense', { p_expense: expenseId, p_reason: parsed.data.reason ?? undefined });
  if (error) return fail(error);
  revalidatePath(`/grupos/${groupId}`, 'layout');
  revalidatePath('/grupos');
  revalidatePath('/actividad');
  return { ok: true, data: undefined };
}
