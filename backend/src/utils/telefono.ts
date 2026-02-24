import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizarTelefono(telefono: string): string {

  let limpio = telefono.replace(/\D/g, '');

  // 🔹 Caso México WhatsApp (52 + 1 + 10 dígitos)
  if (limpio.startsWith('521') && limpio.length === 13) {
    limpio = '52' + limpio.substring(3);
  }

  const parsed = parsePhoneNumberFromString('+' + limpio);

  if (!parsed || !parsed.isValid()) {
    throw new Error('Número de teléfono inválido');
  }

  return parsed.number.replace('+', '');
}