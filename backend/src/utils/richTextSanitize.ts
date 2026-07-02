import sanitizeHtml from 'sanitize-html';

const RICH_TEXT_BASICO_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li'],
  allowedAttributes: {},
};

export function sanitizarRichTextBasico(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_BASICO_OPTIONS);
}
