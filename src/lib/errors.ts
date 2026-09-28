// Maps database error codes ('ronda:<code>') to user-facing Spanish copy.

const MESSAGES: Record<string, string> = {
  not_authenticated: 'Tu sesión venció. Entrá de nuevo.',
  not_member: 'No tenés acceso a este grupo.',
  not_owner: 'Sólo quien administra el grupo puede hacer esto.',
  not_found: 'No encontramos eso. Puede que ya no exista o que no tengas acceso.',
  invalid_name: 'Poné un nombre de hasta 60 caracteres.',
  invalid_currency: 'Elegí una moneda válida.',
  invalid_email: 'Revisá el email.',
  invalid_description: 'Poné una descripción de hasta 80 caracteres.',
  invalid_amount: 'El monto tiene que ser mayor a cero.',
  invalid_date: 'Revisá la fecha.',
  invalid_category: 'Elegí una categoría válida.',
  invalid_method: 'Elegí un medio de pago válido.',
  invalid_member: 'Alguna de las personas no es parte del grupo.',
  inactive_member: 'Alguna de las personas ya no está en el grupo.',
  invalid_share: 'Revisá los montos del reparto.',
  no_participants: 'Elegí al menos una persona.',
  duplicate_participant: 'Hay una persona repetida en el reparto.',
  shares_mismatch: 'El reparto no suma el total.',
  percent_mismatch: 'Los porcentajes tienen que sumar 100 %.',
  split_rule_mismatch: 'El reparto no coincide con el redondeo de Ronda. Volvé a intentar.',
  currency_mismatch: 'La moneda no coincide con la del grupo.',
  currency_locked: 'La moneda ya no se puede cambiar: el grupo tiene movimientos.',
  stale_revision: 'Alguien editó este gasto mientras lo mirabas. Recargá para ver la última versión.',
  no_changes: 'No cambiaste nada.',
  already_voided: 'Esto ya estaba anulado.',
  immutable_record: 'Los registros del historial no se pueden modificar.',
  already_member: 'Esa persona ya está en el grupo.',
  already_invited: 'Ya agregaste a alguien con ese email.',
  too_many_members: 'El grupo llegó al máximo de 50 personas.',
  too_many_groups: 'Llegaste al máximo de grupos activos.',
  invite_invalid: 'Ese link de invitación no existe.',
  invite_expired: 'Ese link de invitación venció o fue desactivado. Pedí uno nuevo.',
  cannot_claim: 'Ese lugar ya no está disponible.',
  balance_not_zero: 'Primero hay que saldar: el saldo tiene que quedar en cero.',
  last_owner: 'Sos la única persona que administra el grupo. Pasale la administración a alguien antes de salir.',
  cannot_remove_self: 'Para irte del grupo usá “Salir del grupo”.',
  text_too_long: 'El texto es demasiado largo.',
};

export const GENERIC_ERROR = 'No pudimos guardar. Revisá tu conexión y volvé a intentar.';

export function errorCode(error: unknown): string | null {
  const msg = typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error ?? '');
  const m = msg.match(/ronda:([a-z_]+)/);
  return m ? m[1] : null;
}

export function errorMessage(error: unknown): string {
  const code = errorCode(error);
  return (code && MESSAGES[code]) || GENERIC_ERROR;
}
