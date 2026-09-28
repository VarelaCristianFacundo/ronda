'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { fail, invalid, uuid, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/data';
import { CURRENCY_CODES } from '@/lib/money';

const name = z.string().trim().min(1, 'Poné un nombre.').max(60, 'Hasta 60 caracteres.');
const currency = z.enum(CURRENCY_CODES as [string, ...string[]], { message: 'Elegí una moneda.' });

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ name, currency }).safeParse({ name: formData.get('name'), currency: formData.get('currency') });
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('create_group', { p_name: parsed.data.name, p_currency: parsed.data.currency });
  if (error || !data) return fail(error);
  revalidatePath('/', 'layout');
  redirect(`/grupos/${data}`);
}

export async function updateGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ groupId: uuid, name, currency })
    .safeParse({ groupId: formData.get('groupId'), name: formData.get('name'), currency: formData.get('currency') });
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('update_group', {
    p_group: parsed.data.groupId,
    p_name: parsed.data.name,
    p_currency: parsed.data.currency,
  });
  if (error) return fail(error);
  revalidatePath('/', 'layout');
  return {};
}

export async function addMember(
  groupId: string,
  input: { name: string; email?: string },
): Promise<ActionResult<{ id: string }>> {
  const parsed = z
    .object({
      groupId: uuid,
      name,
      email: z
        .string()
        .trim()
        .toLowerCase()
        .email('Revisá el email.')
        .max(254)
        .optional()
        .or(z.literal('').transform(() => undefined)),
    })
    .safeParse({ groupId, ...input });
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('add_member', {
    p_group: parsed.data.groupId,
    p_name: parsed.data.name,
    p_email: parsed.data.email ?? undefined,
  });
  if (error || !data) return fail(error);
  revalidatePath(`/grupos/${groupId}`, 'layout');
  return { ok: true, data: { id: data } };
}

export async function createInvite(groupId: string): Promise<ActionResult<{ token: string }>> {
  if (!uuid.safeParse(groupId).success) return { ok: false, error: 'Grupo inválido.' };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('create_invite', { p_group: groupId });
  if (error || !data) return fail(error);
  revalidatePath(`/grupos/${groupId}/invitar`);
  return { ok: true, data: { token: data } };
}

export async function revokeInvites(groupId: string): Promise<ActionResult> {
  if (!uuid.safeParse(groupId).success) return { ok: false, error: 'Grupo inválido.' };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('revoke_invites', { p_group: groupId });
  if (error) return fail(error);
  revalidatePath(`/grupos/${groupId}/invitar`);
  return { ok: true, data: undefined };
}

export async function removeMember(groupId: string, memberId: string, force: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(groupId).success || !uuid.safeParse(memberId).success) return { ok: false, error: 'Datos inválidos.' };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('remove_member', { p_group: groupId, p_member: memberId, p_force: force });
  if (error) return fail(error);
  revalidatePath(`/grupos/${groupId}`, 'layout');
  return { ok: true, data: undefined };
}

export async function setMemberRole(groupId: string, memberId: string, role: 'owner' | 'member'): Promise<ActionResult> {
  const parsed = z.object({ groupId: uuid, memberId: uuid, role: z.enum(['owner', 'member']) }).safeParse({ groupId, memberId, role });
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('set_member_role', { p_group: groupId, p_member: memberId, p_role: role });
  if (error) return fail(error);
  revalidatePath(`/grupos/${groupId}`, 'layout');
  return { ok: true, data: undefined };
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  if (!uuid.safeParse(groupId).success) return { ok: false, error: 'Grupo inválido.' };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('leave_group', { p_group: groupId });
  if (error) return fail(error);
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}

export async function acceptInvite(token: string, claimMemberId: string | null): Promise<ActionResult<{ groupId: string }>> {
  const parsed = z
    .object({ token: z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/), claim: uuid.nullable() })
    .safeParse({ token, claim: claimMemberId });
  if (!parsed.success) return { ok: false, error: 'Ese link de invitación no es válido.' };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('accept_invite', {
    p_token: parsed.data.token,
    p_claim_member: parsed.data.claim ?? undefined,
  });
  if (error || !data) return fail(error);
  revalidatePath('/', 'layout');
  return { ok: true, data: { groupId: data } };
}
