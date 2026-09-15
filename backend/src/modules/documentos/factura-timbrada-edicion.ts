export const CAMPOS_EDITABLES_FACTURA_TIMBRADA = [
  'observaciones',
  'fecha_vencimiento',
] as const;

export const esFacturaTimbrada = (documento: { tipo_documento?: unknown; estatus_documento?: unknown; esta_timbrado?: unknown; cfdi_uuid?: unknown }): boolean =>
  String(documento.tipo_documento ?? '').trim().toLowerCase() === 'factura'
  && (Boolean(documento.esta_timbrado) || Boolean(documento.cfdi_uuid) || String(documento.estatus_documento ?? '').trim().toLowerCase() === 'timbrado');

export function validarCamposFacturaTimbrada(data: Record<string, unknown>): void {
  const permitidos = new Set<string>(CAMPOS_EDITABLES_FACTURA_TIMBRADA);
  const prohibidos = Object.keys(data).filter((campo) => !permitidos.has(campo));
  if (prohibidos.length > 0) {
    throw new Error(`VALIDATION_ERROR: Una factura timbrada sólo permite modificar observaciones y fecha_vencimiento. Campos no permitidos: ${prohibidos.join(', ')}`);
  }
}
