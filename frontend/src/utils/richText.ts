export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const texto = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim();
  return texto.length === 0;
}
