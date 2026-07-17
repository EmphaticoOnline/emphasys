import { apiFetch } from './apiFetch';

const BASE = '/api/contabilidad/ventas/facturas';

export interface MovimientoAsientoVenta {
  cuenta_id: number;
  cuenta: string;
  descripcion: string;
  cargo: number;
  abono: number;
  origen: string;
  concepto: string;
}

export interface AsientoFacturaVenta {
  documento_id: number;
  folio: string;
  fecha_documento: string;
  movimientos: MovimientoAsientoVenta[];
  total_cargos: number;
  total_abonos: number;
}

export interface FaltanteCuentaContable {
  uso_contable: string;
  contexto: string;
}

export interface PolizaEncabezadoResumen {
  id: number;
  numero: number;
  tipo_poliza_identificador: string;
  fecha: string;
  estatus: string;
  total_cargos: number;
  total_abonos: number;
  referencia: string | null;
}

export interface ContabilizacionResumen {
  id: number;
  poliza_id: number;
  documento_id: number | null;
  evento_contable: string;
  modo_contabilizacion: string;
  es_reversa: boolean;
}

export interface ResultadoContabilizarFacturaVenta {
  poliza: PolizaEncabezadoResumen;
  contabilizacion: ContabilizacionResumen;
  asiento: AsientoFacturaVenta;
}

export async function previsualizarFacturaVenta(documentoId: number): Promise<AsientoFacturaVenta> {
  return apiFetch(`${BASE}/${documentoId}/preview`, { method: 'POST' });
}

// tipoPolizaId ya no se pide en el flujo normal de UI: el backend lo resuelve
// desde contabilidad.configuracion_tipos_automaticos (clave venta_factura). Se
// conserva como override opcional para no romper otros llamadores.
export async function contabilizarFacturaVenta(
  documentoId: number,
  tipoPolizaId?: number
): Promise<ResultadoContabilizarFacturaVenta> {
  return apiFetch(`${BASE}/${documentoId}/contabilizar`, {
    method: 'POST',
    body: tipoPolizaId != null ? { tipo_poliza_id: tipoPolizaId } : {},
  });
}

export type AgrupacionLoteVenta = 'individual' | 'concentrado';

export type EstadoDocumentoLoteVenta =
  | 'contabilizada'
  | 'omitida_ya_contabilizada'
  // Solo puede ocurrir en modalidad selección: documento no encontrado en la
  // empresa, cancelado, no es factura estándar, o no timbrado sin permiso.
  | 'omitida_no_elegible'
  | 'error';

export interface ResultadoDocumentoLoteVenta {
  documento_id: number;
  estado: EstadoDocumentoLoteVenta;
  motivo?: string;
  contabilizacion_id?: number;
}

export interface ResumenLoteFacturaVenta {
  total_en_rango: number;
  contabilizadas: number;
  omitidas_ya_contabilizadas: number;
  omitidas_no_elegibles: number;
  con_error: number;
  // Solo poblados en modalidad selección.
  seleccionadas?: number;
  elegibles?: number;
}

export interface ResultadoLoteVenta {
  modo: 'lote_individual' | 'lote_concentrado';
  resumen: ResumenLoteFacturaVenta;
  resultados: ResultadoDocumentoLoteVenta[];
  polizas?: PolizaEncabezadoResumen[];
  contabilizaciones?: ContabilizacionResumen[];
  mensaje?: string;
}

// Modalidad "rango": todas las facturas de venta candidatas dentro de un
// rango de fechas. Modalidad "seleccion": solo los documento_ids indicados
// (facturas marcadas en la grilla), sin requerir fechas. tipo_poliza_id ya no
// se pide en el flujo normal de UI: el backend lo resuelve desde
// contabilidad.configuracion_tipos_automaticos. Se conserva como override
// opcional para no romper otros llamadores.
export type ContabilizarLoteVentaPayload =
  | { fecha_desde: string; fecha_hasta: string; agrupacion: AgrupacionLoteVenta; tipo_poliza_id?: number }
  | { documento_ids: number[]; agrupacion: AgrupacionLoteVenta; tipo_poliza_id?: number };

export async function contabilizarFacturasVentaLote(payload: ContabilizarLoteVentaPayload): Promise<ResultadoLoteVenta> {
  return apiFetch(`${BASE}/lote`, { method: 'POST', body: payload });
}

export type EstadoContableFacturaVenta = 'contabilizada' | 'no_contabilizable' | 'pendiente';

export interface EstadoContableFacturaVentaInfo {
  estado: EstadoContableFacturaVenta;
  motivo: string | null;
  poliza_id?: number;
  poliza_numero?: number;
  poliza_fecha?: string;
  tipo_poliza_identificador?: string;
}

export async function fetchEstadoContableFacturasVentaLote(
  documentoIds: number[]
): Promise<Record<number, EstadoContableFacturaVentaInfo>> {
  if (documentoIds.length === 0) return {};
  return apiFetch(`${BASE}/estado-contable-lote`, {
    method: 'POST',
    body: { documento_ids: documentoIds },
  });
}

// Consulta genérica de contabilidad.contabilizaciones por documento (infraestructura
// base, no específica de ventas), usada aquí solo para localizar la póliza ya
// generada cuando la factura está contabilizada.
export interface ContabilizacionGenerica {
  id: number;
  poliza_id: number;
  documento_id: number | null;
  evento_contable: string;
  es_reversa: boolean;
}

export async function fetchContabilizacionesDocumento(documentoId: number): Promise<ContabilizacionGenerica[]> {
  return apiFetch(`/api/contabilidad/contabilizaciones/documento/${documentoId}`);
}
