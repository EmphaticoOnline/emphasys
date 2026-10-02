import type { DocumentoFiscalPolicy } from './documento-policy.types';

const TRASLADO_POLICY: DocumentoFiscalPolicy = {
  codigo: 'traslado',
  esCfdi: true,
  tipoCfdi: 'T',
  generaSaldo: false,
  esCobrable: false,
  afectaVentas: false,
  afectaInventario: 'none',
  permitePagos: false,
  permiteAplicacionesSaldo: false,
  permiteCartaPorte: true,
  permiteNotaCredito: false,
  permiteContabilizacion: false,
  permiteRelacionesCfdi: false,
  receptor: 'empresa_activa',
  formaPago: 'prohibida',
  metodoPago: 'prohibido',
  subtotal: 'cero',
  total: 'cero',
  impuestos: 'prohibidos',
};

export function getDocumentoPolicy(tipoDocumento: string | null | undefined): DocumentoFiscalPolicy | null {
  return String(tipoDocumento ?? '').trim().toLowerCase() === 'traslado' ? TRASLADO_POLICY : null;
}

export function isTraslado(tipoDocumento: string | null | undefined): boolean {
  return getDocumentoPolicy(tipoDocumento)?.codigo === 'traslado';
}
