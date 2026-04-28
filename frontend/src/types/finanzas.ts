export type TipoMovimiento = 'Deposito' | 'Retiro';
export type NaturalezaOperacion = 'cobro_cliente' | 'pago_proveedor' | 'movimiento_general';

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
  factura_id?: number | null;
  es_transferencia?: boolean;
  transferencia_id?: number | null;
  estado_conciliacion?: EstadoConciliacion;
  saldo?: number | null;
  fecha_creacion?: string;
  concepto_id?: number | null;
  concepto_nombre?: string | null;
  transferencia_cuenta_origen?: number | null;
  transferencia_cuenta_destino?: number | null;
  transferencia_origen_nombre?: string | null;
  transferencia_destino_nombre?: string | null;
}

export interface OperacionDisponible {
  id: number;
  monto_total: number;
  monto_aplicado: number;
  monto_disponible: number;
}

export interface AplicacionOperacion {
  id: number;
  empresa_id: number;
  finanzas_operacion_id: number | null;
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
  tipo_movimiento?: string | null;
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
