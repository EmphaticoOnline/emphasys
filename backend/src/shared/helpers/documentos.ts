/**
 * Centraliza la definición de documentos fiscales para evitar lógica duplicada
 * en servicios/módulos como impuestos, timbrado CFDI, validaciones fiscales y generación de XML.
 * Si se agregan nuevos documentos fiscales, basta con actualizar TIPOS_DOCUMENTO_FISCALES.
 */
export const TIPOS_DOCUMENTO_FISCALES = new Set<string>(['factura', 'factura_compra']);

export function esDocumentoFiscal(tipoDocumento: string | null | undefined): boolean {
  if (!tipoDocumento) return false;
  const normalizado = tipoDocumento.trim().toLowerCase();
  if (!normalizado) return false;
  return TIPOS_DOCUMENTO_FISCALES.has(normalizado);
}
