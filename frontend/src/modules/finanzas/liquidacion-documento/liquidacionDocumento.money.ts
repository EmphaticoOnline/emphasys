export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function toCivilDate(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

export function parseMoneyInput(value: string | number | null | undefined): number {
  if (typeof value === 'number') return roundMoney(Math.max(0, value));
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!normalized) return 0;
  return roundMoney(Math.max(0, Number(normalized) || 0));
}
