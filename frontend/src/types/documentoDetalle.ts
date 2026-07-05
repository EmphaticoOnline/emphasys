import type { CotizacionDocumento, CotizacionPartida } from './cotizacion';

export interface PagoAplicado {
  id: number;
  monto_moneda_documento: number;
  monto: number;
  fecha_aplicacion: string | null;
  imp_saldo_ant?: number | null;
  imp_saldo_insoluto?: number | null;
  num_parcialidad?: number | null;
  finanzas_operacion_id: number;
  fecha_pago: string | null;
  referencia?: string | null;
  cuenta_identificador?: string | null;
  metodo_pago_nombre?: string | null;
  documento_pago_id?: number | null;
  documento_pago_serie?: string | null;
  documento_pago_numero?: number | null;
  documento_pago_tipo_documento?: string | null;
  documento_pago_estatus?: string | null;
}

export interface NotaCreditoAplicada {
  id: number;
  monto_moneda_documento: number;
  monto: number;
  fecha_aplicacion: string | null;
  documento_nc_id: number;
  documento_nc_serie: string | null;
  documento_nc_numero: number | null;
  documento_nc_tipo_documento: string;
  documento_nc_fecha: string;
  motivo_nc: 'devolucion' | 'bonificacion' | 'otro' | null;
  documento_nc_total: number;
  documento_nc_estatus: string;
}

export interface DocumentoRelacionado {
  id: number;
  tipo_documento: string;
  serie: string | null;
  numero: number | null;
  fecha_documento: string;
  estatus_documento: string;
  total: number;
  relacion: 'origen' | 'destino';
}

export interface MovimientoInventarioDocumento {
  movimiento_id: number;
  fecha: string;
  tipo_movimiento: string;
  observaciones?: string | null;
  producto_id: number | null;
  producto_clave: string | null;
  producto_descripcion: string | null;
  almacen_origen_id: number | null;
  almacen_origen_nombre: string | null;
  almacen_destino_id: number | null;
  almacen_destino_nombre: string | null;
  cantidad: number;
}

export interface DocumentoDetalleResponse {
  documento: CotizacionDocumento;
  partidas: CotizacionPartida[];
  pagos: PagoAplicado[];
  notasCredito: NotaCreditoAplicada[];
  documentosRelacionados: DocumentoRelacionado[];
  movimientosInventario: MovimientoInventarioDocumento[];
}
