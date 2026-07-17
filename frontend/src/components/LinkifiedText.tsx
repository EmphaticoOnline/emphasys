import React from 'react';

// Detecta URLs dentro de texto plano no confiable (mensajes de WhatsApp,
// enviados o recibidos) y las convierte en fragmentos <a> clicables sin usar
// dangerouslySetInnerHTML: el texto se parte en nodos de texto normal (que
// React escapa automáticamente) y elementos <a> construidos vía JSX.
// Reconoce http(s):// y www. (a este último se le antepone https:// solo en
// el href, nunca en el texto visible).

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

// Puntuación que puede quedar "pegada" al final de una URL sin formar parte
// de ella (p. ej. "Visita https://ejemplo.com." o "(https://ejemplo.com)").
// Los paréntesis/corchetes de cierre solo se recortan si están desbalanceados
// dentro del candidato, para no romper URLs legítimas que sí los contienen.
const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]}'"”’»]/;

function stripTrailingPunctuation(candidate: string): string {
  let url = candidate;

  while (url.length > 0) {
    const last = url.charAt(url.length - 1);
    if (!TRAILING_PUNCTUATION_RE.test(last)) break;

    if (last === ')') {
      const opens = (url.match(/\(/g) || []).length;
      const closes = (url.match(/\)/g) || []).length;
      if (opens >= closes) break;
    }
    if (last === ']') {
      const opens = (url.match(/\[/g) || []).length;
      const closes = (url.match(/\]/g) || []).length;
      if (opens >= closes) break;
    }

    url = url.slice(0, -1);
  }

  return url;
}

/**
 * Convierte un texto plano en un array de nodos React: strings normales
 * (pueden contener saltos de línea, se preservan tal cual y se renderizan
 * gracias a white-space: pre-wrap en el contenedor) y elementos <a> para
 * cada URL detectada. Nunca modifica el texto original ni usa HTML crudo.
 */
export function linkifyMessageText(text: string): React.ReactNode[] {
  if (!text) return [text];

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const regex = new RegExp(URL_REGEX);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const url = stripTrailingPunctuation(raw);
    if (!url) continue;

    const start = match.index;
    const end = start + url.length;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    const href = /^www\./i.test(url) ? `https://${url}` : url;

    nodes.push(
      <a
        key={`link-${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'inherit', textDecorationLine: 'underline', wordBreak: 'break-word' }}
      >
        {url}
      </a>
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Devuelve la URL si el texto contiene exactamente una, o null si no hay
 * ninguna o hay más de una (en ese caso no se puede identificar de manera
 * inequívoca cuál copiar). Reutiliza el mismo regex y el mismo recorte de
 * puntuación final que linkifyMessageText, para no duplicar la detección.
 */
export function findSingleUrl(text: string): string | null {
  if (!text) return null;

  const regex = new RegExp(URL_REGEX);
  let match: RegExpExecArray | null;
  let found: string | null = null;
  let count = 0;

  while ((match = regex.exec(text)) !== null) {
    const url = stripTrailingPunctuation(match[0]);
    if (!url) continue;
    count += 1;
    if (count > 1) return null;
    found = /^www\./i.test(url) ? `https://${url}` : url;
  }

  return count === 1 ? found : null;
}
