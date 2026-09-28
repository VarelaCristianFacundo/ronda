// Product copy helpers (es-AR). Direction is always stated in words, never only color/sign.

export const CATEGORIES = {
  COM: 'Comida',
  SUP: 'Supermercado',
  ALO: 'Alojamiento',
  TRA: 'Transporte',
  SAL: 'Salidas',
  SER: 'Servicios',
  OTR: 'Otros',
} as const;

export type CategoryCode = keyof typeof CATEGORIES;
export const CATEGORY_CODES = Object.keys(CATEGORIES) as CategoryCode[];

export function isCategory(v: unknown): v is CategoryCode {
  return typeof v === 'string' && v in CATEGORIES;
}

export const PAYMENT_METHODS = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  otro: 'Otro',
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const SPLIT_LABELS = { equal: 'Iguales', exact: 'Montos exactos', percent: 'Porcentajes' } as const;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "14 jul" or "14 jul 2025" when not the current year. Input is an ISO date (YYYY-MM-DD). */
export function formatDay(iso: string, opts: { year?: 'auto' | 'always' } = {}): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const showYear = opts.year === 'always' || y !== new Date().getFullYear();
  return `${d} ${MONTHS[m - 1]}${showYear ? ` ${y}` : ''}`;
}

/** Local calendar date in Argentina for "today" defaults. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

export function relativeDay(iso: string): string {
  const today = todayIso();
  if (iso === today) return 'hoy';
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (iso === y.toISOString().slice(0, 10)) return 'ayer';
  return formatDay(iso);
}

export function formatDateTime(ts: string): string {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const year = Number(get('year'));
  const month = get('month').replace('.', '');
  const base = `${get('day')} ${month}${year !== new Date().getFullYear() ? ` ${year}` : ''}`;
  return `${base}, ${get('hour')}:${get('minute')}`;
}

export function tsToDay(ts: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(ts));
}

export function initial(name: string): string {
  const ch = name.trim().match(/\p{L}|\p{N}/u)?.[0] ?? '?';
  return ch.toLocaleUpperCase('es-AR');
}

export function personas(n: number): string {
  return n === 1 ? '1 persona' : `${n} personas`;
}

/** Joins names naturally: "Nico", "Nico y Juli", "Nico, Juli y Fede". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
