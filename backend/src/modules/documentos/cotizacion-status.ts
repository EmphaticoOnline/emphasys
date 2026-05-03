export const COTIZACION_ESTADOS_SEGUIMIENTO = [
  'abierta',
  'pausada',
  'ganada',
  'perdida',
  'cancelada',
] as const;

export const COTIZACION_ESTATUS_DOCUMENTO = [
  'Borrador',
  'Enviado',
  'En negociaci\u00f3n',
] as const;

export const COTIZACION_ESTADO_SEGUIMIENTO_DEFAULT = 'abierta';
export const COTIZACION_ESTATUS_DOCUMENTO_DEFAULT = 'Borrador';
export const COTIZACION_ESTATUS_DOCUMENTO_ENVIADO = 'Enviado';
export const COTIZACION_ESTATUS_DOCUMENTO_EN_NEGOCIACION = 'En negociaci\u00f3n';

export type CotizacionEstadoSeguimiento = typeof COTIZACION_ESTADOS_SEGUIMIENTO[number];
export type CotizacionEstatusDocumento = typeof COTIZACION_ESTATUS_DOCUMENTO[number];

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function normalizarEstadoSeguimientoCotizacion(valor: unknown): CotizacionEstadoSeguimiento | null {
  const texto = normalizarTexto(valor);

  switch (texto) {
    case 'abierta':
    case 'pausada':
    case 'ganada':
    case 'perdida':
    case 'cancelada':
      return texto;
    default:
      return null;
  }
}

export function normalizarEstatusDocumentoCotizacion(valor: unknown): CotizacionEstatusDocumento | null {
  const texto = normalizarTexto(valor);

  switch (texto) {
    case 'borrador':
      return 'Borrador';
    case 'enviado':
      return 'Enviado';
    case 'en negociacion':
    case 'negociacion':
      return 'En negociaci\u00f3n';
    default:
      return null;
  }
}

export function sanitizarCamposCotizacion<
  T extends Record<string, any> & {
    estatus_documento?: any;
    estado_seguimiento?: any;
  },
>(
  data: T,
  options: { applyDefaults?: boolean } = {}
): T {
  const next = { ...data };

  if (options.applyDefaults) {
    if (next.estatus_documento == null || String(next.estatus_documento).trim() === '') {
      next.estatus_documento = COTIZACION_ESTATUS_DOCUMENTO_DEFAULT;
    }
    if (next.estado_seguimiento == null || String(next.estado_seguimiento).trim() === '') {
      next.estado_seguimiento = COTIZACION_ESTADO_SEGUIMIENTO_DEFAULT;
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, 'estatus_documento') && next.estatus_documento !== undefined) {
    const estatus = normalizarEstatusDocumentoCotizacion(next.estatus_documento);
    if (!estatus) {
      throw new Error('VALIDATION_ERROR: estatus_documento invalido para cotizacion');
    }
    next.estatus_documento = estatus;
  }

  if (Object.prototype.hasOwnProperty.call(next, 'estado_seguimiento') && next.estado_seguimiento !== undefined) {
    const estado = normalizarEstadoSeguimientoCotizacion(next.estado_seguimiento);
    if (!estado) {
      throw new Error('VALIDATION_ERROR: estado_seguimiento invalido para cotizacion');
    }
    next.estado_seguimiento = estado;
  }

  return next;
}