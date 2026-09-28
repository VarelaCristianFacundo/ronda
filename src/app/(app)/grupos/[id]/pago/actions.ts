'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, invalid, uuid, type ActionResult } from '@/lib/actions';
import { getGroup, requireUser, who } from '@/lib/data';
import { formatMoney, MAX_AMOUNT_MINOR } from '@/lib/money';

const input = z.object({
  fromId: uuid,
  toId: uuid,
  amountMinor: z.number().int().positive('El monto tiene que ser mayor a cero.').max(MAX_AMOUNT_MINOR),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Revisá la fecha.'),
  method: z.enum(['transferencia', 'efectivo', 'otro']).nullable(),
  note: z.string().trim().max(500).nullable(),
});

export async function recordPayment(
  groupId: string,
  raw: z.infer<typeof input>,
): Promise<ActionResult<{ paymentId: string; message: string }>> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  if (!uuid.safeParse(groupId).success) return { ok: false, error: 'Grupo inválido.' };
  const p = parsed.data;
  if (p.fromId === p.toId) return { ok: false, error: 'Elegí dos personas distintas.' };

  const b = await getGroup(groupId); // RLS-scoped; notFound for non-members
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('record_payment', {
    p_group: groupId,
    p_from: p.fromId,
    p_to: p.toId,
    p_amount: p.amountMinor,
    p_currency: b.group.currency,
    p_date: p.date,
    p_method: p.method ?? undefined,
    p_note: p.note || undefined,
  });
  if (error || !data) return fail(error);
  const paymentId = (data as { id: string }).id;

  // Remaining debt between these two after the payment (from the pre-payment balances).
  const before = b.transfers.find((t) => t.fromId === p.fromId && t.toId === p.toId)?.amountMinor ?? 0;
  const left = before - p.amountMinor;
  const from = who(b, p.fromId);
  const to = who(b, p.toId);
  const c = b.group.currency;
  const subject = p.fromId === b.me.id ? 'Tu pago' : `Pago de ${from}`;
  const tail =
    left > 0
      ? p.toId === b.me.id
        ? ` Todavía te debe ${formatMoney(left, c)}.`
        : p.fromId === b.me.id
          ? ` Todavía le debés ${formatMoney(left, c)} a ${to}.`
          : ` ${from} todavía le debe ${formatMoney(left, c)} a ${to}.`
      : left === 0 && before > 0
        ? ' Quedaron a mano.'
        : '';

  revalidatePath(`/grupos/${groupId}`, 'layout');
  revalidatePath('/grupos');
  revalidatePath('/actividad');
  return { ok: true, data: { paymentId, message: `${subject} registrado.${tail}` } };
}

export async function voidPayment(groupId: string, paymentId: string, reason: string | null): Promise<ActionResult> {
  const parsed = z.object({ groupId: uuid, paymentId: uuid, reason: z.string().trim().max(200).nullable() }).safeParse({ groupId, paymentId, reason: reason || null });
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('void_payment', { p_payment: paymentId, p_reason: parsed.data.reason ?? undefined });
  if (error) return fail(error);
  revalidatePath(`/grupos/${groupId}`, 'layout');
  revalidatePath('/grupos');
  revalidatePath('/actividad');
  return { ok: true, data: undefined };
}
