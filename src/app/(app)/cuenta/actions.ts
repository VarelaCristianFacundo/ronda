'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, invalid } from '@/lib/actions';
import { requireUser } from '@/lib/data';

export type ProfileState = { error?: string; fieldErrors?: Record<string, string>; saved?: number };

const schema = z.object({
  name: z.string().trim().min(1, 'Poné tu nombre.').max(60, 'Hasta 60 caracteres.'),
  alias: z
    .string()
    .trim()
    .max(60, 'Hasta 60 caracteres.')
    .regex(/^[A-Za-z0-9.\-_]*$/, 'Usá letras, números, puntos o guiones (sin espacios).'),
});

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = schema.safeParse({ name: formData.get('name'), alias: formData.get('alias') ?? '' });
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.name, payment_alias: parsed.data.alias || null })
    .eq('id', user.id);
  if (error) return fail(error);
  revalidatePath('/', 'layout');
  return { saved: Date.now() };
}
