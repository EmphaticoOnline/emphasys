import { apiFetch } from './apiFetch';
import type {
  AplicacionOperacion,
  DocumentoAnticiposDisponibles,
  ConciliacionPayload,
  DocumentoAnticipoResumen,
  DocumentoSaldo,
  EstadoCuentaItem,
  FacturaCompraPendiente,
  FinanzasCuenta,
  FinanzasMetodoPago,
  FinanzasOperacion,
  NaturalezaOperacion,
  OperacionDisponible,
  ProgramacionPago,
  ProgramacionPagoInput,
  ProgramacionMasivaInput,
  TipoMovimiento,
  TransferenciaPayload,
  TransferenciaUpdatePayload,
  ConciliacionMovimientosResult,
  CierrePayload,
  CierreResult,
  HistorialConciliacion,
  DeshacerConciliacionPayload,
  DeshacerConciliacionResult,
} from '../types/finanzas';

const BASE = '/api/finanzas';

export async function fetchCuentas(): Promise<FinanzasCuenta[]> {
  return apiFetch(`${BASE}/cuentas`);
}

export async function crearCuenta(payload: Partial<FinanzasCuenta>): Promise<FinanzasCuenta> {
  return apiFetch(`${BASE}/cuentas`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarCuenta(id: number, payload: Partial<FinanzasCuenta>): Promise<FinanzasCuenta> {
  return apiFetch(`${BASE}/cuentas/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarCuenta(id: number): Promise<void> {
  await apiFetch(`${BASE}/cuentas/${id}`, { method: 'DELETE' });
}

export async function fetchOperaciones(cuentaId: number): Promise<FinanzasOperacion[]> {
  return apiFetch(`${BASE}/operaciones?cuenta_id=${cuentaId}`);
}

export interface OperacionPayload {
  cuenta_id: number;
  fecha: string;
  tipo_movimiento: TipoMovimiento;
  naturaleza_operacion?: NaturalezaOperacion;
  documento_origen_id?: number | null;
  contacto_id?: number | null;
  referencia?: string | null;
  observaciones?: string | null;
  monto: number;
  concepto_id?: number | null;
  metodo_pago_id?: number | null;
}

export async function crearOperacion(payload: OperacionPayload): Promise<FinanzasOperacion> {
  return apiFetch(`${BASE}/operaciones`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarOperacion(id: number, payload: OperacionPayload): Promise<FinanzasOperacion> {
  return apiFetch(`${BASE}/operaciones/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarOperacion(id: number): Promise<void> {
  await apiFetch(`${BASE}/operaciones/${id}`, { method: 'DELETE' });
}

export async function crearTransferencia(payload: TransferenciaPayload): Promise<any> {
  return apiFetch(`${BASE}/transferencias`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarTransferencia(id: number, payload: TransferenciaPayload): Promise<any> {
  return apiFetch(`${BASE}/transferencias/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarTransferencia(id: number): Promise<void> {
  await apiFetch(`${BASE}/transferencias/${id}`, { method: 'DELETE' });
}

export async function crearConciliacion(payload: ConciliacionPayload): Promise<any> {
  return apiFetch(`${BASE}/conciliaciones`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function fetchOperacionDetalle(id: number): Promise<FinanzasOperacion> {
  return apiFetch(`${BASE}/finanzas_operaciones/${id}`);
}

export async function fetchOperacionDisponible(_id: number): Promise<OperacionDisponible> {
  throw new Error('fetchOperacionDisponible ya no está disponible en el modelo documental');
}

export async function fetchAplicacionesPorOperacion(_id: number): Promise<AplicacionOperacion[]> {
  throw new Error('fetchAplicacionesPorOperacion ya no está disponible en el modelo documental');
}

export async function fetchAplicacionesDocumento(id: number): Promise<AplicacionOperacion[]> {
  return apiFetch(`${BASE}/documentos/${id}/aplicaciones`);
}

export async function fetchSaldoDocumento(id: number): Promise<DocumentoSaldo> {
  return apiFetch(`${BASE}/documentos/${id}/saldo`);
}

export async function fetchResumenAnticiposDocumento(id: number): Promise<DocumentoAnticipoResumen> {
  return apiFetch(`${BASE}/documentos/${id}/anticipos-resumen`);
}

export async function fetchAnticiposDisponiblesDocumento(id: number): Promise<DocumentoAnticiposDisponibles> {
  return apiFetch(`${BASE}/documentos/${id}/anticipos-disponibles`);
}

export async function fetchEstadoCuenta(contactoId: number): Promise<EstadoCuentaItem[]> {
  return apiFetch(`${BASE}/contactos/${contactoId}/estado-cuenta`);
}

export async function crearAplicacion(payload: {
  documento_origen_id: number;
  documento_destino_id: number;
  monto: number;
  monto_moneda_documento: number;
  fecha_aplicacion?: string | null;
}): Promise<AplicacionOperacion> {
  return apiFetch(`${BASE}/aplicaciones`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function aplicarAnticiposDocumento(
  documentoOrigenId: number,
  payload: {
    documento_destino_id: number;
    aplicaciones: Array<{
      finanzas_operacion_id: number;
      monto: number;
      monto_moneda_documento?: number;
      fecha_aplicacion?: string | null;
    }>;
    fecha_aplicacion?: string | null;
  }
): Promise<AplicacionOperacion[]> {
  return apiFetch(`${BASE}/documentos/${documentoOrigenId}/aplicar-anticipos`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function eliminarAplicacion(id: number): Promise<void> {
  await apiFetch(`${BASE}/aplicaciones/${id}`, { method: 'DELETE' });
}

// ── Métodos de pago operativos ─────────────────────────────────────────────────

export async function fetchMetodosPago(soloActivos = true): Promise<FinanzasMetodoPago[]> {
  return apiFetch(`${BASE}/metodos-pago${soloActivos ? '?activos=true' : ''}`);
}

export async function crearMetodoPago(
  payload: Omit<FinanzasMetodoPago, 'id' | 'empresa_id' | 'created_at'>
): Promise<FinanzasMetodoPago> {
  return apiFetch(`${BASE}/metodos-pago`, { method: 'POST', body: payload as any });
}

export async function actualizarMetodoPago(
  id: number,
  payload: Partial<Omit<FinanzasMetodoPago, 'id' | 'empresa_id' | 'created_at'>>
): Promise<FinanzasMetodoPago> {
  return apiFetch(`${BASE}/metodos-pago/${id}`, { method: 'PUT', body: payload as any });
}

// ── Programación de pagos (Fase 3.2A) ─────────────────────────────────────────

export async function fetchFacturasCompraPendientes(opts?: {
  proveedorId?: number | null;
  search?: string | null;
  excludeProgramacionId?: number | null;
  moneda?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  vencimiento?: 'vencidas' | 'por_vencer' | null;
  limit?: number | null;
}): Promise<FacturaCompraPendiente[]> {
  const qs = new URLSearchParams();
  if (opts?.proveedorId) qs.set('proveedor_id', String(opts.proveedorId));
  if (opts?.search) qs.set('search', opts.search);
  if (opts?.excludeProgramacionId) qs.set('exclude_programacion_id', String(opts.excludeProgramacionId));
  if (opts?.moneda) qs.set('moneda', opts.moneda);
  if (opts?.fechaDesde) qs.set('fecha_desde', opts.fechaDesde);
  if (opts?.fechaHasta) qs.set('fecha_hasta', opts.fechaHasta);
  if (opts?.vencimiento) qs.set('vencimiento', opts.vencimiento);
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const q = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`${BASE}/facturas-compra-pendientes${q}`);
}

export interface ProgramacionPagosParams {
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  proveedor_id?: number | null;
  estatus?: string | null;
  cuenta_origen_id?: number | null;
  metodo_pago_id?: number | null;
  moneda?: string | null;
}

export async function fetchProgramacionesPago(
  params?: ProgramacionPagosParams
): Promise<ProgramacionPago[]> {
  const qs = new URLSearchParams();
  if (params?.fecha_inicio)    qs.set('fecha_inicio',    params.fecha_inicio);
  if (params?.fecha_fin)       qs.set('fecha_fin',       params.fecha_fin);
  if (params?.proveedor_id)    qs.set('proveedor_id',    String(params.proveedor_id));
  if (params?.estatus)         qs.set('estatus',         params.estatus);
  if (params?.cuenta_origen_id) qs.set('cuenta_origen_id', String(params.cuenta_origen_id));
  if (params?.metodo_pago_id)  qs.set('metodo_pago_id',  String(params.metodo_pago_id));
  if (params?.moneda)          qs.set('moneda',          params.moneda);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`${BASE}/programacion-pagos${q}`);
}

export async function crearProgramacionPago(
  payload: ProgramacionPagoInput
): Promise<ProgramacionPago> {
  return apiFetch(`${BASE}/programacion-pagos`, { method: 'POST', body: payload as any });
}

export async function crearProgramacionesMasiva(
  payload: ProgramacionMasivaInput
): Promise<ProgramacionPago[]> {
  return apiFetch(`${BASE}/programacion-pagos/masiva`, { method: 'POST', body: payload as any });
}

export async function actualizarProgramacionPago(
  id: number,
  payload: Partial<ProgramacionPagoInput>
): Promise<ProgramacionPago> {
  return apiFetch(`${BASE}/programacion-pagos/${id}`, { method: 'PUT', body: payload as any });
}

export async function cancelarProgramacionPago(id: number): Promise<ProgramacionPago> {
  return apiFetch(`${BASE}/programacion-pagos/${id}/cancelar`, { method: 'POST' });
}

export interface PagarProgramacionResult {
  programacion: ProgramacionPago;
  documento_pago_id: number;
  finanzas_operacion_id: number;
}

export async function pagarProgramacion(id: number): Promise<PagarProgramacionResult> {
  return apiFetch(`${BASE}/programacion-pagos/${id}/pagar`, { method: 'POST' });
}

// =============================================================================
// Fase 3.4 — Conciliación Bancaria Básica Manual
// =============================================================================

export async function fetchConciliacionMovimientos(
  cuentaId: number,
  fechaCorte: string
): Promise<ConciliacionMovimientosResult> {
  return apiFetch(
    `${BASE}/conciliacion-bancaria/movimientos?cuenta_id=${cuentaId}&fecha_corte=${encodeURIComponent(fechaCorte)}`
  );
}

export async function cotejarMovimientosSvc(
  operacionIds: number[],
  estado: 'pendiente' | 'cotejado'
): Promise<{ updated: number }> {
  return apiFetch(`${BASE}/conciliacion-bancaria/cotejar`, {
    method: 'POST',
    body: { operacion_ids: operacionIds, estado } as any,
  });
}

export async function cerrarConciliacion(payload: CierrePayload): Promise<CierreResult> {
  return apiFetch(`${BASE}/conciliacion-bancaria/cerrar`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function fetchHistorialConciliaciones(
  cuentaId: number
): Promise<HistorialConciliacion[]> {
  return apiFetch(`${BASE}/conciliacion-bancaria/historial?cuenta_id=${cuentaId}`);
}

export async function deshacerConciliacionSvc(
  id: number,
  payload: DeshacerConciliacionPayload
): Promise<DeshacerConciliacionResult> {
  return apiFetch(`${BASE}/conciliacion-bancaria/${id}/deshacer`, {
    method: 'POST',
    body: payload as any,
  });
}
