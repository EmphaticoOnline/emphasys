import type { CotizacionListado } from '../../types/cotizacion';
import type { StatusTone } from '../status/status.types';

const normalizar = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export type EstadoVisualDocumento = { tone: StatusTone; label: string };

/** Misma semántica que el punto de estatus de Facturas Workspace. */
export function estadoVisualDocumento(
  row: Pick<CotizacionListado, 'estatus_documento' | 'tratamiento_impuestos' | 'cfdi_cancelacion_estado' | 'cfdi_estado_sat' | 'cfdi_fecha_cancelacion' | 'cfdi_uuid'>,
): EstadoVisualDocumento {
  const estatus = normalizar(row.estatus_documento);
  const cancelacion = normalizar(row.cfdi_cancelacion_estado);
  const estadoSat = normalizar(row.cfdi_estado_sat);
  const cancelada = estatus === 'cancelado' || estatus === 'cancelada' || cancelacion === 'cancelada'
    || estadoSat === 'cancelado' || estadoSat === 'cancelada' || Boolean(row.cfdi_fecha_cancelacion);
  if (cancelada) return { tone: 'error', label: 'Cancelada' };
  if (['solicitada', 'pendiente', 'requiere_reconciliacion'].includes(cancelacion)) {
    return { tone: 'warning', label: 'Cancelación pendiente' };
  }
  if (estatus === 'timbrado' && Boolean(row.cfdi_uuid)) return { tone: 'success', label: 'Timbrada' };
  if (estatus === 'emitido' && normalizar(row.tratamiento_impuestos) === 'sin_iva') return { tone: 'success', label: 'Emitida' };
  return { tone: 'draft', label: estatus === 'emitido' ? 'Emitida · CFDI pendiente' : 'Borrador' };
}
