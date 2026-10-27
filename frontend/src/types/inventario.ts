export type TipoMovimientoInventario = 'entrada' | 'salida' | 'transferencia';

export interface MovimientoPartidaPayload {
  producto_id: number;
  almacen_id: number;
  almacen_destino_id?: number | null | undefined;
  cantidad: number | string;
  costo_unitario?: number | null;
  sentido?: TipoMovimientoInventario;
}

export interface CrearMovimientoManualPayload {
  tipo_movimiento?: TipoMovimientoInventario | 'mixto';
  fecha: string; // ISO string
  observaciones?: string | null;
  contacto_id?: number | null;
  partidas: MovimientoPartidaPayload[];
}

export interface MovimientoEncabezado {
  id: number;
  serie?: string | null;
  numero?: number | null;
  estatus_afectacion?: 0 | 1 | number;
  es_reversion?: boolean;
  movimiento_origen_id?: number | null;
  fecha: string;
  tipo_movimiento: TipoMovimientoInventario | string;
  observaciones: string | null;
  usuario_id: number | null;
  usuario_nombre?: string | null;
  documento_id: number | null;
  documento_serie?: string | null;
  documento_numero?: number | null;
  documento_serie_externa?: string | null;
  documento_numero_externo?: number | null;
  documento_tipo?: string | null;
  documento_estatus?: string | null;
  documento_fecha?: string | null;
  documento_origen_id?: number | null;
  contacto_id?: number | null;
  contacto_nombre?: string | null;
  contacto_tipo?: string | null;
}

export type MovimientoListadoItem = MovimientoEncabezado;

export interface MovimientoPartidaDetalle {
  id: number;
  producto_id: number | null;
  producto_clave?: string | null;
  producto_descripcion?: string | null;
  almacen_origen_id: number | null;
  almacen_origen_nombre?: string | null;
  almacen_destino_id: number | null;
  almacen_destino_nombre?: string | null;
  tipo_partida?: 'normal' | 'salida_transferencia' | 'entrada_transferencia' | null;
  signo?: number | null;
  cantidad: number | string;
  costo_unitario?: number | string | null;
  existencia_resultante?: number | string | null;
  valor_movimiento?: number | string | null;
}

export interface MovimientoDetalle {
  movimiento: MovimientoEncabezado;
  partidas: MovimientoPartidaDetalle[];
}

export interface Almacen {
  id: number;
  empresa_id?: number;
  nombre: string;
  clave?: string | null;
  tipo?: string | null;
  activo?: boolean;
  created_at?: string;
  updated_at?: string | null;
}
