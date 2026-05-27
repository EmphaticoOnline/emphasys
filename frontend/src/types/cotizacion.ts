import type { TipoDocumento } from './documentos.types';

export type TratamientoImpuestos = 'normal' | 'sin_iva' | 'tasa_cero' | 'exento';
export type EstadoSeguimiento = 'abierta' | 'pausada' | 'convertida' | 'perdida' | 'no seleccionada' | 'cancelada';

export interface CotizacionListado {
  id: number;
  motivo_nc?: 'devolucion' | 'bonificacion' | 'otro' | null;
  serie: string | null;
  numero: number | null;
  fecha_documento: string;
  contacto_principal_id: number | null;
  agente_id?: number | null;
  nombre_cliente: string | null;
  subtotal: number;
  descuento_global?: number;
  descuento?: number;
  iva: number;
  total: number;
  estatus_documento: string;
  producto_resumen?: string | null;
  estado_seguimiento?: EstadoSeguimiento | null;
  comentario_seguimiento?: string | null;
  eliminara_oportunidad?: boolean;
  saldo?: number | null;
}

export interface CotizacionDocumento {
  id: number;
  empresa_id: number;
  tipo_documento: TipoDocumento;
  motivo_nc?: 'devolucion' | 'bonificacion' | 'otro' | null;
  concepto_id?: number | null;
  serie: string | null;
  numero: number | null;
  documento_origen_id?: number | null;
  oportunidad_id?: number | null;
  fecha_documento: string;
  contacto_principal_id: number | null;
  agente_id?: number | null;
  moneda: string | null;
  tipo_cambio?: number | null;
  cuenta_financiera_id?: number | null;
  finanzas_operacion_id?: number | null;
  observaciones?: string | null;
  subtotal: number;
  descuento_global?: number;
  descuento?: number;
  iva: number;
  total: number;
  estatus_documento: string;
  usuario_creacion_id?: number | null;
  producto_resumen?: string | null;
  estado_seguimiento?: EstadoSeguimiento | null;
  comentario_seguimiento?: string | null;
  rfc_receptor?: string | null;
  nombre_receptor?: string | null;
  regimen_fiscal_receptor?: string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal_receptor?: string | null;
  tratamiento_impuestos?: TratamientoImpuestos | null;
  saldo?: number | null;
}

export interface CotizacionPartida {
  id: number;
  documento_id: number;
  producto_id: number | null;
  documento_origen_id?: number | null;
  partida_origen_id?: number | null;
  cantidad_vinculada?: number | null;
  descripcion_alterna: string | null;
  cantidad: number;
  precio_unitario: number;
  precio_lista_id?: number | null;
  precio_editado_manual?: boolean;
  precio_origen?: string | null;
  descuento?: number;
  subtotal_partida: number;
  total_partida: number;
  es_parte_oportunidad?: boolean;
  archivo_imagen_1?: string | null;
  producto_archivo_id?: number | null;
  producto_descripcion?: string | null;
  producto_clave?: string | null;
  observaciones?: string | null;
  impuestos?: ImpuestoPartida[];
  impuestos_calculados?: ImpuestoCalculadoUI[];
}

export interface CotizacionDetalle {
  documento: CotizacionDocumento;
  partidas: CotizacionPartida[];
}

export interface ImpuestoPartida {
  impuesto_id: string;
  nombre?: string | null;
  tipo?: string | null;
  tasa: number;
  base?: number | null;
  monto: number;
}

export interface ImpuestoCalculadoUI {
  id?: string | number;
  nombre?: string;
  tipo?: string;
  tasa: number;
  base: number;
  monto: number;
}

export interface CotizacionCrearPayload {
  empresa_id?: number;
  tipo_documento?: TipoDocumento;
  motivo_nc?: 'devolucion' | 'bonificacion' | 'otro' | null;
  concepto_id?: number | null;
  serie?: string | null;
  documento_origen_id?: number | null;
  oportunidad_id?: number | null;
  contacto_principal_id: number | null;
  agente_id?: number | null;
  fecha_documento: string;
  moneda: string | null;
  tipo_cambio?: number | null;
  cuenta_financiera_id?: number | null;
  finanzas_operacion_id?: number | null;
  observaciones?: string | null;
  subtotal: number;
  descuento_global?: number;
  descuento?: number;
  iva?: number;
  total: number;
  usuario_creacion_id?: number | null;
  producto_resumen?: string | null;
  estado_seguimiento?: EstadoSeguimiento | null;
  comentario_seguimiento?: string | null;
  rfc_receptor?: string | null;
  nombre_receptor?: string | null;
  regimen_fiscal_receptor?: string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal_receptor?: string | null;
  tratamiento_impuestos?: TratamientoImpuestos | null;
  aplicaciones_documento?: Array<{
    documento_destino_id: number;
    monto: number;
    monto_moneda_documento: number;
    fecha_aplicacion?: string | null;
  }>;
}

export interface CotizacionPartidaPayload {
  producto_id: number | null;
  descripcion_alterna: string | null;
  cantidad: number;
  precio_unitario: number;
  precio_lista_id?: number | null;
  precio_editado_manual?: boolean;
  precio_origen?: string | null;
  descuento?: number;
  subtotal_partida: number;
  total_partida: number;
  es_parte_oportunidad?: boolean;
  archivo_imagen_1?: string | null;
  producto_archivo_id?: number | null;
  observaciones?: string | null;
  impuestos?: ImpuestoPartida[];
}
