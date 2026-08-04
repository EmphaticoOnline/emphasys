import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizarTelefono(telefono: string): string {
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
