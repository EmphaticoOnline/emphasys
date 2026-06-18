export type TipoMovimientoInventario = 'entrada' | 'salida' | 'transferencia';

export interface MovimientoPartidaPayload {
  producto_id: number;
  almacen_id: number;
  almacen_destino_id?: number | null | undefined;
  cantidad: number;
}

export interface CrearMovimientoManualPayload {
  tipo_movimiento: TipoMovimientoInventario;
  fecha: string; // ISO string
  observaciones?: string | null;
  partidas: MovimientoPartidaPayload[];
}

export interface MovimientoListadoItem {
  id: number;
  fecha: string;
  tipo_movimiento: TipoMovimientoInventario;
  observaciones: string | null;
  usuario_id: number | null;
  usuario_nombre?: string | null;
  documento_id: number | null;
  documento_serie?: string | null;
  documento_numero?: number | null;
}

export interface MovimientoPartidaDetalle {
  id: number;
  producto_id: number | null;
  producto_clave?: string | null;
  producto_descripcion?: string | null;
  almacen_origen_id: number | null;
  almacen_origen_nombre?: string | null;
  almacen_destino_id: number | null;
  almacen_destino_nombre?: string | null;
  cantidad: number;
}

export interface MovimientoDetalle {
  movimiento: {
    id: number;
    fecha: string;
    tipo_movimiento: TipoMovimientoInventario;
    observaciones: string | null;
    usuario_id: number | null;
    usuario_nombre?: string | null;
    documento_id: number | null;
    documento_serie?: string | null;
    documento_numero?: number | null;
  };
  partidas: MovimientoPartidaDetalle[];
}

export interface Almacen {
  id: number;
  nombre: string;
  clave?: string | null;
  descripcion?: string | null;
}
