// El usuario captura solo dígitos corridos (o pega una cuenta ya separada);
// aquí se descarta cualquier carácter que no sea dígito, incluyendo el propio
// caracter_separador si es un espacio, punto, guion, etc.
export function limpiarCuentaInput(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

// estructura_cuentas siempre usa guion como notación propia de longitudes de
// segmento (ej. "3-4-3"), independientemente del caracter_separador
// configurado para el número de cuenta visible.
export function parseEstructuraCuentas(estructuraCuentas: string): number[] {
  return estructuraCuentas.split('-').map(Number);
}

export function capacidadMaximaDigitos(segmentLengths: number[]): number {
  return segmentLengths.reduce((acc, n) => acc + n, 0);
}

// Formatea una cadena de dígitos según las longitudes de segmento,
// insertando el caracter_separador configurado entre cada segmento completo.
export function aplicarMascaraCuenta(digitos: string, segmentLengths: number[], caracterSeparador: string): string {
  const partes: string[] = [];
  let cursor = 0;
  for (const len of segmentLengths) {
    if (cursor >= digitos.length) break;
    partes.push(digitos.slice(cursor, cursor + len));
    cursor += len;
  }
  return partes.join(caracterSeparador);
}

// Determina si la cantidad de dígitos capturada cae exactamente en un límite
// de segmento válido (ej. 3, 7 o 10 dígitos para la estructura "3-4-3") y, de
// ser así, regresa la cadena jerárquica ya formateada con el separador
// configurado (nivel 1, nivel 1+2, ..., nivel final). Si la cantidad de
// dígitos queda a la mitad de un segmento o excede la capacidad total,
// regresa null.
export function obtenerNivelesCuenta(digitos: string, segmentLengths: number[], caracterSeparador: string): string[] | null {
  if (!digitos) return null;
  const niveles: string[] = [];
  let cursor = 0;
  for (const len of segmentLengths) {
    cursor += len;
    if (cursor > digitos.length) return null;
    niveles.push(aplicarMascaraCuenta(digitos.slice(0, cursor), segmentLengths, caracterSeparador));
    if (cursor === digitos.length) return niveles;
  }
  return null;
}
