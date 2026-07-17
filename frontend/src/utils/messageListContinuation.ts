// Continuación automática de listas numeradas ("1. ", "2. "...) y con viñetas
// ("- "/"* ") en cuadros de texto planos (sin editor enriquecido). Se usa en el
// composer de WhatsApp de LeadsPage, pero es una función pura sin dependencias
// de React ni del DOM: recibe el texto completo y la posición del cursor, y
// devuelve el texto resultante y la nueva posición del cursor, o null si la
// línea actual no es una lista (en cuyo caso el llamador debe dejar el
// comportamiento normal de salto de línea sin modificar).

const NUMBERED_LIST_RE = /^(\d+)\.[ \t](.*)$/s;
const BULLET_LIST_RE = /^([-*])[ \t](.*)$/s;

export type ListContinuationResult = {
  text: string;
  cursorPos: number;
};

function findLineBounds(text: string, cursorPos: number): { lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
  const nextBreak = text.indexOf('\n', cursorPos);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return { lineStart, lineEnd };
}

/**
 * Calcula el resultado de continuar (o terminar) una lista al insertar un
 * salto de línea en `cursorPos`. Devuelve null cuando la línea actual no
 * coincide con un patrón de lista, o cuando hay una selección activa
 * (selectionStart !== selectionEnd): en ambos casos el llamador debe dejar
 * el comportamiento normal del textarea sin intervenir.
 */
export function computeListContinuation(
  text: string,
  selectionStart: number,
  selectionEnd: number
): ListContinuationResult | null {
  if (selectionStart !== selectionEnd) return null;

  const { lineStart, lineEnd } = findLineBounds(text, selectionStart);
  const line = text.slice(lineStart, lineEnd);

  const numberedMatch = line.match(NUMBERED_LIST_RE);
  const bulletMatch = line.match(BULLET_LIST_RE);

  if (numberedMatch) {
    const numberStr = numberedMatch[1];
    const rest = numberedMatch[2] ?? '';
    if (rest.trim() === '') {
      // Línea de lista vacía ("3. "): termina la lista, no continúa la numeración.
      const newText = text.slice(0, lineStart) + '\n' + text.slice(lineEnd);
      return { text: newText, cursorPos: lineStart + 1 };
    }
    const nextNumber = Number(numberStr) + 1;
    const prefix = `${nextNumber}. `;
    const newText = text.slice(0, selectionStart) + '\n' + prefix + text.slice(selectionStart);
    return { text: newText, cursorPos: selectionStart + 1 + prefix.length };
  }

  if (bulletMatch) {
    const bullet = bulletMatch[1];
    const rest = bulletMatch[2] ?? '';
    if (rest.trim() === '') {
      // Viñeta vacía ("- " o "* "): termina la lista.
      const newText = text.slice(0, lineStart) + '\n' + text.slice(lineEnd);
      return { text: newText, cursorPos: lineStart + 1 };
    }
    const prefix = `${bullet} `;
    const newText = text.slice(0, selectionStart) + '\n' + prefix + text.slice(selectionStart);
    return { text: newText, cursorPos: selectionStart + 1 + prefix.length };
  }

  return null;
}
