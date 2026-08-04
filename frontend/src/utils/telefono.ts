import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizarTelefonoMx(telefono: string): string {
  const valor = telefono.trim();
  const limpio = valor.replace(/\D/g, '');

  if (!limpio) {
    throw new Error('Número de teléfono inválido');
  }

  if (!valor.startsWith('+')) {
    if (limpio.startsWith('521') && limpio.length === 13) return limpio;
    if (limpio.startsWith('52') && limpio.length === 12) return `521${limpio.slice(-10)}`;
    if (limpio.length === 10) return `521${limpio}`;
  }

  const parsed = valor.startsWith('+')
    ? parsePhoneNumberFromString(valor)
    : parsePhoneNumberFromString(`+${limpio}`);

  if (!parsed || !parsed.isValid()) {
    throw new Error('Número de teléfono inválido');
  }

  if (parsed.country === 'MX') {
    return `521${parsed.nationalNumber}`;
  }

  return parsed.number.slice(1);
}

export function formatearTelefonoParaMostrar(
  telefono: string | null | undefined
): string {
  const valor = String(telefono ?? '').trim();
  if (!valor) return '';

  const digits = valor.replace(/\D/g, '');
  const parsed = valor.startsWith('+')
    ? parsePhoneNumberFromString(valor)
    : digits.startsWith('521') && digits.length === 13
      ? parsePhoneNumberFromString(`+52${digits.slice(3)}`)
      : digits.startsWith('52') && digits.length === 12
        ? parsePhoneNumberFromString(`+${digits}`)
        : digits.length === 10
          ? parsePhoneNumberFromString(digits, 'MX')
          : parsePhoneNumberFromString(`+${digits}`);

  if (!parsed || !parsed.isValid()) return valor;

  if (parsed.country === 'MX') {
    const groups = parsed.formatNational().match(/\d+/g) ?? [];
    if (groups.length >= 3) {
      return `(${groups[0]}) ${groups.slice(1, -1).join(' ')}-${groups.at(-1)}`;
    }
    return parsed.formatNational();
  }

  if (parsed.countryCallingCode === '1' && parsed.nationalNumber.length === 10) {
    const national = parsed.nationalNumber;
    return `+1 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }

  return parsed.formatInternational();
}
