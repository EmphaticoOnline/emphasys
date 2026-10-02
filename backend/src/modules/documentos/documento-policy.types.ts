export type DocumentoInventarioAfectacion = 'none' | 'entrada' | 'salida' | 'transferencia';

export type DocumentoFiscalPolicy = {
  codigo: string;
  esCfdi: boolean;
  tipoCfdi: 'I' | 'E' | 'T' | 'P' | null;
  generaSaldo: boolean;
  esCobrable: boolean;
  afectaVentas: boolean;
  afectaInventario: DocumentoInventarioAfectacion;
  permitePagos: boolean;
  permiteAplicacionesSaldo: boolean;
  permiteCartaPorte: boolean;
  permiteNotaCredito: boolean;
  permiteContabilizacion: boolean;
  permiteRelacionesCfdi: boolean;
  receptor: 'empresa_activa' | 'contacto' | 'manual';
  formaPago: 'prohibida' | 'opcional' | 'requerida';
  metodoPago: 'prohibido' | 'opcional' | 'requerido';
  subtotal: 'cero' | 'partidas' | 'calculado';
  total: 'cero' | 'partidas' | 'calculado';
  impuestos: 'prohibidos' | 'permitidos' | 'requeridos';
};
