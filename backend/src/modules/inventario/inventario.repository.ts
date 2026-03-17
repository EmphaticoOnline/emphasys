import pool from '../../config/database';

export type MovimientoRow = {
  id: number;
  fecha: Date;
  tipo_movimiento: string;
  observaciones: string | null;
  usuario_id: number | null;
  usuario_nombre: string | null;
  documento_id: number | null;
};

export type MovimientoPartidaDetalle = {
  id: number;
  producto_id: number | null;
  almacen_origen_id: number | null;
  almacen_destino_id: number | null;
  cantidad: number;
};

export type MovimientoDetalle = {
  movimiento: MovimientoRow;
  partidas: MovimientoPartidaDetalle[];
};

export async function listarMovimientosRepository(empresaId: number): Promise<MovimientoRow[]> {
  const query = `
    SELECT m.id,
           m.fecha,
           m.tipo_movimiento,
           m.observaciones,
       m.usuario_id,
       u.nombre AS usuario_nombre,
           m.documento_id
      FROM inventario.movimientos m
     LEFT JOIN core.usuarios u ON u.id = m.usuario_id
     WHERE m.empresa_id = $1
     ORDER BY m.fecha DESC, m.id DESC
  `;

  const { rows } = await pool.query<MovimientoRow>(query, [empresaId]);
  return rows;
}

export async function obtenerMovimientoDetalleRepository(id: number, empresaId: number): Promise<MovimientoDetalle | null> {
  const headerQuery = `
    SELECT m.id,
           m.fecha,
           m.tipo_movimiento,
           m.observaciones,
           m.usuario_id,
           u.nombre AS usuario_nombre,
           m.documento_id
      FROM inventario.movimientos m
      LEFT JOIN core.usuarios u ON u.id = m.usuario_id
     WHERE m.id = $1
       AND m.empresa_id = $2
     LIMIT 1
  `;

  const partidasQuery = `
    SELECT mp.id,
           mp.producto_id,
           mp.almacen_id AS almacen_origen_id,
           mp.almacen_destino_id,
           mp.cantidad * mp.signo AS cantidad
      FROM inventario.movimientos_partidas mp
     WHERE mp.movimiento_id = $1
       AND mp.empresa_id = $2
     ORDER BY mp.id ASC
  `;

  const { rows: headerRows } = await pool.query<MovimientoRow>(headerQuery, [id, empresaId]);
  const movimiento = headerRows[0];
  if (!movimiento) return null;

  const { rows: partidas } = await pool.query<MovimientoPartidaDetalle>(partidasQuery, [id, empresaId]);

  return {
    movimiento,
    partidas,
  };
}
