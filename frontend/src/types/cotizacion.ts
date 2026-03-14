import type { TipoDocumento } from './documentos.types';

export type TratamientoImpuestos = 'normal' | 'sin_iva' | 'tasa_cero' | 'exento';

export interface CotizacionListado {
  id: number;
  serie: string | null;
  numero: number | null;
  fecha_documento: string;
  contacto_principal_id: number | null;
  nombre_cliente: string | null;
  subtotal: number;
  iva: number;
  total: number;
  estatus_documento: string;
  saldo?: number | null;
}

export interface CotizacionDocumento {
  id: number;
  empresa_id: number;
  tipo_documento: TipoDocumento;
  serie: string | null;
  numero: number | null;
  fecha_documento: string;
  contacto_principal_id: number | null;
  moneda: string | null;
  observaciones?: string | null;
  subtotal: number;
  iva: number;
  total: number;
  estatus_documento: string;
  usuario_creacion_id?: number | null;
  rfc_receptor?: string | null;
  nombre_receptor?: string | null;
  regimen_fiscal_receptor?: string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal_receptor?: string | null;
  tratamiento_impuestos?: TratamientoImpuestos | null;
}

export interface CotizacionPartida {
  id: number;
  documento_id: number;
  producto_id: number | null;
  descripcion_alterna: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal_partida: number;
  iva_porcentaje?: number | null;
  iva_monto: number;
  total_partida: number;
  producto_descripcion?: string | null;
  producto_clave?: string | null;
  observaciones?: string | null;
}

export interface CotizacionDetalle {
  documento: CotizacionDocumento;
  partidas: CotizacionPartida[];
}

export interface CotizacionCrearPayload {
  empresa_id?: number;
  tipo_documento?: TipoDocumento;
  serie?: string | null;
  contacto_principal_id: number | null;
  fecha_documento: string;
  moneda: string | null;
  observaciones?: string | null;
  subtotal: number;
  iva?: number;
  total: number;
  usuario_creacion_id?: number | null;
  rfc_receptor?: string | null;
  nombre_receptor?: string | null;
  regimen_fiscal_receptor?: string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal_receptor?: string | null;
  tratamiento_impuestos?: TratamientoImpuestos | null;
}

export interface CotizacionPartidaPayload {
  producto_id: number | null;
  descripcion_alterna: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal_partida: number;
  iva_porcentaje?: number | null;
  iva_monto: number;
  total_partida: number;
  observaciones?: string | null;
}
