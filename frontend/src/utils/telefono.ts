import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizarTelefonoMx(telefono: string): string {
  let limpio = telefono.replace(/\D/g, '');

  if (limpio.startsWith('521') && limpio.length === 13) {
    limpio = `52${limpio.substring(3)}`;
  }

  const parsed = limpio.startsWith('52')
    ? parsePhoneNumberFromString(`+${limpio}`)
    : parsePhoneNumberFromString(limpio, 'MX');

  if (!parsed || !parsed.isValid()) {
    throw new Error('Número de teléfono inválido');
  }

  return parsed.number.replace('+', '');
}