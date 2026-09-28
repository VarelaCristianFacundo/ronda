import 'server-only';
import { z } from 'zod';
import { errorMessage } from './errors';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const uuid = z.string().uuid();

export function fail(error: unknown): { ok: false; error: string } {
  // Log unexpected errors server-side; users get mapped Spanish copy.
  if (!String((error as { message?: string })?.message ?? '').includes('ronda:')) console.error(error);
  return { ok: false, error: errorMessage(error) };
}

export function invalid(issues: z.ZodError): { ok: false; error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues.issues) {
    const key = i.path.join('.') || '_';
    if (!fieldErrors[key]) fieldErrors[key] = i.message;
  }
  return { ok: false, error: Object.values(fieldErrors)[0] ?? 'Revisá los datos.', fieldErrors };
}
