/** Numeric precision accepted by Facturama for concept-level fiscal values. */
export const FACTURAMA_DECIMALS = 6;

/**
 * Truncates a finite number to six decimal places without exposing the usual
 * binary floating-point residue in the JSON payload.
 */
export function truncateFiscal(value: number): number {
  if (!Number.isFinite(value)) return 0;

  const sign = value < 0 ? -1 : 1;
  // Compensate only the tiny representation error introduced by converting
  // decimal database/XML values to JS numbers; this is far below one unit at
  // the sixth decimal place and does not change the truncation policy.
  const absolute = Math.abs(value) + Math.max(1, Math.abs(value)) * 1e-12;
  const decimal = absolute.toFixed(12).split('.')[1] ?? '';
  const integer = Math.trunc(absolute);
  const fraction = decimal.slice(0, FACTURAMA_DECIMALS).padEnd(FACTURAMA_DECIMALS, '0');
  const normalized = Number(`${integer}.${fraction}`) * sign;
  return Object.is(normalized, -0) ? 0 : normalized;
}
