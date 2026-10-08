import type { TipoDocumento } from '../../types/documentos';

/** Los documentos de Compras no pertenecen al scope comercial por agente. */
const TIPOS_DOCUMENTO_COMPRAS = new Set<TipoDocumento>([
  'orden_compra',
  'recepcion',
  'factura_compra',
  'nota_credito_compra',
  'pago_proveedor',
  'ajuste_proveedor',
]);

export function debeAplicarScopeVentas(tipoDocumento: TipoDocumento): boolean {
  return !TIPOS_DOCUMENTO_COMPRAS.has(tipoDocumento);
}
