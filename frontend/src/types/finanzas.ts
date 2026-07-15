export type TipoMovimiento = 'Deposito' | 'Retiro';
export type NaturalezaOperacion = 'cobro_cliente' | 'pago_proveedor' | 'movimiento_general';

export type EstatusProgramacion = 'programado' | 'pagado' | 'cancelado';

export interface FacturaCompraPendiente {
  id: number;
  serie: string;
  numero: number;
  serie_externa: string | null;
  numero_externo: number | null;
  folio: string;
  folio_proveedor: string;
  fecha_documento: string;
  fecha_vencimiento: string | null;
  proveedor_id: number;
  proveedor_nombre: string;
  moneda: string;
  total: number;
  saldo: number;
  saldo_disponible_programar: number;
}

export interface ProgramacionPagoDetalle {
  id: number;
  empresa_id: number;
  programacion_id: number;
  documento_id: number;
  monto_programado: number;
  moneda: string;
  created_at: string;
  updated_at: string;
  // joined
  documento_serie?: string | null;
  documento_numero?: number | null;
  documento_serie_externa?: string | null;
  documento_numero_externo?: number | null;
  documento_fecha_vencimiento?: string | null;
}

export interface ProgramacionPago {
  id: number;
  empresa_id: number;
  documento_id: number | null;    // nullable: NULL para multi-factura (modelo v2)
  proveedor_id: number | null;
  fecha_programada: string;
  monto_programado: number;       // total de todos los detalles
  moneda: string;
  cuenta_origen_id: number | null;
  metodo_pago_id: number | null;
  referencia: string | null;
  estatus: EstatusProgramacion;
  notas: string | null;
  documento_pago_id: number | null;
  finanzas_operacion_id: number | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  // joined
  proveedor_nombre?: string | null;
  numero_facturas?: number;
  folios_resumen?: string | null;
  // primer documento (backward compat display)
  documento_serie?: string | null;
  documento_numero?: number | null;
  documento_serie_externa?: string | null;
  documento_numero_externo?: number | null;
  documento_folio?: string | null;
  documento_folio_proveedor?: string | null;
  documento_fecha_vencimiento?: string | null;
  cuenta_identificador?: string | null;
  metodo_pago_nombre?: string | null;
  detalles?: ProgramacionPagoDetalle[];
}

export interface ProgramacionPagoInput {
  proveedor_id: number;
  fecha_programada: string;
  moneda: string;
  cuenta_origen_id?: number | null;
  metodo_pago_id?: number | null;
  referencia?: string | null;
  notas?: string | null;
  detalles: Array<{
    documento_id: number;
    monto_programado: number;
  }>;
}

export interface ProgramacionMasivaInput {
  fecha_programada: string;
  cuenta_origen_id?: number | null;
  metodo_pago_id?: number | null;
  referencia?: string | null;
  notas?: string | null;
  facturas: Array<{
    documento_id: number;
    monto_programado: number;
  }>;
}

export interface FinanzasMetodoPago {
  id: number;
  empresa_id: number;
  clave: string;
  nombre: string;
  activo: boolean;
  requiere_referencia: boolean;
  es_efectivo: boolean;
  forma_pago_sat: string | null;
  created_at: string;
}

export interface FinanzasCuenta {
  id: number;
  empresa_id?: number;
  identificador: string;
  numero_cuenta?: string | null;
  tipo_cuenta: string;
  moneda: string;
  saldo: number;
  saldo_inicial?: number;
  saldo_conciliado?: number;
  fecha_ultima_conciliacion?: string | null;
  es_cuenta_efectivo?: boolean;
  afecta_total_disponible?: boolean;
  cuenta_cerrada?: boolean;
  observaciones?: string | null;
}

export type EstadoConciliacion = 'pendiente' | 'cotejado' | 'conciliado';

export interface FinanzasOperacion {
  id: number;
  empresa_id?: number;
  fecha: string;
  tipo_movimiento: TipoMovimiento;
  naturaleza_operacion?: NaturalezaOperacion;
  monto: number;
  moneda?: string;
  tipo_cambio?: number;
  referencia?: string | null;
  observaciones?: string | null;
  cuenta_id: number;
  contacto_id?: number | null;
  contacto_nombre?: string | null;
  documento_origen_id?: number | null;
  documento_origen_tipo_documento?: string | null;
  documento_origen_serie?: string | null;
  documento_origen_numero?: number | null;
  documento_origen_serie_externa?: string | null;
  documento_origen_numero_externo?: number | null;
  documento_origen_total?: number | null;
  factura_id?: number | null;
  es_transferencia?: boolean;
  transferencia_id?: number | null;
  estado_conciliacion?: EstadoConciliacion;
  saldo?: number | null;
  saldo_acumulado?: number | null;
  fecha_creacion?: string;
  concepto_id?: number | null;
  concepto_nombre?: string | null;
  metodo_pago_id?: number | null;
  metodo_pago_nombre?: string | null;
  transferencia_cuenta_origen?: number | null;
  transferencia_cuenta_destino?: number | null;
  transferencia_origen_nombre?: string | null;
  transferencia_destino_nombre?: string | null;
}

export interface ResultadoRecalculoSaldos {
  cuentas_procesadas: number;
  operaciones_procesadas: number;
  cuentas_actualizadas: number;
  operaciones_actualizadas: number;
  ejecutado_en: string;
}

export interface AplicacionOperacion {
  id: number;
  empresa_id: number;
  documento_origen_id: number | null;
  documento_destino_id: number | null;
  monto: number;
  monto_moneda_documento: number;
  fecha_aplicacion: string | null;
  fecha_creacion?: string | null;
  tipo_documento?: string | null;
  serie?: string | null;
  numero?: number | null;
  fecha_documento?: string | null;
  total_documento?: number | null;
  moneda_documento?: string | null;
  tipo_documento_origen?: string | null;
  tipo_documento_destino?: string | null;
}

export interface DocumentoSaldo {
  id: number;
  empresa_id: number;
  tipo_documento: string;
  moneda: string;
  tipo_cambio?: number | null;
  total: number;
  saldo: number;
}

export interface DocumentoAnticipoResumen {
  documento_id: number;
  empresa_id: number;
  tipo_documento: string;
  flujo: 'ventas' | 'compras' | null;
  total_documento: number;
  total_anticipado: number;
  total_aplicado: number;
  disponible_por_aplicar: number;
  pendiente_estimado: number;
  cantidad_operaciones: number;
}

export interface AnticipoDisponible {
  finanzas_operacion_id: number;
  empresa_id: number;
  documento_origen_id: number;
  tipo_movimiento: string;
  naturaleza_operacion: string;
  fecha: string;
  monto_total: number;
  monto_aplicado: number;
  monto_disponible: number;
  contacto_id: number | null;
  contacto_nombre: string | null;
  cuenta_id: number;
  cuenta_identificador: string | null;
  moneda: string | null;
}

export interface DocumentoAnticiposDisponibles {
  documento_id: number;
  empresa_id: number;
  tipo_documento: string;
  flujo: 'ventas' | 'compras' | null;
  anticipos: AnticipoDisponible[];
  total_disponible: number;
}

export interface EstadoCuentaItem {
  id: number;
  contacto_id: number;
  empresa_id: number;
  origen: 'documento' | 'operacion';
  tipo: string;
  moneda: string;
  tipo_cambio?: number | null;
  monto: number;
  saldo: number | null;
  fecha: string;
  serie?: string | null;
  numero?: number | null;
}

export interface TransferenciaPayload {
  cuenta_origen_id: number;
  cuenta_destino_id: number;
  monto: number;
  fecha: string;
  referencia?: string | null;
  observaciones?: string | null;
}

export interface TransferenciaUpdatePayload extends TransferenciaPayload {
  id: number;
}

export interface ConciliacionPayload {
  cuenta_id: number;
  fecha_corte: string;
  saldo_banco: number;
  observaciones?: string | null;
}

export interface Concepto {
  id: number;
  empresa_id?: number;
  nombre_concepto: string;
  es_gasto: boolean;
  activo: boolean;
  cuenta_contable?: string | null;
  rubro_presupuesto_id?: number | null;
  orden?: number | null;
  color?: string | null;
  observaciones?: string | null;
}

// =============================================================================
// Fase 3.4 — Conciliación Bancaria Básica Manual
// =============================================================================

export interface MovimientoConciliacion {
  id: number;
  fecha: string;
  tipo_movimiento: 'Deposito' | 'Retiro';
  naturaleza_operacion: string | null;
  monto: string;
  referencia: string | null;
  observaciones: string | null;
  estado_conciliacion: 'pendiente' | 'cotejado';
  dias_sin_conciliar: number;
  contacto_id: number | null;
  cuenta_nombre: string;
  cuenta_moneda: string;
  contacto_nombre: string | null;
  concepto_nombre: string | null;
  metodo_pago_nombre: string | null;
  documento_tipo_documento: string | null;
  documento_serie: string | null;
  documento_numero: number | null;
  documento_serie_externa: string | null;
  documento_numero_externo: number | null;
}

export interface ConciliacionMovimientosResult {
  movimientos: MovimientoConciliacion[];
  saldo_sistema: number;
  saldo_conciliado_anterior: number;
  total_depositos_cotejados: number;
  total_retiros_cotejados: number;
  saldo_conciliado_calculado: number;
  moneda: string;
}

export interface CierrePayload {
  cuenta_id: number;
  fecha_corte: string;
  saldo_banco: number;
  observaciones?: string | null;
}

export interface CierreResult {
  conciliacion_id: number;
  saldo_banco: number;
  saldo_sistema: number;
  saldo_conciliado_anterior: number;
  total_depositos_cotejados: number;
  total_retiros_cotejados: number;
  saldo_conciliado_calculado: number;
  diferencia: number;
  operaciones_conciliadas: number;
}

export interface HistorialConciliacion {
  id: number;
  cuenta_id: number;
  fecha_corte: string;
  saldo_banco: number;
  saldo_sistema: number | null;
  saldo_conciliado_anterior: number | null;
  total_depositos_cotejados: number | null;
  total_retiros_cotejados: number | null;
  saldo_conciliado_calculado: number | null;
  diferencia: number | null;
  estatus: 'cerrada' | 'anulada';
  fecha_conciliacion: string;
  anulada_en: string | null;
  anulada_por: number | null;
  motivo_anulacion: string | null;
  cantidad_movimientos: number;
  es_ultima_reversible: boolean;
}

export interface DeshacerConciliacionPayload {
  motivo: string;
}

export interface DeshacerConciliacionResult {
  conciliacion_id: number;
  estatus: 'anulada';
  saldo_conciliado_restaurado: number;
  fecha_ultima_conciliacion: string | null;
  movimientos_regresados_a_cotejado: number;
}
