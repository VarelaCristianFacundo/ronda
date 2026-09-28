import { CURRENCIES, formatMoney, type CurrencyCode } from './money';

export type OverallLine = {
  currency: CurrencyCode;
  netMinor: number;
  tone: 'owed' | 'owe' | 'settled';
  headline: string; // "En pesos te deben"
  sentence: string; // "En euros debés € 42,50"
};

const IN_CURRENCY: Record<CurrencyCode, string> = { ARS: 'En pesos', USD: 'En dólares', EUR: 'En euros' };

/**
 * Overall balance per currency. Currencies are never added together: converting would mean
 * inventing an exchange rate. Order: largest absolute balance first; ARS breaks ties.
 */
export function overallByCurrency(groups: { currency: CurrencyCode; netMinor: number }[]): OverallLine[] {
  const totals = new Map<CurrencyCode, number>();
  for (const g of groups) totals.set(g.currency, (totals.get(g.currency) ?? 0) + g.netMinor);
  return [...totals]
    .sort(([ca, a], [cb, b]) => Math.abs(b) - Math.abs(a) || (ca === 'ARS' ? -1 : cb === 'ARS' ? 1 : 0))
    .map(([currency, netMinor]) => {
      const tone = netMinor > 0 ? 'owed' : netMinor < 0 ? 'owe' : 'settled';
      const verb = tone === 'owed' ? 'te deben' : tone === 'owe' ? 'debés' : 'estás al día';
      const prefix = IN_CURRENCY[currency] ?? `En ${CURRENCIES[currency].name}`;
      return {
        currency,
        netMinor,
        tone,
        headline: `${prefix} ${verb}`,
        sentence: tone === 'settled' ? `${prefix} ${verb}` : `${prefix} ${verb} ${formatMoney(Math.abs(netMinor), currency)}`,
      };
    });
}
